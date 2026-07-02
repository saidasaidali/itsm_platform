// backend/src/controllers/qrCodeController.js
import pool from '../db.js'
import { t } from '../utils/i18n.js'
import QRCode from 'qrcode'
import {
  assignQrToken,
  getAssetByQrToken,
  logScan,
  getScanHistory,
} from '../services/qrCodeService.js'
import asyncHandler from '../middlewares/asyncHandler.js'

// ─── POST /api/qr/assets/:id/generate ────────────────────────────────────────
export const generateQrCode = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') })
  }

  const { rows } = await pool.query(
    'SELECT id, asset_tag, qr_token FROM assets WHERE id = $1',
    [id]
  )
  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'asset_not_found') })
  }

  // Réutiliser le token existant ou en générer un nouveau
  let token = rows[0].qr_token
  if (!token) {
    token = await assignQrToken(id)
  }

  // ✅ URL compatible HashRouter — /#/ obligatoire
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
  const qrUrl   = `${baseUrl}/#/assets/scan/${token}`

  // SVG uniquement — aucune donnée sensible dans le QR
  const qrSvg = await QRCode.toString(qrUrl, {
    type:   'svg',
    width:  300,
    margin: 2,
  })

  return res.json({
    success: true,
    data: { token, url: qrUrl, qrSvg },
  })
});

// ─── POST /api/qr/assets/:id/regenerate ──────────────────────────────────────
export const regenerateQrCode = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') })
  }

  const { rows } = await pool.query(
    'SELECT id, asset_tag FROM assets WHERE id = $1',
    [id]
  )
  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'asset_not_found') })
  }

  // Force un nouveau token (invalide l'ancien QR imprimé)
  const token   = await assignQrToken(id)

  // ✅ URL compatible HashRouter
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001'
  const qrUrl   = `${baseUrl}/#/assets/scan/${token}`

  const qrSvg = await QRCode.toString(qrUrl, {
    type:   'svg',
    width:  300,
    margin: 2,
  })

  return res.json({
    success: true,
    data: { token, url: qrUrl, qrSvg },
  })
});

// ─── GET /api/qr/assets/scan/:token ──────────────────────────────────────────
// ✅ Authentification et rôle vérifiés par les middlewares avant d'arriver ici
// ✅ userId toujours présent (req.user garanti par authenticate)
// ✅ Message neutre si asset introuvable — ne révèle rien
export const scanQrCode = asyncHandler(async (req, res) => {
  const { token } = req.params

  const asset = await getAssetByQrToken(token)

  if (!asset) {
    return res.status(404).json({
      success: false,
      message: 'QR Code invalide ou équipement introuvable.',
    })
  }

  // ✅ Log avec userId garanti, IP et user-agent
  const userId    = req.user.id
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim()
                 || req.socket?.remoteAddress
                 || null
  const userAgent = req.headers['user-agent'] || null

  await logScan(asset.id, userId, ipAddress, userAgent)

  const history = await getScanHistory(asset.id)

  return res.json({
    success: true,
    data: {
      id:               asset.id,
      asset_tag:        asset.asset_tag,
      type:             asset.type,
      brand:            asset.brand,
      model:            asset.model,
      status:           asset.status,
      location:         asset.location,
      department:       asset.department,
      serial_number:    asset.serial_number,
      assigned_to_name: asset.assigned_to_name,
      scan_count:       history.length,
    },
  })
});

// ─── GET /api/qr/assets/:id/history ──────────────────────────────────────────
export const getQrScanHistory = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') })
  }

  const history = await getScanHistory(id)
  return res.json({ success: true, data: history })
});