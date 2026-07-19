import React from 'react'
import { useTranslation } from 'react-i18next'
import { CFooter } from '@coreui/react'

const AppFooter = () => {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <CFooter className="px-4">
      <div>
        <span className="fw-semibold">{t('footer.platform')}</span>
        <span className="ms-1">{t('footer.copyright', { year })}</span>
      </div>
      <div className="ms-auto text-muted small">
        {t('footer.support')}
      </div>
    </CFooter>
  )
}

export default React.memo(AppFooter)
