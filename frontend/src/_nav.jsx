// src/_nav.jsx
// Le menu est filtré dynamiquement selon le rôle dans AppSidebarNav
import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilDescription,
  cilNotes,
  cilSpeedometer,
  cilPeople,
  cilLibrary,
} from '@coreui/icons'
import { CNavItem, CNavTitle } from '@coreui/react'

// roles: tableau des rôles autorisés à voir cet item
// Si 'roles' est absent → visible par tous les utilisateurs connectés
const _nav = [
  {
    component: CNavItem,
    name: 'Dashboard',
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'ITSM',
  },
  {
    component: CNavItem,
    name: 'Utilisateurs',
    to: '/users',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    roles: ['Admin'], // ← Admin uniquement
  },
  {
    component: CNavItem,
    name: 'Tickets',
    to: '/tickets',
    icon: <CIcon icon={cilNotes} customClassName="nav-icon" />,
    // Visible par tous (Agent crée, Technicien traite, Admin supervise)
  },
  {
    component: CNavItem,
    name: 'Ressources IT',
    to: '/assets',
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
    roles: ['Admin', 'Technicien'], // ← Admin + Technicien
  },
  {
    component: CNavItem,
    name: 'Base de connaissance',
    to: '/knowledge',
    icon: <CIcon icon={cilLibrary} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'Notifications',
    to: '/notifications',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
  },
]

export default _nav