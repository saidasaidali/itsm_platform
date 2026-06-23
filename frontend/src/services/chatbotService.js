// frontend/src/services/chatbotService.js
import api from './api'

export const askChatbot = async (message) => {
  const data = await api.post('/api/chatbot/ask', { message })
  return data
}