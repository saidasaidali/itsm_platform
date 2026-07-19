// src/auth/AuthProvider.jsx
import React, { createContext, useMemo, useState } from 'react'
import {
  getCurrentUser as getStoredUser,
  login as loginService,
  logout as logoutService,
  register as registerService,
} from '../services/authService'

export const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(getStoredUser())
  const [authError, setAuthError] = useState(null)

  const login = async (credentials) => {
    try {
      const user = await loginService(credentials)
      setCurrentUser(user)
      setAuthError(null)
      return user
    } catch (error) {
      setAuthError(error.message)
      return Promise.reject(error)
    }
  }

  const register = async (userData) => {
    try {
      // L'inscription ne connecte plus l'utilisateur automatiquement.
      // Le compte est 'pending' et doit être validé par un admin.
      const result = await registerService(userData)
      setAuthError(null)
      return result
    } catch (error) {
      setAuthError(error.message)
      return Promise.reject(error)
    }
  }

  const logout = async () => {
    try {
      // Appel API pour invalider côté serveur si nécessaire (best-effort)
      await logoutService()
    } catch (_) {
      // On ignore l'erreur réseau — la déconnexion locale se fait quoi qu'il arrive
    } finally {
      // Nettoyage systématique du localStorage
      localStorage.removeItem('itsm-auth-token')
      localStorage.removeItem('itsm-auth-user')
      setCurrentUser(null)
      setAuthError(null)
    }
  }

  const value = useMemo(
    () => ({ currentUser, login, logout, register, authError }),
    [currentUser, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider