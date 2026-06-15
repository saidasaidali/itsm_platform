/**
 * App Component — Routing with authentication guards
 */

import React, { Suspense, useEffect, useContext } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

import { AuthProvider, AuthContext } from './auth/AuthProvider'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages publiques
const HomePage  = React.lazy(() => import('./views/pages/home/HomePage'))
const Login     = React.lazy(() => import('./views/pages/login/Login'))
const Register  = React.lazy(() => import('./views/pages/register/Register'))
const Page404   = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500   = React.lazy(() => import('./views/pages/page500/Page500'))

// ─── Guard : redirige vers /login si non connecté ────────────────────────────
const RequireAuth = ({ children }) => {
  const { currentUser } = useContext(AuthContext)
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

// ─── Guard : redirige vers /dashboard si déjà connecté ───────────────────────
const RedirectIfAuth = ({ children }) => {
  const { currentUser } = useContext(AuthContext)
  if (currentUser) return <Navigate to="/dashboard" replace />
  return children
}

// ─── Composant interne (a accès au contexte Auth) ────────────────────────────
const AppRoutes = () => {
  const { currentUser } = useContext(AuthContext)

  return (
    <Routes>
      {/* Route racine : dashboard si connecté, sinon page d'accueil */}
      <Route
        path="/"
        element={currentUser ? <Navigate to="/dashboard" replace /> : <HomePage />}
      />

      {/* Routes publiques — redirigent vers /dashboard si déjà connecté */}
      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <Login />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuth>
            <Register />
          </RedirectIfAuth>
        }
      />

      {/* Pages d'erreur — toujours accessibles */}
      <Route path="/404" element={<Page404 />} />
      <Route path="/500" element={<Page500 />} />

      {/* Routes protégées — redirigent vers /login si non connecté */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <DefaultLayout />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

// ─── Composant racine ─────────────────────────────────────────────────────────
const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)
  const dispatch = useDispatch()

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = '/'
    }

    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    const safeTheme = ['light', 'dark', 'auto'].includes(theme) ? theme : null
    if (safeTheme) {
      setColorMode(safeTheme)
      dispatch({ type: 'set', theme: safeTheme })
      return
    }
    if (isColorModeSet()) return
    setColorMode(storedTheme || 'light')
  }, [dispatch, isColorModeSet, setColorMode, storedTheme])

  return (
    <HashRouter>
      <Suspense
        fallback={
          <div className="pt-3 text-center">
            <CSpinner color="primary" variant="grow" />
          </div>
        }
      >
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Suspense>
    </HashRouter>
  )
}

export default App