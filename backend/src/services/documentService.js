// backend/src/services/documentService.js
// Service métier pour la gestion des fiches d'intervention PDF.
// Responsabilités :
//   - Initialisation du dossier de stockage physique
//   - Calcul du SHA-256 (détection des doublons)
//   - Génération du nom de fichier normalisé
//   - Écriture du fichier sur le disque
//   - CRUD sur la table pdf_documents
//   - Suppression physique + cascade DB

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dossier de stockage physique des PDFs
// Chemin absolu : backend/storage/pdfs/
export const PDF_STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage', 'pdfs');

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Crée le dossier de stockage s'il n'existe pas.
 * Appelé au démarrage du serveur via app.js.
 */
export async function initStorageDir() {
  await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });
  console.log(`[DocumentService] Dossier de stockage prêt : ${PDF_STORAGE_DIR}`);
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/**
 * Calcule le hash SHA-256 d'un buffer.
 * Utilisé pour détecter les doublons avant d'écrire sur le disque.
 * @param {Buffer} buffer
 * @returns {string} Hash hexadécimal (64 caractères)
 */
export function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Génère un nom de fichier normalisé unique.
 * Format : {timestamp_ms}_{slug}.pdf
 * Exemple : 1720863000000_fiche_intervention_reseau_wifi.pdf
 * @param {string} originalName - Nom original du fichier uploadé
 * @returns {string}
 */
export function generateStoredFilename(originalName) {
  // Extraire le nom sans extension
  const baseName = originalName.replace(/\.pdf$/i, '');

  // Convertir en slug ASCII : minuscules, accents supprimés, espaces → _
  const slug = baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // supprime les diacritiques
    .replace(/[^a-z0-9]+/g, '_')       // remplace les caractères spéciaux par _
    .replace(/^_+|_+$/g, '')           // supprime les _ en début/fin
    .substring(0, 80);                 // limite la longueur du slug

  return `${Date.now()}_${slug}.pdf`;
}

// ─── Vérification des doublons ────────────────────────────────────────────────

/**
 * Vérifie si un document avec ce SHA-256 existe déjà dans la base.
 * @param {string} sha256
 * @returns {object|null} L'enregistrement existant, ou null si aucun doublon
 */
export async function findBySha256(sha256) {
  const { rows } = await pool.query(
    'SELECT id, original_filename, status, created_at FROM pdf_documents WHERE sha256 = $1 LIMIT 1',
    [sha256]
  );
  return rows[0] || null;
}

/**
 * Retourne les statistiques d'indexation pour le diagnostic du pipeline RAG.
 * @returns {object} { total_documents, by_status, total_chunks, documents_with_errors }
 */
export async function getIndexingStats() {
  const totalDocs = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM pdf_documents');
  
  const byStatus = await pool.query(
    `SELECT status, COUNT(*)::INTEGER AS count
     FROM pdf_documents
     GROUP BY status
     ORDER BY status`
  );

  const totalChunks = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM document_chunks');

  const docsWithErrors = await pool.query(
    `SELECT id, original_filename, status, error_message, updated_at
     FROM pdf_documents
     WHERE status = 'error'
     ORDER BY updated_at DESC
     LIMIT 10`
  );

  return {
    total_documents: totalDocs.rows[0].count,
    by_status: byStatus.rows,
    total_chunks: totalChunks.rows[0].count,
    documents_with_errors: docsWithErrors.rows,
  };
}

// ─── Écriture du fichier ──────────────────────────────────────────────────────

/**
 * Écrit le buffer PDF sur le disque dans PDF_STORAGE_DIR.
 * @param {Buffer} buffer
 * @param {string} storedFilename - Nom normalisé généré par generateStoredFilename()
 * @returns {string} Chemin relatif depuis la racine backend (pour stockage en DB)
 */
export async function writeFileToDisk(buffer, storedFilename) {
  const absolutePath = path.join(PDF_STORAGE_DIR, storedFilename);
  await fs.writeFile(absolutePath, buffer);

  // Chemin relatif stocké en base (portable, indépendant de la machine)
  return path.join('storage', 'pdfs', storedFilename);
}

/**
 * Supprime un fichier PDF du disque.
 * Ne lève pas d'exception si le fichier est déjà absent.
 * @param {string} filePath - Chemin relatif depuis la racine backend
 */
export async function deleteFileFromDisk(filePath) {
  try {
    const absolutePath = path.resolve(__dirname, '..', '..', filePath);
    await fs.unlink(absolutePath);
  } catch (err) {
    // ENOENT = fichier déjà supprimé, on ignore silencieusement
    if (err.code !== 'ENOENT') {
      console.warn(`[DocumentService] Impossible de supprimer le fichier ${filePath} :`, err.message);
    }
  }
}

// ─── CRUD base de données ─────────────────────────────────────────────────────

/**
 * Insère un nouveau document dans pdf_documents avec status = 'pending'.
 * @param {object} params
 * @param {string} params.originalFilename
 * @param {string} params.storedFilename
 * @param {string} params.filePath          - Chemin relatif
 * @param {number} params.fileSizeBytes
 * @param {string} params.sha256
 * @param {string} [params.category]
 * @param {string[]} [params.tags]
 * @param {number|null} params.uploadedBy   - ID de l'utilisateur connecté
 * @returns {object} L'enregistrement créé
 */
export async function createDocument({
  originalFilename,
  storedFilename,
  filePath,
  fileSizeBytes,
  sha256,
  category = null,
  tags = [],
  uploadedBy = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO pdf_documents
       (original_filename, stored_filename, file_path,
        file_size_bytes, sha256, category, tags,
        uploaded_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [
      originalFilename,
      storedFilename,
      filePath,
      fileSizeBytes,
      sha256,
      category,
      tags,
      uploadedBy,
    ]
  );
  return rows[0];
}

/**
 * Retourne la liste de tous les documents avec le nombre de chunks associés.
 * @returns {object[]}
 */
export async function listDocuments() {
  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.original_filename,
       d.stored_filename,
       d.file_size_bytes,
       d.page_count,
       d.is_scanned,
       d.category,
       d.tags,
       d.status,
       d.error_message,
       d.indexed_at,
       d.created_at,
       d.updated_at,
       u.username AS uploaded_by_username,
       COUNT(c.id)::INTEGER AS chunk_count
     FROM pdf_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     LEFT JOIN document_chunks c ON c.document_id = d.id
     GROUP BY d.id, u.username
     ORDER BY d.created_at DESC`
  );
  return rows;
}

/**
 * Retourne un document par son ID (avec nombre de chunks).
 * @param {number} id
 * @returns {object|null}
 */
export async function getDocumentById(id) {
  const { rows } = await pool.query(
    `SELECT
       d.*,
       u.username AS uploaded_by_username,
       COUNT(c.id)::INTEGER AS chunk_count
     FROM pdf_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     LEFT JOIN document_chunks c ON c.document_id = d.id
     WHERE d.id = $1
     GROUP BY d.id, u.username`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Supprime un document : efface le fichier physique et l'enregistrement DB.
 * Les chunks sont supprimés automatiquement par ON DELETE CASCADE.
 * @param {number} id
 * @returns {boolean} true si supprimé, false si introuvable
 */
export async function deleteDocument(id) {
  // Récupérer le chemin avant suppression
  const { rows } = await pool.query(
    'SELECT file_path, extracted_text_path FROM pdf_documents WHERE id = $1',
    [id]
  );
  if (!rows[0]) return false;

  const { file_path, extracted_text_path } = rows[0];

  // Supprimer l'enregistrement DB (CASCADE supprime les chunks)
  await pool.query('DELETE FROM pdf_documents WHERE id = $1', [id]);

  // Supprimer les fichiers physiques (silencieux si absents)
  await deleteFileFromDisk(file_path);
  if (extracted_text_path) {
    await deleteFileFromDisk(extracted_text_path);
  }

  return true;
}

/**
 * Remet un document en status 'pending' pour relancer le pipeline d'indexation.
 * Supprime les chunks existants pour éviter les doublons.
 * @param {number} id
 * @returns {object|null} Le document mis à jour, ou null si introuvable
 */
export async function resetDocumentForReindex(id) {
  // Supprimer les chunks existants (l'embedding sera recréé à l'étape 5)
  await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [id]);

  const { rows } = await pool.query(
    `UPDATE pdf_documents
     SET status        = 'pending',
         error_message = NULL,
         indexed_at    = NULL,
         page_count    = NULL,
         is_scanned    = FALSE
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}
