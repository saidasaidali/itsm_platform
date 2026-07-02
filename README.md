# ITSM Platform

Système de Gestion des Services Informatiques (ITSM) complet avec intelligence artificielle, conçu pour la gestion des tickets, des équipements, la découverte réseau et l'assistance utilisateur intelligente.

---

# Fonctionnalités

## Gestion des Tickets
- Création, modification et suppression de tickets
- Attribution et transfert de tickets
- Suivi des statuts (Nouveau, Assigné, En cours, En attente, Résolu, Clôturé, Rouvert)
- Gestion des priorités (Basse, Moyenne, Haute, Critique)
- Catégorisation (Matériel, Logiciel, Réseau, Imprimante, Email, Accès, Autre)
- Système de commentaires et historique
- Sessions de support à distance
- Analyse de sentiment des tickets et commentaires
- Monitoring SLA avec alertes automatiques
- Auto-ticketing basé sur des règles

## Gestion des Équipements (Assets)
- Inventaire complet des équipements
- Génération et impression de QR Codes
- Scan de QR Codes pour identification rapide
- Import/Export Excel
- Affectation aux utilisateurs
- Historique des modifications
- Alertes de garantie
- Prédictions ML (risque, défaillance, anomalies)
- Heartbeat agent pour surveillance temps réel
- Découverte réseau automatique (SNMP, Active Directory)

## Base de Connaissances
- Création et gestion d'articles
- Import d'articles
- Recherche full-text en français
- Compteur de vues
- Catégorisation

## Chatbot IA
- Assistant conversationnel en français
- Intégration avec Ollama (LLaMA 3.2)
- Recherche sémantique dans la base de connaissances
- Mémoire des cas résolus (apprentissage automatique)
- Reconnaissance vocale (Whisper)
- Synthèse vocale (Piper TTS)
- Détection d'intention et classification
- Création de tickets depuis le chatbot

## Intelligence Artificielle
- **Prédiction de risque** : Score de risque pour chaque équipement
- **Prédiction de défaillance** : Estimation de panne future
- **Détection d'anomalies** : Identification de comportements anormaux
- **Analyse de sentiment** : Analyse des émotions dans les tickets
- **Recommandation de techniciens** : Suggestions basées sur les compétences
- **Service ML Python** : Modèles scikit-learn avec API FastAPI

## Découverte Réseau
- Scan SNMP automatique
- Scan Active Directory
- Cartographie réseau (Digital Twin)
- Détection de relations entre équipements
- Identification des appareils inconnus
- État temps réel des équipements

## Tableau de Bord
- Statistiques globales
- Graphiques interactifs (Chart.js)
- Carte réseau interactive (ReactFlow)
- Alertes et anomalies
- Métriques de performance
- Top tickets et équipements critiques

## Notifications
- Notifications in-app
- Emails (SMTP)
- Préférences utilisateur configurables
- Alertes SLA
- Notifications de changement de statut

## Gestion des Utilisateurs
- Authentification JWT
- Rôles (Admin, Technicien, Agent, Utilisateur)
- Profils utilisateur
- Import/Export Excel
- Réinitialisation de mot de passe
- Préférences de langue et de format

## Internationalisation
- Support multilingue (Français, Anglais, Arabe)
- Détection automatique de la langue
- Traductions dynamiques

## Rapports
- Génération de rapports PDF
- Rapports mensuels, hebdomadaires et personnalisés
- Export de données

## Smart Assistant
- Assistant intelligent contextuel
- Suggestions proactives
- Actions rapides

---

# Architecture du projet

```
itsm-platform/
├── backend/                 # API REST Node.js/Express
│   ├── src/
│   │   ├── routes/         # Routes API
│   │   ├── controllers/    # Contrôleurs
│   │   ├── services/       # Logique métier
│   │   ├── middlewares/    # Middlewares Express
│   │   ├── utils/          # Utilitaires
│   │   └── app.js          # Point d'entrée
│   ├── ml/                 # Service ML Python (FastAPI)
│   ├── schema.sql          # Schéma PostgreSQL
│   ├── migrations/         # Scripts SQL de migration
│   └── .env.example        # Variables d'environnement
│
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── views/          # Pages/Écrans
│   │   ├── services/       # Services API
│   │   ├── auth/           # Authentification
│   │   ├── i18n/           # Traductions
│   │   └── App.jsx         # Point d'entrée
│   ├── public/             # Assets statiques
│   └── .env.example        # Variables d'environnement
│
├── requirements.txt        # Dépendances Python (ML)
└── README.md              # Ce fichier
```

### Rôle des dossiers

**Backend**
- `routes/` : Définition des endpoints API
- `controllers/` : Logique de traitement des requêtes
- `services/` : Logique métier et intégrations (Ollama, ML, Email, etc.)
- `middlewares/` : Authentification, validation, i18n
- `utils/` : Fonctions utilitaires (i18n, PDF)
- `ml/` : Service Python séparé pour le Machine Learning

**Frontend**
- `components/` : Composants réutilisables (Header, Sidebar, Chatbot)
- `views/` : Pages de l'application (Tickets, Assets, Dashboard, etc.)
- `services/` : Clients API et logique frontend
- `auth/` : Gestion de l'authentification
- `i18n/` : Fichiers de traduction (fr, en, ar)

---

# Technologies utilisées

## Frontend
- **React 19** : Framework UI
- **Vite 8** : Build tool et dev server
- **CoreUI 5** : Framework UI Bootstrap-based
- **React Router 7** : Routage
- **Redux 5** : Gestion d'état
- **Chart.js 4** : Graphiques
- **ReactFlow 11** : Cartographie réseau
- **i18next** : Internationalisation
- **Axios** : Client HTTP (via services personnalisés)
- **SCSS** : Préprocesseur CSS
- **ESLint + Prettier** : Linting et formatting

## Backend
- **Node.js** : Runtime JavaScript
- **Express 5** : Framework web
- **PostgreSQL 15** : Base de données
- **JWT** : Authentification
- **bcrypt** : Hashage des mots de passe
- **Multer** : Upload de fichiers
- **Nodemailer** : Envoi d'emails
- **Ollama** : Intégration LLM (IA)
- **pdfkit** : Génération de PDF
- **xlsx** : Import/Export Excel
- **chart.js** : Génération de graphiques
- **net-snmp** : Scan réseau SNMP
- **Helmet** : Sécurité HTTP
- **CORS** : Gestion des origines croisées
- **express-validator** : Validation des données

## Intelligence Artificielle
- **Ollama** : Serveur LLM local
  - Modèle : LLaMA 3.2 (configurable via `OLLAMA_MODEL`)
- **Python 3** : Langage pour le service ML
- **FastAPI** : Framework API ML
- **scikit-learn** : Modèles de machine learning
  - Risk Scorer (score de risque)
  - Failure Predictor (prédiction de panne)
  - Anomaly Detector (détection d'anomalies)
- **LangChain** : Non utilisé (RAG manuel avec PostgreSQL Full-Text Search)

## Autres
- **Git** : Versioning
- **Docker** : Non configuré dans le projet actuel
- **PowerShell** : Scripts de scan AD Windows

---

# Prérequis

Avant d'installer le projet, assurez-vous d'avoir les éléments suivants :

- **Node.js** >= 18.x
- **npm** >= 9.x
- **PostgreSQL** >= 15.x
- **Git**
- **Ollama** (pour le chatbot IA)
- **Python 3.9+** (pour le service ML, optionnel)
- **pip** (gestionnaire de paquets Python)

---

# Installation

## 1. Cloner le projet

```bash
git clone https://github.com/saidasaidali/itsm_platform.git
cd itsm-platform
```

## 2. Installation du Backend

```bash
cd backend
npm install
```

## 3. Installation du Frontend

```bash
cd frontend
npm install
```

## 4. Installation du Service ML (Optionnel)

```bash
cd backend/ml
pip install -r requirements.txt
```

---

# Configuration

## Backend

Copiez le fichier `.env.example` vers `.env` :

```bash
cd backend
cp .env.example .env
```

Éditez le fichier `.env` et remplissez les variables selon votre environnement.

### Variables d'environnement Backend

```env
# Base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itsm_platform
DB_USER=postgres
DB_PASSWORD=your_password_here

# Authentification JWT
JWT_SECRET=your_jwt_secret_key_min_32_characters_long
JWT_EXPIRES_IN=7d

# Serveur Backend
PORT=3000
NODE_ENV=development

# Frontend URL (pour CORS et emails)
FRONTEND_URL=http://localhost:3001

# Configuration SMTP (Emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
SMTP_FROM=noreply@dresi.gov

# Agent Heartbeat (Optionnel)
ASSET_AGENT_KEY=your_secret_key_for_heartbeat_agent

# Configuration Réseau (Optionnel)
NETWORK_SCAN_BASE_IP=192.168.1
NETWORK_SCAN_START=1
NETWORK_SCAN_END=254

# Configuration Active Directory (Optionnel)
AD_SERVER=ldap://your-ad-server.com
AD_DOMAIN=DRESI
AD_USERNAME=service_account
AD_PASSWORD=service_password

# Configuration ML Service (Optionnel)
ML_SERVICE_URL=http://localhost:5000
ML_SERVICE_ENABLED=true

# Configuration Ollama (Chatbot IA)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Configuration des Logs
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Configuration des Tâches Planifiées
SLA_CHECK_INTERVAL=15
TICKET_MONITOR_INTERVAL=30
AUTO_TICKETING_INTERVAL=1
SNMP_SCAN_SCHEDULE=0 2 * * *
AD_SCAN_SCHEDULE=0 3 * * *

# Configuration des Uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.xlsx,.xls

# Configuration de Sécurité
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Configuration du Chatbot
CHATBOT_SESSION_TIMEOUT=3600
CHATBOT_MAX_HISTORY=50
```

## Frontend

Copiez le fichier `.env.example` vers `.env` :

```bash
cd frontend
cp .env.example .env
```

### Variables d'environnement Frontend

```env
# API Configuration
VITE_API_URL=http://localhost:3000

# Application
VITE_APP_NAME=ITSM Platform
VITE_APP_VERSION=1.0.0
VITE_APP_DESCRIPTION=Système de Gestion des Tickets IT

# Environnement
VITE_NODE_ENV=development
VITE_DEBUG=true

# Internationalisation
VITE_DEFAULT_LANGUAGE=fr
VITE_AVAILABLE_LANGUAGES=fr,en,ar

# Thème
VITE_DEFAULT_THEME=light
VITE_AVAILABLE_THEMES=light,dark,auto

# Authentification
VITE_TOKEN_KEY=itsm-auth-token
VITE_USER_KEY=itsm-user
VITE_TOKEN_CHECK_INTERVAL=300000

# Notifications
VITE_NOTIFICATION_POLL_INTERVAL=30000
VITE_NOTIFICATION_MAX_LOAD=50

# Uploads
VITE_MAX_FILE_SIZE=10485760
VITE_ALLOWED_EXCEL_TYPES=.xlsx,.xls

# Pagination
VITE_DEFAULT_PAGE_SIZE=20
VITE_PAGE_SIZE_OPTIONS=10,20,50,100

# Dashboard
VITE_DASHBOARD_REFRESH_INTERVAL=300000
VITE_DASHBOARD_TOP_TICKETS_LIMIT=5

# Chatbot
VITE_CHATBOT_URL=
VITE_CHATBOT_TIMEOUT=30000
VITE_CHATBOT_MAX_HISTORY=50

# ML Service (Optionnel)
VITE_ML_SERVICE_URL=http://localhost:5000
VITE_ML_ENABLED=true

# Features Flags
VITE_FEATURE_NETWORK_SCAN=true
VITE_FEATURE_EXCEL_IMPORT=true
VITE_FEATURE_QR_CODES=true
VITE_FEATURE_VOICE_CHAT=true
VITE_FEATURE_PDF_EXPORT=false
VITE_FEATURE_ADVANCED_REPORTS=false
VITE_FEATURE_REALTIME_MONITORING=true
```

---

# Configuration de PostgreSQL

## 1. Création de la base de données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE itsm_platform;

# Créer un utilisateur (optionnel, recommandé pour la production)
CREATE USER itsm_user WITH PASSWORD 'your_secure_password';

# Accorder les privilèges
GRANT ALL PRIVILEGES ON DATABASE itsm_platform TO itsm_user;

# Se connecter à la base
\c itsm_platform

# Accorder les privilèges sur le schéma public
GRANT ALL ON SCHEMA public TO itsm_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO itsm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO itsm_user;
```

## 2. Initialisation du schéma

Le schéma est automatiquement créé au premier démarrage du backend via les migrations automatiques dans `app.js`.

Pour initialiser manuellement :

```bash
cd backend
psql -U postgres -d itsm_platform -f schema.sql
```

## 3. Exécution des migrations

Les migrations suivantes sont exécutées automatiquement au démarrage :
- Colonnes de sentiment (tickets et commentaires)
- Tables Smart Assistant
- Table reports

---

# Installation d'Ollama

Le chatbot IA utilise Ollama pour fonctionner.

## 1. Installation d'Ollama

**Windows :**
```powershell
# Télécharger et installer depuis https://ollama.com/download
# Ou via winget
winget install Ollama.Ollama
```

**macOS :**
```bash
brew install ollama
```

**Linux :**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## 2. Vérification de l'installation

```bash
ollama --version
```

## 3. Téléchargement du modèle

```bash
# Le modèle par défaut est llama3.2
ollama pull llama3.2

# Autres modèles possibles (configurer via OLLAMA_MODEL dans .env)
ollama pull llama3.1
ollama pull mistral
ollama pull codellama
```

## 4. Lancer le serveur Ollama

```bash
# Démarrer le service Ollama
ollama serve

# Vérifier que le service fonctionne
curl http://localhost:11434/api/tags
```

## 5. Configuration Backend

Assurez-vous que les variables suivantes sont définies dans `backend/.env` :

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

# Installation du Service ML (Optionnel)

Le service ML est optionnel mais recommandé pour bénéficier des prédictions intelligentes.

## 1. Installer les dépendances Python

```bash
cd backend/ml
pip install -r requirements.txt
```

## 2. Démarrer le service ML

```bash
# Le service démarre automatiquement avec le backend
# Ou manuellement :
python app.py
```

Le service écoute sur le port 5000 par défaut.

## 3. Vérification

```bash
curl http://localhost:5000/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "service": "DRESI ML Service"
}
```

---

# Lancement du projet

## Ordre de démarrage recommandé

1. **PostgreSQL** : Démarrer le service PostgreSQL
2. **Ollama** : Démarrer le serveur Ollama (si chatbot IA activé)
3. **Service ML** : Démarrer le service Python (optionnel)
4. **Backend** : Démarrer le serveur Node.js
5. **Frontend** : Démarrer le serveur Vite

## 1. Démarrer PostgreSQL

**Windows (service) :**
```powershell
# Démarrer le service PostgreSQL
net start postgresql
```

**macOS :**
```bash
brew services start postgresql
```

**Linux :**
```bash
sudo systemctl start postgresql
```

## 2. Démarrer Ollama (si activé)

```bash
ollama serve
```

## 3. Démarrer le Backend

```bash
cd backend
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

**Scripts disponibles :**
- `npm start` : Démarrer en mode production
- `npm run dev` : Démarrer en mode développement avec rechargement automatique

## 4. Démarrer le Frontend

```bash
cd frontend
npm start
```

Le serveur démarre sur `http://localhost:3001`

**Scripts disponibles :**
- `npm start` : Démarrer le serveur de développement
- `npm run build` : Construire pour la production
- `npm run serve` : Prévisualiser le build de production
- `npm run lint` : Vérifier le code avec ESLint

## 5. Accéder à l'application

Ouvrir votre navigateur et accéder à :
```
http://localhost:3001
```

### Ports utilisés

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3001 | http://localhost:3001 |
| Backend API | 3000 | http://localhost:3000 |
| ML Service | 5000 | http://localhost:5000 |
| Ollama | 11434 | http://localhost:11434 |
| PostgreSQL | 5432 | localhost:5432 |

---

# Structure du projet

```
itsm-platform/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── ticketRoutes.js
│   │   │   ├── assetRoutes.js
│   │   │   ├── knowledgeRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   ├── anomalyRoutes.js
│   │   │   ├── smartCmdbRoutes.js
│   │   │   ├── autoTicketingRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   ├── settingsRoutes.js
│   │   │   ├── chatbotRoutes.js
│   │   │   ├── recommendationRoutes.js
│   │   │   ├── sentimentRoutes.js
│   │   │   ├── qrCodeRoutes.js
│   │   │   ├── smartAssistantRoutes.js
│   │   │   └── reportRoutes.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── ticketController.js
│   │   │   ├── assetController.js
│   │   │   ├── knowledgeController.js
│   │   │   ├── notificationController.js
│   │   │   ├── anomalyController.js
│   │   │   ├── smartCmdbController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── settingsController.js
│   │   │   ├── chatbotController.js
│   │   │   ├── recommendationController.js
│   │   │   ├── sentimentController.js
│   │   │   ├── qrCodeController.js
│   │   │   ├── smartAssistantController.js
│   │   │   └── reportController.js
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── ticketService.js
│   │   │   ├── assetService.js
│   │   │   ├── knowledgeService.js
│   │   │   ├── notificationService.js
│   │   │   ├── emailService.js
│   │   │   ├── slaMonitor.js
│   │   │   ├── ticketMonitor.js
│   │   │   ├── chatbot/
│   │   │   │   └── chatbotBrain.js
│   │   │   ├── autoTicketing/
│   │   │   │   ├── autoTicketEngine.js
│   │   │   │   ├── autoCloseEngine.js
│   │   │   │   └── suggestionEngine.js
│   │   │   ├── networkDiscovery/
│   │   │   │   ├── scheduler.js
│   │   │   │   ├── snmpScan.js
│   │   │   │   ├── adScan.js
│   │   │   │   ├── digitalTwin.js
│   │   │   │   ├── anomalyDetector.js
│   │   │   │   └── relationDetector.js
│   │   │   ├── mlService.js
│   │   │   ├── startMLService.js
│   │   │   ├── sentimentAnalyzer.js
│   │   │   ├── technicianRecommender.js
│   │   │   ├── qrCodeService.js
│   │   │   ├── smartAssistantService.js
│   │   │   ├── reportService.js
│   │   │   ├── settingsService.js
│   │   │   └── whisperService.js
│   │   ├── middlewares/
│   │   │   ├── authMiddleware.js
│   │   │   ├── roleMiddleware.js
│   │   │   └── languageMiddleware.js
│   │   ├── utils/
│   │   │   ├── i18n.js
│   │   │   └── pdfGenerator.js
│   │   ├── db.js
│   │   └── app.js
│   ├── ml/
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   ├── models/
│   │   │   ├── risk_scorer.py
│   │   │   ├── failure_predictor.py
│   │   │   └── anomaly_detector.py
│   │   └── data/
│   │       └── dataset_builder.py
│   ├── schema.sql
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.jsx
│   │   │   ├── AppBreadcrumb.jsx
│   │   │   ├── AppContent.jsx
│   │   │   ├── AppHeader.jsx
│   │   │   ├── AppSidebar.jsx
│   │   │   ├── AppSidebarNav.jsx
│   │   │   ├── Chatbot.jsx
│   │   │   ├── SmartAssistant.jsx
│   │   │   └── LanguageToggle.jsx
│   │   ├── views/
│   │   │   ├── dashboard/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   └── NetworkMap.jsx
│   │   │   ├── tickets/
│   │   │   │   ├── Tickets.jsx
│   │   │   │   ├── TicketForm.jsx
│   │   │   │   └── TicketDetail.jsx
│   │   │   ├── assets/
│   │   │   │   ├── Assets.jsx
│   │   │   │   ├── AssetForm.jsx
│   │   │   │   ├── AssetDetail.jsx
│   │   │   │   ├── PrintQRCodes.jsx
│   │   │   │   ├── ScanResult.jsx
│   │   │   │   └── ImportAssets.jsx
│   │   │   ├── knowledge/
│   │   │   │   ├── Knowledge.jsx
│   │   │   │   ├── Article.jsx
│   │   │   │   ├── ArticleForm.jsx
│   │   │   │   └── ImportArticles.jsx
│   │   │   ├── users/
│   │   │   │   ├── Users.jsx
│   │   │   │   ├── UserForm.jsx
│   │   │   │   └── ImportUsers.jsx
│   │   │   ├── notifications/
│   │   │   │   └── Notifications.jsx
│   │   │   ├── anomalies/
│   │   │   │   └── Anomalies.jsx
│   │   │   ├── reports/
│   │   │   │   └── Reports.jsx
│   │   │   ├── settings/
│   │   │   │   └── Parametres.jsx
│   │   │   ├── chatbot/
│   │   │   │   └── ChatbotWidget.jsx
│   │   │   └── pages/
│   │   │       ├── home/
│   │   │   │   └── HomePage.jsx
│   │   │       ├── login/
│   │   │   │   └── Login.jsx
│   │   │       ├── register/
│   │   │   │   └── Register.jsx
│   │   │       ├── logout/
│   │   │   │   └── Logout.jsx
│   │   │       └── auth/
│   │   │           ├── ForgotPassword.jsx
│   │   │           └── ResetPassword.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── ticketService.js
│   │   │   ├── assetService.js
│   │   │   ├── knowledgeService.js
│   │   │   ├── notificationService.js
│   │   │   ├── dashboardService.js
│   │   │   ├── chatbotService.js
│   │   │   ├── smartAssistantService.js
│   │   │   ├── anomalyService.js
│   │   │   ├── recommendationService.js
│   │   │   ├── sentimentService.js
│   │   │   ├── qrCodeService.js
│   │   │   ├── reportService.js
│   │   │   ├── settingsService.js
│   │   │   ├── userService.js
│   │   │   └── smartCmdbService.js
│   │   ├── auth/
│   │   │   ├── AuthProvider.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── i18n/
│   │   │   ├── index.js
│   │   │   └── locales/
│   │   │       ├── fr.json
│   │   │       ├── en.json
│   │   │       └── ar.json
│   │   ├── layout/
│   │   │   └── DefaultLayout.jsx
│   │   ├── App.jsx
│   │   ├── routes.js
│   │   ├── _nav.jsx
│   │   └── index.jsx
│   ├── public/
│   ├── scss/
│   │   └── style.scss
│   ├── package.json
│   ├── vite.config.mjs
│   └── .env.example
│
└── README.md
```

---

# Description des principaux dossiers

## Backend/src/routes/
Définit tous les endpoints API de l'application. Chaque fichier correspond à une ressource (tickets, assets, users, etc.) et regroupe les routes associées.

## Backend/src/controllers/
Contient la logique de traitement des requêtes HTTP. Chaque contrôleur gère les opérations CRUD et la logique métier pour une ressource spécifique.

## Backend/src/services/
Contient la logique métier réutilisable, les intégrations externes (Ollama, Email, SNMP, AD) et les services de fond (SLA Monitor, Ticket Monitor, etc.).

## Backend/src/middlewares/
Middlewares Express pour l'authentification JWT, la gestion des rôles, la validation des données et l'internationalisation.

## Backend/ml/
Service Python FastAPI séparé pour le Machine Learning. Contient les modèles de prédiction de risque, de défaillance et de détection d'anomalies.

## Frontend/src/views/
Pages de l'application React. Chaque dossier représente un module fonctionnel (tickets, assets, dashboard, etc.).

## Frontend/src/services/
Clients API et services frontend pour communiquer avec le backend. Gère les requêtes HTTP, le stockage local et la logique côté client.

## Frontend/src/i18n/
Fichiers de traduction pour le support multilingue (français, anglais, arabe).

---

# API

## Authentification
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/auth/login` | Connexion utilisateur |
| POST | `/api/auth/register` | Inscription utilisateur |
| POST | `/api/auth/logout` | Déconnexion |
| POST | `/api/auth/forgot-password` | Demande de réinitialisation |
| POST | `/api/auth/reset-password` | Réinitialisation du mot de passe |
| GET | `/api/auth/me` | Récupérer le profil utilisateur connecté |

## Utilisateurs
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/users` | Liste des utilisateurs |
| GET | `/api/users/:id` | Détails d'un utilisateur |
| POST | `/api/users` | Créer un utilisateur |
| PUT | `/api/users/:id` | Modifier un utilisateur |
| DELETE | `/api/users/:id` | Supprimer un utilisateur |
| POST | `/api/users/import` | Import Excel d'utilisateurs |

## Tickets
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/tickets` | Liste des tickets |
| GET | `/api/tickets/:id` | Détails d'un ticket |
| POST | `/api/tickets` | Créer un ticket |
| PATCH | `/api/tickets/:id/status` | Modifier le statut |
| PATCH | `/api/tickets/:id/assign` | Assigner un ticket |
| PATCH | `/api/tickets/:id/transfer` | Transférer un ticket |
| POST | `/api/tickets/:id/comments` | Ajouter un commentaire |
| DELETE | `/api/tickets/:id` | Supprimer un ticket |
| GET | `/api/tickets/stats` | Statistiques des tickets |
| GET | `/api/tickets/reliability` | Alertes de fiabilité |
| GET | `/api/tickets/asset/:assetId` | Tickets d'un équipement |
| POST | `/api/tickets/:id/remote-session` | Démarrer une session remote |
| DELETE | `/api/tickets/:id/remote-session` | Terminer une session remote |

## Équipements (Assets)
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/assets` | Liste des équipements |
| GET | `/api/assets/:id` | Détails d'un équipement |
| POST | `/api/assets` | Créer un équipement |
| PUT | `/api/assets/:id` | Modifier un équipement |
| DELETE | `/api/assets/:id` | Supprimer un équipement |
| PATCH | `/api/assets/:id/assign` | Affecter un équipement |
| GET | `/api/assets/stats` | Statistiques des équipements |
| GET | `/api/assets/warranty-alerts` | Alertes de garantie |
| POST | `/api/assets/import` | Import Excel |
| POST | `/api/assets/heartbeat` | Heartbeat agent (API key) |
| GET | `/api/assets/:id/ml-prediction` | Prédiction ML |
| POST | `/api/assets/scan/ad` | Scan Active Directory |
| POST | `/api/assets/scan/snmp` | Scan SNMP |

## Base de Connaissances
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/knowledge` | Liste des articles |
| GET | `/api/knowledge/:id` | Détails d'un article |
| POST | `/api/knowledge` | Créer un article |
| PUT | `/api/knowledge/:id` | Modifier un article |
| DELETE | `/api/knowledge/:id` | Supprimer un article |
| POST | `/api/knowledge/import` | Import d'articles |

## Notifications
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/notifications` | Liste des notifications |
| PATCH | `/api/notifications/:id/read` | Marquer comme lu |
| DELETE | `/api/notifications/:id` | Supprimer une notification |
| GET | `/api/notifications/preferences` | Préférences utilisateur |
| PUT | `/api/notifications/preferences` | Modifier les préférences |

## Anomalies
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/anomalies` | Liste des anomalies |
| GET | `/api/anomalies/:id` | Détails d'une anomalie |
| PATCH | `/api/anomalies/:id/resolve` | Résoudre une anomalie |

## Chatbot
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/chatbot/message` | Envoyer un message |
| GET | `/api/chatbot/history` | Historique des conversations |
| POST | `/api/chatbot/voice` | Message vocal (audio upload) |
| POST | `/api/chatbot/sync` | Synchroniser les connaissances |

## Sentiment
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/sentiment/analyze` | Analyser le sentiment d'un texte |
| POST | `/api/sentiment/analyze-ticket/:id` | Analyser un ticket |

## Recommandations
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/recommendations/technician/:ticketId` | Recommander un technicien |

## QR Codes
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/qr/:token` | Rechercher un équipement par QR Code |
| POST | `/api/qr/generate/:assetId` | Générer un QR Code |

## Smart Assistant
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/smart-assistant/suggestions` | Suggestions contextuelles |
| GET | `/api/smart-assistant/actions` | Actions rapides |

## Rapports
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/reports` | Liste des rapports |
| POST | `/api/reports/generate` | Générer un rapport |
| GET | `/api/reports/:id/download` | Télécharger un rapport |

## Dashboard
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/dashboard/stats` | Statistiques globales |
| GET | `/api/dashboard/tickets-chart` | Données graphique tickets |
| GET | `/api/dashboard/assets-chart` | Données graphique équipements |

## Settings
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/settings` | Paramètres système |
| PUT | `/api/settings` | Modifier les paramètres |

## Auto-Ticketing
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/auto-ticketing/rules` | Règles d'auto-ticketing |
| POST | `/api/auto-ticketing/rules` | Créer une règle |
| PUT | `/api/auto-ticketing/rules/:id` | Modifier une règle |
| DELETE | `/api/auto-ticketing/rules/:id` | Supprimer une règle |

## CMDB
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/cmdb/relations` | Relations entre équipements |
| GET | `/api/cmdb/unknown-devices` | Appareils inconnus |
| PATCH | `/api/cmdb/unknown-devices/:id` | Classifier un appareil |

## Utilitaires
| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/health` | Health check de l'API |

---

# Base de données

## Tables principales

### users
Utilisateurs du système avec authentification et rôles.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| username | VARCHAR(100) | Nom d'utilisateur |
| email | VARCHAR(150) | Email |
| password | VARCHAR(255) | Mot de passe hashé |
| role_id | INTEGER | Rôle (référence à roles) |
| status | VARCHAR(20) | Statut (active, pending, inactive) |
| language | VARCHAR(5) | Langue préférée (fr, en, ar) |
| date_format | VARCHAR(20) | Format de date |
| email_notifications | BOOLEAN | Activer les notifications email |
| created_at | TIMESTAMP | Date de création |

### roles
Rôles utilisateur (Admin, Technicien, Agent, Utilisateur).

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| name | VARCHAR(50) | Nom du rôle |

### tickets
Tickets de support informatique.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| title | VARCHAR(255) | Titre du ticket |
| description | TEXT | Description détaillée |
| category | VARCHAR(100) | Catégorie |
| priority | VARCHAR(20) | Priorité (Basse, Moyenne, Haute, Critique) |
| status | VARCHAR(20) | Statut (Nouveau, Assigné, En cours, etc.) |
| created_by | INTEGER | Créateur (référence à users) |
| assigned_to | INTEGER | Assigné à (référence à users) |
| asset_id | INTEGER | Équipement associé (référence à assets) |
| sentiment | VARCHAR(20) | Sentiment analysé |
| sentiment_score | INTEGER | Score de sentiment |
| sentiment_emotions | JSONB | Émotions détectées |
| sentiment_is_critical | BOOLEAN | Sentiment critique |
| is_auto_generated | BOOLEAN | Ticket auto-généré |
| remote_session_url | TEXT | URL de session remote |
| created_at | TIMESTAMP | Date de création |

### assets
Inventaire des équipements informatiques.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| asset_tag | VARCHAR(100) | Tag unique |
| type | VARCHAR(50) | Type (PC, Imprimante, etc.) |
| brand | VARCHAR(100) | Marque |
| model | VARCHAR(100) | Modèle |
| serial_number | VARCHAR(100) | Numéro de série |
| status | VARCHAR(50) | Statut (En service, En panne, etc.) |
| location | VARCHAR(150) | Emplacement |
| adresse_ip | VARCHAR(50) | Adresse IP |
| adresse_mac | VARCHAR(50) | Adresse MAC |
| date_acquisition | DATE | Date d'acquisition |
| date_fin_garantie | DATE | Date de fin de garantie |
| department | VARCHAR(100) | Département |
| assigned_to | INTEGER | Assigné à (référence à users) |
| qr_token | VARCHAR(64) | Token QR Code unique |
| last_seen_at | TIMESTAMP | Dernière détection réseau |

### ticket_comments
Commentaires sur les tickets.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| ticket_id | INTEGER | Ticket associé |
| user_id | INTEGER | Auteur |
| message | TEXT | Contenu du commentaire |
| is_internal | BOOLEAN | Commentaire interne |
| sentiment | VARCHAR(20) | Sentiment analysé |
| sentiment_score | INTEGER | Score de sentiment |
| created_at | TIMESTAMP | Date de création |

### knowledge_articles
Articles de la base de connaissances.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| title | VARCHAR(255) | Titre |
| summary | TEXT | Résumé |
| content | TEXT | Contenu complet |
| category | VARCHAR(100) | Catégorie |
| author_id | INTEGER | Auteur |
| keywords | TEXT[] | Mots-clés |
| views_count | INTEGER | Nombre de vues |
| is_published | BOOLEAN | Publié ou brouillon |
| created_at | TIMESTAMP | Date de création |

### notifications
Notifications utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| user_id | INTEGER | Utilisateur destinataire |
| title | VARCHAR(255) | Titre |
| message | TEXT | Message |
| read | BOOLEAN | Lu ou non |
| ticket_id | INTEGER | Ticket associé |
| asset_id | INTEGER | Équipement associé |
| created_at | TIMESTAMP | Date de création |

### chatbot_learned_cases
Cas appris par le chatbot (apprentissage automatique).

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| problem_keywords | TEXT[] | Mots-clés du problème |
| problem_summary | TEXT | Résumé du problème |
| solution_text | TEXT | Solution |
| source_type | VARCHAR(20) | Type de source (ticket, article) |
| source_id | INTEGER | ID de la source |
| hit_count | INTEGER | Nombre de consultations |
| confidence_score | NUMERIC(4,3) | Score de confiance |

### asset_anomalies
Anomalies détectées sur les équipements.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| asset_id | INTEGER | Équipement concerné |
| anomaly_type | VARCHAR(50) | Type d'anomalie |
| severity | VARCHAR(20) | Sévérité (low, medium, high, critical) |
| description | TEXT | Description |
| details | JSONB | Détails supplémentaires |
| status | VARCHAR(20) | Statut (open, resolved) |
| detected_at | TIMESTAMP | Date de détection |
| resolved_at | TIMESTAMP | Date de résolution |

### asset_risk_scores
Scores de risque des équipements (ML).

| Colonne | Type | Description |
|---------|------|-------------|
| asset_id | INTEGER | Équipement (clé primaire) |
| risk_score | NUMERIC(5,1) | Score de risque (0-100) |
| risk_level | VARCHAR(20) | Niveau (faible, modéré, élevé, critique) |
| computed_at | TIMESTAMP | Date de calcul |

### asset_live_state
État temps réel des équipements.

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | Identifiant unique |
| asset_id | INTEGER | Équipement |
| is_online | BOOLEAN | En ligne ou non |
| cpu_usage | NUMERIC(5,2) | Utilisation CPU (%) |
| ram_usage | NUMERIC(5,2) | Utilisation RAM (%) |
| disk_free_gb | NUMERIC(8,2) | Espace disque libre (GB) |
| uptime_hours | NUMERIC(10,2) | Temps de fonctionnement (heures) |
| logged_in_user | VARCHAR(100) | Utilisateur connecté |
| last_checked_at | TIMESTAMP | Dernière vérification |

## Vues

### asset_reliability
Vue calculant la fiabilité des équipements :
- Nombre total de tickets
- Pannes sur 6 mois
- Tickets résolus
- Pannes par mois
- Jours en service

### chatbot_top_cases
Vue des cas les plus consultés par le chatbot.

## Relations principales

```
users (1) ──── (N) tickets (créateur)
users (1) ──── (N) tickets (assigné)
users (1) ──── (N) assets (assigné)
users (1) ──── (N) ticket_comments
users (1) ──── (N) notifications
users (1) ──── (N) knowledge_articles

tickets (1) ──── (N) ticket_comments
tickets (1) ──── (N) ticket_history
tickets (N) ──── (1) assets

assets (1) ──── (N) tickets
assets (1) ──── (N) asset_anomalies
assets (1) ──── (1) asset_risk_scores
assets (1) ──── (1) asset_live_state
assets (1) ──── (N) asset_relations
assets (1) ──── (N) scan_history

chatbot_sessions (1) ──── (N) chatbot_messages
chatbot_learned_cases (1) ──── (N) chatbot_logs
```

---

# IA

## Chatbot IA avec Ollama

### Fonctionnement

Le chatbot utilise **Ollama** avec le modèle **LLaMA 3.2** (configurable) pour fournir des réponses intelligentes en français.

### Architecture du chatbot

```
Utilisateur → Frontend → Backend → chatbotBrain.js
                                    ├── Détection d'intention (regex)
                                    ├── Recherche dans chatbot_learned_cases (mémoire)
                                    ├── Recherche dans knowledge_articles (Full-Text Search)
                                    ├── Construction du prompt avec contexte
                                    └── Appel à Ollama (LLaMA 3.2)
                                    └── Réponse + sauvegarde en base
```

### Flux complet d'une question utilisateur

1. **Réception du message** : L'utilisateur envoie un message via le widget chatbot
2. **Détection d'intention** : Le backend analyse le message avec des regex pour détecter l'intention (créer ticket, chercher info, etc.)
3. **Extraction de mots-clés** : Extraction des mots-clés significatifs (suppression des stopwords)
4. **Recherche en mémoire** : Recherche dans `chatbot_learned_cases` pour trouver des cas similaires déjà résolus
5. **Recherche dans la base de connaissances** : Full-Text Search PostgreSQL sur `knowledge_articles`
6. **Construction du prompt** : Le prompt inclut :
   - Instructions système (rôle du chatbot)
   - Cas similaires trouvés
   - Articles de la base de connaissances
   - Historique de la conversation
   - Question de l'utilisateur
7. **Appel à Ollama** : Envoi du prompt à Ollama avec le modèle LLaMA 3.2
8. **Réponse** : Si Ollama répond, la réponse est retournée. Sinon, fallback sur la mémoire ou la base de connaissances
9. **Sauvegarde** : Le message et la réponse sont sauvegardés dans `chatbot_messages` et `chatbot_logs`
10. **Apprentissage automatique** : Lorsqu'un ticket est résolu, il est automatiquement ajouté à `chatbot_learned_cases` pour enrichir la mémoire du chatbot

### Configuration Ollama

**Variables d'environnement :**
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

**Démarrage d'Ollama :**
```bash
ollama serve
```

**Téléchargement du modèle :**
```bash
ollama pull llama3.2
```

### Intégration dans le code

**Fichier clé :** `backend/src/services/chatbot/chatbotBrain.js`

```javascript
import ollama from 'ollama';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const callLLM = async (prompt) => {
  const response = await ollama.generate({
    model: OLLAMA_MODEL,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 512
    }
  }, { host: OLLAMA_URL });
  return response.response;
};
```

## Service ML Python

### Modèles utilisés

Le service ML utilise **scikit-learn** pour trois modèles :

1. **Risk Scorer** (`risk_scorer.py`) : Score de risque d'un équipement (0-100)
2. **Failure Predictor** (`failure_predictor.py`) : Prédiction de panne future
3. **Anomaly Detector** (`anomaly_detector.py`) : Détection de comportements anormaux

### Features utilisées

```python
- age_years : Âge de l'équipement en années
- total_tickets : Nombre total de tickets
- tickets_6m : Tickets sur 6 mois
- high_priority_6m : Tickets haute priorité sur 6 mois
- avg_resolution_hours : Temps moyen de résolution
- total_anomalies : Nombre total d'anomalies
- anomalies_3m : Anomalies sur 3 mois
- high_severity_anomalies : Anomalies haute sévérité
- cpu_usage : Utilisation CPU (%)
- ram_usage : Utilisation RAM (%)
- disk_usage_pct : Utilisation disque (%)
- uptime_hours : Temps de fonctionnement
- is_online : En ligne (0/1)
- type_enc : Type encodé
- status_enc : Statut encodé
```

### Endpoints ML

| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/predict/risk` | Prédire le score de risque |
| POST | `/predict/failure` | Prédire une défaillance |
| POST | `/predict/anomaly` | Détecter une anomalie |
| POST | `/predict/full` | Prédictions combinées |
| POST | `/train` | Entraîner les modèles |

### Démarrage automatique

Le service ML démarre automatiquement avec le backend via `startMLService()` dans `app.js`.

```javascript
import { startMLService, stopMLService } from './services/startMLService.js';

// Démarrage automatique
startMLService().catch((err) =>
  console.warn('[ML-Launcher] Démarrage ML ignoré (mode dégradé):', err.message)
);

// Arrêt propre
process.on('SIGINT', () => {
  stopMLService();
  process.exit(0);
});
```

## Analyse de sentiment

Le service d'analyse de sentiment utilise des bibliothèques JavaScript pour analyser les émotions dans les tickets et commentaires.

**Fichier clé :** `backend/src/services/sentimentAnalyzer.js`

**Données stockées :**
- `sentiment` : global, positif, négatif, neutre
- `sentiment_score` : Score numérique
- `sentiment_emotions` : JSONB avec émotions détectées
- `sentiment_intensity` : Intensité (0-100)
- `sentiment_is_critical` : Flag de criticité

---

# Dépendances importantes

## Backend

| Dépendance | Version | Rôle |
|------------|---------|------|
| express | ^5.2.1 | Framework web |
| pg | ^8.21.0 | Client PostgreSQL |
| jsonwebtoken | ^9.0.3 | Authentification JWT |
| bcrypt | ^6.0.0 | Hashage de mots de passe |
| ollama | ^0.5.12 | Intégration LLM |
| nodemailer | ^9.0.0 | Envoi d'emails |
| multer | (via express) | Upload de fichiers |
| pdfkit | ^0.19.1 | Génération de PDF |
| xlsx | ^0.18.5 | Import/Export Excel |
| chart.js | ^4.5.1 | Graphiques |
| net-snmp | ^3.26.3 | Scan réseau SNMP |
| helmet | ^8.2.0 | Sécurité HTTP |
| cors | ^2.8.6 | Gestion CORS |
| express-validator | ^7.3.2 | Validation des données |
| mammoth | ^1.8.0 | Lecture de fichiers Word |
| pdf-parse | ^1.1.1 | Extraction de texte PDF |
| canvas | ^3.2.3 | Génération d'images (QR Codes) |

## Frontend

| Dépendance | Version | Rôle |
|------------|---------|------|
| react | ^19.2.4 | Framework UI |
| @coreui/react | ^5.10.0 | Composants UI |
| react-router-dom | ^7.13.2 | Routage |
| redux | 5.0.1 | Gestion d'état |
| react-redux | ^9.2.0 | Intégration Redux |
| chart.js | ^4.5.1 | Graphiques |
| @coreui/react-chartjs | ^3.0.0 | Graphiques CoreUI |
| reactflow | ^11.11.4 | Cartographie réseau |
| i18next | ^26.3.1 | Internationalisation |
| react-i18next | ^17.0.8 | Intégration i18next |
| sass | ^1.98.0 | Préprocesseur CSS |
| vite | ^8.0.3 | Build tool |

## ML Service (Python)

| Dépendance | Version | Rôle |
|------------|---------|------|
| fastapi | (voir requirements.txt) | Framework API |
| pydantic | (voir requirements.txt) | Validation de données |
| scikit-learn | (voir requirements.txt) | Machine Learning |
| pandas | (voir requirements.txt) | Manipulation de données |
| numpy | (voir requirements.txt) | Calculs numériques |
| uvicorn | (voir requirements.txt) | Serveur ASGI |

---

# Scripts npm

## Backend

| Script | Commande | Description |
|---------|----------|-------------|
| `npm start` | `node src/app.js` | Démarrer en mode production |
| `npm run dev` | `node --watch src/app.js` | Démarrer en mode développement avec rechargement automatique |
| `npm test` | `echo "Error: no test specified" && exit 1` | Tests (non configuré) |

## Frontend

| Script | Commande | Description |
|---------|----------|-------------|
| `npm start` | `vite` | Démarrer le serveur de développement |
| `npm run build` | `vite build` | Construire pour la production |
| `npm run serve` | `vite preview` | Prévisualiser le build de production |
| `npm run lint` | `eslint` | Vérifier le code avec ESLint |

## ML Service

```bash
# Installation des dépendances
pip install -r requirements.txt

# Démarrage manuel
python app.py

# Ou avec uvicorn
uvicorn app:app --host 0.0.0.0 --port 5000 --reload
```

---

# Captures d'écran

## Section à compléter

Cette section est réservée pour les captures d'écran de l'application.

### Tableau de bord
![Dashboard](screenshots/dashboard.png)

### Gestion des tickets
![Tickets](screenshots/tickets.png)

### Gestion des équipements
![Assets](screenshots/assets.png)

### Chatbot IA
![Chatbot](screenshots/chatbot.png)

### Carte réseau
![Network Map](screenshots/network-map.png)

---

# Déploiement

## Production

### Prérequis
- Serveur Linux (Ubuntu 20.04+ recommandé)
- Node.js >= 18.x
- PostgreSQL >= 15.x
- Ollama (pour le chatbot)
- Nginx (reverse proxy)
- PM2 (gestion des processus Node.js)
- Certbot (SSL avec Let's Encrypt)

### 1. Configuration de la base de données

```bash
# Sur le serveur de base de données
sudo -u postgres psql
CREATE DATABASE itsm_platform;
CREATE USER itsm_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE itsm_platform TO itsm_user;
```

### 2. Déploiement du Backend

```bash
# Cloner le projet
git clone https://github.com/saidasaidali/itsm_platform.git
cd itsm-platform/backend

# Installer les dépendances
npm install --production

# Configurer les variables d'environnement
cp .env.example .env
nano .env  # Éditer les variables

# Démarrer avec PM2
pm2 start src/app.js --name itsm-backend
pm2 save
pm2 startup
```

### 3. Déploiement du Frontend

```bash
cd ../frontend

# Installer les dépendances
npm install

# Construire pour la production
npm run build

# Les fichiers de build sont dans le dossier dist/
# Servir avec Nginx ou un hébergeur statique
```

### 4. Configuration Nginx

```nginx
server {
    listen 80;
    server_name itsm.dresi.gov;

    # Frontend
    root /var/www/itsm-platform/frontend/dist;
    index index.html;

    # API Backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ML Service
    location /ml {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. SSL avec Let's Encrypt

```bash
sudo certbot --nginx -d itsm.dresi.gov
```

### 6. Configuration Ollama en production

```bash
# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Télécharger le modèle
ollama pull llama3.2

# Démarrer le service
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 7. Service ML en production

```bash
# Installer les dépendances Python
cd backend/ml
pip install -r requirements.txt

# Créer un service systemd
sudo nano /etc/systemd/system/itsm-ml.service
```

Contenu du fichier `itsm-ml.service` :
```ini
[Unit]
Description=ITSM ML Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/itsm-platform/backend/ml
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Activer et démarrer le service
sudo systemctl enable itsm-ml
sudo systemctl start itsm-ml
```

---

# Dépannage

## Erreur PostgreSQL

**Erreur :** `ECONNREFUSED` ou `password authentication failed`

**Solution :**
```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql

# Vérifier les identifiants dans .env
# Tester la connexion
psql -U postgres -d itsm_platform

# Vérifier pg_hba.conf pour l'authentification
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

## Erreur Ollama

**Erreur :** `ECONNREFUSED` sur le port 11434

**Solution :**
```bash
# Vérifier qu'Ollama est démarré
ollama --version

# Démarrer le service
ollama serve

# Vérifier la connectivité
curl http://localhost:11434/api/tags

# Vérifier les variables d'environnement dans .env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Erreur : Modèle Ollama introuvable

**Erreur :** `model "llama3.2" not found`

**Solution :**
```bash
# Télécharger le modèle
ollama pull llama3.2

# Vérifier les modèles installés
ollama list
```

## Port déjà utilisé

**Erreur :** `EADDRINUSE` sur le port 3000 ou 3001

**Solution :**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Ou changer le port dans .env
PORT=3002
```

## Erreur CORS

**Erreur :** `Access-Control-Allow-Origin`

**Solution :**
```bash
# Vérifier CORS_ORIGINS dans backend/.env
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Redémarrer le backend après modification
```

## Erreur .env

**Erreur :** Variables d'environnement non chargées

**Solution :**
```bash
# Vérifier que le fichier .env existe
ls -la backend/.env
ls -la frontend/.env

# Vérifier le format (pas d'espaces autour du =)
DB_HOST=localhost
# PAS : DB_HOST = localhost

# Redémarrer les serveurs après modification
```

## Erreur npm

**Erreur :** `npm install` échoue

**Solution :**
```bash
# Nettoyer le cache
npm cache clean --force

# Supprimer node_modules et package-lock.json
rm -rf node_modules package-lock.json

# Réinstaller
npm install
```

## Erreur Python/ML Service

**Erreur :** Module introuvable ou version incompatible

**Solution :**
```bash
# Créer un environnement virtuel
cd backend/ml
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# ou
venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt

# Vérifier la version de Python
python --version  # Doit être >= 3.9
```

## Erreur de migration

**Erreur :** Colonnes ou tables déjà existantes

**Solution :**
Les migrations automatiques utilisent `IF NOT EXISTS`, donc elles sont idempotentes. Si une erreur persiste :

```bash
# Vérifier les logs du backend
# Les migrations sont exécutées au démarrage

# Vérifier manuellement
psql -U postgres -d itsm_platform -c "\d tickets"
```

## Performance lente

**Solution :**
```bash
# Activer les index PostgreSQL
psql -U postgres -d itsm_platform -f schema.sql

# Vérifier les requêtes lentes
# Activer pg_stat_statements dans postgresql.conf

# Augmenter la mémoire PostgreSQL
# Dans postgresql.conf :
# shared_buffers = 256MB
# work_mem = 16MB
```

## Logs

**Backend :**
```bash
# Les logs sont affichés dans la console
# Pour enregistrer dans un fichier :
npm run dev > logs/backend.log 2>&1
```

**Frontend :**
```bash
# Les logs sont affichés dans la console du navigateur
# Activer les logs détaillés dans .env :
VITE_DEBUG=true
VITE_LOG_API_CALLS=true
```

**ML Service :**
```bash
# Les logs sont affichés dans la console
# Rediriger vers un fichier :
python app.py > logs/ml-service.log 2>&1
```

---

# Auteur

**ITSM Platform** - Développé par l'équipe DRESI

- **Repository GitHub** : https://github.com/saidasaidali/itsm_platform
- **Version** : 1.0.0
- **Licence** : MIT

## Contributeurs

À compléter

## Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter la documentation
- Vérifier la section Dépannage

---

# Licence

MIT License - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

# Notes importantes

## Sécurité

- **Ne jamais commiter le fichier `.env`** (il est dans `.gitignore`)
- Utiliser des mots de passe forts pour `JWT_SECRET` et `DB_PASSWORD`
- Utiliser des "Mots de passe d'application" pour Gmail (SMTP)
- Limiter les accès à la base de données
- Mettre à jour régulièrement les dépendances (`npm audit`, `npm update`)
- Activer HTTPS en production (Let's Encrypt)
- Configurer un firewall approprié

## Performance

- Le service ML est optionnel mais recommandé pour les prédictions
- Ollama nécessite suffisamment de RAM (4GB minimum, 8GB recommandé)
- Les scans réseau peuvent être gourmands en ressources (planifier la nuit)
- Le chatbot utilise du RAG (Retrieval-Augmented Generation) pour des réponses pertinentes

## Maintenance

- Sauvegarder régulièrement la base de données PostgreSQL
- Surveiller les logs d'erreur
- Mettre à jour les modèles Ollama régulièrement
- Ré-entraîner les modèles ML périodiquement avec `POST /train`
- Nettoyer les anciennes notifications (90 jours par défaut)
- Archiver les tickets anciens

## Évolutions futures

À compléter selon les besoins du projet.

---

# Changelog

## Version 1.0.0 (Date à compléter)

- Initialisation du projet
- Gestion des tickets
- Gestion des équipements
- Chatbot IA avec Ollama
- Service ML (prédictions)
- Découverte réseau
- Base de connaissances
- Notifications
- Internationalisation (FR, EN, AR)
- Rapports PDF
- QR Codes
- Analyse de sentiment
- Auto-ticketing
- Smart Assistant

---

**Dernière mise à jour :** 2026-02-07

**Documentation générée à partir du code source.**