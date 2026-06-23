// src/layout/DefaultLayout.jsx
import React from 'react'
import { AppContent, AppFooter, AppHeader, AppSidebar } from '../components'
import Chatbot from '../components/Chatbot'

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
      <Chatbot />
    </div>
  )
}

export default DefaultLayout