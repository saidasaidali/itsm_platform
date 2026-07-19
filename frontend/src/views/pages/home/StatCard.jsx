import React from 'react'
import { CCard, CCardBody } from '@coreui/react'

const StatCard = ({ label, value }) => {
  return (
    <CCard className="landing-stat-card border-0 h-100">
      <CCardBody>
        <div className="text-uppercase text-secondary fw-semibold mb-2" style={{ letterSpacing: '0.12em' }}>
          {label}
        </div>
        <div className="fs-2 fw-semibold text-white">{value}</div>
      </CCardBody>
    </CCard>
  )
}

export default StatCard
