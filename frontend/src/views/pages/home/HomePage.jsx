// frontend/src/views/pages/home/HomePage.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CContainer, CRow, CCol, CCollapse, useColorModes } from '@coreui/react'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import {
  cilNotes, cilLaptop, cilChartLine, cilShieldAlt,
  cilSettings, cilHeadphones, cilBuilding, cilMenu, cilX,
  cilCheckAlt, cilMediaPlay, cilLibrary, cilSun, cilMoon,
} from '@coreui/icons'
import LanguageToggle from '../../../components/LanguageToggle'
import { translateRole } from '../../../utils/translate'
import { getTicketStats } from '../../../services/ticketService'
import { getAssetCounts } from '../../../services/assetService'

// ── Palette de thème (clair / sombre) ───────────────────────────────────────────
const PALETTE = {
  dark: {
    pageBg: '#0a1128',
    navBgScrolled: 'rgba(10,17,40,0.97)',
    navBorder: '1px solid rgba(255,255,255,0.08)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.5)',
    textFaint: 'rgba(255,255,255,0.3)',
    accent: '#3b82f6',
    accentLight: '#60a5fa',
    accentSoftBg: 'rgba(59,130,246,0.15)',
    accentSoftBorder: 'rgba(59,130,246,0.3)',
    accentBannerBg: 'rgba(59,130,246,0.08)',
    accentBannerBorder: 'rgba(59,130,246,0.15)',
    cardBg: 'rgba(255,255,255,0.03)',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardBorderHover: 'rgba(59,130,246,0.4)',
    cardBgHover: 'rgba(59,130,246,0.05)',
    panelBg: 'rgba(255,255,255,0.04)',
    panelBorder: 'rgba(255,255,255,0.1)',
    pillBg: 'rgba(255,255,255,0.08)',
    pillBorder: 'rgba(255,255,255,0.15)',
    pillText: 'rgba(255,255,255,0.6)',
    sectionAltBg: 'rgba(255,255,255,0.02)',
    sectionBorder: 'rgba(255,255,255,0.06)',
    trackBg: 'rgba(255,255,255,0.08)',
    thumbBg: '#0d1a3a',
    navLinkColor: 'rgba(255,255,255,0.75)',
    navLinkHover: '#ffffff',
    mobileMenuBg: 'rgba(10,17,40,0.98)',
    mobileMenuBorder: '1px solid rgba(255,255,255,0.1)',
    mobileItemBorder: '1px solid rgba(255,255,255,0.06)',
    toggleBg: 'rgba(255,255,255,0.08)',
    toggleBorder: '1px solid rgba(255,255,255,0.15)',
    toggleHoverBg: 'rgba(255,255,255,0.16)',
  },
  light: {
    pageBg: '#f4f6fb',
    navBgScrolled: 'rgba(255,255,255,0.96)',
    navBorder: '1px solid rgba(15,23,42,0.08)',
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15,23,42,0.65)',
    textMuted: 'rgba(15,23,42,0.55)',
    textFaint: 'rgba(15,23,42,0.4)',
    accent: '#2563eb',
    accentLight: '#2563eb',
    accentSoftBg: 'rgba(37,99,235,0.1)',
    accentSoftBorder: 'rgba(37,99,235,0.25)',
    accentBannerBg: 'rgba(37,99,235,0.06)',
    accentBannerBorder: 'rgba(37,99,235,0.15)',
    cardBg: '#ffffff',
    cardBorder: 'rgba(15,23,42,0.08)',
    cardBorderHover: 'rgba(37,99,235,0.35)',
    cardBgHover: 'rgba(37,99,235,0.03)',
    panelBg: '#ffffff',
    panelBorder: 'rgba(15,23,42,0.08)',
    pillBg: 'rgba(15,23,42,0.05)',
    pillBorder: 'rgba(15,23,42,0.1)',
    pillText: 'rgba(15,23,42,0.6)',
    sectionAltBg: '#ffffff',
    sectionBorder: 'rgba(15,23,42,0.06)',
    trackBg: 'rgba(15,23,42,0.08)',
    thumbBg: '#e2e8f0',
    navLinkColor: 'rgba(15,23,42,0.7)',
    navLinkHover: '#0f172a',
    mobileMenuBg: '#ffffff',
    mobileMenuBorder: '1px solid rgba(15,23,42,0.08)',
    mobileItemBorder: '1px solid rgba(15,23,42,0.06)',
    toggleBg: 'rgba(15,23,42,0.05)',
    toggleBorder: '1px solid rgba(15,23,42,0.12)',
    toggleHoverBg: 'rgba(15,23,42,0.1)',
  },
}

// ── Données (avec traduction) ──────────────────────────────────────────────────
const ROLE_COLORS = {
  Agent:      { bg: '#e8f5e9', text: '#2e7d32' },
  Technicien: { bg: '#e3f2fd', text: '#1565c0' },
  Admin:      { bg: '#fce4ec', text: '#c62828' },
  Tous:       { bg: '#f3e5f5', text: '#6a1b9a' },
}

const getHomeData = (t) => ({
  FEATURES: [
    { icon: cilNotes,      title: t('home.feature_tickets_title'),     desc: t('home.feature_tickets_desc') },
    { icon: cilLaptop,     title: t('home.feature_assets_title'),       desc: t('home.feature_assets_desc') },
    { icon: cilHeadphones, title: t('home.feature_support_title'),       desc: t('home.feature_support_desc') },
    { icon: cilChartLine,  title: t('home.feature_dashboard_title'),        desc: t('home.feature_dashboard_desc') },
    { icon: cilShieldAlt,  title: t('home.feature_security_title'),   desc: t('home.feature_security_desc') },
    { icon: cilSettings,   title: t('home.feature_integration_title'),             desc: t('home.feature_integration_desc') },
  ],
  STEPS: [
    { n: '01', title: t('home.step1_title'),             desc: t('home.step1_desc') },
    { n: '02', title: t('home.step2_title'),       desc: t('home.step2_desc') },
    { n: '03', title: t('home.step3_title'),     desc: t('home.step3_desc') },
    { n: '04', title: t('home.step4_title'),           desc: t('home.step4_desc') },
  ],
  VIDEOS: [
    {
      id: 'v1',
      title: t('home.video_ticket_title'),
      duration: '2 min',
      role: 'Agent',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Tickets',
      desc: t('home.video_ticket_desc'),
    },
    {
      id: 'v2',
      title: t('home.video_treat_title'),
      duration: '3 min',
      role: 'Technicien',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Technician',
      desc: t('home.video_treat_desc'),
    },
    {
      id: 'v3',
      title: t('home.video_admin_title'),
      duration: '4 min',
      role: 'Admin',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Admin',
      desc: t('home.video_admin_desc'),
    },
    {
      id: 'v4',
      title: t('home.video_assets_title'),
      duration: '3 min',
      role: 'Technicien',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Assets',
      desc: t('home.video_assets_desc'),
    },
    {
      id: 'v5',
      title: t('home.video_kb_title'),
      duration: '2 min',
      role: 'Tous',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Knowledge+Base',
      desc: t('home.video_kb_desc'),
    },
    {
      id: 'v6',
      title: t('home.video_notif_title'),
      duration: '1 min',
      role: 'Tous',
      thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Notifications',
      desc: t('home.video_notif_desc'),
    },
  ],
  STATS: [
    { value: '99.8%', label: t('home.stats_resolution') },
    { value: '< 15 min', label: t('home.stats_delay') },
    { value: '3 roles', label: t('home.stats_roles') },
    { value: '24/7', label: t('home.stats_availability') },
  ],
})

// ── Composants internes ────────────────────────────────────────────────────────

const NavBar = ({ c, colorMode, toggleTheme }) => {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (e, id) => {
    e.preventDefault()
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? c.navBgScrolled : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? c.navBorder : 'none',
      transition: 'all 0.3s ease', padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff',
          }}>IT</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: c.textPrimary }}>DRESI ITSM</span>
        </div>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="d-none d-lg-flex">
          {['home', 'features', 'guide', 'videos', 'contact'].map((id) => (
            <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)} style={{
              color: c.navLinkColor, textDecoration: 'none', fontSize: 14,
              fontWeight: 500, transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.target.style.color = c.navLinkHover}
              onMouseLeave={e => e.target.style.color = c.navLinkColor}
            >{t(`nav.${id}`)}</a>
          ))}

          <LanguageToggle />

          {/* Toggle thème clair/sombre */}
          <button
            onClick={toggleTheme}
            title={colorMode === 'dark' ? t('theme.light') : t('theme.dark')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '50%',
              background: c.toggleBg, border: c.toggleBorder,
              color: c.textPrimary, cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = c.toggleHoverBg}
            onMouseLeave={(e) => e.currentTarget.style.background = c.toggleBg}
          >
            <CIcon icon={colorMode === 'dark' ? cilSun : cilMoon} size="sm" />
          </button>

          <Link to="/login" style={{
            background: c.accent, color: '#fff', padding: '8px 20px',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>{t('nav.login')}</Link>
        </div>

        {/* Mobile : toggle thème + menu burger */}
        <div className="d-lg-none" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleTheme}
            title={colorMode === 'dark' ? t('theme.light') : t('theme.dark')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '50%',
              background: c.toggleBg, border: c.toggleBorder,
              color: c.textPrimary, cursor: 'pointer',
            }}
          >
            <CIcon icon={colorMode === 'dark' ? cilSun : cilMoon} size="sm" />
          </button>
          <button onClick={() => setOpen(!open)}
            style={{ background: 'none', border: 'none', color: c.textPrimary, cursor: 'pointer', padding: 8 }}>
            <CIcon icon={open ? cilX : cilMenu} size="lg" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: c.mobileMenuBg, padding: '16px 24px 24px', borderTop: c.mobileMenuBorder }}>
          <div style={{ padding: '8px 0' }}>
            <LanguageToggle />
          </div>
          {['home', 'features', 'guide', 'videos', 'contact'].map((id) => (
            <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)} style={{
              display: 'block', color: c.navLinkColor, textDecoration: 'none',
              padding: '12px 0', fontSize: 15, borderBottom: c.mobileItemBorder,
            }}>{t(`nav.${id}`)}</a>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} style={{
            display: 'block', marginTop: 16, background: c.accent, color: '#fff',
            padding: '12px 20px', borderRadius: 8, textDecoration: 'none',
            fontSize: 15, fontWeight: 600, textAlign: 'center',
          }}>{t('nav.login')}</Link>
        </div>
      )}
    </nav>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation()
  const [videoFilter, setVideoFilter] = useState('all')
  const [ticketStats, setTicketStats] = useState(null)
  const [assetCounts, setAssetCounts] = useState(null)
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const safeMode = colorMode === 'dark' ? 'dark' : 'light'
  const c = PALETTE[safeMode]

  const { FEATURES, STEPS, VIDEOS, STATS } = getHomeData(t)

  // Charger les vraies statistiques
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [ticketData, assetData] = await Promise.all([
          getTicketStats(),
          getAssetCounts()
        ])
        setTicketStats(ticketData)
        setAssetCounts(assetData)
      } catch (err) {
        console.error('[HomePage] Error loading stats:', err)
      }
    }
    loadStats()
  }, [])

  const toggleTheme = () => setColorMode(safeMode === 'dark' ? 'light' : 'dark')

  const roleFilters = [
    { value: 'all', label: t('home.filter_all') },
    { value: 'Agent', label: t('roles.Agent') },
    { value: 'Technicien', label: t('roles.Technicien') },
    { value: 'Admin', label: t('roles.Admin') },
  ]
  const filteredVideos = videoFilter === 'all'
    ? VIDEOS
    : VIDEOS.filter((v) => v.role === videoFilter || v.role === 'Tous')

  return (
    <div style={{ background: c.pageBg, minHeight: '100vh', overflowX: 'hidden', transition: 'background 0.3s ease' }}>
      <NavBar c={c} colorMode={safeMode} toggleTheme={toggleTheme} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section id="home" style={{ paddingTop: 120, paddingBottom: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-grid">
            <div>
              <span style={{
                display: 'inline-block', background: c.accentSoftBg,
                color: c.accentLight, border: `1px solid ${c.accentSoftBorder}`,
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                marginBottom: 24, letterSpacing: '0.04em',
              }}>{t('home.badge')}</span>

              <h1 style={{
                fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: c.textPrimary,
                lineHeight: 1.15, marginBottom: 20,
              }}>
                {t('home.hero_title')}<br />
                <span style={{ color: c.accent }}>{t('home.hero_title_accent')}</span>
              </h1>

              <p style={{ color: c.textSecondary, fontSize: 17, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
                {t('home.hero_desc')}
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/login" style={{
                  background: c.accent, color: '#fff', padding: '14px 32px',
                  borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                  transition: 'background 0.2s',
                }}>{t('home.cta_login')}</Link>
                <a href="#guide" onClick={(e) => { e.preventDefault(); document.getElementById('guide')?.scrollIntoView({ behavior: 'smooth' }) }}
                  style={{
                    background: c.pillBg, color: c.textPrimary, padding: '14px 32px',
                    borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                    border: c.pillBorder,
                  }}>{t('home.cta_guide')}</a>
              </div>

              <div style={{ marginTop: 40, display: 'flex', gap: 32 }}>
                {STATS.slice(0, 2).map(s => (
                  <div key={s.value}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: c.accent }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carte droite */}
            <div style={{
              background: c.panelBg, border: `1px solid ${c.panelBorder}`,
              borderRadius: 20, padding: 32,
            }}>
              <div style={{ color: c.textMuted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
                {t('home.kpi_title')}
              </div>
              {[
                { label: t('home.kpi_tickets'), val: '24', color: c.accent, pct: 60 },
                { label: t('home.kpi_resolved'), val: '187', color: '#22c55e', pct: 85 },
                { label: t('home.kpi_avg_time'), val: '12 min', color: '#f59e0b', pct: 40 },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: c.textSecondary, fontSize: 14 }}>{row.label}</span>
                    <span style={{ color: c.textPrimary, fontWeight: 700, fontSize: 14 }}>{row.val}</span>
                  </div>
                  <div style={{ background: c.trackBg, borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${row.pct}%`, background: row.color, borderRadius: 4, height: 6, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}

              <div style={{ borderTop: `1px solid ${c.cardBorder}`, marginTop: 24, paddingTop: 24 }}>
                {[
                  t('home.check_auto_assign'),
                  t('home.check_lifecycle'),
                  t('home.check_notes'),
                  t('home.check_sla')
                ].map(feat => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <CIcon icon={cilCheckAlt} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ color: c.textSecondary, fontSize: 14 }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats banner ──────────────────────────────────────────────────── */}
      <div style={{ background: c.accentBannerBg, borderTop: `1px solid ${c.accentBannerBorder}`, borderBottom: `1px solid ${c.accentBannerBorder}`, padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
          {STATS.map(s => (
            <div key={s.value} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.accentLight }}>{s.value}</div>
              <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fonctionnalités ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ color: c.accentLight, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t('home.features_section_label')}</div>
            <h2 style={{ color: c.textPrimary, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>{t('home.features_title')}</h2>
            <p style={{ color: c.textMuted, fontSize: 16, maxWidth: 520, margin: '0 auto' }}>{t('home.features_desc')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                borderRadius: 16, padding: 28, transition: 'border-color 0.2s, background 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.cardBorderHover; e.currentTarget.style.background = c.cardBgHover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.cardBorder; e.currentTarget.style.background = c.cardBg }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: c.accentSoftBg, border: `1px solid ${c.accentSoftBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <CIcon icon={f.icon} style={{ color: c.accentLight, fontSize: 20 }} />
                </div>
                <h3 style={{ color: c.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: c.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────────────────────────── */}
      <section id="guide" style={{ padding: '100px 24px', background: c.sectionAltBg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ color: c.accentLight, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t('home.guide_label')}</div>
            <h2 style={{ color: c.textPrimary, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>{t('home.guide_title')}</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 28, left: '12.5%', right: '12.5%', height: 1,
              background: `linear-gradient(90deg, transparent, ${c.accentSoftBorder}, transparent)`,
            }} className="d-none d-lg-block" />

            {STEPS.map((s, i) => (
              <div key={s.n} style={{ textAlign: 'center', padding: '0 16px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 18, fontWeight: 700, color: '#fff',
                  boxShadow: `0 0 0 6px ${c.accentSoftBg}`,
                  position: 'relative', zIndex: 1,
                }}>{s.n}</div>
                <h3 style={{ color: c.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: c.textMuted, fontSize: 14, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: c.accentSoftBg, color: c.accentLight,
              border: `1px solid ${c.accentSoftBorder}`, padding: '14px 32px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>
              <CIcon icon={cilLibrary} />
              {t('nav.register')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Vidéos & guides ───────────────────────────────────────────────── */}
      <section id="videos" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ color: c.accentLight, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t('home.videos_label')}</div>
            <h2 style={{ color: c.textPrimary, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>{t('home.videos_title')}</h2>
            <p style={{ color: c.textMuted, fontSize: 16, maxWidth: 500, margin: '0 auto' }}>{t('home.videos_desc')}</p>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            {roleFilters.map(({ value, label }) => (
              <button key={value} onClick={() => setVideoFilter(value)} style={{
                padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                background: videoFilter === value ? c.accent : c.pillBg,
                color: videoFilter === value ? '#fff' : c.pillText,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {filteredVideos.map(v => {
              const rc = ROLE_COLORS[v.role] || ROLE_COLORS['Tous']
              return (
                <div key={v.id} style={{
                  background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                  borderRadius: 16, overflow: 'hidden',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = c.cardBorderHover }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = c.cardBorder }}
                >
                  <div style={{ position: 'relative', background: c.thumbBg, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(59,130,246,0.85)', backdropFilter: 'blur(4px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'transform 0.2s, background 0.2s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#3b82f6' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(59,130,246,0.85)' }}
                    >
                      <CIcon icon={cilMediaPlay} style={{ color: '#fff', fontSize: 24 }} />
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 10, right: 10,
                      background: 'rgba(0,0,0,0.7)', color: '#fff',
                      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    }}>{v.duration}</div>
                  </div>

                  <div style={{ padding: '20px 20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                        background: rc.bg, color: rc.text,
                      }}>{v.role === 'Tous' ? t('home.filter_all') : translateRole(v.role)}</span>
                    </div>
                    <h3 style={{ color: c.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{v.title}</h3>
                    <p style={{ color: c.textMuted, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{v.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 56, padding: 32, background: c.accentBannerBg, border: `1px solid ${c.accentBannerBorder}`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ color: c.textPrimary, fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>{t('home.doc_title')}</h3>
              <p style={{ color: c.textMuted, margin: 0, fontSize: 14 }}>{t('home.doc_desc')}</p>
            </div>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: c.accent, color: '#fff', padding: '12px 24px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
            }}>
              <CIcon icon={cilLibrary} />
              {t('home.doc_btn')}
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: '100px 24px', background: c.sectionAltBg, borderTop: `1px solid ${c.sectionBorder}` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: c.accentLight, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{t('home.contact_label')}</div>
          <h2 style={{ color: c.textPrimary, fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>{t('home.contact_title')}</h2>
          <p style={{ color: c.textMuted, fontSize: 16, lineHeight: 1.7, marginBottom: 40 }}>
            {t('home.contact_desc')}
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:support@itsm-ministere.gov" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: c.accent, color: '#fff', padding: '14px 28px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>{t('home.contact_btn')}</a>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: c.pillBg, color: c.textPrimary,
              border: c.pillBorder,
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              fontWeight: 600, fontSize: 15,
            }}>{t('nav.login')}</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${c.sectionBorder}`, padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 11, color: '#fff',
            }}>IT</div>
            <span style={{ color: c.textSecondary, fontSize: 14, fontWeight: 600 }}>DRESI ITSM Platform</span>
          </div>
          <p style={{ color: c.textFaint, fontSize: 13, margin: 0 }}>
            © 2026 · support@itsm-ministere.gov
          </p>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </div>
  )
}

export default HomePage
