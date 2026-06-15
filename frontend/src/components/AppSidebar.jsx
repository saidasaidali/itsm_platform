// src/components/AppSidebar.jsx
import React, { useContext } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  CCloseButton, CSidebar, CSidebarBrand,
  CSidebarFooter, CSidebarHeader, CSidebarToggler,
} from '@coreui/react'
import { AuthContext } from '../auth/AuthProvider'
import { AppSidebarNav } from './AppSidebarNav'
import navigation from '../_nav'

const ROLE_COLORS = { Admin: '#e74c3c', Technicien: '#2980b9', Agent: '#27ae60' }

const AppSidebar = () => {
  const dispatch   = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { currentUser } = useContext(AuthContext)

  const role     = currentUser?.role || ''
  const username = currentUser?.username || ''
  const initiale = username.charAt(0).toUpperCase()
  const color    = ROLE_COLORS[role] || '#6c757d'

  // Filtrer la navigation selon le rôle
  const filteredNav = navigation.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(role)
  })

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => dispatch({ type: 'set', sidebarShow: visible })}
      style={{ background: 'linear-gradient(180deg, #1a1f35 0%, #0f1422 100%)' }}
    >
      {/* Brand / Logo */}
      <CSidebarHeader className="border-bottom border-secondary">
        <CSidebarBrand>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '800', fontSize: '16px', color: '#fff',
              boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
            }}>
              IT
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff', lineHeight: 1.2 }}>
                DRESI
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.05em' }}>
                ITSM Platform
              </div>
            </div>
          </div>
        </CSidebarBrand>
        <CCloseButton
          className="d-lg-none"
          dark
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>

      {/* Profil utilisateur dans la sidebar */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%',
          backgroundColor: color, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '17px',
          boxShadow: `0 0 0 2px rgba(255,255,255,0.15)`,
        }}>
          {initiale}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            color: '#f1f5f9', fontWeight: '600', fontSize: '13px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {username}
          </div>
          <div style={{
            fontSize: '11px', color: color, fontWeight: '500',
          }}>
            {role}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <AppSidebarNav items={filteredNav} />

      {/* Footer sidebar */}
      <CSidebarFooter className="border-top border-secondary">
        <CSidebarToggler
          onClick={() => dispatch({ type: 'set', sidebarUnfoldable: !unfoldable })}
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default AppSidebar