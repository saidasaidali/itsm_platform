// frontend/src/views/pages/home/HomePage.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CContainer, CRow, CCol, CCollapse } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilNotes, cilLaptop, cilChartLine, cilShieldAlt,
  cilSettings, cilHeadphones, cilBuilding, cilMenu, cilX,
  cilCheckAlt, cilMediaPlay, cilLibrary,
} from '@coreui/icons'

// ── Données ────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: cilNotes,      title: 'Gestion des tickets',     desc: 'Incidents centralisés, priorités automatiques, SLA intégrés.' },
  { icon: cilLaptop,     title: 'Parc informatique',       desc: 'Inventaire matériel et logiciel, maintenance planifiée.' },
  { icon: cilHeadphones, title: 'Support technique',       desc: 'Demandes traitées avec assignation et suivi en temps réel.' },
  { icon: cilChartLine,  title: 'Tableaux de bord',        desc: 'KPIs, tendances et performances IT visualisés.' },
  { icon: cilShieldAlt,  title: 'Sécurité & conformité',   desc: 'Audit, traçabilité et conformité réglementaire.' },
  { icon: cilSettings,   title: 'Intégration',             desc: 'Connexion aux outils métiers et annuaires existants.' },
]

const STEPS = [
  { n: '01', title: 'Connexion sécurisée',             desc: 'Accédez à votre espace via vos identifiants ministériels.' },
  { n: '02', title: 'Créez ou suivez un ticket',       desc: 'Déclarez un incident en quelques clics et suivez son avancement.' },
  { n: '03', title: 'Traitement par l\'équipe IT',     desc: 'Un technicien prend en charge votre demande selon la priorité.' },
  { n: '04', title: 'Résolution et clôture',           desc: 'Confirmez la résolution et consultez l\'historique complet.' },
]

const VIDEOS = [
  {
    id: 'v1',
    title: 'Créer votre premier ticket',
    duration: '2 min',
    role: 'Agent',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Créer+un+ticket',
    desc: 'Apprenez à déclarer un incident, choisir la priorité et suivre le traitement.',
  },
  {
    id: 'v2',
    title: 'Traiter un ticket (Technicien)',
    duration: '3 min',
    role: 'Technicien',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Traiter+un+ticket',
    desc: 'Prise en charge, mise en attente, résolution et notes internes.',
  },
  {
    id: 'v3',
    title: 'Tableau de bord Admin',
    duration: '4 min',
    role: 'Admin',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Dashboard+Admin',
    desc: 'Supervision globale, assignation manuelle et gestion des utilisateurs.',
  },
  {
    id: 'v4',
    title: 'Gérer le parc informatique',
    duration: '3 min',
    role: 'Technicien',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Parc+informatique',
    desc: 'Ajouter, modifier et suivre les équipements IT du ministère.',
  },
  {
    id: 'v5',
    title: 'Base de connaissance',
    duration: '2 min',
    role: 'Tous',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Base+de+connaissance',
    desc: 'Consulter et contribuer à la documentation technique partagée.',
  },
  {
    id: 'v6',
    title: 'Notifications & alertes',
    duration: '1 min',
    role: 'Tous',
    thumb: 'https://placehold.co/320x180/1a2744/4a9eff?text=Notifications',
    desc: 'Configurer les alertes SLA et les notifications de ticket.',
  },
]

const ROLE_COLORS = {
  Agent:      { bg: '#e8f5e9', text: '#2e7d32' },
  Technicien: { bg: '#e3f2fd', text: '#1565c0' },
  Admin:      { bg: '#fce4ec', text: '#c62828' },
  Tous:       { bg: '#f3e5f5', text: '#6a1b9a' },
}

const STATS = [
  { value: '99.8%', label: 'Taux de résolution' },
  { value: '< 15 min', label: 'Délai moyen de prise en charge' },
  { value: '3 rôles', label: 'Agent · Technicien · Admin' },
  { value: '24/7', label: 'Disponibilité de la plateforme' },
]

// ── Composants internes ────────────────────────────────────────────────────────

const NavBar = () => {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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
      background: scrolled ? 'rgba(10,17,40,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : 'none',
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
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>DRESI ITSM</span>
        </div>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="d-none d-lg-flex">
          {[['home','Accueil'],['features','Fonctionnalités'],['guide','Comment ça marche'],['videos','Vidéos & guides'],['contact','Contact']].map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)} style={{
              color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: 14,
              fontWeight: 500, transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.target.style.color='#fff'}
              onMouseLeave={e => e.target.style.color='rgba(255,255,255,0.75)'}
            >{label}</a>
          ))}
          <Link to="/login" style={{
            background: '#3b82f6', color: '#fff', padding: '8px 20px',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>Se connecter</Link>
        </div>

        {/* Mobile toggle */}
        <button className="d-lg-none" onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 8 }}>
          <CIcon icon={open ? cilX : cilMenu} size="lg" />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: 'rgba(10,17,40,0.98)', padding: '16px 24px 24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[['home','Accueil'],['features','Fonctionnalités'],['guide','Comment ça marche'],['videos','Vidéos & guides'],['contact','Contact']].map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={(e) => scrollTo(e, id)} style={{
              display: 'block', color: 'rgba(255,255,255,0.8)', textDecoration: 'none',
              padding: '12px 0', fontSize: 15, borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>{label}</a>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} style={{
            display: 'block', marginTop: 16, background: '#3b82f6', color: '#fff',
            padding: '12px 20px', borderRadius: 8, textDecoration: 'none',
            fontSize: 15, fontWeight: 600, textAlign: 'center',
          }}>Se connecter</Link>
        </div>
      )}
    </nav>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
const HomePage = () => {
  const [videoFilter, setVideoFilter] = useState('Tous')
  const roles = ['Tous', 'Agent', 'Technicien', 'Admin']
  const filteredVideos = videoFilter === 'Tous'
    ? VIDEOS
    : VIDEOS.filter(v => v.role === videoFilter || v.role === 'Tous')

  return (
    <div style={{ background: '#0a1128', minHeight: '100vh', overflowX: 'hidden' }}>
      <NavBar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section id="home" style={{ paddingTop: 120, paddingBottom: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-grid">
            <div>
              <span style={{
                display: 'inline-block', background: 'rgba(59,130,246,0.15)',
                color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)',
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                marginBottom: 24, letterSpacing: '0.04em',
              }}>Solution officielle ITSM · Ministère</span>

              <h1 style={{
                fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: '#fff',
                lineHeight: 1.15, marginBottom: 20,
              }}>
                Gérez votre IT<br />
                <span style={{ color: '#3b82f6' }}>avec précision</span>
              </h1>

              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
                Plateforme centralisée pour la gestion des incidents, du parc informatique et du support IT dans les administrations publiques.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/login" style={{
                  background: '#3b82f6', color: '#fff', padding: '14px 32px',
                  borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                  transition: 'background 0.2s',
                }}>Accéder à la plateforme</Link>
                <a href="#guide" onClick={(e) => { e.preventDefault(); document.getElementById('guide')?.scrollIntoView({ behavior: 'smooth' }) }}
                  style={{
                    background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '14px 32px',
                    borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}>Comment ça marche</a>
              </div>

              <div style={{ marginTop: 40, display: 'flex', gap: 32 }}>
                {STATS.slice(0, 2).map(s => (
                  <div key={s.value}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6' }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carte droite */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: 32,
            }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
                Indicateurs en temps réel
              </div>
              {[
                { label: 'Tickets en cours', val: '24', color: '#3b82f6', pct: 60 },
                { label: 'Résolus ce mois', val: '187', color: '#22c55e', pct: 85 },
                { label: 'Temps moyen', val: '12 min', color: '#f59e0b', pct: 40 },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{row.label}</span>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{row.val}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${row.pct}%`, background: row.color, borderRadius: 4, height: 6, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 24, paddingTop: 24 }}>
                {['Assignation automatique par charge', 'Cycle de vie complet du ticket', 'Notes internes techniciens', 'Alertes SLA en temps réel'].map(feat => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <CIcon icon={cilCheckAlt} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats banner ──────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(59,130,246,0.08)', borderTop: '1px solid rgba(59,130,246,0.15)', borderBottom: '1px solid rgba(59,130,246,0.15)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
          {STATS.map(s => (
            <div key={s.value} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#60a5fa' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fonctionnalités ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Fonctionnalités</div>
            <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>Une plateforme ITSM complète</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>Tous les outils nécessaires pour gérer efficacement le support IT d'une administration publique.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 28, transition: 'border-color 0.2s, background 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <CIcon icon={f.icon} style={{ color: '#60a5fa', fontSize: 20 }} />
                </div>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────────────────────────── */}
      <section id="guide" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Comment ça marche</div>
            <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>En 4 étapes simples</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 0, position: 'relative' }}>
            {/* Ligne de connexion desktop */}
            <div style={{
              position: 'absolute', top: 28, left: '12.5%', right: '12.5%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent)',
            }} className="d-none d-lg-block" />

            {STEPS.map((s, i) => (
              <div key={s.n} style={{ textAlign: 'center', padding: '0 16px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 18, fontWeight: 700, color: '#fff',
                  boxShadow: '0 0 0 6px rgba(59,130,246,0.15)',
                  position: 'relative', zIndex: 1,
                }}>{s.n}</div>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.3)', padding: '14px 32px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>
              <CIcon icon={cilLibrary} />
              Créer mon compte
            </Link>
          </div>
        </div>
      </section>

      {/* ── Vidéos & guides ───────────────────────────────────────────────── */}
      <section id="videos" style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Vidéos & guides</div>
            <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>Prenez en main la plateforme</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Des tutoriels vidéo adaptés à chaque rôle pour démarrer rapidement.</p>
          </div>

          {/* Filtres par rôle */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            {roles.map(r => (
              <button key={r} onClick={() => setVideoFilter(r)} style={{
                padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                background: videoFilter === r ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                color: videoFilter === r ? '#fff' : 'rgba(255,255,255,0.6)',
              }}>{r}</button>
            ))}
          </div>

          {/* Grille vidéos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {filteredVideos.map(v => {
              const rc = ROLE_COLORS[v.role] || ROLE_COLORS['Tous']
              return (
                <div key={v.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16, overflow: 'hidden',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >
                  {/* Thumbnail */}
                  <div style={{ position: 'relative', background: '#0d1a3a', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

                  {/* Contenu */}
                  <div style={{ padding: '20px 20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                        background: rc.bg, color: rc.text,
                      }}>{v.role}</span>
                    </div>
                    <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{v.title}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{v.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lien vers la doc */}
          <div style={{ marginTop: 56, padding: 32, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>Documentation complète</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 14 }}>Guides détaillés, FAQ et procédures pour chaque fonctionnalité.</p>
            </div>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#3b82f6', color: '#fff', padding: '12px 24px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
            }}>
              <CIcon icon={cilLibrary} />
              Consulter la doc
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section id="contact" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Contact & support</div>
          <h2 style={{ color: '#fff', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, marginBottom: 16 }}>Une question ?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.7, marginBottom: 40 }}>
            L'équipe technique du ministère est disponible pour vous accompagner dans la prise en main de la plateforme.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:support@itsm-ministere.gov" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#3b82f6', color: '#fff', padding: '14px 28px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>Contacter le support</a>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '14px 28px', borderRadius: 10, textDecoration: 'none',
              fontWeight: 600, fontSize: 15,
            }}>Se connecter</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 11, color: '#fff',
            }}>IT</div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>DRESI ITSM Platform</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>
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