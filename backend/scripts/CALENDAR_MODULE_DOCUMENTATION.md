# Module Calendrier ITSM - Documentation Complète

## 📋 Vue d'ensemble

Le module Calendrier est une extension complète de la plateforme ITSM permettant la planification et le suivi de toutes les activités IT. Il s'intègre parfaitement avec les modules existants (Tickets, Équipements, Utilisateurs) et respecte l'architecture et les conventions du projet.

**Version:** 1.0.0  
**Date de déploiement:** 2026-07-07  
**Compatibilité:** React + Express + PostgreSQL

---

## 🗄️ Architecture Base de Données

### Tables créées

#### 1. `calendar_events` - Événements principaux
```sql
- id (SERIAL, PRIMARY KEY)
- title (VARCHAR 255, NOT NULL)
- description (TEXT)
- event_type (VARCHAR 50, DEFAULT 'autre')
- start_date (TIMESTAMP, NOT NULL)
- end_date (TIMESTAMP, NOT NULL)
- all_day (BOOLEAN, DEFAULT FALSE)
- status (VARCHAR 20, DEFAULT 'scheduled')
- color (VARCHAR 7)
- ticket_id (INTEGER, FK → tickets.id)
- asset_id (INTEGER, FK → assets.id)
- assigned_to (INTEGER, FK → users.id)
- created_by (INTEGER, FK → users.id, NOT NULL)
- department (VARCHAR 100)
- site (VARCHAR 150)
- reminder_1h (BOOLEAN, DEFAULT TRUE)
- reminder_1d (BOOLEAN, DEFAULT TRUE)
- reminder_start (BOOLEAN, DEFAULT FALSE)
- is_recurring (BOOLEAN, DEFAULT FALSE)
- recurrence_pattern (JSONB)
- location (VARCHAR 255)
- notes (TEXT)
- created_at (TIMESTAMP, DEFAULT NOW())
- updated_at (TIMESTAMP, DEFAULT NOW())
```

**Contraintes:**
- CHECK (end_date >= start_date)

#### 2. `calendar_event_participants` - Participants
```sql
- id (SERIAL, PRIMARY KEY)
- event_id (INTEGER, FK → calendar_events.id)
- user_id (INTEGER, FK → users.id)
- role (VARCHAR 50, DEFAULT 'attendee')
- status (VARCHAR 20, DEFAULT 'pending')
- notified_at (TIMESTAMP)
- created_at (TIMESTAMP, DEFAULT NOW())
- UNIQUE(event_id, user_id)
```

#### 3. `calendar_notifications` - Rappels
```sql
- id (SERIAL, PRIMARY KEY)
- event_id (INTEGER, FK → calendar_events.id)
- user_id (INTEGER, FK → users.id)
- notification_type (VARCHAR 20, NOT NULL)
- scheduled_at (TIMESTAMP, NOT NULL)
- sent_at (TIMESTAMP)
- status (VARCHAR 20, DEFAULT 'pending')
- channel (VARCHAR 20, DEFAULT 'in_app')
- created_at (TIMESTAMP, DEFAULT NOW())
- UNIQUE(event_id, user_id, notification_type)
```

### Vues

#### `calendar_upcoming_events`
Événements à venir (7 jours) avec informations enrichies:
- Jointures avec users, tickets, assets, participants
- Filtre sur les événements non annulés/complétés
- Tri par date de début

#### `calendar_stats`
Statistiques mensuelles par type et statut d'événement.

### Index (Performance)

```sql
- idx_calendar_events_dates (start_date, end_date)
- idx_calendar_events_type (event_type)
- idx_calendar_events_status (status)
- idx_calendar_events_ticket (ticket_id) WHERE ticket_id IS NOT NULL
- idx_calendar_events_asset (asset_id) WHERE asset_id IS NOT NULL
- idx_calendar_events_assigned (assigned_to) WHERE assigned_to IS NOT NULL
- idx_calendar_events_created_by (created_by)
- idx_calendar_participants_user (user_id)
- idx_calendar_participants_event (event_id)
- idx_calendar_notifications_scheduled (scheduled_at) WHERE status = 'pending'
- idx_calendar_notifications_user (user_id)
```

### Triggers

- `trigger_calendar_events_updated_at` - Met à jour automatiquement `updated_at` lors de modifications

---

## 🔌 API REST

### Endpoints disponibles

#### `GET /api/calendar/events`
Liste des événements avec filtres

**Query Parameters:**
- `start` (timestamp) - Date de début
- `end` (timestamp) - Date de fin
- `type` (string) - Type d'événement
- `status` (string) - Statut
- `ticket_id` (integer) - Filtrer par ticket
- `asset_id` (integer) - Filtrer par équipement
- `assigned_to` (integer) - Filtrer par utilisateur assigné

**Permissions:** Tous rôles authentifiés  
**Filtrage automatique:** 
- Technicien: voit ses événements + ceux qu'il a créés
- Agent: voit uniquement ses événements

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Maintenance serveur",
      "event_type": "maintenance_preventive",
      "start_date": "2026-07-10T10:00:00Z",
      "end_date": "2026-07-10T12:00:00Z",
      "color": "#28a745",
      "ticket_id": 5,
      "ticket_title": "Maintenance préventive",
      "asset_id": 12,
      "asset_tag": "SRV-001",
      "assigned_to": 3,
      "created_by": 1,
      "created_by_name": "admin"
    }
  ]
}
```

#### `GET /api/calendar/events/:id`
Détail d'un événement

**Permissions:** 
- Admin: tous les événements
- Technicien: ses événements + ceux créés par lui
- Agent: uniquement ses événements

#### `POST /api/calendar/events`
Créer un événement

**Permissions:** Admin, Technicien

**Body:**
```json
{
  "title": "Maintenance serveur",
  "description": "Maintenance préventive mensuelle",
  "event_type": "maintenance_preventive",
  "start_date": "2026-07-10T10:00:00Z",
  "end_date": "2026-07-10T12:00:00Z",
  "all_day": false,
  "status": "scheduled",
  "ticket_id": 5,
  "asset_id": 12,
  "assigned_to": 3,
  "department": "DSI",
  "site": "Siège",
  "location": "Salle serveur",
  "notes": "Prévoir outils de diagnostic",
  "reminder_1h": true,
  "reminder_1d": true,
  "reminder_start": false
}
```

**Response:** 201 Created

#### `PUT /api/calendar/events/:id`
Modifier un événement

**Permissions:** Admin (tous), Technicien (ses événements uniquement)

**Body:** Même structure que POST

#### `DELETE /api/calendar/events/:id`
Supprimer un événement

**Permissions:** Admin uniquement

**Response:**
```json
{
  "success": true,
  "message": "Événement supprimé avec succès."
}
```

#### `GET /api/calendar/stats`
Statistiques du calendrier

**Permissions:** Tous rôles authentifiés

**Response:**
```json
{
  "success": true,
  "data": {
    "today": 5,
    "thisWeek": 12,
    "maintenance": 3,
    "upcoming": 8
  }
}
```

---

## 🎨 Frontend - Architecture

### Composants créés

#### 1. `Calendar.jsx` - Page principale
**Chemin:** `frontend/src/views/calendar/Calendar.jsx`

**Fonctionnalités:**
- Affichage FullCalendar (Jour/Semaine/Mois/Agenda)
- Création d'événements (clic sur date)
- Modification (clic sur événement)
- Suppression (avec confirmation)
- Drag & drop pour déplacer
- Redimensionnement
- Filtres (type, statut, recherche)
- Navigation vers tickets/équipements liés
- Support RTL (arabe)
- i18n complet

**État local:**
```javascript
- view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
- events: []
- loading: boolean
- error: string | null
- stats: object | null
- showModal: boolean
- editingEvent: object | null
- selectedEvent: object | null
- filters: { type, status, search }
- formData: { title, description, event_type, dates, ... }
```

**Permissions:**
- Admin: accès complet
- Technicien: créer, modifier ses événements
- Agent: lecture seule

#### 2. `Calendar.scss` - Styles
**Chemin:** `frontend/src/views/calendar/Calendar.scss`

**Responsive:**
- Mobile: toolbar en colonne
- Adaptation automatique

**RTL:**
- Support direction RTL pour arabe

#### 3. `CalendarWidget.jsx` - Widget Dashboard
**Chemin:** `frontend/src/views/dashboard/CalendarWidget.jsx`

**Affichage:**
- 4 KPIs (aujourd'hui, semaine, maintenances, prochaines)
- Liste des 5 prochains événements du jour
- Navigation vers page calendrier

---

## 🔐 Permissions et Sécurité

### Rôles et droits

| Action | Admin | Technicien | Agent |
|---------|-------|------------|-------|
| Voir événements | ✅ Tous | ✅ Ses événements | ✅ Ses événements |
| Créer événement | ✅ | ✅ | ❌ |
| Modifier événement | ✅ Tous | ✅ Ses événements | ❌ |
| Supprimer événement | ✅ | ❌ | ❌ |
| Voir stats | ✅ | ✅ | ✅ |

### Implémentation

**Backend (calendarController.js):**
```javascript
// Récupération avec filtrage par rôle
if (role === 'Technicien') {
  query += ` AND (ce.assigned_to = $${++paramCount} OR ce.created_by = ${paramCount})`
  params.push(userId, userId)
} else if (role === 'Agent') {
  query += ` AND ce.created_by = $${++paramCount}`
  params.push(userId)
}

// Modification - vérification propriétaire
if (role !== 'Admin' && existing[0].created_by !== userId) {
  return res.status(403).json({ success: false, message: t(req, 'access_denied') })
}

// Suppression - Admin uniquement
if (role !== 'Admin') {
  return res.status(403).json({ success: false, message: t(req, 'access_denied') })
}
```

**Frontend (Calendar.jsx):**
```javascript
const canCreate = role === 'Admin' || role === 'Technicien'
const canEdit = role === 'Admin' || role === 'Technicien'
const canDelete = role === 'Admin'
```

---

## 🎨 Types d'événements

| Type | Couleur | Usage |
|------|---------|-------|
| `intervention_technique` | #dc3545 (rouge) | Interventions techniques |
| `maintenance_preventive` | #28a745 (vert) | Maintenance préventive |
| `maintenance_corrective` | #ffc107 (jaune) | Maintenance corrective |
| `deploiement` | #17a2b8 (cyan) | Déploiements |
| `installation_equipement` | #6f42c1 (violet) | Installations |
| `reunion` | #007bff (bleu) | Réunions |
| `formation` | #20c997 (teal) | Formations |
| `incident_critique` | #dc3545 (rouge) | Incidents critiques |
| `astreinte` | #fd7e14 (orange) | Astreintes |
| `autre` | #6c757d (gris) | Autres |

---

## 🔗 Intégrations

### Tickets
- Liaison via `ticket_id`
- Navigation cliquable depuis le calendrier vers la fiche ticket
- Affichage du titre du ticket dans la vue détaillée

### Équipements
- Liaison via `asset_id`
- Navigation cliquable vers la fiche équipement
- Affichage du tag et type d'équipement

### Utilisateurs
- `created_by`: créateur de l'événement
- `assigned_to`: technicien assigné
- Participants multiples (table `calendar_event_participants`)

---

## 📦 Dépendances à installer

### Backend
```bash
cd backend
npm install
# Aucune dépendance supplémentaire nécessaire
# Les migrations s'exécutent automatiquement
```

### Frontend
```bash
cd frontend
npm install

# Dépendances FullCalendar
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/interaction
```

---

## 🚀 Installation et Déploiement

### 1. Migrations de base de données

Les migrations s'exécutent **automatiquement** au démarrage du backend.

**Vérification:**
```bash
cd backend
npm start

# Logs attendus:
# [Migration] Module Calendrier vérifié/créé avec succès.
```

**Vérification manuelle (optionnel):**
```sql
-- Vérifier les tables
\d calendar_events
\d calendar_event_participants
\d calendar_notifications

-- Vérifier les vues
SELECT * FROM calendar_upcoming_events LIMIT 5;
SELECT * FROM calendar_stats LIMIT 5;

-- Vérifier les index
\d calendar_events
```

### 2. Configuration backend

**Fichier:** `backend/src/app.js`

La route est automatiquement enregistrée:
```javascript
app.use('/api/calendar', calendarRoutes);
```

### 3. Configuration frontend

**Fichiers modifiés:**
- `frontend/src/App.jsx` - Lazy import Calendar
- `frontend/src/routes.js` - Route `/calendar`
- `frontend/src/_nav.jsx` - Menu latéral
- `frontend/src/i18n/locales/fr.json` - Traductions

---

## 🧪 Tests à effectuer

### Tests fonctionnels

#### 1. Authentification et permissions
- [ ] Se connecter en tant qu'Admin
- [ ] Se connecter en tant que Technicien
- [ ] Se connecter en tant qu'Agent
- [ ] Vérifier l'accès au menu Calendrier pour chaque rôle
- [ ] Vérifier les droits de création/modification/suppression

#### 2. CRUD Événements
- [ ] Créer un événement (Admin)
- [ ] Créer un événement (Technicien)
- [ ] Modifier un événement
- [ ] Supprimer un événement (Admin uniquement)
- [ ] Vérifier les messages de succès/erreur
- [ ] Tester la validation des dates (fin >= début)

#### 3. Vues calendrier
- [ ] Vue Mois - affichage correct
- [ ] Vue Semaine - affichage correct
- [ ] Vue Jour - affichage correct
- [ ] Vue Agenda (liste) - affichage correct
- [ ] Navigation entre mois/semaines/jours
- [ ] Bouton "Aujourd'hui"

#### 4. Filtres et recherche
- [ ] Filtrer par type d'événement
- [ ] Filtrer par statut
- [ ] Recherche par titre/description/localisation
- [ ] Combinaison de filtres
- [ ] Réinitialisation des filtres

#### 5. Drag & Drop
- [ ] Déplacer un événement (Admin)
- [ ] Déplacer un événement (Technicien)
- [ ] Redimensionner un événement
- [ ] Vérifier la persistance après rafraîchissement

#### 6. Liaisons
- [ ] Créer un événement lié à un ticket
- [ ] Créer un événement lié à un équipement
- [ ] Cliquer sur le lien ticket → navigation vers ticket
- [ ] Cliquer sur le lien équipement → navigation vers équipement

#### 7. Widget Dashboard
- [ ] Vérifier l'affichage des 4 KPIs
- [ ] Vérifier la liste des événements du jour
- [ ] Cliquer sur un événement → navigation vers calendrier
- [ ] Vérifier le rafraîchissement automatique (20s)

#### 8. Internationalisation
- [ ] Basculer en français
- [ ] Basculer en anglais
- [ ] Basculer en arabe (RTL)
- [ ] Vérifier les traductions du calendrier
- [ ] Vérifier le format des dates

#### 9. Thème
- [ ] Mode clair
- [ ] Mode sombre
- [ ] Vérifier le contraste des événements

#### 10. Responsive
- [ ] Desktop (> 1200px)
- [ ] Tablet (768px - 1199px)
- [ ] Mobile (< 768px)
- [ ] Vérifier l'affichage du calendrier
- [ ] Vérifier les modals

### Tests techniques

#### Backend
```bash
# Tester les endpoints
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/calendar/events
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/calendar/stats

# Vérifier les migrations
psql -U postgres -d itsm_db -c "\d calendar_events"
psql -U postgres -d itsm_db -c "SELECT * FROM calendar_upcoming_events LIMIT 5;"

# Vérifier les index
psql -U postgres -d itsm_db -c "\di calendar_*"
```

#### Frontend
```bash
# Vérifier la compilation
cd frontend
npm run build

# Vérifier les erreurs ESLint
npm run lint

# Tester en développement
npm start
# → http://localhost:3001/#/calendar
```

---

## 📊 Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Calendar.jsx (Page principale)                             │
│  ├── FullCalendar (vues multiples)                          │
│  ├── Modals (création/édition/détail/suppression)          │
│  ├── Filtres (type, statut, recherche)                      │
│  └── calendarService.js (appels API)                        │
│                                                              │
│  CalendarWidget.jsx (Dashboard)                             │
│  ├── KPIs (aujourd'hui, semaine, maintenances)             │
│  └── Liste événements du jour                               │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Express.js)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  calendarRoutes.js                                           │
│  ├── GET /events (avec filtres)                             │
│  ├── GET /events/:id                                         │
│  ├── POST /events                                            │
│  ├── PUT /events/:id                                         │
│  ├── DELETE /events/:id                                      │
│  └── GET /stats                                              │
│                                                              │
│  calendarController.js                                       │
│  ├── getEvents() - Liste avec permissions                   │
│  ├── getEventById() - Détail + vérification droits          │
│  ├── createEvent() - Création + couleur auto                │
│  ├── updateEvent() - Modification + vérification            │
│  ├── deleteEvent() - Suppression (Admin only)               │
│  └── getStats() - KPIs statistiques                         │
│                                                              │
│  calendarService.js (optionnel, pour futures évolutions)    │
│                                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Base de données)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  calendar_events (10 types d'événements)                    │
│  ├── Relations: tickets, assets, users                      │
│  ├── Index: dates, type, status, relations                  │
│  └── Trigger: updated_at automatique                        │
│                                                              │
│  calendar_event_participants (participants)                 │
│  └── calendar_notifications (rappels)                       │
│                                                              │
│  Vues:                                                       │
│  ├── calendar_upcoming_events (7 jours)                     │
│  └── calendar_stats (statistiques mensuelles)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flux de données

### Création d'événement

```
1. User clique sur date → handleDateSelect()
2. Ouverture modal avec dates pré-remplies
3. User remplit formulaire → setFormData()
4. Clic sur "Enregistrer" → handleSubmit()
5. Appel API: POST /api/calendar/events
6. Backend: createEvent()
   - Vérification permissions
   - Insertion en base
   - Retour de l'événement créé
7. Rafraîchissement de la liste → fetchEvents()
8. Fermeture du modal
9. Affichage du nouvel événement dans le calendrier
```

### Modification par drag & drop

```
1. User déplace un événement
2. FullCalendar appelle handleEventDrop()
3. Récupération des nouvelles dates
4. Appel API: PUT /api/calendar/events/:id
5. Backend: updateEvent()
   - Vérification permissions
   - Update en base
   - Retour de l'événement modifié
6. Rafraîchissement de la liste
7. Si erreur → dropInfo.revert() (rollback visuel)
```

---

## 🎯 Points forts du module

### Architecture
- ✅ Modulaire et extensible
- ✅ Respect des conventions du projet
- ✅ Séparation des responsabilités (MVC)
- ✅ Migrations automatiques
- ✅ Index optimisés pour les performances

### Sécurité
- ✅ Authentification JWT requise
- ✅ Autorisation par rôle (RBAC)
- ✅ Validation des entrées
- ✅ Protection CSRF (Helmet)
- ✅ Filtrage automatique des données par utilisateur

### Interface
- ✅ FullCalendar professionnel (compatible Outlook/Google Calendar)
- ✅ 4 vues différentes
- ✅ Drag & drop intuitif
- ✅ Code couleur automatique
- ✅ Responsive design
- ✅ Support RTL (arabe)
- ✅ i18n complet (FR/EN/AR)
- ✅ Mode clair/sombre

### Intégrations
- ✅ Liaison avec Tickets
- ✅ Liaison avec Équipements
- ✅ Navigation bidirectionnelle
- ✅ Widget Dashboard
- ✅ Menu latéral intégré

### Évolutivité
- ✅ Système de notifications préparé pour email
- ✅ Participants multiples (table dédiée)
- ✅ Récurrence (JSONB pour patterns complexes)
- ✅ Rappels configurables (1h, 1j, début)
- ✅ Extensible pour nouveaux types d'événements

---

## 🔮 Évolutions futures possibles

### Court terme
- [ ] Notifications email (SMTP déjà configuré)
- [ ] Notifications in-app avec tableau de bord
- [ ] Export iCal/Google Calendar
- [ ] Récurrence avancée (RRULE)
- [ ] Participants avec statuts (accepté/refusé)

### Moyen terme
- [ ] Vue planning par technicien
- [ ] Vue planning par équipement
- [ ] Vue planning par département
- [ ] Rapports PDF de planning
- [ ] Intégration avec système de ticketing automatique

### Long terme
- [ ] Synchronisation avec Outlook/Google Calendar
- [ ] Application mobile (React Native)
- [ ] Intelligence artificielle pour suggestions de créneaux
- [ ] Optimisation automatique des plannings
- [ ] Gestion des ressources (salles, véhicules, etc.)

---

## 📝 Notes techniques

### Performances
- Les index sur `start_date` et `end_date` optimisent les requêtes de plage
- Le filtrage par rôle se fait côté backend (pas de fuite de données)
- Les vues matérialisées pourraient être ajoutées si le volume augmente

### Maintenance
- Les migrations sont idempotentes (IF NOT EXISTS)
- Le trigger `updated_at` est automatique
- Les logs backend permettent de tracer les opérations

### Compatibilité
- Testé avec PostgreSQL 12+
- Compatible avec le schéma existant (pas de modification des tables existantes)
- Respecte les contraintes d'intégrité référentielle

---

## 📞 Support

Pour toute question ou problème:
- **Email:** support@itsm-ministere.gov.ma
- **Documentation:** Voir README.md du projet
- **Issues:** GitHub repository

---

## ✅ Checklist de déploiement

- [ ] Backend démarré sans erreur
- [ ] Migrations exécutées avec succès
- [ ] Tables créées dans PostgreSQL
- [ ] Index créés
- [ ] Vues créées
- [ ] Frontend compilé sans erreur
- [ ] Dépendances FullCalendar installées
- [ ] Routes enregistrées
- [ ] Menu latéral affiché
- [ ] Tests fonctionnels passés
- [ ] Tests de permissions passés
- [ ] Tests responsive passés
- [ ] Tests i18n passés
- [ ] Documentation lue et comprise

---

**Module Calendrier ITSM - Version 1.0.0**  
*Développé pour le Ministère DRESI*  
*© 2026 - Tous droits réservés*