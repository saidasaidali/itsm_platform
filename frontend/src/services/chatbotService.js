// frontend/src/services/chatbotService.js
import api from './api'

export const askChatbot = async (message, sessionKey) => {
  const data = await api.post('/api/chatbot/ask', { message, session_key: sessionKey })
  return data
}

export const sendVoiceMessage = async (audioBlob, sessionKey) => {
  console.log('[Voice] Envoi message vocal');
  console.log('[Voice] Blob size:', audioBlob.size, 'type:', audioBlob.type);
  
  const formData = new FormData()
  formData.append('audio', audioBlob, 'audio.webm')
  formData.append('session_key', sessionKey)
  
  console.log('[Voice] FormData créé, envoi vers /api/chatbot/voice');
  
  const data = await api.post('/api/chatbot/voice', formData)
  console.log('[Voice] Réponse reçue:', data);
  
  return data
}
