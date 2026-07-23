# ITSM Platform - Intelligent IT Service Management

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/saidasaidali/cleannow_v2)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.x-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-15-blue.svg)](https://www.postgresql.org/)

> Plateforme complète de gestion des services informatiques (ITSM) intelligente et moderne avec IA intégrée.

## 📚 Table des matières

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancement](#lancement)
- [Structure du projet](#structure-du-projet)
- [API Documentation](#api-documentation)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contribuer](#contribuer)
- [Licence](#licence)
- [Auteur](#auteur)

---

## 🎯 Présentation

ITSM Platform est une plateforme complète de gestion des services informatiques (ITSM) intelligente et moderne. Elle combine les fonctionnalités classiques d'une plateforme ITSM avec des capacités avancées d'intelligence artificielle pour automatiser et optimiser la gestion du parc informatique, le support utilisateur et la maintenance proactive.

### Points clés

- 🤖 **Assistant Intelligent** : Analyse des demandes, création automatique de tickets, détection d'incidents de sécurité
- 🔍 **Découverte Réseau** : Scan automatique AD, SNMP, WMI avec Digital Twin
- 📊 **Analytics & ML** : Prédictions de pannes, analyse de sentiment, recommandations de techniciens
- 🌍 **Multilingue** : Support FR/EN/AR avec RTL
- 📱 **Mobile Ready** : Interface responsive, scan QR codes
- 🔐 **Sécurisé** : JWT, rôles, permissions, logs d'audit

---

## ✨ Fonctionnalités

### 📋 Gestion des Tickets
- Création, modification, suppression de tickets
- Transitions d'état automatisées (Nouveau → Assigné → En cours → Résolu → Clôturé)
- Auto-assignation aux techniciens avec moins de charge
- Commentaires et notes internes
- Historique complet des modifications
- Sessions distantes (intégration outils de support)
- Analyse de sentiment et priorisation automatique
- Suggestions de résolution basées sur l'IA

### 💻 Gestion des Parc Informatique (CMDB)
- Inventaire complet des équipements
- Scan automatique via AD, SNMP, WMI
- Génération et scan de QR codes
- Suivi des garanties et alertes automatiques
- Historique des modifications et affectations
- Import/export Excel
- Détection automatique des relations entre équipements
- Digital Twin du réseau

### 🤖 Smart Assistant (IA)
- **NLP** : Analyse du langage naturel, extraction d'entités
- **Classification** : Catégorisation et priorisation automatique de tickets
- **Sentiment** : Analyse de sentiment avec émotions et intensité
- **Sécurité** : Détection d'incidents de sécurité (malware, phishing, intrusion)
- **ML** : Prédiction de risque de panne (risk scoring)
- **Recommandations** : Recommandation de techniciens basée sur la charge et les compétences
- **Actions** : Création automatique de tickets
- **Apprentissage** : Le système apprend des tickets résolus

### 💬 Chatbot & Base de Connaissances
- Chat conversationnel en temps réel
- Recherche sémantique dans la base de connaissances
- RAG (Retrieval-Augmented Generation) avec LLM local (Ollama)
- Apprentissage automatique depuis les tickets résolus
- Recherche dans les documents PDF internes
- Cas appris automatiquement

### 📅 Calendrier & Maintenance
- Gestion d'événements et interventions
- Maintenance préventive automatique
- Rappels et notifications
- Vue planning par technicien
- Synchronisation avec les tickets
- Récurrence d'événements

### 📊 Rapports & Analytics
- Rapports mensuels, hebdomadaires, personnalisés
- Génération automatique en arrière-plan
- Graphiques interactifs (Chart.js)
- Export PDF
- Statistiques de tickets, équipements, utilisateurs
- Métriques Smart Assistant en temps réel

### 🔔 Notifications
- Notifications in-app
- Notifications email (Nodemailer)
- Préférences utilisateur configurables
- Notifications automatiques :
  - Création/modification/clôture de ticket
  - Assignation
  - Changement de statut
  - SLA breach
  - Incidents de sécurité
  - Nouveaux équipements détectés

### 🔐 Authentification & Autorisation
- Connexion JWT (username/email + mot de passe)
- Inscription publique (Technicien/Agent)
- Réinitialisation de mot de passe par email
- Rôles : Admin, Technicien, Agent
- Permissions granulaires par ressource
- Protection des routes

### 🌐 Découverte Réseau
- Scan Active Directory (PowerShell)
- Scan SNMP des équipements réseau
- Récupération état live via WMI
- Détection automatique des relations
- Cartographie réseau interactive (ReactFlow)
- Mode simulation pour développement

### 🎯 Auto-Ticketing
- Détection de patterns (pannes répétées, anomalies)
- Création automatique de tickets
- Gestion de cooldown (éviter spam)
- Escalade automatique
- Suggestions de résolution
- Fermeture automatique

---

## 🏗️ Architecture

### Vue d'ensemble

```
┌─────────────┐
│   Frontend  │  React 19 + CoreUI + Vite
│  (Port 3001)│
└──────┬──────┘
       │ HTTP/REST API
       ↓
┌─────────────┐
│   Backend   │  Node.js + Express 5
│  (Port 3000)│
└──────┬──────┘
       │
   ┌───┴───┬──────────┬──────────┐
   │       │          │          │
   ↓       ↓          ↓          ↓
┌──────┐ ┌──────┐ ┌────────┐ ┌──────────┐
│PostgreSQL│ │ Ollama│ │  AD   │ │  SNMP    │
│  (DB) │ │ (LLM)│ │(Scan) │ │ (Scan)   │
└──────┘ └──────┘ └────────┘ └──────────┘
       │
       ↓
┌─────────────┐
│  ML Service │  Python FastAPI (Port 8000)
│  (Optionnel)│
└─────────────┘
```

### Architecture Backend (Layered)

```
Routes (API Endpoints)
    ↓
Controllers (Gestion HTTP, validation)
    ↓
Services (Logique métier)
    ↓
Database (PostgreSQL)
```

**Couches transversales** :
- **Middlewares** : Authentification, validation, i18n, gestion d'erreurs
- **Utils** : Fonctions utilitaires (i18n, validation, historique)
- **Workers** : Services background (scheduler, monitors)

### Architecture Frontend

```
App.jsx (Routing + Auth Guards)
    ↓
DefaultLayout (Sidebar + Header + Content)
    ↓
Views (Pages par module)
    ↓
Components (Composants réutilisables)
    ↓
Services (Couche API)
```

**State Management** : Redux + Context API (Auth)
**Routing** : React Router DOM (HashRouter)
**i18n** : i18next (FR/EN/AR + RTL)

---

## 🛠️ Technologies

### Backend
- **Runtime** : Node.js 18+
- **Framework** : Express 5.2.1
- **Base de données** : PostgreSQL 15
- **Authentification** : JWT (jsonwebtoken) + bcrypt
- **Sécurité** : Helmet, CORS, express-validator
- **IA/ML** : Ollama (LLM local), scikit-learn, pandas
- **Fichiers** : Multer, PDFKit, pdf-parse, XLSX, Mammoth, Canvas
- **Communication** : Nodemailer (email), net-snmp (SNMP)
- **Utilitaires** : dotenv, chart.js

### Frontend
- **Framework** : React 19.2.4
- **UI Framework** : CoreUI 5.10.0
- **State Management** : Redux 5.0.1 + React Redux 9.2.0
- **Routing** : React Router DOM 7.13.2
- **i18n** : i18next 26.3.1 + react-i18next 17.0.8
- **Visualisation** : ReactFlow 11.11.4, Chart.js 4.5.1
- **Build** : Vite 8.0.3
- **Styles** : SCSS (Sass)
- **Linting** : ESLint + Prettier

### Base de données
- **SGBD** : PostgreSQL 15
- **Extension** : pgcrypto (chiffrement)
- **Client** : pg (Node.js)

### IA & Machine Learning
- **LLM** : Ollama (modèles locaux : Llama 2, Mistral, etc.)
- **ML** : scikit-learn 1.4.2, pandas 2.2.2, joblib 1.4.2
- **NLP** : Traitement naturel custom (tokenization, stemming, intentions)
- **Sentiment** : Analyse de sentiment avec émotions

---

## 📋 Prérequis

### Logiciels requis

- **Node.js** : 18.x ou supérieur ([Télécharger](https://nodejs.org/))
- **npm** : 9.x ou supérieur (inclus avec Node.js)
- **PostgreSQL** : 15.x ou supérieur ([Télécharger](https://www.postgresql.org/download/))
- **Python** : 3.9+ (optionnel, pour le service ML)
- **Git** : Pour cloner le repository

### Configuration système recommandée

- **RAM** : 8GB minimum, 16GB recommandés (16GB+ pour le service ML)
- **CPU** : 4 cœurs minimum, 8 cœurs recommandés
- **Stockage** : 5GB d'espace libre minimum
- **OS** : Windows 10+, macOS 11+, ou Linux (Ubuntu 20.04+)

### Ports requis

- **3000** : Backend API
- **3001** : Frontend (Vite dev server)
- **8000** : Service ML (optionnel)
- **5432** : PostgreSQL
- **11434** : Ollama (optionnel)

### Vérification des prérequis

```bash
# Vérifier Node.js
node --version  # Doit afficher v18.x ou supérieur

# Vérifier npm
npm --version   # Doit afficher 9.x ou supérieur

# Vérifier PostgreSQL
psql --version  # Doit afficher 15.x ou supérieur

# Vérifier Python (optionnel)
python --version  # Doit afficher 3.9+
```

---

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/saidasaidali/cleannow_v2.git
cd itsm-platform
```

### 2. Installation du Backend

```bash
cd backend

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Éditer le fichier .env avec vos paramètres (voir section Configuration)
```

### 3. Installation de la Base de données

```bash
# Créer la base de données
createdb itsm_db

# Importer le schéma
psql -U postgres -d itsm_db -f schema.sql

# Insérer les rôles de base
psql -U postgres -d itsm_db -c "INSERT INTO roles (name) VALUES ('Admin'), ('Technicien'), ('Agent');"

# Créer un utilisateur admin (remplacer <hash> par un hash bcrypt)
psql -U postgres -d itsm_db -c "INSERT INTO users (username, email, password, role_id, status) VALUES ('admin', 'admin@itsm.com', '<hash>', 1, 'active');"
```

**Générer un hash bcrypt** :
```bash
node -e "console.log(require('bcrypt').hashSync('admin123', 12))"
```

### 4. Installation du Frontend

```bash
cd ../frontend

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Éditer le fichier .env avec vos paramètres
```

### 5. Installation du Service ML (optionnel)

```bash
cd backend/ml

# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement virtuel
# Windows :
venv\Scripts\activate
# Linux/Mac :
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

---

## ⚙️ Configuration

### Variables d'environnement - Backend

Créer un fichier `.env` dans le dossier `backend/` :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itsm_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT (Générer une clé sécurisée en production!)
JWT_SECRET=your-secret-key-minimum-32-characters-change-in-production

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@itsm.com

# Frontend
FRONTEND_URL=http://localhost:3001

# CORS
CORS_ORIGIN=http://localhost:3001

# Agent Windows
ASSET_AGENT_KEY=your-secret-key-for-windows-agent

# Service ML
ENABLE_ML_SERVICE=true
ML_SERVICE_URL=http://localhost:8000

# Ollama (LLM)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Debug
RAG_DEBUG_MODE=false
```

### Variables d'environnement - Frontend

Créer un fichier `.env` dans le dossier `frontend/` :

```env
VITE_API_URL=http://localhost:3000/api
```

### Configuration avancée

#### Configuration Email (SMTP)

**Gmail** :
1. Activer la validation en deux étapes
2. Générer un mot de passe d'application
3. Utiliser le mot de passe d'application dans `SMTP_PASS`

**Outlook/Office 365** :
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
```

**SendGrid** :
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

#### Configuration Ollama

1. Installer Ollama : https://ollama.ai/
2. Démarrer le service :
   ```bash
   ollama serve
   ```
3. Télécharger un modèle :
   ```bash
   ollama pull llama2
   # ou
   ollama pull mistral
   ```

#### Configuration Active Directory

Le scan AD nécessite PowerShell avec les droits appropriés. Voir `backend/src/services/networkDiscovery/scan-ad.ps1`.

---

## 🎬 Lancement

### Mode Développement

**Terminal 1 - Backend** :
```bash
cd backend
npm run dev
```
✅ Serveur disponible sur `http://localhost:3000`

**Terminal 2 - Frontend** :
```bash
cd frontend
npm start
```
✅ Application disponible sur `http://localhost:3001`

**Terminal 3 - Service ML (optionnel)** :
```bash
cd backend/ml
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
uvicorn app:app --reload --port 8000
```
✅ Service ML disponible sur `http://localhost:8000`

**Terminal 4 - Ollama (optionnel)** :
```bash
ollama serve
```

### Mode Production

**Backend** :
```bash
cd backend
npm start
```

**Frontend** :
```bash
cd frontend
npm run build
# Servir le dossier dist/ avec Nginx, Apache, ou similaire
```

**Avec PM2 (recommandé pour production)** :
```bash
# Installer PM2
npm install -g pm2

# Démarrer le backend
cd backend
pm2 start src/app.js --name itsm-backend

# Démarrer le service ML
cd backend/ml
pm2 start "uvicorn app:app --host 0.0.0.0 --port 8000" --name itsm-ml
```

### Vérification

```bash
# Vérifier que le backend fonctionne
curl http://localhost:3000/api/health

# Réponse attendue :
# {"status":"OK","timestamp":"2025-01-01T00:00:00.000Z"}
```

---

## 📁 Structure du projet

```
itsm-platform/
├── backend/                      # API REST Express
│   ├── src/
│   │   ├── app.js               # Point d'entrée, configuration, migrations
│   │   ├── db.js                # Connexion PostgreSQL
│   │   ├── controllers/         # Contrôleurs (couche présentation)
│   │   │   ├── authController.js
│   │   │   ├── ticketController.js
│   │   │   ├── assetController.js
│   │   │   └── ...
│   │   ├── routes/              # Routes API
│   │   │   ├── authRoutes.js
│   │   │   ├── ticketRoutes.js
│   │   │   └── ...
│   │   ├── services/            # Logique métier
│   │   │   ├── authService.js
│   │   │   ├── smartAssistantService.js
│   │   │   ├── ragService.js
│   │   │   ├── autoTicketing/
│   │   │   ├── chatbot/
│   │   │   ├── knowledgeProviders/
│   │   │   └── networkDiscovery/
│   │   ├── middlewares/          # Middlewares Express
│   │   │   ├── authMiddleware.js
│   │   │   └── ...
│   │   ├── utils/               # Utilitaires
│   │   │   ├── i18n.js
│   │   │   └── ...
│   │   └── mock/                # Données de simulation
│   ├── ml/                      # Service ML Python (FastAPI)
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── scripts/                 # Scripts utilitaires
│   ├── reports/                 # Rapports PDF générés
│   ├── storage/                 # Fichiers uploadés
│   ├── schema.sql               # Schéma PostgreSQL
│   └── package.json
│
├── frontend/                     # Application React
│   ├── src/
│   │   ├── App.jsx              # Composant racine, routing
│   │   ├── index.jsx            # Point d'entrée
│   │   ├── routes.js            # Configuration des routes
│   │   ├── store.js             # Store Redux
│   │   ├── views/               # Pages de l'application
│   │   │   ├── dashboard/
│   │   │   ├── tickets/
│   │   │   ├── assets/
│   │   │   ├── calendar/
│   │   │   ├── reports/
│   │   │   └── ...
│   │   ├── components/          # Composants réutilisables
│   │   │   ├── dashboard/
│   │   │   ├── calendar/
│   │   │   ├── SmartAssistant.jsx
│   │   │   └── ...
│   │   ├── services/            # Services API
│   │   │   ├── api.js
│   │   │   ├── ticketService.js
│   │   │   └── ...
│   │   ├── auth/                # Authentification
│   │   │   └── AuthProvider.jsx
│   │   ├── i18n/                # Internationalisation
│   │   │   ├── locales/         # Fichiers de traduction
│   │   │   │   ├── fr.json
│   │   │   │   ├── en.json
│   │   │   │   └── ar.json
│   │   │   └── index.js
│   │   ├── layout/              # Layout principal
│   │   ├── scss/                # Styles SCSS
│   │   └── utils/               # Utilitaires
│   ├── public/                  # Assets statiques
│   ├── package.json
│   └── vite.config.mjs
│
├── README.md                     # Ce fichier
├── LICENSE                       # Licence MIT
└── requirements.txt              # Dépendances Python (ML)
```

---

## 📸 Captures d'écran

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)
*Tableau de bord avec KPIs, graphiques et alertes*

### Gestion des Tickets
![Tickets](docs/screenshots/tickets.png)
*Liste des tickets avec filtres et statistiques*

### Gestion des Équipements
![Assets](docs/screenshots/assets.png)
*Inventaire du parc informatique avec QR codes*

### Smart Assistant
![Smart Assistant](docs/screenshots/smart-assistant.png)
*Assistant intelligent avec IA conversationnelle*

### Cartographie Réseau
![Network Map](docs/screenshots/network-map.png)
*Visualisation interactive du réseau (ReactFlow)*

### Calendrier
![Calendar](docs/screenshots/calendar.png)
*Planning des interventions et maintenance*

---

## 🔌 API Documentation

### Authentification

#### POST /api/auth/login
Connexion utilisateur

**Request** :
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response** :
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@itsm.com",
    "role": "Admin"
  }
}
```

#### POST /api/auth/register
Inscription publique (Technicien/Agent uniquement)

**Request** :
```json
{
  "username": "technicien1",
  "email": "tech@itsm.com",
  "password": "secure123",
  "role_id": 2
}
```

#### GET /api/auth/me
Profil utilisateur connecté (protégé)

**Headers** :
```
Authorization: Bearer <token>
```

### Tickets

#### GET /api/tickets
Liste des tickets (avec filtres)

**Query Parameters** :
- `status` : Filtrer par statut (Nouveau, Assigné, En cours, etc.)
- `priority` : Filtrer par priorité (Haute, Moyenne, Basse)

**Headers** :
```
Authorization: Bearer <token>
```

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Imprimante en panne",
      "status": "Nouveau",
      "priority": "Moyenne",
      "created_by_name": "agent1",
      "assigned_to_name": "tech1"
    }
  ]
}
```

#### POST /api/tickets
Créer un ticket (Agent uniquement)

**Request** :
```json
{
  "title": "Imprimante en panne",
  "description": "L'imprimante du 3ème étage ne répond plus",
  "priority": "Moyenne",
  "category": "Matériel",
  "asset_id": 5
}
```

#### PATCH /api/tickets/:id/status
Changer le statut d'un ticket

**Request** :
```json
{
  "status": "En cours"
}
```

#### POST /api/tickets/:id/comments
Ajouter un commentaire

**Request** :
```json
{
  "message": "Je travaille sur le problème",
  "is_internal": false
}
```

### Équipements

#### GET /api/assets
Liste des équipements (avec filtres)

**Query Parameters** :
- `status` : Filtrer par statut (En service, En panne, etc.)
- `type` : Filtrer par type (Ordinateur, Serveur, etc.)

#### POST /api/assets
Créer un équipement (Admin)

**Request** :
```json
{
  "asset_tag": "ASSET-001",
  "type": "Ordinateur",
  "brand": "Dell",
  "model": "Latitude 5520",
  "serial_number": "ABC123",
  "status": "En service"
}
```

#### POST /api/assets/import
Import massif depuis Excel (Admin)

**Body** : Form-data avec fichier Excel

### Smart Assistant

#### POST /api/smart-assistant/chat
Envoyer un message au Smart Assistant

**Request** :
```json
{
  "message": "Mon imprimante ne fonctionne plus, pouvez-vous m'aider ?"
}
```

**Response** :
```json
{
  "response": "Je vois que vous avez un problème avec l'imprimante. Je vais vous aider à créer un ticket.",
  "analysis": {
    "intent": "ticket_create",
    "sentiment": {
      "sentiment": "negative",
      "score": 65,
      "emotions": ["frustration"]
    },
    "asset": {
      "id": 5,
      "asset_tag": "ASSET-001"
    }
  },
  "sources": []
}
```

### Dashboard

#### GET /api/dashboard/stats
Statistiques globales

**Response** :
```json
{
  "success": true,
  "data": {
    "total_tickets": 150,
    "open_tickets": 23,
    "total_assets": 85,
    "total_users": 12
  }
}
```

### Documentation complète

Pour la documentation API complète, utiliser la collection Postman disponible dans `docs/postman/` ou générer la documentation Swagger/OpenAPI.

---

## ❓ FAQ

### Comment réinitialiser le mot de passe administrateur ?

```bash
# Générer un nouveau hash bcrypt
node -e "console.log(require('bcrypt').hashSync('nouveau_mot_de_passe', 12))"

# Mettre à jour dans la base de données
psql -U postgres -d itsm_db -c "UPDATE users SET password = '<nouveau_hash>' WHERE username = 'admin';"
```

### Comment activer le service ML ?

1. Installer les dépendances Python : `cd backend/ml && pip install -r requirements.txt`
2. Démarrer le service : `uvicorn app:app --reload --port 8000`
3. Dans le fichier `.env` du backend : `ENABLE_ML_SERVICE=true`

### Comment configurer le scan Active Directory ?

1. Configurer les paramètres AD dans `backend/src/services/networkDiscovery/scan-ad.ps1`
2. S'assurer que PowerShell a les droits d'exécution
3. Démarrer le scheduler : `startNetworkDiscovery()`

### Comment importer des équipements en masse ?

1. Aller dans **Équipements** → **Importer**
2. Télécharger le template Excel
3. Remplir le fichier avec les données
4. Uploader le fichier via l'interface

### Comment générer des QR codes pour les équipements ?

1. Aller dans **Équipements**
2. Sélectionner un équipement
3. Cliquer sur **Générer QR Code**
4. Scanner avec l'application mobile (optionnel)

### Comment activer le mode simulation ?

Le mode simulation est activé automatiquement si les services externes (AD, SNMP) ne sont pas disponibles. Pour forcer le mode simulation, modifier les paramètres dans `backend/src/services/mock/simulationService.js`.

### Comment résoudre les erreurs de connexion à la base de données ?

1. Vérifier que PostgreSQL est démarré : `pg_isready`
2. Vérifier les paramètres dans `.env` (host, port, user, password)
3. Vérifier que la base de données existe : `psql -U postgres -l`
4. Vérifier les droits de l'utilisateur PostgreSQL

### Comment mettre à jour le schéma de la base de données ?

Les migrations sont automatiques au démarrage du backend. Pour ajouter de nouvelles migrations, modifier `backend/src/app.js` dans la section "Migrations automatiques".

---

## 🗺️ Roadmap

### Version 1.1.0 (Q2 2025)
- [ ] Authentification à deux facteurs (2FA)
- [ ] SSO (Single Sign-On) - SAML/OAuth2
- [ ] Documentation API Swagger/OpenAPI
- [ ] Tests unitaires et d'intégration (couverture 80%)
- [ ] Rate limiting et protection DDoS
- [ ] Cache Redis pour performances

### Version 1.2.0 (Q3 2025)
- [ ] API GraphQL en plus de REST
- [ ] Application mobile React Native
- [ ] Intégration ServiceNow/Jira
- [ ] Tableaux de bord personnalisables
- [ ] Workflows visuels (BPMN)

### Version 2.0.0 (Q4 2025)
- [ ] Intégration Slack/Teams
- [ ] Prédictions ML avancées (LSTM, Transformers)
- [ ] Géolocalisation des équipements
- [ ] Gestion de parc cloud (AWS, Azure, GCP)
- [ ] Automatisation avancée (RPA)
- [ ] Monitoring (Prometheus, Grafana)
- [ ] CI/CD avec tests automatisés

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Voici comment contribuer :

1. **Fork** le projet
2. **Créer** une branche pour votre fonctionnalité : `git checkout -b feature/ma-fonctionnalite`
3. **Commit** vos changements : `git commit -m 'feat: ajout de ma fonctionnalité'`
4. **Push** vers la branche : `git push origin feature/ma-fonctionnalite`
5. **Ouvrir** une Pull Request

### Standards de code

- **Backend** : ESLint + Prettier
- **Frontend** : ESLint + Prettier
- **Commits** : Conventional Commits (feat, fix, docs, etc.)
- **Tests** : Ajouter des tests pour toute nouvelle fonctionnalité

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 👤 Auteur

**Saïd ASALI**
- GitHub : [@saidasaidali](https://github.com/saidasaidali)
- Email : contact@example.com
- Projet : [ITSM Platform](https://github.com/saidasaidali/cleannow_v2)

---

## 📞 Support

Pour toute question ou problème :

- 📝 **Issues** : [GitHub Issues](https://github.com/saidasaidali/cleannow_v2/issues)
- 📧 **Email** : contact@example.com
- 📖 **Documentation** : Voir le dossier `docs/`

---

## 🙏 Remerciements

- [CoreUI](https://coreui.io/) - Template React admin
- [Ollama](https://ollama.ai/) - LLM local
- [ReactFlow](https://reactflow.dev/) - Cartographie réseau
- [Chart.js](https://www.chartjs.org/) - Graphiques
- Tous les contributeurs du projet

---

**Dernière mise à jour** : Juillet 2026  
**Version** : 1.0.0
