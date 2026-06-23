// frontend/src/components/Chatbot.jsx
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilCommentSquare, cilX, cilSend, cilBook } from '@coreui/icons'
import { askChatbot } from '../services/chatbotService'

const Chatbot = () => {
  const { t, i18n } = useTranslation()
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef(null)
  const inputRef              = useRef(null)
  const navigate              = useNavigate()

  useEffect(() => {
    setMessages([{
      id: 0,
      role: 'bot',
      text: t('chatbot.welcome'),
      sources: [],
    }])
  }, [i18n.language, t])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now(), role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await askChatbot(text)
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: data.answer,
        sources: data.sources || [],
        hasResults: data.hasResults,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: t('chatbot.error'),
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1050,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(59,130,246,0.55)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)'
        }}
        title={t('chatbot.button_title')}
      >
        <CIcon icon={open ? cilX : cilCommentSquare} size="lg" />
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 28, zIndex: 1049,
          width: 360, height: 500,
          background: 'var(--cui-body-bg)',
          border: '1px solid var(--cui-border-color)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #1a1f35, #2563eb)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t('chatbot.title')}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                {t('chatbot.subtitle')}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
            >
              <CIcon icon={cilX} size="sm" />
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '82%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? '#2563eb'
                      : 'var(--cui-tertiary-bg)',
                    color: msg.role === 'user' ? '#fff' : 'var(--cui-body-color)',
                    fontSize: 13, lineHeight: 1.55,
                  }}>
                    {msg.text}
                  </div>
                </div>

                {msg.sources?.length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 4 }}>
                    <div style={{
                      fontSize: 11, color: 'var(--cui-secondary-color)',
                      marginBottom: 4, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {t('chatbot.related_articles')}
                    </div>
                    {msg.sources.map((src) => (
                      <div
                        key={src.id}
                        onClick={() => navigate(`/knowledge/${src.id}`)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                          background: 'var(--cui-tertiary-bg)',
                          border: '1px solid var(--cui-border-color)',
                          cursor: 'pointer', transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--cui-border-color)' }}
                      >
                        <CIcon icon={cilBook} size="sm"
                          style={{ color: '#2563eb', flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{
                            fontSize: 12, fontWeight: 600,
                            color: 'var(--cui-body-color)', marginBottom: 2,
                          }}>
                            {src.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                            {src.summary?.slice(0, 70)}{src.summary?.length > 70 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--cui-tertiary-bg)',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--cui-secondary-color)',
                      display: 'inline-block',
                      animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--cui-border-color)',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatbot.placeholder')}
              rows={1}
              style={{
                flex: 1, border: '1px solid var(--cui-border-color)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13,
                resize: 'none', outline: 'none',
                background: 'var(--cui-body-bg)',
                color: 'var(--cui-body-color)',
                fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 80, overflowY: 'auto',
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: input.trim() && !loading ? '#2563eb' : 'var(--cui-secondary-bg)',
                color: input.trim() && !loading ? '#fff' : 'var(--cui-secondary-color)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <CIcon icon={cilSend} size="sm" />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}

export default Chatbot
