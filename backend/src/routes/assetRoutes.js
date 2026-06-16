// src/routes/assetRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getAssets, getAssetById, createAsset, updateAsset,
  deleteAsset, getAssetStats, getWarrantyAlerts,
  assignAsset, heartbeat,
} from '../controllers/assetController.js';

const router = Router();

const assetValidation = [
  body('asset_tag').notEmpty().withMessage('Tag asset obligatoire.').trim(),
  body('type').notEmpty().withMessage('Type obligatoire.').trim(),
  body('brand').notEmpty().withMessage('Marque obligatoire.').trim(),
  body('model').notEmpty().withMessage('Modèle obligatoire.').trim(),
  body('status').optional()
    .isIn(['En service', 'En panne', 'En maintenance', 'Retiré'])
    .withMessage('Statut invalide.'),
  body('warranty_end').optional().isDate()
    .withMessage('Date de fin de garantie invalide.'),
];

// ── Stats et alertes (avant /:id pour éviter conflit de route) ──
router.get('/stats',           authenticate, authorize('Admin','Technicien'), getAssetStats);
router.get('/warranty-alerts', authenticate, authorize('Admin','Technicien'), getWarrantyAlerts);

// ── Agent heartbeat (sans auth classique, protégé par API key) ──
router.post('/heartbeat', heartbeat);

// ── CRUD ──
router.get('/',      authenticate , getAssets);
router.get('/:id',   authenticate, authorize('Admin','Technicien'), getAssetById);
router.post('/',     authenticate, authorize('Admin','Technicien'), assetValidation, createAsset);
router.put('/:id',   authenticate, authorize('Admin','Technicien'), assetValidation, updateAsset);
router.delete('/:id',authenticate, authorize('Admin'), deleteAsset);

// ── Affectation dédiée ──
router.patch('/:id/assign', authenticate, authorize('Admin'), assignAsset);

export default router;