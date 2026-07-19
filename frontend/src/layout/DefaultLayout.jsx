// src/layout/DefaultLayout.jsx
import React from 'react'
import { AppContent, AppFooter, AppHeader, AppSidebar } from '../components'
import SmartAssistant from '../components/SmartAssistant'

const DefaultLayout = () => {
  return (
    <div>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <div className="body flex-grow-1">
          <AppContent />
        </div>
        <AppFooter />
      </div>
      <SmartAssistant />
    </div>
  )
}

export default DefaultLayout
