// src/components/AppSidebarNav.jsx
import React, { useContext } from 'react'
import { NavLink } from 'react-router-dom'
import { CBadge, CNavItem, CNavTitle } from '@coreui/react'
import { AuthContext } from '../auth/AuthProvider'

export const AppSidebarNav = ({ items }) => {
  const { currentUser } = useContext(AuthContext)
  const userRole = currentUser?.role

  const navLink = (name, icon, badge) => (
    <>
      {icon && icon}
      {name && <span className="nav-link-name">{name}</span>}
      {badge && (
        <CBadge color={badge.color} className="ms-auto">
          {badge.text}
        </CBadge>
      )}
    </>
  )

  const navItem = (item, index) => {
    const { component: Component, name, badge, icon, to, ...rest } = item
    return (
      <Component as="div" key={index}>
        {to ? (
          <NavLink
            className={({ isActive }) =>
              ['nav-link', isActive ? 'active' : ''].join(' ')
            }
            to={to}
            {...rest}
          >
            {navLink(name, icon, badge)}
          </NavLink>
        ) : (
          navLink(name, icon, badge)
        )}
      </Component>
    )
  }

  const navTitle = (item, index) => {
    const { component: Component, name } = item
    return (
      <Component key={index} className="sidebar-nav-title">
        {name}
      </Component>
    )
  }

  const filterByRole = (items) => {
    const filtered = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.roles && !item.roles.includes(userRole)) continue

      if (item.component === CNavTitle) {
        let hasVisibleChild = false
        for (let j = i + 1; j < items.length; j++) {
          if (items[j].component === CNavTitle) break
          if (!items[j].roles || items[j].roles.includes(userRole)) {
            hasVisibleChild = true
            break
          }
        }
        if (!hasVisibleChild) continue
      }
      filtered.push(item)
    }
    return filtered
  }

  const visibleItems = filterByRole(items)

  return (
    <nav className="sidebar-nav" style={{ padding: '8px 0' }}>
      {visibleItems.map((item, index) =>
        item.component === CNavTitle
          ? navTitle(item, index)
          : navItem(item, index)
      )}
    </nav>
  )
}

export default AppSidebarNav