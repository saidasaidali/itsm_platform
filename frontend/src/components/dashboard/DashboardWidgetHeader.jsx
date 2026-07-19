import React from 'react'
import { CCardHeader } from '@coreui/react'

/**
 * En-tête de widget standardisé pour le dashboard ITSM
 * Reproduit le pattern des en-têtes de cartes existants
 *
 * @param {string} title - Titre du widget
 * @param {React.ReactNode} children - Contenu additionnel (badges, icônes, etc.)
 */
const DashboardWidgetHeader = ({ title, children }) => {
  return (
    <CCardHeader>
      {title}
      {children}
    </CCardHeader>
  )
}

export default DashboardWidgetHeader