// src/services/documentService.js
import api from './api.js'

export const uploadDocument = async (file, category, tags) => {
  const formData = new FormData()
  formData.append('file', file)
  if (category) formData.append('category', category)
  if (tags && tags.length > 0) formData.append('tags', tags.join(','))
  // formData est déjà construit : on l'envoie directement via api.post
  // (api.upload reconstruit un FormData et écraserait le fichier).
  const data = await api.post('/api/documents/upload', formData)
  return data.data
}

export const getDocuments = async () => {
  const data = await api.get('/api/documents')
  return data.data
}

export const getDocument = async (id) => {
  const data = await api.get(`/api/documents/${id}`)
  return data.data
}

export const deleteDocument = async (id) => {
  await api.delete(`/api/documents/${id}`)
}

export const reindexDocument = async (id) => {
  const data = await api.post(`/api/documents/${id}/reindex`)
  return data.data
}