import React from 'react'
import { CCard, CCardBody, CCardTitle, CCardText } from '@coreui/react'
import CIcon from '@coreui/icons-react'

const FeatureCard = ({ icon, title, description }) => {
  return (
    <CCard className="h-100 border rounded-4 landing-card-flat">
      <CCardBody className="d-flex flex-column h-100 gap-3">
        <div className="landing-icon-bg">
          <CIcon icon={icon} size="lg" />
        </div>
        <CCardTitle className="h6 fw-semibold mb-0">{title}</CCardTitle>
        <CCardText className="text-muted mb-0 flex-grow-1">{description}</CCardText>
      </CCardBody>
    </CCard>
  )
}

export default FeatureCard
