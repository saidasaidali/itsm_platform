// src/components/AppContent.jsx
import React, { Suspense, useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'
import { AuthContext } from '../auth/AuthProvider'
import routes from '../routes'

const AppContent = () => {
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  return (
    <CContainer className="px-4" lg>
      <Suspense fallback={<div className="text-center p-5"><CSpinner /></div>}>
        <Routes>
          {routes.map((route) => {
            // Bloquer /users* aux non-admins
            if (route.path.startsWith('/users') && role !== 'Admin') {
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<Navigate to="/dashboard" replace />}
                />
              )
            }
            return (
              <Route
                key={route.path}
                path={route.path}
                element={<route.element />}
              />
            )
          })}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default AppContent