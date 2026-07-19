import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilGlobeAlt } from '@coreui/icons'

const languages = ['fr', 'ar', 'en']

const languageLabels = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
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
        className={`btn btn-outline-primary rounded-pill ${className}`}
        title={t('lang.switch')}
        aria-label={t('lang.switch')}
        style={{
          height: 38,
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          fontSize: 13,
          borderWidth: 2,
        }}
      >
        <CIcon icon={cilGlobeAlt} size="sm" />
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
      {languageLabels[currentLang] || languageLabels.fr}
    </button>
  )
}

export default LanguageToggle
