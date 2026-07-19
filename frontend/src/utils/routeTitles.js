/**
 * Central mapping of routes to their page titles and descriptions
 * Used by useRouteTitle hook to automatically update document.title
 * 
 * Format: {
 *   '/path': { title: 'Page Title', description: 'Meta description (optional)' }
 * }
 */

export const ROUTE_TITLES = {
  // Dashboard
  '/dashboard': {
    title: 'Dashboard',
    description: 'View your IT service management dashboard'
  },

  // Tickets
  '/tickets': {
    title: 'Tickets',
    description: 'Manage all IT support tickets'
  },
  '/tickets/new': {
    title: 'New Ticket',
    description: 'Create a new support ticket'
  },
  '/tickets/:ticketId': {
    title: 'Ticket Details',
    description: 'View ticket details and history'
  },
  '/tickets/:ticketId/edit': {
    title: 'Edit Ticket',
    description: 'Edit support ticket information'
  },

  // Assets
  '/assets': {
    title: 'Assets',
    description: 'Manage your IT assets and inventory'
  },
  '/assets/new': {
    title: 'New Asset',
    description: 'Create a new asset'
  },
  '/assets/import': {
    title: 'Import Assets',
    description: 'Import assets from file'
  },
  '/assets/scan/:token': {
    title: 'Scan Results',
    description: 'View scan results'
  },
  '/assets/print-qr': {
    title: 'Print QR Codes',
    description: 'Print QR codes for assets'
  },
  '/assets/:assetId': {
    title: 'Asset Details',
    description: 'View asset details and information'
  },
  '/assets/:assetId/edit': {
    title: 'Edit Asset',
    description: 'Edit asset information'
  },

  // Knowledge Base
  '/knowledge': {
    title: 'Knowledge Base',
    description: 'Search and manage knowledge articles'
  },
  '/knowledge/new': {
    title: 'New Article',
    description: 'Create a new knowledge article'
  },
  '/knowledge/import': {
    title: 'Import Articles',
    description: 'Import knowledge articles from file'
  },
  '/knowledge/:articleId': {
    title: 'Article',
    description: 'View knowledge article'
  },
  '/knowledge/:articleId/edit': {
    title: 'Edit Article',
    description: 'Edit knowledge article'
  },

  // Notifications
  '/notifications': {
    title: 'Notifications',
    description: 'Manage your notifications and preferences'
  },

  // Users
  '/users': {
    title: 'Users',
    description: 'Manage system users and access'
  },
  '/users/new': {
    title: 'New User',
    description: 'Create a new user account'
  },
  '/users/import': {
    title: 'Import Users',
    description: 'Import users from file'
  },
  '/users/:userId': {
    title: 'User Details',
    description: 'View and edit user information'
  },
  '/users/:userId/edit': {
    title: 'Edit User',
    description: 'Edit user account information'
  },

  // Anomalies
  '/anomalies': {
    title: 'Anomalies',
    description: 'Monitor and resolve system anomalies'
  },

  // Settings/Parametres
  '/parametres': {
    title: 'Settings',
    description: 'Manage system settings and preferences'
  },

  // Reports
  '/reports': {
    title: 'Reports',
    description: 'View and generate system reports'
  },

  // Auth pages
  '/login': {
    title: 'Login',
    description: 'Sign in to your ITSM Platform account'
  },
  '/register': {
    title: 'Register',
    description: 'Create a new account'
  },
  '/forgot-password': {
    title: 'Forgot Password',
    description: 'Reset your password'
  },
  '/reset-password/:token': {
    title: 'Reset Password',
    description: 'Create a new password'
  },
}

/**
 * Get title and description for a given route path
 * Matches dynamic routes (with :params) against actual paths
 * 
 * @param {string} pathname - The current pathname from useLocation()
 * @returns {Object} { title, description, isMatchedRoute }
 */
export const getTitleForRoute = (pathname) => {
  // Normalize path (remove trailing slash)
  const normalizedPath = pathname.replace(/\/$/, '') || '/'

  // First, try exact match
  if (ROUTE_TITLES[normalizedPath]) {
    return {
      title: ROUTE_TITLES[normalizedPath].title,
      description: ROUTE_TITLES[normalizedPath].description,
      isMatchedRoute: true
    }
  }

  // Then, try pattern matching for dynamic routes
  for (const [routePattern, routeData] of Object.entries(ROUTE_TITLES)) {
    // Convert route pattern to regex: /users/:userId -> /users/[^/]+
    const regexPattern = routePattern
      .replace(/:\w+/g, '[^/]+')
      .replace(/\//g, '\\/')
    const regex = new RegExp(`^${regexPattern}$`)

    if (regex.test(normalizedPath)) {
      return {
        title: routeData.title,
        description: routeData.description,
        isMatchedRoute: true
      }
    }
  }

  // No match found
  return {
    title: null,
    description: null,
    isMatchedRoute: false
  }
}

export default ROUTE_TITLES
