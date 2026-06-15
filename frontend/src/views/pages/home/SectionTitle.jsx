import React from 'react'

const SectionTitle = ({ title, subtitle }) => {
  return (
    <div className="mb-5 text-center">
      <p className="text-uppercase text-white-50 fw-semibold mb-2">{title}</p>
      {subtitle && (
        <p className="fs-5 text-white-75 mx-auto" style={{ maxWidth: '720px' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export default SectionTitle
