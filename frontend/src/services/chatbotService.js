// frontend/src/services/chatbotService.js
import api from './api'

export const askChatbot = async (message, sessionKey) => {
  const data = await api.post('/api/chatbot/ask', { message, session_key: sessionKey })
  return data
}