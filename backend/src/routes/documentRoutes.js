// backend/src/routes/documentRoutes.js
// Routes REST pour la gestion des fiches d'intervention PDF.
// Toutes les routes sont protégées par authenticate.
// Les routes d'écriture (upload, delete, reindex) sont réservées aux Admins.

import { Router }   from 'express';
import multer       from 'multer';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize }    from '../middlewares/roleMiddleware.js';
import {
  uploadDocument,
  getDocuments,
  getDocument,
  removeDocument,
  reindexDocument,
} from '../controllers/documentController.js';

const router = Router();

// ─── Multer : stockage en mémoire, validation MIME + taille ──────────────────
// Le fichier est transmis en mémoire (buffer) à documentService.js
// qui se charge de l'écrire sur le disque dans storage/pdfs/.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 50 * 1024 * 1024, // 50 Mo maximum
  },

  fileFilter: (_req, file, cb) => {
    // Accepter uniquement les PDFs (MIME + extension)
    const isMimePdf = file.mimetype === 'application/pdf';
    const isExtPdf  = file.originalname.toLowerCase().endsWith('.pdf');

    if (isMimePdf && isExtPdf) {
      return cb(null, true);
    }

    // Rejeter tout autre format avec un message explicite
    cb(
      Object.assign(new Error('Seuls les fichiers PDF sont acceptés.'), {
        status: 415,
      })
    );
  },
});

// Gestionnaire d'erreur Multer : transforme les erreurs multer en JSON propre
// (taille dépassée, mauvais type) sans faire crasher le serveur.
const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success : false,
        message : 'Fichier trop volumineux. La taille maximale autorisée est 50 Mo.',
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.status === 415) {
    return res.status(415).json({ success: false, message: err.message });
  }
  next(err);
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/documents/upload
 * Upload d'un PDF.
 * Body (multipart/form-data) :
 *   - file     : fichier PDF (requis)
 *   - category : string optionnel (Réseau, Matériel, Logiciel, Sécurité, Accès, Autre)
 *   - tags     : string CSV ou tableau optionnel (ex: "wifi,connexion")
 */
router.post(
  '/upload',
  authenticate,
  authorize('Admin'),
  upload.single('file'),
  handleMulterError,
  uploadDocument
);

/**
 * GET /api/documents
 * Liste tous les documents avec statut et nombre de chunks.
 */
router.get(
  '/',
  authenticate,
  authorize('Admin'),
  getDocuments
);

/**
 * GET /api/documents/:id
 * Détail d'un document.
 */
router.get(
  '/:id',
  authenticate,
  authorize('Admin'),
  getDocument
);

/**
 * DELETE /api/documents/:id
 * Supprime un document (fichier physique + DB + chunks).
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Admin'),
  removeDocument
);

/**
 * POST /api/documents/:id/reindex
 * Remet le document en 'pending' pour relancer le pipeline.
 */
router.post(
  '/:id/reindex',
  authenticate,
  authorize('Admin'),
  reindexDocument
);

export default router;
