import React from 'react'
import { CCard, CCardBody, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilClock, cilSettings, cilArrowRight } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

const STATS_ITEMS = [
  { key: 'today', icon: cilCalendar, variant: 'today' },
  { key: 'week', icon: cilClock, variant: 'week' },
  { key: 'maintenance', icon: cilSettings, variant: 'maintenance' },
  { key: 'upcoming', icon: cilArrowRight, variant: 'upcoming' },
]

/**
 * Cartes de statistiques modernisées pour le calendrier
 *
 * Props :
 * - stats : { today, thisWeek, maintenance, upcoming }
 * - loading : boolean
 */
const CalendarStatsCards = React.memo(({ stats, loading }) => {
  const { t } = useTranslation()

  if (loading) return null

  return (
    <>
      {STATS_ITEMS.map((item) => (
        <CCol xs={12} md={6} lg={3} key={item.key}>
          <CCard className={`calendar-stats-card calendar-stats-card--${item.variant}`}>
            <CCardBody>
              <div className="stats-icon">
                <CIcon icon={item.icon} />
              </div>
              <div className="stats-label">
                {t(`calendar.widget.${item.key === 'week' ? 'week' : item.key}_title`)}
              </div>
              <div className="stats-value">
                {stats?.[item.key === 'week' ? 'thisWeek' : item.key] || 0}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      ))}
    </>
  )
})

CalendarStatsCards.displayName = 'CalendarStatsCards'

export default CalendarStatsCards
