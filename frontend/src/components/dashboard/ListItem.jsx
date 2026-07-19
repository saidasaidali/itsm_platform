import React from 'react'
import { CBadge } from '@coreui/react'

/**
 * Élément de liste réutilisable pour le dashboard
 * @param {string} title - Titre principal
 * @param {string} subtitle - Sous-titre optionnel
 * @param {string} badgeText - Texte du badge optionnel
 * @param {string} badgeColor - Couleur du badge
 * @param {boolean} clickable - Si l'élément est cliquable
 * @param {function} onClick - Fonction de clic
 * @param {React.ReactNode} children - Contenu additionnel
 */
const ListItem = ({
  title,
  subtitle,
  badgeText,
  badgeColor = 'secondary',
  clickable = false,
  onClick,
  children,
}) => {
  const itemProps = clickable
    ? {
        style: { cursor: 'pointer' },
        onClick,
        className: 'd-flex justify-content-between align-items-center py-2 border-bottom',
      }
    : {
        className: 'd-flex justify-content-between align-items-center py-2 border-bottom',
      }

  return (
    <div {...itemProps}>
      <div>
        {title && <div className="small fw-semibold">{title}</div>}
        {subtitle && <small className="text-muted">{subtitle}</small>}
        {children}
      </div>
      {badgeText && <CBadge color={badgeColor}>{badgeText}</CBadge>}
    </div>
  )
}

export default ListItem