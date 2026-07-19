// src/routes/assetRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getAssets, getAssetById, createAsset, updateAsset,
  deleteAsset, getAssetStats, getWarrantyAlerts,
  assignAsset, heartbeat, importAssetsFromExcel,
  getAssetServicesList, getAssetDepartmentsList,
} from '../controllers/assetController.js';

import { runADScan } from '../services/networkDiscovery/adScan.js';
import { runSNMPScan } from '../services/networkDiscovery/snmpScan.js';
import { getAssetMLPrediction } from '../controllers/assetController.js';
import { getSettings } from '../services/settingsService.js';

const router = Router();

// Multer pour l'import Excel
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format invalide. Utilisez un fichier .xlsx ou .xls.'));
    }
  },
});

const assetValidation = [
  body('asset_tag').notEmpty().withMessage('Tag asset obligatoire.').trim(),
  body('type').notEmpty().withMessage('Type obligatoire.').trim(),
  body('brand').notEmpty().withMessage('Marque obligatoire.').trim(),
  body('model').notEmpty().withMessage('Modèle obligatoire.').trim(),
  body('status').optional()
    .isIn(['En service', 'En panne', 'En maintenance', 'Retiré'])
    .withMessage('Statut invalide.'),
  body('warranty_end').optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date de fin de garantie invalide.'),
];

// ── Stats et alertes (avant /:id pour éviter conflit de route) ──
router.get('/stats',           authenticate, authorize('Admin','Technicien'), getAssetStats);
router.get('/warranty-alerts', authenticate, authorize('Admin','Technicien'), getWarrantyAlerts);
router.get('/services',        authenticate, getAssetServicesList);
router.get('/departments',     authenticate, getAssetDepartmentsList);

// ── Agent heartbeat (sans auth classique, protégé par API key) ──
router.post('/heartbeat', heartbeat);

// ── Routes statiques — AVANT /:id pour éviter les conflits ──
router.post('/import', authenticate, authorize('Admin'), uploadExcel.single('file'), importAssetsFromExcel);

// ── CRUD ──
router.get('/',      authenticate , getAssets);
router.get('/:id',   authenticate, authorize('Admin','Technicien'), getAssetById);
router.post('/',     authenticate, authorize('Admin','Technicien'), assetValidation, createAsset);
router.put('/:id',   authenticate, authorize('Admin','Technicien'), assetValidation, updateAsset);
router.delete('/:id',authenticate, authorize('Admin'), deleteAsset);

// ── Affectation dédiée ──
router.patch('/:id/assign', authenticate, authorize('Admin'), assignAsset);

// ── ML Prediction ──
router.get('/:id/ml-prediction', authenticate, authorize('Admin', 'Technicien'), getAssetMLPrediction);



// Déclenchement manuel depuis l'interface (Admin uniquement)
router.post('/scan/ad', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const result = await runADScan();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[scan/ad]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du scan AD.' });
  }
});

router.post('/scan/snmp', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { baseIp, start, end } = req.body;
    const s = getSettings();
    const result = await runSNMPScan(baseIp || s.snmp_network_base, start || 1, end || 254);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[scan/snmp]', err);
    res.status(500).json({ success: false, message: 'Erreur lors du scan SNMP.' });
  }
});
export default router;