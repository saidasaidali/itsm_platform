-- =============================================================================
-- Migration : Module Fiches d'Intervention PDF
-- Version   : 1.1.0
-- Date      : 2026-07-13
-- Description :
--   Ajoute la base documentaire PDF au chatbot ITSM.
--   Ne modifie aucune table existante.
--   Crée uniquement :
--     - Extension pgvector (si absente)
--     - Table pdf_documents  (métadonnées des PDFs)
--     - Table document_chunks (fragments de texte + embeddings vectoriels)
--   Compatible PostgreSQL 15+
--
-- Idempotence :
--   Ce script peut être exécuté plusieurs fois sans erreur.
--   Chaque instruction utilise IF NOT EXISTS, CREATE OR REPLACE,
--   DROP ... IF EXISTS ou un bloc DO $$ pour les cas non couverts.
--
-- Exécution manuelle :
--   psql -U postgres -d itsm_platform -f scripts/pdf-migration.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extension pgvector
--    Pré-requis sur le serveur :
--      Ubuntu/Debian : sudo apt install postgresql-15-pgvector
--      macOS         : brew install pgvector
--    IF NOT EXISTS : idempotent, aucune erreur si déjà activée.
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;


-- -----------------------------------------------------------------------------
-- 2. Table pdf_documents
--    Un enregistrement par fichier PDF uploadé.
--    Le fichier physique est stocké sur le disque (documents/fiches/).
--    Cette table ne contient que le chemin et les métadonnées.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pdf_documents (

  -- Identifiant unique auto-incrémenté
  id                  SERIAL PRIMARY KEY,

  -- Nom original du fichier tel que fourni par l'administrateur
  -- Ex : "Fiche intervention réseau WiFi.pdf"
  original_filename   VARCHAR(255)  NOT NULL,

  -- Nom normalisé généré à l'upload, unique sur le disque
  -- Format : {timestamp_unix}_{slug}.pdf
  -- Ex : "1720863000_fiche_intervention_reseau_wifi.pdf"
  stored_filename     VARCHAR(255)  NOT NULL UNIQUE,

  -- Chemin relatif depuis la racine du backend
  -- Ex : "documents/fiches/1720863000_fiche_intervention_reseau_wifi.pdf"
  file_path           VARCHAR(500)  NOT NULL,

  -- Taille du fichier en octets (renseignée à l'upload)
  file_size_bytes     INTEGER,

  -- Empreinte SHA-256 du fichier (hex, 64 caractères)
  -- Calculée à l'upload pour détecter les doublons avant stockage.
  -- UNIQUE : deux fichiers identiques ne peuvent pas coexister.
  sha256              CHAR(64) UNIQUE,

  -- Nombre de pages du PDF (renseigné après extraction du texte)
  page_count          INTEGER,

  -- TRUE si le PDF est scanné et a nécessité l'OCR Tesseract
  -- FALSE si le PDF contient du texte natif (pdf-parse suffit)
  is_scanned          BOOLEAN      DEFAULT FALSE,

  -- Chemin vers le fichier .txt produit par l'OCR (cache)
  -- Null pour les PDFs natifs (texte extrait directement)
  -- Ex : "documents/extracted/1720863000_fiche_intervention_reseau_wifi.txt"
  extracted_text_path VARCHAR(500),

  -- Catégorie métier du document, choisie par l'admin à l'upload
  -- Valeurs attendues : Réseau, Matériel, Logiciel, Sécurité, Accès, Autre
  category            VARCHAR(100),

  -- Mots-clés libres associés au document par l'admin
  -- Stockés sous forme de tableau PostgreSQL
  -- Ex : ARRAY['wifi','connexion','dépannage']
  tags                TEXT[]       DEFAULT '{}',

  -- Référence à l'administrateur qui a uploadé le document
  -- ON DELETE SET NULL : si l'utilisateur est supprimé, le document reste
  uploaded_by         INTEGER      REFERENCES users(id) ON DELETE SET NULL,

  -- Cycle de vie du document :
  --   pending    → uploadé, en attente de traitement
  --   processing → OCR / chunking / embedding en cours
  --   indexed    → disponible pour la recherche dans le chatbot
  --   error      → une étape du pipeline a échoué (voir error_message)
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'indexed', 'error')),

  -- Message d'erreur lisible si status = 'error'
  -- Ex : "tesseract introuvable - vérifiez l'installation"
  error_message       TEXT,

  -- Horodatage de la fin de l'indexation (status → indexed)
  -- Null tant que le document n'est pas encore indexé
  indexed_at          TIMESTAMP,

  -- Horodatages système
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()

);

-- Index sur status : filtre les documents indexés lors de la recherche
CREATE INDEX IF NOT EXISTS idx_pdf_documents_status
  ON pdf_documents(status);

-- Index sur sha256 : détection rapide des doublons à l'upload
-- (la contrainte UNIQUE crée déjà un index, celui-ci est redondant
--  mais explicitement nommé pour la lisibilité)
CREATE INDEX IF NOT EXISTS idx_pdf_documents_sha256
  ON pdf_documents(sha256);

-- Index sur category : filtrage par catégorie dans l'interface admin
CREATE INDEX IF NOT EXISTS idx_pdf_documents_category
  ON pdf_documents(category);

-- Index GIN sur tags : opérateurs @> et && sur les tableaux
CREATE INDEX IF NOT EXISTS idx_pdf_documents_tags
  ON pdf_documents USING GIN(tags);

-- Index sur uploaded_by : documents d'un administrateur donné
CREATE INDEX IF NOT EXISTS idx_pdf_documents_uploaded_by
  ON pdf_documents(uploaded_by);


-- -----------------------------------------------------------------------------
-- 3. Fonction et trigger updated_at pour pdf_documents
--    CREATE OR REPLACE FUNCTION : idempotent, remplace si elle existe déjà.
--    DROP TRIGGER IF EXISTS avant CREATE TRIGGER : idempotent sur le trigger.
--    (CREATE TRIGGER IF NOT EXISTS n'existe pas en PostgreSQL 15)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_pdf_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pdf_documents_updated_at ON pdf_documents;

CREATE TRIGGER trg_pdf_documents_updated_at
  BEFORE UPDATE ON pdf_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_pdf_documents_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Table document_chunks
--    Un enregistrement par fragment de texte extrait d'un PDF.
--    Contient le texte brut ET son embedding vectoriel (768 dimensions).
--    ON DELETE CASCADE : supprimer un pdf_documents supprime ses chunks.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_chunks (

  -- Identifiant unique auto-incrémenté
  id              SERIAL PRIMARY KEY,

  -- Référence au document source
  -- ON DELETE CASCADE : si le document est supprimé, tous ses chunks le sont aussi
  document_id     INTEGER       NOT NULL
                  REFERENCES pdf_documents(id) ON DELETE CASCADE,

  -- Position du chunk dans le document (0, 1, 2, ...)
  chunk_index     INTEGER       NOT NULL,

  -- Première page du PDF couverte par ce chunk (null si indéterminable)
  page_start      INTEGER,

  -- Dernière page du PDF couverte par ce chunk
  page_end        INTEGER,

  -- Texte brut du chunk (~500 tokens, soit ~350 mots en français)
  -- Injecté dans le prompt du LLM lors de la recherche
  content         TEXT          NOT NULL,

  -- Vecteur d'embedding produit par Ollama nomic-embed-text (768 dimensions)
  -- Null tant que l'embedding n'a pas encore été généré
  embedding       VECTOR(768),

  -- Métadonnées complémentaires au format JSON. Exemple :
  -- {
  --   "document_category": "Réseau",
  --   "document_tags": ["wifi", "connexion"],
  --   "section_title": "Procédure de dépannage"
  -- }
  metadata        JSONB         DEFAULT '{}',

  -- Horodatage de création du chunk
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),

  -- Contrainte : un document ne peut pas avoir deux chunks avec le même index
  CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)

);

-- Index B-tree sur document_id
CREATE INDEX IF NOT EXISTS idx_chunks_document_id
  ON document_chunks(document_id);

-- Index composite pour reconstruire l'ordre de lecture
CREATE INDEX IF NOT EXISTS idx_chunks_index
  ON document_chunks(document_id, chunk_index);

-- Index GIN sur metadata
CREATE INDEX IF NOT EXISTS idx_chunks_metadata
  ON document_chunks USING GIN(metadata);


-- -----------------------------------------------------------------------------
-- 5. Index HNSW pour la recherche vectorielle
--    Traité séparément dans un bloc DO $$ car :
--      - CREATE INDEX ... IF NOT EXISTS sur un index HNSW n'est supporté
--        qu'à partir de pgvector 0.7.0+ / PostgreSQL 17+.
--      - Sur PostgreSQL 15 avec pgvector < 0.7.0, l'instruction échoue.
--      - Le bloc DO $$ vérifie l'existence dans pg_indexes avant de créer,
--        ce qui garantit l'idempotence sur toutes les versions supportées.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  tablename = 'document_chunks'
    AND    indexname = 'idx_chunks_embedding_hnsw'
  ) THEN
    CREATE INDEX idx_chunks_embedding_hnsw
      ON document_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  END IF;
END$$;


-- -----------------------------------------------------------------------------
-- 6. Commentaires de documentation
-- -----------------------------------------------------------------------------

COMMENT ON TABLE pdf_documents IS
  'Métadonnées des fiches d''intervention PDF. Fichiers physiques dans documents/fiches/.';

COMMENT ON TABLE document_chunks IS
  'Fragments de texte extraits des PDFs avec embeddings vectoriels (nomic-embed-text, 768 dims).';

COMMENT ON COLUMN pdf_documents.status IS
  'Cycle de vie : pending → processing → indexed | error';

COMMENT ON COLUMN document_chunks.embedding IS
  'Vecteur 768 dims (nomic-embed-text). Recherche : ORDER BY embedding <=> $query LIMIT N';
