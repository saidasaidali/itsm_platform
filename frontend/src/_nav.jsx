import React from 'react'
import CIcon from '@coreui/icons-react'
import i18n from './i18n'

import {
  cilBell,
  cilDescription,
  cilNotes,
  cilSpeedometer,
  cilPeople,
  cilLibrary,
  cilBan,
  cilSettings,
  cilChart,
} from '@coreui/icons'

import { CNavItem, CNavTitle } from '@coreui/react'

const getNav = () => [
  {
    component: CNavItem,
    name: i18n.t('nav.dashboard'),
    to: '/dashboard',
    icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
  },

  {
    component: CNavTitle,
    name: i18n.t('nav.itsm'),
  },

  {
    component: CNavItem,
    name: i18n.t('nav.users'),
    to: '/users',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    roles: ['Admin'],
  },

  {
    component: CNavItem,
    name: i18n.t('nav.tickets'),
    to: '/tickets',
    icon: <CIcon icon={cilNotes} customClassName="nav-icon" />,
  },

  {
    component: CNavItem,
    name: i18n.t('nav.assets'),
    to: '/assets',
    icon: <CIcon icon={cilDescription} customClassName="nav-icon" />,
    roles: ['Admin', 'Technicien'],
  },

  {
    component: CNavItem,
    name: i18n.t('nav.knowledge'),
    to: '/knowledge',
    icon: <CIcon icon={cilLibrary} customClassName="nav-icon" />,
  },

  {
    component: CNavItem,
    name: i18n.t('nav.notifications'),
    to: '/notifications',
    icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
  },

  {
    component: CNavItem,
    name: i18n.t('nav.anomalies'),
    to: '/anomalies',
    icon: <CIcon icon={cilBan} customClassName="nav-icon" />,
    roles: ['Admin', 'Technicien'],
  },

  {
    component: CNavItem,
    name: 'Rapports IA',
    to: '/reports',
    icon: <CIcon icon={cilChart} customClassName="nav-icon" />,
    roles: ['Admin'],
  },

  {
    component: CNavItem,
    name: i18n.t('nav.settings'),
    to: '/parametres',
    icon: <CIcon icon={cilSettings} customClassName="nav-icon" />,
  },
]

export default getNav