import React, { useEffect, useRef, useContext, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  CButton,
  CBadge,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell, cilMenu, cilMoon, cilSun } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../auth/AuthProvider'
import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'
import { getUnreadCount } from '../services/notificationService'
import LanguageToggle from './LanguageToggle'

const AppHeader = () => {
  const headerRef = useRef()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const { colorMode, setColorMode } = useColorModes(
    'coreui-free-react-admin-template-theme',
  )

  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      getUnreadCount().then(setUnreadCount).catch(() => {})
    }

    fetchCount()
    const interval = setInterval(fetchCount, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current?.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }

    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        <CHeaderNav className="d-none d-md-flex">
          <CNavItem>
            <CNavLink to="/dashboard" as={NavLink}>
              {t('nav.dashboard')}
            </CNavLink>
          </CNavItem>

          {role === 'Admin' && (
            <CNavItem>
              <CNavLink to="/users" as={NavLink}>
                {t('nav.users')}
              </CNavLink>
            </CNavItem>
          )}

          <CNavItem>
            <CNavLink to="/tickets" as={NavLink}>
              {t('nav.tickets')}
            </CNavLink>
          </CNavItem>

          {(role === 'Admin' || role === 'Technicien') && (
            <CNavItem>
              <CNavLink to="/assets" as={NavLink}>
                {t('nav.assets')}
              </CNavLink>
            </CNavItem>
          )}
        </CHeaderNav>

        <CHeaderNav className="ms-auto d-flex align-items-center gap-2">
          <LanguageToggle variant="icon" className="me-2" />

          <CButton
            color="secondary"
            shape="rounded-pill"
            size="sm"
            className="d-none d-lg-inline-flex align-items-center"
            onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
          >
            <CIcon icon={colorMode === 'dark' ? cilSun : cilMoon} />
            <span className="ms-2">
              {colorMode === 'dark' ? t('theme.light') : t('theme.dark')}
            </span>
          </CButton>

          <CNavItem>
            <CNavLink
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => navigate('/notifications')}
              aria-label={t('nav.notifications')}
            >
              <CIcon icon={cilBell} size="lg" />

              {unreadCount > 0 && (
                <CBadge
                  color="danger"
                  shape="rounded-pill"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    fontSize: '10px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </CBadge>
              )}
            </CNavLink>
          </CNavItem>

          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>

      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
