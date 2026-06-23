import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const languages = ['fr', 'ar', 'en']

const languageLabels = {
  fr: 'FR',
  ar: 'AR',
  en: 'EN',
}

const applyDirection = (lang) => {
  const language = lang || 'fr'
  document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', language)
}

const LanguageToggle = ({ variant = 'button', className = '' }) => {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.resolvedLanguage || i18n.language || 'fr'

  useEffect(() => {
    applyDirection(currentLang)
  }, [currentLang])

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('itsm-lang', lng)
    applyDirection(lng)
  }

  const nextLanguage = () => {
    const index = languages.indexOf(currentLang)
    const next = languages[((index === -1 ? 0 : index) + 1) % languages.length]
    changeLanguage(next)
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={nextLanguage}
        className={className}
        title={t('lang.switch')}
        aria-label={t('lang.switch')}
        style={{
          height: 38,
          borderRadius: 20,
          padding: '0 14px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>{languageLabels[currentLang] || languageLabels.fr}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={nextLanguage}
      className={`btn btn-secondary rounded-pill btn-sm ${className}`}
      title={t('lang.switch')}
      aria-label={t('lang.switch')}
    >
      {t(`lang.${currentLang}`)}
    </button>
  )
}

export default LanguageToggle
