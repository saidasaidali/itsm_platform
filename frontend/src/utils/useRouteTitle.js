/**
 * Hook to automatically update document.title on route changes
 * Listens to location changes and applies the appropriate title based on ROUTE_TITLES map
 * 
 * This hook provides automatic title management for all routes.
 * Individual pages can still use usePageTitle() to override with dynamic titles.
 * 
 * Usage in AppContent.jsx:
 *   useRouteTitle()  // That's it! Handles all routes automatically
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getTitleForRoute } from './routeTitles'
import { APP_CONFIG } from './appConfig'

export const useRouteTitle = () => {
  const location = useLocation()

  useEffect(() => {
    // Get title and description for current route
    const { title, description, isMatchedRoute } = getTitleForRoute(location.pathname)

    if (isMatchedRoute && title) {
      // Generate full title with app name suffix
      const fullTitle = `${title} | ${APP_CONFIG.name}`
      document.title = fullTitle

      // Update meta description if provided
      if (description) {
        let metaTag = document.querySelector('meta[name="description"]')
        if (!metaTag) {
          metaTag = document.createElement('meta')
          metaTag.name = 'description'
          document.head.appendChild(metaTag)
        }
        metaTag.content = description
      }
    }
  }, [location.pathname])
}

export default useRouteTitle
