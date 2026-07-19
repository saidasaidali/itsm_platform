import React from 'react'
import { CFormInput, CFormSelect } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import { EVENT_TYPES, EVENT_STATUSES } from '../../services/calendarService'

/**
 * Barre de filtres modernisée pour le calendrier
 *
 * Props :
 * - filters : { type, status, search }
 * - onFilterChange : (newFilters) => void
 */
const CalendarFilters = React.memo(({ filters, onFilterChange }) => {
  const { t } = useTranslation()

  const handleChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value })
  }

  return (
    <div className="calendar-filters-bar d-flex gap-2 align-items-center">
      <div className="filter-search flex-grow-1">
        <CIcon icon={cilSearch} className="search-icon" />
        <CFormInput
          type="text"
          placeholder={t('calendar.actions.search_placeholder')}
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
        />
      </div>
    </div>
  )
})

CalendarFilters.displayName = 'CalendarFilters'

export default CalendarFilters
