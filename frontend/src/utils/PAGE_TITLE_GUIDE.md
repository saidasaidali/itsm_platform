# 📄 Guide de Gestion des Titres de Page

## 📋 Vue d'Ensemble

Ce guide explique comment gérer les titres dynamiques des pages dans l'application ITSM Platform.

Le système fonctionne avec un hook personnalisé `usePageTitle` qui met automatiquement à jour:
- ✅ Le titre de l'onglet du navigateur
- ✅ Les métadonnées de description
- ✅ Le format: `{PageTitle} | ITSM Platform`

---

## 🚀 Utilisation du Hook usePageTitle

### Import

```javascript
import usePageTitle from '../../utils/usePageTitle'
```

### Utilisation Basique

Au sein de votre composant, appelez le hook avec le titre de la page:

```javascript
const Dashboard = () => {
  // Simple - juste le titre de la page
  usePageTitle('Dashboard')
  
  return (
    // ... votre JSX
  )
}
```

**Résultat:**
- Onglet navigateur: `Dashboard | ITSM Platform`
- Meta description: inchangée

### Utilisation avec Description

Ajoutez une description pour les métadonnées:

```javascript
const Tickets = () => {
  // Avec description pour SEO
  usePageTitle('Tickets', 'Manage all IT support tickets')
  
  return (
    // ... votre JSX
  )
}
```

**Résultat:**
- Onglet navigateur: `Tickets | ITSM Platform`
- Meta description: `Manage all IT support tickets`

### Utilisation avec Options

Pour personnaliser le séparateur ou le nom de l'application:

```javascript
const CustomPage = () => {
  usePageTitle('My Page', 'Page description', {
    separator: '—',           // Utilise '—' au lieu de '|'
    appName: 'Custom Name'    // Utilise un nom d'app personnalisé
  })
  
  return (
    // ... votre JSX
  )
}
```

**Résultat:**
- Onglet navigateur: `My Page — Custom Name`

---

## 🎯 Exemples Pratiques

### 1️⃣ Liste de Tickets

```javascript
import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import usePageTitle from '../../utils/usePageTitle'

const Tickets = () => {
  const navigate = useNavigate()
  
  // Set page title with description
  usePageTitle('Tickets', 'Browse and manage all IT support tickets')
  
  const [tickets, setTickets] = useState([])
  
  return (
    <div>
      <h1>Support Tickets</h1>
      {/* ... */}
    </div>
  )
}

export default Tickets
```

**Onglet:** `Tickets | ITSM Platform`

---

### 2️⃣ Détail d'un Ticket Dynamique

Pour les pages avec des données dynamiques (comme l'ID du ticket), vous pouvez générer le titre dynamiquement:

```javascript
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import usePageTitle from '../../utils/usePageTitle'

const TicketDetail = () => {
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState(null)
  
  useEffect(() => {
    // Charger les données du ticket
    fetchTicket(ticketId).then(setTicket)
  }, [ticketId])
  
  // Mettre à jour le titre une fois les données chargées
  usePageTitle(
    ticket ? `Ticket #${ticket.id}` : 'Loading...',
    ticket ? `${ticket.title} - Priority: ${ticket.priority}` : 'Loading ticket details...'
  )
  
  if (!ticket) return <Spinner />
  
  return (
    <div>
      <h1>{ticket.title}</h1>
      {/* ... */}
    </div>
  )
}

export default TicketDetail
```

**Onglets possibles:**
- `Ticket #123 | ITSM Platform`
- `Ticket #456 | ITSM Platform`

---

### 3️⃣ Détail d'un Utilisateur

```javascript
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import usePageTitle from '../../utils/usePageTitle'

const UserDetail = () => {
  const { userId } = useParams()
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])
  
  usePageTitle(
    user ? `${user.firstName} ${user.lastName}` : 'Loading User...',
    user ? `User profile for ${user.email}` : 'Loading user details...'
  )
  
  if (!user) return <Spinner />
  
  return (
    <div>
      <h1>{user.firstName} {user.lastName}</h1>
      <p>Email: {user.email}</p>
      {/* ... */}
    </div>
  )
}

export default UserDetail
```

**Onglets possibles:**
- `John Doe | ITSM Platform`
- `Jane Smith | ITSM Platform`

---

### 4️⃣ Création de Ressource

```javascript
import React from 'react'
import usePageTitle from '../../utils/usePageTitle'

const CreateTicket = () => {
  usePageTitle('Create Ticket', 'Create a new IT support ticket')
  
  return (
    <div>
      <h1>Create New Ticket</h1>
      <form>{/* ... */}</form>
    </div>
  )
}

export default CreateTicket
```

**Onglet:** `Create Ticket | ITSM Platform`

---

### 5️⃣ Paramètres

```javascript
import React from 'react'
import usePageTitle from '../../utils/usePageTitle'

const Settings = () => {
  usePageTitle('Settings', 'Configure application settings and preferences')
  
  return (
    <div>
      <h1>Application Settings</h1>
      {/* ... */}
    </div>
  )
}

export default Settings
```

**Onglet:** `Settings | ITSM Platform`

---

## 📁 Configuration Centralisée

### Fichier: `src/utils/appConfig.js`

Ce fichier contient toutes les métadonnées de votre application:

```javascript
export const APP_CONFIG = {
  // Nom de l'application (utilisé dans tous les titres)
  name: 'ITSM Platform',
  
  // Nom court pour les apps PWA
  shortName: 'ITSM',
  
  // Description globale
  description: 'Smart IT Service Management Platform with AI-powered support',
  
  // Mots-clés pour SEO
  keywords: 'ITSM, IT Service Management, Ticketing, Asset Management, Helpdesk',
  
  // Auteur/Organisation
  author: 'Your Organization',
  
  // Entreprise
  company: 'Your Company',
}
```

### Personnaliser le Nom de l'Application

Pour changer le nom partout dans l'app, modifiez seulement `APP_CONFIG.name`:

```javascript
// AVANT
name: 'ITSM Platform',

// APRÈS
name: 'Helpdesk Pro',
```

Tous les titres de page s'actualiseront automatiquement! ✨

---

## 🔧 Configuration Avancée

### Personnaliser le Séparateur Global

Pour changer le séparateur par défaut (actuellement `|`), modifiez la fonction `generatePageTitle` dans `appConfig.js`:

```javascript
export const generatePageTitle = (pageTitle, options = {}) => {
  const { separator = '→', appName = APP_CONFIG.name } = options  // Changé: '|' → '→'
  
  if (!pageTitle) {
    return appName
  }
  
  return `${pageTitle} ${separator} ${appName}`
}
```

---

## 📚 Pages Déjà Configurées

Les pages suivantes utilisent déjà le hook `usePageTitle`:

✅ Dashboard  
✅ Login  
✅ Tickets  
✅ Assets  

Pour toutes les autres pages, suivez le modèle ci-dessus.

---

## 🎨 Personnaliser index.html

Le titre par défaut de la page (avant tout chargement) est défini dans `index.html`:

```html
<head>
  <title>ITSM Platform</title>
  <meta name="description" content="Smart IT Service Management Platform...">
  <meta name="author" content="Your Organization">
  <!-- ... -->
</head>
```

Modifiez ces valeurs pour personnaliser le titre initial.

---

## 🔗 Fichiers Modifiés

| Fichier | Modifications |
|---------|---------------|
| `index.html` | Titre et métadonnées par défaut |
| `src/utils/appConfig.js` | Configuration centralisée (NOUVEAU) |
| `src/utils/usePageTitle.js` | Hook personnalisé (NOUVEAU) |
| `src/App.jsx` | Import et utilisation du hook |
| `src/views/dashboard/Dashboard.jsx` | Intégration du hook |
| `src/views/pages/login/Login.jsx` | Intégration du hook |
| `src/views/tickets/Tickets.jsx` | Intégration du hook |
| `src/views/assets/Assets.jsx` | Intégration du hook |
| `public/manifest.json` | Métadonnées PWA actualisées |

---

## ✨ Bonnes Pratiques

1. ✅ **Toujours** ajouter une description au hook pour les pages principales
2. ✅ **Placer** l'appel au hook au début du composant (après les imports)
3. ✅ **Utiliser** des titres significatifs et conviviaux
4. ✅ **Éviter** les accents ou caractères spéciaux en excès
5. ✅ **Tester** dans différents navigateurs

---

## ❓ FAQ

**Q: Pourquoi mon titre n'a pas changé?**
> Vérifiez que vous avez importé et appelé `usePageTitle` dans votre composant. L'hook doit être appelé au niveau du composant, pas dans un sous-composant.

**Q: Puis-je avoir un titre différent du pattern "Title | App"?**
> Oui! Utilisez l'option `separator` ou `appName` pour personnaliser.

**Q: Cela affecte-t-il le SEO?**
> Oui! Le title et la meta description sont importants pour le SEO. Assurez-vous d'avoir des descriptions pertinentes.

**Q: Comment gérer les titres des pages d'erreur?**
> Utilisez `usePageTitle('Error 404', 'Page not found')` ou `usePageTitle('Error 500', 'Server error')`

---

## 🚀 Résumé

Pour ajouter un titre personnalisé à une nouvelle page:

1. Importez le hook: `import usePageTitle from '../../utils/usePageTitle'`
2. Appelez-le dans votre composant: `usePageTitle('Ma Page', 'Description optionnelle')`
3. C'est fait! ✨

Les titres sont maintenant gérés de manière centralisée, cohérente et facilement maintenable!
