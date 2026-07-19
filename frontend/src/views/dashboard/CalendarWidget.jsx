import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CBadge,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import { getStats } from '../../services/calendarService'
import { getEvents } from '../../services/calendarService'

const CalendarWidget = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [todayEvents, setTodayEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, eventsData] = await Promise.all([
          getStats(),
          getEvents({
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          }),
        ])
        setStats(statsData)
        setTodayEvents((eventsData || []).slice(0, 5)) // Top 5 events
      } catch (err) {
        console.error('Error fetching calendar data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <CCard className="h-100">
        <CCardBody className="text-center p-5">
          <CSpinner color="primary" />
        </CCardBody>
      </CCard>
    )
  }

  return (
    <>
      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <CCard className="h-100">
            <CCardBody className="p-3">
              <div className="text-uppercase text-secondary small mb-2">{t('calendar.widget.today_title')}</div>
              <div className="fs-2 fw-semibold">{stats?.today || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="h-100">
            <CCardBody className="p-3">
              <div className="text-uppercase text-secondary small mb-2">{t('calendar.widget.week_title')}</div>
              <div className="fs-2 fw-semibold">{stats?.thisWeek || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="h-100">
            <CCardBody className="p-3">
              <div className="text-uppercase text-secondary small mb-2">{t('calendar.widget.maintenance_title')}</div>
              <div className="fs-2 fw-semibold">{stats?.maintenance || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="h-100">
            <CCardBody className="p-3">
              <div className="text-uppercase text-secondary small mb-2">{t('calendar.widget.upcoming_title')}</div>
              <div className="fs-2 fw-semibold">{stats?.upcoming || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {todayEvents.length > 0 && (
        <CCard className="mb-4">
          <CCardHeader>
            <CIcon icon={cilCalendar} size="sm" className="me-2" />
            {t('calendar.widget.today_title')}
          </CCardHeader>
          <CCardBody className="p-0">
            {todayEvents.map((event) => (
              <div
                key={event.id}
                className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/calendar')}
              >
                <div>
                  <span className="fw-semibold">{event.title}</span>
                  <span className="text-muted ms-2 small">
                    {new Date(event.start_date).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <CBadge color="primary">{event.event_type}</CBadge>
              </div>
            ))}
          </CCardBody>
        </CCard>
      )}
    </>
  )
}

export default CalendarWidget