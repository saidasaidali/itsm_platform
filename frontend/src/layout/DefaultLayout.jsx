// src/layout/DefaultLayout.jsx
import React, { useContext } from 'react'
import { AppContent, AppHeader, AppSidebar } from '../components'
import { AuthContext } from '../auth/AuthProvider'

const DefaultLayout = () => {
  const { currentUser } = useContext(AuthContext)
  return (
    <div>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <div className="body flex-grow-1">
          <AppContent />
        </div>
      </div>
    </div>
  )
}

export default DefaultLayout