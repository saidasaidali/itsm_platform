// backend/src/controllers/documentController.js
// Contrôleur HTTP pour la gestion des fiches d'intervention PDF.
// Gère : upload, liste, détail, suppression, réindexation.
// L'OCR et les embeddings sont déclenchés à l'étape 3 (pdfIndexer).

import asyncHandler from '../middlewares/asyncHandler.js';
import { validateId } from '../utils/validationUtils.js';
import {
  computeSha256,
  generateStoredFilename,
  findBySha256,
  writeFileToDisk,
  createDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
  resetDocumentForReindex,
  getIndexingStats,
} from '../services/documentService.js';
import pdfIndexer from '../services/pdfIndexer.js';

// ─── POST /api/documents/upload ───────────────────────────────────────────────
/**
 * Upload d'un fichier PDF.
 * Multer (configuré dans documentRoutes.js) dépose le fichier dans req.file.
 * Vérifie le SHA-256 pour rejeter les doublons.
 * Enregistre le fichier sur le disque et l'entrée en base (status = 'pending').
 * Ne lance PAS l'OCR ni les embeddings (étape 3).
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  // Multer doit avoir déposé le fichier dans req.file.
  // Si absent (requête mal formée, champ incorrect, ou fichier filtré),
  // on renvoie 400 propre au lieu de crasher avec un 500.
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      message: 'Aucun fichier PDF reçu. Vérifiez que le champ "file" est bien présent et qu\'un fichier est sélectionné.',
    });
  }

  const { originalname, buffer, size } = req.file;
  const userId = req.user?.id || null;

  // Champs optionnels du body
  const category = req.body.category?.trim() || null;
  const rawTags  = req.body.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map(t => t.trim()).filter(Boolean)
    : typeof rawTags === 'string'
      ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

  // 1. Calcul du SHA-256
  const sha256 = computeSha256(buffer);

  // 2. Vérification doublon
  const existing = await findBySha256(sha256);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Ce fichier existe déjà (enregistré le ${new Date(existing.created_at).toLocaleDateString('fr-FR')} sous le nom "${existing.original_filename}").`,
      data: {
        existing_id: existing.id,
        original_filename: existing.original_filename,
        status: existing.status,
      },
    });
  }

  // 3. Génération du nom normalisé et écriture sur le disque
  const storedFilename = generateStoredFilename(originalname);
  const filePath = await writeFileToDisk(buffer, storedFilename);

  // 4. Enregistrement en base (status = 'pending')
  const document = await createDocument({
    originalFilename : originalname,
    storedFilename,
    filePath,
    fileSizeBytes    : size,
    sha256,
    category,
    tags,
    uploadedBy       : userId,
  });

   // TEMP DEBUG
   console.log(`[TEMP DEBUG] Sur le point d'appeler indexDocument pour document.id=${document.id}`);
   
   // Lancer l'indexation en arrière-plan (non-bloquant)
   pdfIndexer.indexDocument(document.id).catch((err) => {
     // TEMP DEBUG
     console.log(`[TEMP DEBUG] Le .catch() de indexDocument a été déclenché`);
     console.error(`[documentController] Erreur indexation auto document #${document.id}:`, err.message);
   });

  return res.status(201).json({
    success : true,
    message : 'Fichier uploadé avec succès. Indexation en attente.',
    data    : document,
  });
});

// ─── GET /api/documents ───────────────────────────────────────────────────────
/**
 * Liste tous les documents avec leur statut et leur nombre de chunks.
 */
export const getDocuments = asyncHandler(async (req, res) => {
  const documents = await listDocuments();
  return res.json({ success: true, data: documents });
});

// ─── GET /api/documents/:id ───────────────────────────────────────────────────
/**
 * Détail d'un document par son ID.
 */
export const getDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const document = await getDocumentById(Number(id));
  if (!document) {
    return res.status(404).json({ success: false, message: 'Document introuvable.' });
  }

  return res.json({ success: true, data: document });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
/**
 * Supprime un document : fichier physique + enregistrement DB + chunks (CASCADE).
 */
export const removeDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const deleted = await deleteDocument(Number(id));
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Document introuvable.' });
  }

  return res.json({ success: true, message: 'Document supprimé avec succès.' });
});

// ─── GET /api/documents/indexing/status ───────────────────────────────────────
/**
 * Retourne les statistiques d'indexation du pipeline RAG PDF.
 * Utile pour le diagnostic sans interroger la base manuellement.
 */
export const getIndexingStatus = asyncHandler(async (req, res) => {
  const stats = await getIndexingStats();
  return res.json({ success: true, data: stats });
});

// ─── POST /api/documents/:id/reindex ─────────────────────────────────────────
/**
 * Remet le document en status 'pending' et supprime ses chunks existants.
 * Le pipeline d'indexation (OCR → chunking → embeddings) sera déclenché
 * à l'étape 3 via pdfIndexer.
 */
export const reindexDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const document = await resetDocumentForReindex(Number(id));
  if (!document) {
    return res.status(404).json({ success: false, message: 'Document introuvable.' });
  }

  // Lancer la réindexation en arrière-plan (non-bloquant)
  pdfIndexer.indexDocument(document.id).catch((err) => {
    console.error(`[documentController] Erreur réindexation document #${document.id}:`, err.message);
  });

  return res.json({
    success : true,
    message : 'Document remis en attente de réindexation.',
    data    : document,
  });
});
