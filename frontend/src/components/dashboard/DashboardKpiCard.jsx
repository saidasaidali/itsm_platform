import React from 'react'
import { CCard, CCardBody, CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'

/**
 * Carte KPI modernisée pour le dashboard ITSM
 * Design moderne avec icône, hiérarchie visuelle améliorée et couleurs CoreUI
 *
 * @param {string} title - Titre en uppercase
 * @param {string|number} value - Valeur principale (gros chiffre)
 * @param {string} subtitle - Texte secondaire en muted
 * @param {string} badgeText - Texte du badge optionnel
 * @param {string} badgeColor - Couleur du badge (warning, info, success, danger, etc.)
 * @param {string} icon - Icône CoreUI (ex: cilClipboard)
 * @param {string} iconColor - Couleur de l'icône (text-primary, text-success, etc.)
 * @param {string} valueColor - Couleur de la valeur (text-success, text-warning, text-danger, etc.)
 * @param {boolean} clickable - Si la carte est cliquable
 * @param {function} onClick - Handler de clic
 */
const DashboardKpiCard = ({
  title,
  value,
  subtitle,
  badgeText,
  badgeColor = 'secondary',
  icon,
  iconColor = 'text-primary',
  valueColor,
  clickable = false,
  onClick,
}) => {
  const cardProps = clickable
    ? { style: { cursor: 'pointer' }, onClick }
    : {}

  return (
    <CCard className="p-3 h-100" {...cardProps}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div className="flex-grow-1">
          <div className="text-uppercase text-secondary small mb-2">{title}</div>
          <div className={`fs-2 fw-bold ${valueColor || 'text-dark'}`}>{value}</div>
          {subtitle && <div className="text-muted small mt-1">{subtitle}</div>}
        </div>
        {icon && (
          <div className={`fs-1 ${iconColor} opacity-75`}>
            <CIcon icon={icon} />
          </div>
        )}
      </div>
      {badgeText && <CBadge color={badgeColor} className="mt-2">{badgeText}</CBadge>}
    </CCard>
  )
}

export default DashboardKpiCard