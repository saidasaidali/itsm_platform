// frontend/src/components/Chatbot.jsx
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilCommentSquare, cilX, cilSend, cilBook, cilMicrophone } from '@coreui/icons'
import { askChatbot, sendVoiceMessage } from '../services/chatbotService'

const Chatbot = () => {
  const { t, i18n } = useTranslation()
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionKey] = useState(() => {
    let key = localStorage.getItem('chatbot_session_key')
    if (!key) {
      key = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem('chatbot_session_key', key)
    }
    return key
  })
  const bottomRef             = useRef(null)
  const inputRef              = useRef(null)
  const mediaRecorderRef      = useRef(null)
  const audioChunksRef        = useRef([])
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

  const speakText = async (text) => {
    try {
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = 0.9
      utterance.pitch = 1
      
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error('Erreur TTS:', error)
      setIsSpeaking(false)
    }
  }

  const stopSpeaking = () => {
    speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await processVoiceMessage(audioBlob)
        
        // Nettoyer le stream
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Erreur microphone:', error)
      alert('Impossible d\'accéder au microphone. Veuillez autoriser l\'accès au microphone.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processVoiceMessage = async (audioBlob) => {
    setIsTranscribing(true)
    setLoading(true)

    try {
      const data = await sendVoiceMessage(audioBlob, sessionKey)
      
      // Afficher la transcription comme message utilisateur
      const userMsg = { 
        id: Date.now(), 
        role: 'user', 
        text: data.transcript,
        isVoice: true 
      }
      setMessages((prev) => [...prev, userMsg])

      // Afficher la réponse du bot
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: data.answer,
        sources: data.sources || [],
        hasResults: data.hasResults,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (error) {
      console.error('Erreur traitement vocal:', error)
      // Fallback: utiliser l'API Web Speech pour la transcription côté client
      const fallbackTranscript = await transcribeWithWebSpeech()
      if (fallbackTranscript) {
        const userMsg = { 
          id: Date.now(), 
          role: 'user', 
          text: fallbackTranscript,
          isVoice: true 
        }
        setMessages((prev) => [...prev, userMsg])
        
        // Envoyer le texte transcrit au chatbot
        try {
          const data = await askChatbot(fallbackTranscript, sessionKey)
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
        }
      } else {
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          role: 'bot',
          text: t('chatbot.voice_error'),
          sources: [],
        }])
      }
    } finally {
      setIsTranscribing(false)
      setLoading(false)
    }
  }

  const transcribeWithWebSpeech = () => {
    return new Promise((resolve) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Web Speech API non supportée')
        resolve(null)
        return
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'fr-FR'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        resolve(transcript)
      }

      recognition.onerror = (event) => {
        console.error('Erreur reconnaissance vocale:', event.error)
        resolve(null)
      }

      recognition.onend = () => {
        if (!recognition.result) {
          resolve(null)
        }
      }

      recognition.start()
      
      // Timeout après 10 secondes
      setTimeout(() => {
        recognition.stop()
        resolve(null)
      }, 10000)
    })
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now(), role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await askChatbot(text, sessionKey)
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

  const handleMessageClick = async (msg) => {
    if (msg.role === 'bot' && !isSpeaking) {
      await speakText(msg.text)
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
          width: 360, height: 520,
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
            <div style={{ display: 'flex', gap: 8 }}>
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none', color: '#fff', cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 4, fontSize: 11
                  }}
                >
                  {t('chatbot.stop_speaking')}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
              >
                <CIcon icon={cilX} size="sm" />
              </button>
            </div>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.map((msg) => (
              <div key={msg.id}>
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    cursor: msg.role === 'bot' ? 'pointer' : 'default',
                  }}
                  onClick={() => handleMessageClick(msg)}
                  title={msg.role === 'bot' ? t('chatbot.click_to_speak') : ''}
                >
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
                    position: 'relative',
                  }}>
                    {msg.text}
                    {msg.isVoice && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 10,
                        opacity: 0.8,
                      }}>
                        🎤
                      </span>
                    )}
                    {msg.role === 'bot' && !isSpeaking && (
                      <span style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontSize: 10,
                        opacity: 0.5,
                      }}>
                        🔊
                      </span>
                    )}
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

            {(loading || isTranscribing) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--cui-tertiary-bg)',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {isRecording ? (
                    <span style={{ color: '#ef4444', fontSize: 12 }}>🔴 Enregistrement...</span>
                  ) : isTranscribing ? (
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>⏳ Transcription...</span>
                  ) : (
                    [0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--cui-secondary-color)',
                        display: 'inline-block',
                        animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))
                  )}
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
              disabled={isRecording || isTranscribing}
              style={{
                flex: 1, border: '1px solid var(--cui-border-color)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13,
                resize: 'none', outline: 'none',
                background: 'var(--cui-body-bg)',
                color: 'var(--cui-body-color)',
                fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 80, overflowY: 'auto',
                opacity: (isRecording || isTranscribing) ? 0.6 : 1,
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
              }}
            />
            
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || isTranscribing}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: isRecording ? '#ef4444' : (loading || isTranscribing) ? 'var(--cui-secondary-bg)' : '#10b981',
                color: '#fff',
                cursor: (loading || isTranscribing) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0,
                animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
              title={isRecording ? t('chatbot.stop_recording') : t('chatbot.start_recording')}
            >
              <CIcon icon={cilMicrophone} size="sm" />
            </button>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || isRecording || isTranscribing}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: input.trim() && !loading && !isRecording && !isTranscribing ? '#2563eb' : 'var(--cui-secondary-bg)',
                color: input.trim() && !loading && !isRecording && !isTranscribing ? '#fff' : 'var(--cui-secondary-color)',
                cursor: input.trim() && !loading && !isRecording && !isTranscribing ? 'pointer' : 'default',
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
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </>
  )
}

export default Chatbot