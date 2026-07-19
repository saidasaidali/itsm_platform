import React from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import { CChart } from '@coreui/react-chartjs'

/**
 * Carte avec graphique Chart.js réutilisable pour le dashboard
 * @param {string} title - Titre de la carte
 * @param {string} type - Type de graphique (line, bar, doughnut, etc.)
 * @param {object} data - Données du graphique (format Chart.js)
 * @param {object} options - Options du graphique (format Chart.js)
 * @param {string|number} height - Hauteur du graphique (ex: '260px' ou 260)
 */
const ChartCard = ({ title, type, data, options, height = '260px' }) => {
  const defaultOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
    },
    ...options,
  }

  return (
    <CCard className="h-100">
      {title && <CCardHeader>{title}</CCardHeader>}
      <CCardBody>
        <CChart
          type={type}
          data={data}
          options={defaultOptions}
          style={{ height }}
        />
      </CCardBody>
    </CCard>
  )
}

export default ChartCard