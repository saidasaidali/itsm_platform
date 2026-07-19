import React from 'react'
import { useTranslation } from 'react-i18next'
import { EVENT_TYPES } from '../../services/calendarService'

/**
 * Légende modernisée des types d'événements avec leurs couleurs
 *
 * Props :
 * - compact : boolean (optionnel, défaut: false)
 */
const CalendarLegend = React.memo(({ compact = false }) => {
  const { t } = useTranslation()

  return (
    <div className={`calendar-legend ${compact ? 'calendar-legend--compact' : ''}`}>
      <div className="d-flex flex-wrap gap-1">
        {Object.entries(EVENT_TYPES).map(([key, value]) => (
          <div key={key} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: value.color }} />
            <span className="legend-label">{t(`calendar.types.${key}`) || value.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

CalendarLegend.displayName = 'CalendarLegend'

export default CalendarLegend
