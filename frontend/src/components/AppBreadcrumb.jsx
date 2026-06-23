import React from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'
import { getBreadcrumbLabel } from '../utils/translate'

const AppBreadcrumb = () => {
  const currentLocation = useLocation().pathname
  const { t } = useTranslation()

  const segments = currentLocation.split('/').filter(Boolean)
  const breadcrumbs = []

  let accumulated = ''
  for (let i = 0; i < segments.length; i++) {
    accumulated += `/${segments[i]}`
    const label = getBreadcrumbLabel(segments, i)
    if (label) {
      breadcrumbs.push({
        pathname: accumulated,
        name: label,
        active: i === segments.length - 1,
      })
    }
  }

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem href="/">{t('nav.home')}</CBreadcrumbItem>
      {breadcrumbs.map((breadcrumb, index) => (
        <CBreadcrumbItem
          {...(breadcrumb.active ? { active: true } : { href: breadcrumb.pathname })}
          key={index}
        >
          {breadcrumb.name}
        </CBreadcrumbItem>
      ))}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
