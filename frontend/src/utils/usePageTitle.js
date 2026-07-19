/**
 * Hook to manage document title and meta tags
 * Updates the browser tab title and can manage meta description
 *
 * Usage:
 *   usePageTitle('Dashboard')
 *   usePageTitle('Ticket #123', 'Dynamic title for this ticket')
 *   usePageTitle('Users', { description: 'Manage all users' })
 */

import { useEffect } from 'react'
import { generatePageTitle, APP_CONFIG } from './appConfig'

export const usePageTitle = (pageTitle, metaDescription = null, options = {}) => {
  useEffect(() => {
    // Generate full title with app name
    const fullTitle = generatePageTitle(pageTitle, options)
    
    // Update document title (browser tab)
    document.title = fullTitle
    
    // Update meta description if provided
    if (metaDescription) {
      let metaTag = document.querySelector('meta[name="description"]')
      if (!metaTag) {
        metaTag = document.createElement('meta')
        metaTag.name = 'description'
        document.head.appendChild(metaTag)
      }
      metaTag.content = metaDescription
    }
    
    // Cleanup: Restore default title when component unmounts (optional)
    return () => {
      // You can optionally restore the default title on unmount
      // Uncomment the line below if you want this behavior:
      // document.title = APP_CONFIG.name
    }
  }, [pageTitle, metaDescription, options])
}

export default usePageTitle
