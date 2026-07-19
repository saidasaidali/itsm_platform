/**
 * Application Configuration - Metadata & Title Management
 * Define your app name and metadata here
 */

export const APP_CONFIG = {
  // Application name - used in page titles and metadata
  name: 'ITSM Platform',
  
  // Alternative names (can be used for different contexts)
  shortName: 'ITSM',
  
  // Application description for meta tags
  description: 'Smart IT Service Management Platform with AI-powered support',
  
  // Application keywords for SEO
  keywords: 'ITSM, IT Service Management, Ticketing, Asset Management, Helpdesk',
  
  // Organization/Author name
  author: 'Your Organization',
  
  // Brand/company name
  company: 'Your Company',
}

/**
 * Page titles mapping - Add your routes here
 * Used for page title generation
 */
export const PAGE_TITLES = {
  // Public pages
  '/': 'Home',
  '/login': 'Login',
  '/register': 'Register',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  
  // Dashboard & Main
  '/dashboard': 'Dashboard',
  
  // Tickets
  '/tickets': 'Tickets',
  '/tickets/new': 'Create Ticket',
  '/tickets/:ticketId': 'Ticket Details',
  '/tickets/:ticketId/edit': 'Edit Ticket',
  
  // Assets
  '/assets': 'Assets',
  '/assets/new': 'New Asset',
  '/assets/:assetId': 'Asset Details',
  '/assets/:assetId/edit': 'Edit Asset',
  '/assets/import': 'Import Assets',
  '/assets/print-qr': 'Print QR Codes',
  
  // Knowledge Base
  '/knowledge': 'Knowledge Base',
  '/knowledge/new': 'New Article',
  '/knowledge/:articleId': 'Article',
  '/knowledge/:articleId/edit': 'Edit Article',
  '/knowledge/import': 'Import Articles',
  
  // Users Management
  '/users': 'Users',
  '/users/new': 'New User',
  '/users/:userId': 'User Details',
  '/users/:userId/edit': 'Edit User',
  '/users/import': 'Import Users',
  
  // Settings & Configuration
  '/parametres': 'Settings',
  '/notifications': 'Notifications',
  '/anomalies': 'Anomalies',
  '/reports': 'Reports',
  
  // Error pages
  '/404': 'Page Not Found',
  '/500': 'Server Error',
}

/**
 * Generate page title with app name
 * @param {string} pageTitle - The page-specific title
 * @param {object} options - Optional configuration
 * @returns {string} - Full page title
 */
export const generatePageTitle = (pageTitle, options = {}) => {
  const { separator = '|', appName = APP_CONFIG.name } = options
  
  if (!pageTitle) {
    return appName
  }
  
  return `${pageTitle} ${separator} ${appName}`
}
