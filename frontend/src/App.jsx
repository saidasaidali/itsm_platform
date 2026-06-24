/**
 * App Component — Routing with authentication guards + i18n + RTL
 */

import React, { Suspense, useEffect, useContext } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'

import { AuthProvider, AuthContext } from './auth/AuthProvider'
import i18n from './i18n'

// ────────────────────────────────
// Lazy pages
// ────────────────────────────────
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

const HomePage = React.lazy(() => import('./views/pages/home/HomePage'))
const Login = React.lazy(() => import('./views/pages/login/Login'))
const Register = React.lazy(() => import('./views/pages/register/Register'))
const ForgotPassword = React.lazy(() => import('./views/auth/ForgotPassword'))
const ResetPassword = React.lazy(() => import('./views/auth/ResetPassword'))
const Page404 = React.lazy(() => import('./views/pages/page404/Page404'))
const Page500 = React.lazy(() => import('./views/pages/page500/Page500'))

// ────────────────────────────────
// Guards
// ────────────────────────────────
const RequireAuth = ({ children }) => {
  const { currentUser } = useContext(AuthContext)
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

const RedirectIfAuth = ({ children }) => {
  const { currentUser } = useContext(AuthContext)
  if (currentUser) return <Navigate to="/dashboard" replace />
  return children
}

// ────────────────────────────────
// Routes
// ────────────────────────────────
const AppRoutes = () => {
  const { currentUser } = useContext(AuthContext)

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <HomePage />
          )
        }
      />

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

      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuth>
            <ForgotPassword />
          </RedirectIfAuth>
        }
      />

      <Route
        path="/reset-password/:token"
        element={
          <RedirectIfAuth>
            <ResetPassword />
          </RedirectIfAuth>
        }
      />

      <Route path="/profile" element={<Navigate to="/parametres" replace />} />

      <Route path="/404" element={<Page404 />} />
      <Route path="/500" element={<Page500 />} />

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

// ────────────────────────────────
// Hook RTL + language direction
// ────────────────────────────────
const useLanguageDirection = () => {
  useEffect(() => {
    const updateDirection = (lng) => {
      document.documentElement.lang = lng
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
    }

    updateDirection(i18n.language)

    i18n.on('languageChanged', updateDirection)

    return () => {
      i18n.off('languageChanged', updateDirection)
    }
  }, [])
}

// ────────────────────────────────
// App Root
// ────────────────────────────────
const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes(
    'coreui-free-react-admin-template-theme'
  )

  const storedTheme = useSelector((state) => state.theme)
  const dispatch = useDispatch()

  // RTL + language
  useLanguageDirection()

  // Theme init
  useEffect(() => {
    // Si pas de hash, convertir le chemin actuel en hash route
    if (!window.location.hash) {
      const path = window.location.pathname + window.location.search
      if (path && path !== '/') {
        // Rediriger : /tickets → /#/tickets
        window.location.href = window.location.origin + '/#' + path
      } else {
        window.location.hash = '/'
      }
    }

    const queryString = window.location.href.split('?')[1] || ''
    const urlParams = new URLSearchParams(queryString)
    const theme = urlParams
      .get('theme')
      ?.match(/^[A-Za-z0-9\s]+/)?.[0]

    const safeTheme = ['light', 'dark', 'auto'].includes(theme)
      ? theme
      : null

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