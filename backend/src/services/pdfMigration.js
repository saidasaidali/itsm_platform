// backend/src/services/pdfMigration.js
// Migration automatique pour le module de fiches d'intervention PDF.
// Crée les tables pdf_documents et document_chunks (et l'extension pgvector)
// si elles n'existent pas encore.
//
// Suivi du même pattern que smartAssistantMigration.js : exécuté au démarrage
// du serveur depuis app.js. Idempotent (CREATE TABLE IF NOT EXISTS).
import pool from '../db.js';

export async function runPdfMigration() {
  try {
    console.log('[Migration] Vérification/création des tables PDF (pdf_documents / document_chunks)...');

    // 1. Extension pgvector (requise pour la colonne embedding VECTOR(768))
    //    Si l'extension n'est pas installée sur le serveur PostgreSQL, on
    //    continue quand même : la table pdf_documents (upload) fonctionne sans
    //    pgvector, seule l'indexation vectorielle (document_chunks) en dépend.
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    } catch (extErr) {
      console.warn(
        '[Migration] ⚠️ Extension pgvector indisponible sur ce serveur PostgreSQL. ' +
        'L\'indexation vectorielle (embeddings) sera désactivée jusqu\'à son installation. ' +
        'Détail : ' + extErr.message
      );
    }

    // 2. Table pdf_documents (métadonnées des PDF uploadés)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pdf_documents (
        id                  SERIAL PRIMARY KEY,
        original_filename   VARCHAR(255)  NOT NULL,
        stored_filename     VARCHAR(255)  NOT NULL UNIQUE,
        file_path           VARCHAR(500)  NOT NULL,
        file_size_bytes     INTEGER,
        sha256              CHAR(64) UNIQUE,
        page_count          INTEGER,
        is_scanned          BOOLEAN      DEFAULT FALSE,
        extracted_text_path VARCHAR(500),
        category            VARCHAR(100),
        tags                TEXT[]       DEFAULT '{}',
        uploaded_by         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
        error_message       TEXT,
        indexed_at          TIMESTAMP,
        created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);

    // 2b. Ajout des colonnes manquantes si la table existait déjà
    //     (CREATE TABLE IF NOT EXISTS ne modifie pas une table existante).
    //     La colonne sha256 est critique : sans elle, l'upload renvoie 500.
    await pool.query(`
      ALTER TABLE pdf_documents
        ADD COLUMN IF NOT EXISTS sha256 CHAR(64) UNIQUE,
        ADD COLUMN IF NOT EXISTS page_count INTEGER,
        ADD COLUMN IF NOT EXISTS is_scanned BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS extracted_text_path VARCHAR(500),
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS error_message TEXT,
        ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_documents_status    ON pdf_documents(status);
      CREATE INDEX IF NOT EXISTS idx_pdf_documents_sha256    ON pdf_documents(sha256);
      CREATE INDEX IF NOT EXISTS idx_pdf_documents_category  ON pdf_documents(category);
      CREATE INDEX IF NOT EXISTS idx_pdf_documents_tags      ON pdf_documents USING GIN(tags);
      CREATE INDEX IF NOT EXISTS idx_pdf_documents_uploaded_by ON pdf_documents(uploaded_by);
    `);

    // Trigger updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_pdf_documents_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_pdf_documents_updated_at ON pdf_documents;
      CREATE TRIGGER trg_pdf_documents_updated_at
        BEFORE UPDATE ON pdf_documents
        FOR EACH ROW
        EXECUTE FUNCTION update_pdf_documents_updated_at();
    `);

    // 3. Table document_chunks (fragments + embeddings vectoriels)
    //    Nécessite l'extension vector. Si elle a échoué plus haut, on loggue
    //    une erreur claire mais on ne fait pas crasher le démarrage du serveur
    //    (l'upload des PDF reste fonctionnel, seule l'indexation échouera).
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id          SERIAL PRIMARY KEY,
          document_id INTEGER       NOT NULL
                      REFERENCES pdf_documents(id) ON DELETE CASCADE,
          chunk_index INTEGER       NOT NULL,
          page_start  INTEGER,
          page_end    INTEGER,
          content     TEXT          NOT NULL,
          embedding   VECTOR(768),
          metadata    JSONB         DEFAULT '{}',
          created_at  TIMESTAMP     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_index       ON document_chunks(document_id, chunk_index);
        CREATE INDEX IF NOT EXISTS idx_chunks_metadata    ON document_chunks USING GIN(metadata);
      `);

      // Index HNSW (pgvector 0.7+ / PostgreSQL 17+). Idempotent via bloc DO $$.
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'document_chunks'
              AND indexname = 'idx_chunks_embedding_hnsw'
          ) THEN
            CREATE INDEX idx_chunks_embedding_hnsw
              ON document_chunks USING hnsw (embedding vector_cosine_ops)
              WITH (m = 16, ef_construction = 64);
          END IF;
        END$$;
      `);
    } catch (chunksErr) {
      console.error(
        '[Migration] ❌ Impossible de créer la table document_chunks (dépend de pgvector). ' +
        'L\'upload des PDF fonctionne, mais l\'indexation/recherche RAG sera indisponible. ' +
        'Détail : ' + chunksErr.message
      );
    }

    console.log('[Migration] ✅ Tables PDF vérifiées/créées avec succès.');
    return { success: true, message: 'Migration PDF terminée' };
  } catch (error) {
    console.error('[Migration] ❌ Erreur lors de la migration PDF:', error.message);
    throw error;
  }
}

export default { runPdfMigration };