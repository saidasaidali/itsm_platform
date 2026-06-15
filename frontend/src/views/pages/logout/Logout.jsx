// src/views/pages/logout/Logout.jsx
import React, { useEffect, useState, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import { AuthContext } from '../../../auth/AuthProvider'

const Logout = () => {
  const { logout } = useContext(AuthContext)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // On attend que logout() ait fini (nettoie localStorage + state)
    // avant de laisser Navigate rediriger
    logout().finally(() => setDone(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!done) {
    return (
      <div className="pt-3 text-center">
        <CSpinner color="primary" variant="grow" />
      </div>
    )
  }

  return <Navigate to="/login" replace />
}

export default Logout