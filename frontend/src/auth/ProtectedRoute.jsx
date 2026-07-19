// src/auth/ProtectedRoute.jsx
import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from './AuthProvider'

/**
 * Protège une route selon l'authentification et optionnellement le rôle.
 *
 * Usage :
 *   <ProtectedRoute>                          // connecté seulement
 *   <ProtectedRoute allowedRoles={['Admin']}> // Admin seulement
 *   <ProtectedRoute allowedRoles={['Admin','Technicien']}> // Admin ou Technicien
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useContext(AuthContext)

  // Pas connecté → login
  if (!currentUser) {
    return <Navigate to="/login" />
  }

  // Connecté mais rôle non autorisé → dashboard (sans message d'erreur)
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" />
  }

  return children
}

export default ProtectedRoute