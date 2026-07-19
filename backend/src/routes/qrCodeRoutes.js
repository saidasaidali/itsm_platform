import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware.js'
import { authorize }    from '../middlewares/roleMiddleware.js'
import {
  generateQrCode,
  regenerateQrCode,
  scanQrCode,
  getQrScanHistory,
} from '../controllers/qrCodeController.js'

const router = Router()

// ✅ Route scan AVANT les routes paramétriques :id
// ✅ authenticate obligatoire — aucun accès sans token valide
router.get(
  '/assets/scan/:token',
  authenticate,
  authorize('Admin', 'Technicien', 'Agent'),
  scanQrCode
)

router.post(
  '/assets/:id/generate',
  authenticate,
  authorize('Admin', 'Technicien'),
  generateQrCode
)

router.post(
  '/assets/:id/regenerate',
  authenticate,
  authorize('Admin'),
  regenerateQrCode
)

router.get(
  '/assets/:id/history',
  authenticate,
  authorize('Admin', 'Technicien'),
  getQrScanHistory
)

export default router