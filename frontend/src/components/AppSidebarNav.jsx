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
      <Component key={index} style={{
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.3)',
        padding: '16px 20px 6px',
      }}>
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
      <style>{`
        .sidebar-nav .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          color: rgba(255,255,255,0.6);
          font-size: 13.5px;
          font-weight: 500;
          border-radius: 0;
          transition: all 0.15s ease;
          border-left: 3px solid transparent;
          text-decoration: none;
        }
        .sidebar-nav .nav-link:hover {
          color: #fff;
          background: rgba(255,255,255,0.06);
          border-left-color: rgba(255,255,255,0.2);
        }
        .sidebar-nav .nav-link.active {
          color: #fff;
          background: rgba(59,130,246,0.18);
          border-left-color: #3b82f6;
          font-weight: 600;
        }
        .sidebar-nav .nav-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          opacity: 0.75;
        }
        .sidebar-nav .nav-link.active .nav-icon {
          opacity: 1;
        }
        .sidebar-nav .nav-link-name {
          flex: 1;
        }
      `}</style>
      {visibleItems.map((item, index) =>
        item.component === CNavTitle
          ? navTitle(item, index)
          : navItem(item, index)
      )}
    </nav>
  )
}

export default AppSidebarNav