import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../services/api'
import { CButton } from '@coreui/react'

const ChatbotWidget = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const [sessionKey] = useState(() => {
    let key = localStorage.getItem('chatbot-session-key')
    if (!key) {
      key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      localStorage.setItem('chatbot-session-key', key)
    }
    return key
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (text = input) => {
    if (!text.trim()) return
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    try {
      const res = await api.post('/api/chatbot/message', {
        session_key: sessionKey,
        message: text
      })
      if (res.success) {
        const botMsg = { role: 'bot', content: res.data.text, actions: res.data.actions }
        setMessages(prev => [...prev, botMsg])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'bot', content: t('chatbot.widget.error') }])
    }
    setIsTyping(false)
  }

  const handleAction = (action) => {
    if (action.type === 'create_ticket' || action.type === 'confirm_ticket') {
      window.location.href = '#/tickets/create'
    } else if (action.type === 'view_article') {
      window.location.href = `#/knowledge/${action.id}`
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      {!isOpen && (
        <CButton
          color="primary"
          shape="rounded-pill"
          style={{ width: '60px', height: '60px', fontSize: '24px' }}
          onClick={() => setIsOpen(true)}
        >
          🤖
        </CButton>
      )}
      {isOpen && (
        <div style={{
          width: '380px',
          height: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#321fdb',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <strong>{t('chatbot.widget.title')}</strong>
            <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }} onClick={() => setIsOpen(false)}>×</button>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '16px',
                backgroundColor: msg.role === 'user' ? '#321fdb' : '#f0f2f5',
                color: msg.role === 'user' ? 'white' : 'black'
              }}>
                <div>{msg.content}</div>
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {msg.actions.map((action, aIdx) => (
                      <CButton
                        key={aIdx}
                        size="sm"
                        color={msg.role === 'user' ? 'light' : 'primary'}
                        variant={msg.role === 'user' ? 'outline' : 'solid'}
                        onClick={() => handleAction(action)}
                      >
                        {action.label}
                      </CButton>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', backgroundColor: '#f0f2f5', borderRadius: '16px' }}>
                <span>...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '16px', borderTop: '1px solid #eee', display: 'flex', gap: '8px' }}>
            <input
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
               placeholder={t('chatbot.widget.placeholder')}
            />
              <CButton color="primary" onClick={() => sendMessage()}>{t('chatbot.widget.send')}</CButton>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatbotWidget
