import React from 'react'
import { CCard, CCardBody, CBadge } from '@coreui/react'

/**
 * Carte KPI réutilisable pour le dashboard
 * @param {string} title - Titre du KPI
 * @param {string|number} value - Valeur principale
 * @param {string} subtitle - Sous-titre optionnel
 * @param {string} badgeText - Texte du badge optionnel
 * @param {string} badgeColor - Couleur du badge (primary, success, warning, danger, info)
 * @param {string} valueColor - Couleur de la valeur (text-success, text-warning, text-danger, etc.)
 * @param {boolean} clickable - Si la carte est cliquable
 * @param {function} onClick - Fonction de clic
 */
const KPICard = ({
  title,
  value,
  subtitle,
  badgeText,
  badgeColor = 'secondary',
  valueColor,
  clickable = false,
  onClick,
}) => {
  const cardProps = clickable ? { style: { cursor: 'pointer' }, onClick } : {}

  return (
    <CCard className="p-3 h-100" {...cardProps}>
      <div className="text-uppercase text-secondary small mb-2">{title}</div>
      <div className={`fs-2 fw-semibold ${valueColor || ''}`}>{value}</div>
      {subtitle && <div className="text-muted small">{subtitle}</div>}
      {badgeText && <CBadge color={badgeColor} className="mt-2">{badgeText}</CBadge>}
    </CCard>
  )
}

export default KPICard