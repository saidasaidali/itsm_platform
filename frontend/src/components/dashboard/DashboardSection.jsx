import React from 'react'
import { CRow, CCol } from '@coreui/react'

/**
 * Section standardisée du dashboard avec titre optionnel
 * Reproduit le pattern des sections du dashboard actuel
 *
 * @param {string} title - Titre de la section (optionnel)
 * @param {string} icon - Icône CoreUI (optionnel)
 * @param {string} className - Classes CSS additionnelles
 * @param {React.ReactNode} children - Contenu de la section
 */
const DashboardSection = ({ title, icon, className = '', children }) => {
  const titleElement = title ? (
    <h5 className="mb-2">
      {icon && <span className="me-2">{icon}</span>}
      {title}
    </h5>
  ) : null

  return (
    <>
      {titleElement}
      <CRow className={`g-4 mb-4 ${className}`}>
        {children}
      </CRow>
    </>
  )
}

export default DashboardSection