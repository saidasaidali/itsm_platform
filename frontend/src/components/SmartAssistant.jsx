// frontend/src/components/SmartAssistant.jsx
// Smart IT Assistant - Chatbot intelligent avec analyse complète
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useContext } from 'react'
import CIcon from '@coreui/icons-react'
import { 
  cilCommentSquare, cilX, cilSend, cilBook, cilMicrophone,
  cilChart, cilShieldAlt, cilSpeedometer, cilUser 
} from '@coreui/icons'
import { AuthContext } from '../auth/AuthProvider'
import { sendMessage as sendSmartMessage, analyzeMessage, getSentimentColor, getSentimentIcon, getPriorityColor, getRiskLevelColor, formatProcessingTime } from '../services/smartAssistantService'

const SmartAssistant = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionKey, setSessionKey] = useState(() => {
    // Le session_key est maintenant généré dynamiquement selon l'utilisateur connecté
    // pour garantir l'isolation des conversations
    const userId = localStorage.getItem('user_id') || 'anonymous'
    const key = `smart-session-user-${userId}-${Date.now()}`
    return key
  })
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isRTL, setIsRTL] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const navigate = useNavigate()

  useEffect(() => {
    setMessages([{
      id: 0,
      role: 'bot',
      text: t('smartAssistant.welcome_message'),
      analysis: null,
      sources: [],
    }])
  }, [i18n.language, t])

  // Detect Arabic and set RTL
  useEffect(() => {
    const lastBotMessage = messages.filter(m => m.role === 'bot').pop();
    if (lastBotMessage?.text) {
      const arabicPattern = /[\u0600-\u06FF]/;
      setIsRTL(arabicPattern.test(lastBotMessage.text));
    }
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Réinitialiser la session et les messages quand l'utilisateur change
  useEffect(() => {
    const userId = localStorage.getItem('user_id') || 'anonymous'
    const currentSessionKey = `smart-session-user-${userId}-${Date.now()}`
    setSessionKey(currentSessionKey)
    // Réinitialiser les messages pour la nouvelle session
    setMessages([{
      id: 0,
      role: 'bot',
      text: t('smartAssistant.welcome_message'),
      analysis: null,
      sources: [],
    }])
  }, [localStorage.getItem('user_id'), t])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const speakText = async (text) => {
    try {
      setIsSpeaking(true)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = i18n.language === 'ar' ? 'ar-SA' : 'fr-FR'
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
      alert(t('smartAssistant.microphone_error'))
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
      // Utiliser l'API Web Speech pour la transcription côté client
      const transcript = await transcribeWithWebSpeech()
      if (transcript) {
        await processUserMessage(transcript, true)
      } else {
        throw new Error(t('smartAssistant.transcription_failed'))
      }
    } catch (error) {
      console.error('Erreur traitement vocal:', error)
      setMessages((prev) => [...prev, {
        id: Date.now(),
        role: 'bot',
        text: t('smartAssistant.voice_processing_failed'),
        analysis: null,
        sources: [],
      }])
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
      recognition.lang = i18n.language === 'ar' ? 'ar-SA' : 'fr-FR'
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

  const processUserMessage = async (text, isVoice = false) => {
    const userMsg = { 
      id: Date.now(), 
      role: 'user', 
      text,
      isVoice 
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await sendSmartMessage(text, sessionKey)
      
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: data.data.response,
        analysis: data.data.analysis,
        sources: data.data.sources || [],
        metadata: data.data.metadata,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (error) {
      console.error('Erreur Smart Assistant:', error)
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: t('smartAssistant.error_generic'),
        analysis: null,
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    await processUserMessage(text, false)
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

  const renderAnalysis = (analysis) => {
    if (!analysis) return null

    return (
      <div style={{
        marginTop: 12,
        padding: 12,
        background: 'var(--cui-tertiary-bg)',
        borderRadius: 8,
        border: '1px solid var(--cui-border-color)',
        fontSize: 12,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          cursor: 'pointer',
        }} onClick={() => setShowAnalysis(!showAnalysis)}>
          <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
            {t('smartAssistant.analysis.detailed_analysis')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--cui-secondary-color)' }}>
            {showAnalysis ? '▼' : '▶'}
          </div>
        </div>

        {showAnalysis && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Sentiment */}
            {analysis.sentiment && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: 'var(--cui-body-bg)',
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 16 }}>{getSentimentIcon(analysis.sentiment.sentiment)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('smartAssistant.analysis.sentiment')}</div>
                  <div style={{ 
                    color: getSentimentColor(analysis.sentiment.sentiment),
                    fontWeight: 600,
                    fontSize: 11,
                  }}>
                    {analysis.sentiment.sentiment} ({analysis.sentiment.score}/100)
                  </div>
                </div>
                {analysis.sentiment.isCritical && (
                  <div style={{
                    padding: '2px 6px',
                    background: '#dc3545',
                    color: '#fff',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    {t('smartAssistant.analysis.critical')}
                  </div>
                )}
              </div>
            )}

            {/* Asset identifié */}
            {analysis.asset && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: 'var(--cui-body-bg)',
                borderRadius: 6,
              }}>
                <CIcon icon={cilSpeedometer} size="sm" style={{ color: '#2563eb' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('smartAssistant.analysis.asset_identified')}</div>
                  <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                    {analysis.asset.asset_tag} - {analysis.asset.type}
                  </div>
                </div>
              </div>
            )}

            {/* Classification */}
            {analysis.classification && (
              <div style={{
                display: 'flex',
                gap: 8,
                padding: 8,
                background: 'var(--cui-body-bg)',
                borderRadius: 6,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11 }}>{t('smartAssistant.analysis.category')}</div>
                  <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                    {analysis.classification.category}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11 }}>{t('smartAssistant.analysis.priority')}</div>
                  <div style={{
                    fontSize: 11,
                    color: getPriorityColor(analysis.classification.priority),
                    fontWeight: 600,
                  }}>
                    {analysis.classification.priority}
                  </div>
                </div>
              </div>
            )}

            {/* Prédiction ML */}
            {analysis.mlPrediction && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: 'var(--cui-body-bg)',
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 16 }}>🔮</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11 }}>{t('smartAssistant.analysis.failure_risk')}</div>
                  <div style={{
                    color: getRiskLevelColor(analysis.mlPrediction.risk_level),
                    fontWeight: 600,
                    fontSize: 11,
                  }}>
                    {analysis.mlPrediction.risk_level} ({analysis.mlPrediction.risk_score}/100)
                  </div>
                </div>
              </div>
            )}

            {/* Technicien recommandé */}
            {analysis.technician && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: 'var(--cui-body-bg)',
                borderRadius: 6,
              }}>
                <CIcon icon={cilUser} size="sm" style={{ color: '#28a745' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11 }}>{t('smartAssistant.analysis.recommended_technician')}</div>
                  <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                    {analysis.technician.username} (score: {analysis.technician.score}/100)
                  </div>
                </div>
              </div>
            )}

            {/* Incident de sécurité */}
            {analysis.securityIncident?.isSecurityIncident && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: 6,
              }}>
                <CIcon icon={cilShieldAlt} size="sm" style={{ color: '#dc3545' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11, color: '#dc3545' }}>
                    {t('smartAssistant.analysis.security_incident')}
                  </div>
                  <div style={{ fontSize: 11, color: '#856404' }}>
                    {analysis.securityIncident.type} - {t('smartAssistant.analysis.severity')} {analysis.securityIncident.severity}
                  </div>
                </div>
              </div>
            )}

            {/* Ticket créé */}
            {analysis.ticketCreated && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                background: '#d4edda',
                border: '1px solid #28a745',
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 16 }}>✅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 11, color: '#155724' }}>
                    {t('smartAssistant.analysis.ticket_created_auto')}
                  </div>
                  <div style={{ fontSize: 11, color: '#155724' }}>
                    #{analysis.ticketCreated.id} - {analysis.ticketCreated.title}
                  </div>
                </div>
              </div>
            )}

            {/* Performance */}
            {analysis.metadata && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--cui-secondary-color)',
                paddingTop: 4,
                borderTop: '1px solid var(--cui-border-color)',
              }}>
                <span>{t('smartAssistant.analysis.processing_time')} {formatProcessingTime(analysis.metadata.processingTime)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const chatContainerStyle = {
    position: 'fixed', bottom: 92, right: 28, zIndex: 1049,
    width: 400, height: 600,
    background: 'var(--cui-body-bg)',
    border: '1px solid var(--cui-border-color)',
    borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left',
  };

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
        title={t('smartAssistant.button_title')}
      >
        <CIcon icon={open ? cilX : cilCommentSquare} size="lg" />
      </button>

      {open && (
        <div style={chatContainerStyle}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #1a1f35, #2563eb)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t('smartAssistant.title')}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                {t('smartAssistant.subtitle')}
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
                  {t('smartAssistant.stop_speaking')}
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

          {/* Messages */}
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
                  title={msg.role === 'bot' ? t('smartAssistant.click_to_listen') : ''}
                >
                  <div style={{
                    maxWidth: '85%',
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
                    whiteSpace: 'pre-wrap',
                  }}>
                    {typeof msg.text === 'string'
                      ? msg.text
                      : (msg.text && typeof msg.text === 'object'
                          ? JSON.stringify(msg.text)
                          : '')}
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

                {/* Analyse détaillée - uniquement pour Admin et Technicien */}
                {(role === 'Admin' || role === 'Technicien') && msg.role === 'bot' && msg.analysis && renderAnalysis(msg.analysis)}

                {/* Sources (articles de la base de connaissances uniquement) */}
                {msg.sources?.filter(s => s.type === 'knowledge_base').length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 4 }}>
                    <div style={{
                      fontSize: 11, color: 'var(--cui-secondary-color)',
                      marginBottom: 4, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {t('smartAssistant.related_articles')}
                    </div>
                    {msg.sources
                      .filter(s => s.type === 'knowledge_base')
                      .map((src) => (
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
                    <span style={{ color: '#ef4444', fontSize: 12 }}>{t('smartAssistant.recording')}</span>
                  ) : isTranscribing ? (
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>{t('smartAssistant.transcribing')}</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--cui-secondary-color)',
                        animation: 'chatDot 1.2s ease-in-out 0s infinite',
                      }} />
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--cui-secondary-color)',
                        animation: 'chatDot 1.2s ease-in-out 0.2s infinite',
                      }} />
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--cui-secondary-color)',
                        animation: 'chatDot 1.2s ease-in-out 0.4s infinite',
                      }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
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
              placeholder={t('smartAssistant.placeholder')}
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
              title={isRecording ? t('smartAssistant.stop_recording') : t('smartAssistant.start_recording')}
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

export default SmartAssistant