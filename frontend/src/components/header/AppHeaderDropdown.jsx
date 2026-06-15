// src/components/header/AppHeaderDropdown.jsx
import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilSettings, cilUser } from '@coreui/icons'
import { AuthContext } from '../../auth/AuthProvider'

const ROLE_COLORS = {
  Admin:       '#e74c3c',
  Technicien:  '#2980b9',
  Agent:       '#27ae60',
}

const AppHeaderDropdown = () => {
  const { currentUser, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const username = currentUser?.username || currentUser?.name || 'U'
  const role     = currentUser?.role || ''
  const initiale = username.charAt(0).toUpperCase()
  const color    = ROLE_COLORS[role] || '#6c757d'

  const avatarStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: color,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.3)',
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
        <div style={avatarStyle} title={username}>{initiale}</div>
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
          <div>{username}</div>
          <small className="text-muted fw-normal">{role}</small>
        </CDropdownHeader>

        <CDropdownItem onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilUser} className="me-2" />
          Mon profil
        </CDropdownItem>

        <CDropdownItem onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <CIcon icon={cilSettings} className="me-2" />
          Paramètres
        </CDropdownItem>

        <CDropdownDivider />

        <CDropdownItem
          onClick={() => { logout(); navigate('/login') }}
          style={{ cursor: 'pointer', color: '#e74c3c' }}
        >
          <CIcon icon={cilLockLocked} className="me-2" />
          Déconnexion
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown