import React, { useContext } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarToggler,
  CSidebarHeader,
} from '@coreui/react'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../auth/AuthProvider'
import { AppSidebarNav } from './AppSidebarNav'
import getNav from '../_nav'
import { translateRole } from '../utils/translate'

const ROLE_COLORS = {
  Admin: '#e74c3c',
  Technicien: '#2980b9',
  Agent: '#27ae60',
}

const AppSidebar = () => {
  const dispatch = useDispatch()
  const unfoldable = useSelector((state) => state.sidebarUnfoldable)
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const { t } = useTranslation()

  const { currentUser } = useContext(AuthContext)

  const role = currentUser?.role || ''
  const username = currentUser?.username || ''
  const initiale = username.charAt(0).toUpperCase()
  const color = ROLE_COLORS[role] || '#6c757d'
  const navigation = getNav()

  return (
    <CSidebar
      className="border-end app-sidebar"
      position="fixed"
      unfoldable={unfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => dispatch({ type: 'set', sidebarShow: visible })}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '16px',
                color: '#fff',
              }}
            >
              IT
            </div>

            <div>
              <div className="sidebar-brand-title">DRESI</div>
              <div className="sidebar-brand-subtitle">{t('sidebar.brand_subtitle')}</div>
            </div>
          </div>
        </CSidebarBrand>

        <CCloseButton
          className="d-lg-none"
          onClick={() => dispatch({ type: 'set', sidebarShow: false })}
        />
      </CSidebarHeader>

      <div className="sidebar-user-block">
        <div className="sidebar-user-avatar" style={{ backgroundColor: color }}>
          {initiale}
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div className="sidebar-user-name">{username}</div>
          <div style={{ fontSize: '11px', color, fontWeight: '500' }}>{translateRole(role)}</div>
        </div>
      </div>

      <AppSidebarNav items={navigation} />

      <CSidebarFooter className="border-top">
        <CSidebarToggler
          onClick={() =>
            dispatch({
              type: 'set',
              sidebarUnfoldable: !unfoldable,
            })
          }
        />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default AppSidebar
