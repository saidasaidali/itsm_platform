// frontend/src/services/qrCodeService.js
import api from './api.js'

export const generateQrCode = async (assetId) => {
  const res = await api.post(`/api/qr/assets/${assetId}/generate`)
  if (!res.success) throw new Error(res.message || 'Erreur génération QR')
  return res.data  // { token, url, qrSvg }
}

export const regenerateQrCode = async (assetId) => {
  const res = await api.post(`/api/qr/assets/${assetId}/regenerate`)
  if (!res.success) throw new Error(res.message || 'Erreur régénération QR')
  return res.data
}

export const scanQrCode = async (token) => {
  const res = await api.get(`/api/qr/assets/scan/${token}`)
  if (!res.success) throw new Error(res.message || 'QR Code invalide')
  return res
}

export const getQrScanHistory = async (assetId) => {
  const res = await api.get(`/api/qr/assets/${assetId}/history`)
  if (!res.success) throw new Error(res.message || 'Erreur historique')
  return res.data
}