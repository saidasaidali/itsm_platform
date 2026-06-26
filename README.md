# DRESI ITSM Platform

**Système de Gestion des Services Informatiques (ITSM)** — Plateforme complète de gestion des tickets IT, des parcs informatiques, de la découverte réseau, du chatbot IA, de l'analyse de sentiments et de la maintenance prédictive.

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture du projet](#2-architecture-du-projet)
3. [Prérequis](#3-prérequis)
4. [Installation](#4-installation)
5. [Installation des outils externes](#5-installation-des-outils-externes)
6. [Téléchargement des ressources externes](#6-téléchargement-des-ressources-externes)
7. [Configuration de la base de données](#7-configuration-de-la-base-de-données)
8. [Lancement du projet](#8-lancement-du-projet)
9. [Tests et vérifications](#9-tests-et-vérifications)
10. [Dépannage](#10-dépannage)
11. [Guide de contribution](#11-guide-de-contribution)

---

## 1. Présentation du projet

### Objectif

La plateforme **DRESI ITSM** est un système de gestion des services informatiques (ITSM) conçu pour les administrations et entreprises. Elle permet de :

- Gérer les **tickets d'incidents et demandes** de support IT
- Administrer le **parc informatique** (inventaire des équipements, affectations, QR codes)
- Découvrir automatiquement les **équipements réseau** via SNMP et Active Directory
- Créer des **tickets automatiques** basés sur des règles métier et l'IA prédictive
- Analyser le **sentiment** des tickets et commentaires (détection des urgences, frustrations)
- Proposer un **chatbot intelligent** avec reconnaissance vocale (Whisper) et synthèse vocale (Piper TTS)
- Visualiser le **tableau de bord** et la **cartographie réseau** (Digital Twin)
- Gérer la **base de connaissance** avec suggestions automatiques
- Notifier par **email et notifications système** les événements importants
- Gérer les **SLA** et la **clôture automatique** des tickets résolus
- **Internationalisation** (Français, Anglais, Arabe avec support RTL)

### Fonctionnalités principales

| Fonctionnalité | Description |
|---|---|
| **Gestion des tickets** | Création, assignation, suivi, commentaires, historique |
| **Gestion du parc (CMDB)** | Inventaire des actifs, affectations, scans QR |
| **Découverte réseau** | Scan SNMP, Active Directory, détection d'anomalies |
| **Jumeau numérique (Digital Twin)** | État en direct des équipements (CPU, RAM, disque) |
| **Auto-ticketing** | Création automatique de tickets (PC manquant, disque plein, imprimante hors ligne, risque ML) |
| **Machine Learning** | Prédiction de pannes, scoring de risque, détection d'anomalies (Isolation Forest, Random Forest) |
| **Chatbot IA** | Assistant virtuel avec base de connaissance, reconnaissance vocale (Whisper) et synthèse vocale (Piper TTS) |
| **Analyse de sentiments** | Lexique français on-premise pour détecter frustration, urgence, insatisfaction |
| **Recommandation de techniciens** | Algorithme de scoring basé sur disponibilité, compétences, expérience |
| **Base de connaissance** | Articles, suggestions automatiques, recherche full-text |
| **SLA & Monitoring** | Surveillance des délais, notifications de dépassement, clôture automatique |
| **Authentification & Rôles** | JWT, 3 rôles (Admin, Technicien, Agent), mot de passe oublié |
| **Internationalisation** | fr, en, ar (RTL), sélecteur de langue |
| **Notifications** | Email (SMTP) + notifications système, préférences |
| **Import/Export** | Import Excel des actifs, utilisateurs, articles. QR codes |

---

## 2. Architecture du projet

### Structure des dossiers

```
itsm-platform/
├── backend/                     # Serveur Node.js (Express)
│   ├── ml/                      # Service Machine Learning (Python/FastAPI)
│   │   ├── app.py               # API FastAPI (endpoints /predict, /train)
│   │   ├── models/              # Modèles ML
│   │   │   ├── risk_scorer.py   # Random Forest (score de risque)
│   │   │   ├── failure_predictor.py  # Gradient Boosting (prédiction panne)
│   │   │   └── anomaly_detector.py   # Isolation Forest (anomalies)
│   │   ├── data/
│   │   │   └── dataset_builder.py    # Construction dataset depuis PostgreSQL
│   │   ├── trained/             # Modèles entraînés (pkl)
│   │   └── requirements.txt     # Dépendances Python
│   ├── models/                  # Modèles Whisper/Piper (fichiers .bin/.onnx)
│   ├── scripts/                 # Scripts utilitaires
│   ├── src/
│   │   ├── app.js               # Point d'entrée Express
│   │   ├── db.js                # Connexion PostgreSQL (Pool)
│   │   ├── controllers/         # Contrôleurs de l'API
│   │   ├── routes/              # Routes Express
│   │   ├── services/            # Services métier
│   │   │   ├── networkDiscovery/   # Découverte réseau
│   │   │   │   ├── scheduler.js    # Planification des scans
│   │   │   │   ├── snmpScan.js     # Scan SNMP
│   │   │   │   ├── adScan.js       # Scan Active Directory
│   │   │   │   ├── digitalTwin.js  # État en direct des équipements
│   │   │   │   ├── anomalyDetector.js  # Détection d'anomalies
│   │   │   │   └── relationDetector.js  # Détection de relations
│   │   │   ├── autoTicketing/     # Auto-ticketing
│   │   │   │   ├── autoTicketEngine.js  # Moteur de création automatique
│   │   │   │   ├── autoCloseEngine.js   # Clôture automatique
│   │   │   │   └── suggestionEngine.js  # Suggestions (articles, tickets)
│   │   │   ├── authService.js     # Authentification
│   │   │   ├── emailService.js    # Service email (SMTP/Nodemailer)
│   │   │   ├── mlService.js       # Client ML (appel HTTP vers FastAPI)
│   │   │   ├── startMLService.js  # Lancement automatique du service ML
│   │   │   ├── notificationService.js # Notifications système
│   │   │   ├── piperTtsService.js # Synthèse vocale (Piper TTS)
│   │   │   ├── whisperService.js  # Reconnaissance vocale (Whisper)
│   │   │   ├── qrCodeService.js   # QR codes
│   │   │   ├── qrCodeMigration.js # Migration QR codes
│   │   │   ├── sentimentAnalyzer.js   # Analyse de sentiments (lexique)
│   │   │   ├── technicianRecommender.js  # Recommandation technicien
│   │   │   ├── settingsService.js  # Paramètres système
│   │   │   ├── slaMonitor.js       # Surveillance SLA
│   │   │   └── ticketMonitor.js    # Surveillance tickets non assignés
│   │   └── middlewares/
│   │       └── languageMiddleware.js   # Middleware i18n
│   ├── schema.sql               # Schéma complet PostgreSQL
│   ├── migration_chatbot.sql    # Migration chatbot
│   ├── migration_sentiment.sql  # Migration analyse de sentiments
│   ├── package.json             # Dépendances Node.js
│   └── .env.example             # Exemple de configuration
│
├── frontend/                    # Application React (Vite + CoreUI)
│   ├── public/                  # Fichiers statiques
│   ├── src/
│   │   ├── App.jsx              # Composant racine + routing
│   │   ├── index.jsx            # Point d'entrée
│   │   ├── routes.js            # Configuration des routes
│   │   ├── _nav.jsx             # Navigation / Sidebar
│   │   ├── auth/                # Authentification
│   │   │   └── AuthProvider.jsx # Contexte d'authentification
│   │   ├── components/          # Composants réutilisables
│   │   ├── layout/              # Layout principal
│   │   ├── i18n/                # Internationalisation
│   │   │   ├── index.js         # Configuration i18next
│   │   │   └── locales/         # Traductions
│   │   │       ├── fr.json
│   │   │       ├── en.json
│   │   │       └── ar.json
│   │   ├── scss/                # Styles
│   │   ├── services/            # Services API
│   │   └── views/               # Pages
│   │       ├── dashboard/       # Tableau de bord + carte réseau
│   │       ├── tickets/         # Gestion des tickets
│   │       ├── assets/          # Gestion du parc / QR codes
│   │       ├── knowledge/       # Base de connaissance
│   │       ├── users/           # Gestion des utilisateurs
│   │       ├── notifications/   # Notifications
│   │       ├── anomalies/       # Anomalies réseau
│   │       ├── settings/        # Paramètres
│   │       ├── chatbot/         # Widget chatbot
│   │       └── pages/           # Login, Register, etc.
│   ├── package.json             # Dépendances React
│   ├── vite.config.mjs          # Configuration Vite
│   └── .env.example             # Exemple de configuration
│
├── requirements.txt             # Dépendances globales (référence)
└── README.md                    # Ce fichier
```

### Technologies utilisées

#### Frontend

| Technologie | Version | Utilisation |
|---|---|---|
| **React** | ^19.2.4 | Framework UI |
| **Vite** | ^8.0.3 | Bundler / Dev server |
| **CoreUI React** | ^5.10.0 | Template admin (tableau de bord, composants) |
| **React Router** | ^7.13.2 | Routage |
| **React Redux** | ^9.2.0 | Gestion d'état |
| **i18next** | ^26.3.1 | Internationalisation (fr, en, ar) |
| **ReactFlow** | ^11.11.4 | Cartographie réseau (Digital Twin) |
| **Chart.js** | ^4.5.1 | Graphiques du tableau de bord |
| **SimpleBar** | ^3.3.2 | Scrollbar personnalisée |
| **Sass** | ^1.98.0 | Préprocesseur CSS |

#### Backend

| Technologie | Version | Utilisation |
|---|---|---|
| **Node.js** | ≥18 LTS | Runtime |
| **Express** | ^5.2.1 | Framework HTTP |
| **PostgreSQL (pg)** | ^8.21.0 | Base de données relationnelle |
| **JSON Web Token** | ^9.0.3 | Authentification |
| **bcrypt** | ^6.0.0 | Hachage des mots de passe |
| **Helmet** | ^8.2.0 | Sécurité HTTP |
| **Nodemailer** | ^9.0.0 | Envoi d'emails SMTP |
| **Ollama** | ^0.5.12 | Client Ollama (chatbot) |
| **net-snmp** | ^3.26.3 | Scan SNMP réseau |
| **multer** | — | Upload de fichiers audio |
| **pdf-parse** | ^1.1.1 | Extraction de texte PDF |
| **mammoth** | ^1.8.0 | Conversion DOCX en texte |
| **xlsx** | ^0.18.5 | Import/Export Excel |

#### Base de données

| Technologie | Version |
|---|---|
| **PostgreSQL** | ≥15 |

#### IA / Machine Learning

| Technologie | Version | Utilisation |
|---|---|---|
| **Python** | ≥3.10 | Service ML |
| **FastAPI** | 0.111.0 | API REST ML |
| **Uvicorn** | 0.29.0 | Serveur ASGI |
| **scikit-learn** | 1.4.2 | Random Forest, Gradient Boosting, Isolation Forest |
| **pandas** | 2.2.2 | Manipulation de données |
| **joblib** | 1.4.2 | Sauvegarde/chargement des modèles |
| **Ollama** | — | Modèle de langage pour le chatbot |
| **Whisper.cpp** | — | Reconnaissance vocale (transcription) |
| **Piper TTS** | — | Synthèse vocale (text-to-speech) |

#### DevOps / Outils

| Outil | Utilisation |
|---|---|
| **Git** | Contrôle de version |
| **Docker** | Conteneurisation (optionnel) |
| **PowerShell** | Scripts AD, état en direct |

---

## 3. Prérequis

### Outils et logiciels nécessaires

| Outil | Version recommandée | Utilisation |
|---|---|---|
| **Node.js** | ≥ 18 LTS | Runtime backend |
| **npm** | ≥ 9 | Gestionnaire de paquets |
| **PostgreSQL** | ≥ 15 | Base de données |
| **Python** | ≥ 3.10 | Service ML |
| **pip** | ≥ 22 | Gestionnaire de paquets Python |
| **Git** | ≥ 2.40 | Contrôle de version |
| **PowerShell 7+** | ≥ 7.0 | Scripts AD et Digital Twin (Windows) |
| **Ollama** | ≥ 0.3 | Modèle de langage local |
| **Whisper.cpp** | — | Reconnaissance vocale |
| **Piper TTS** | — | Synthèse vocale |
| **ffmpeg** | — | Conversion audio (Whisper) |

### Vérification des prérequis

```bash
node --version        # >= 18
npm --version         # >= 9
python --version      # >= 3.10
pip --version         # >= 22
psql --version        # >= 15
git --version         # >= 2.40
ffmpeg -version       # Optionnel (reconnaissance vocale)
```

---

## 4. Installation

### 4.1 Cloner le projet

```bash
git clone https://github.com/saidasaidali/itsm_platform.git
cd itsm-platform
```

### 4.2 Installer les dépendances backend

```bash
cd backend
npm install
```

### 4.3 Installer les dépendances frontend

```bash
cd ../frontend
npm install
```

### 4.4 Installer les dépendances Python (ML)

```bash
cd ../backend/ml
pip install -r requirements.txt
```

### 4.5 Configurer les variables d'environnement

#### Backend

```bash
cd ../backend
cp .env.example .env
```

Éditez le fichier `backend/.env` avec vos valeurs :

```env
# Base de Données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itsm_platform
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe

# Authentification JWT
JWT_SECRET=une_cle_secrete_tres_longue_32_caracteres_minimum
JWT_EXPIRES_IN=7d

# Serveur
PORT=3000
NODE_ENV=development

# Frontend URL (pour les emails et CORS)
FRONTEND_URL=http://localhost:3001

# SMTP (emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASS=votre_mot_de_passe_application
SMTP_FROM=noreply@dresi.gov
```

#### Frontend

```bash
cp frontend/.env.example frontend/.env
```

Éditez `frontend/.env` :

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=ITSM Platform
VITE_NODE_ENV=development
VITE_DEFAULT_LANGUAGE=fr
```

---

## 5. Installation des outils externes

### 5.1 PostgreSQL

**À quoi ça sert ?** Base de données relationnelle pour stocker toutes les données : utilisateurs, tickets, actifs, paramètres, etc.

**Installation :**

```bash
# Windows - Téléchargez l'installateur depuis https://www.postgresql.org/download/windows/
# Linux (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**Configuration :**

```bash
# Démarrer le service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Créer un utilisateur
sudo -u postgres createuser --interactive
# Nom du rôle : postgres
# Superutilisateur : oui

# Définir un mot de passe
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'votre_mot_de_passe';"
```

**Vérification :**

```bash
psql -U postgres -h localhost -c "SELECT version();"
```

---

### 5.2 Ollama (Chatbot IA)

**À quoi ça sert ?** Plateforme de modèle de langage local pour alimenter le chatbot ITSM. Le chatbot utilise Ollama pour comprendre les requêtes des utilisateurs, rechercher dans la base de connaissance et générer des réponses contextuelles.

**Installation :**

```bash
# Windows - Téléchargez depuis https://ollama.com/download
# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

**Configuration :**

```bash
# Démarrer le service Ollama
ollama serve

# Télécharger un modèle (recommandé : Mistral pour le français)
ollama pull mistral

# Autres modèles compatibles
# ollama pull llama3
# ollama pull phi3
```

**Variables d'environnement (backend/.env) :**

```env
# Optionnel : définir l'URL d'Ollama si différent de localhost:11434
# OLLAMA_HOST=http://localhost:11434
```

**Vérification :**

```bash
ollama list
# Doit afficher le(s) modèle(s) téléchargé(s)
```

---

### 5.3 Whisper.cpp (Reconnaissance vocale)

**À quoi ça sert ?** Permet au chatbot de comprendre les messages vocaux des utilisateurs. Il convertit l'audio en texte en français.

**Installation :**

```bash
# Windows
# 1. Téléchargez whisper-cli.exe depuis https://github.com/ggerganov/whisper.cpp/releases
# 2. Placez-le dans backend/models/ ou dans un dossier de votre choix

# Linux/Mac
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make
```

**Configuration (backend/.env) :**

```env
WHISPER_CPP_PATH=./models/whisper-cli.exe    # Chemin vers l'exécutable
WHISPER_MODEL_PATH=./models/ggml-base.bin    # Chemin vers le modèle
```

**Vérification :**

```bash
# Windows
whisper-cli.exe --help

# Linux/Mac
./whisper-cli --help
```

---

### 5.4 Piper TTS (Synthèse vocale)

**À quoi ça sert ?** Synthèse vocale pour que le chatbot puisse répondre oralement aux utilisateurs. Transforme le texte généré en audio.

**Installation :**

```bash
# Windows
# 1. Téléchargez piper.exe depuis https://github.com/rhasspy/piper/releases
# 2. Placez-le dans backend/models/

# Linux
sudo apt install piper-tts
```

**Configuration (backend/.env) :**

```env
PIPER_TTS_PATH=./models/piper.exe                # Chemin vers l'exécutable
PIPER_MODEL_PATH=./models/fr_FR-upmc-medium.onnx # Chemin vers le modèle français
```

**Vérification :**

```bash
# Windows
piper.exe --help

# Linux
piper --help
```

---

### 5.5 ffmpeg (Conversion audio)

**À quoi ça sert ?** Convertit les fichiers audio (webm, ogg, mp4) en WAV 16kHz mono pour Whisper. Indispensable pour la reconnaissance vocale.

**Installation :**

```bash
# Windows - Téléchargez depuis https://ffmpeg.org/download.html
# Ajoutez le dossier bin/ à votre PATH

# Linux
sudo apt install ffmpeg
```

**Vérification :**

```bash
ffmpeg -version
```

---

### 5.6 PowerShell 7+ (Windows - Découverte réseau)

**À quoi ça sert ?** Exécute les scripts de découverte Active Directory et d'état en direct (Digital Twin) sur les postes Windows du réseau.

**Installation :**

```bash
# Téléchargez depuis https://learn.microsoft.com/powershell/
# winget install Microsoft.PowerShell
```

**Vérification :**

```bash
pwsh --version
```

---

## 6. Téléchargement des ressources externes

### 6.1 Modèles d'IA

Ces modèles doivent être placés dans le dossier `backend/models/` :

#### Modèle Whisper (reconnaissance vocale)

| Fichier | Source | Taille |
|---|---|---|
| `ggml-base.bin` | [Hugging Face - Whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) | ~150 Mo |
| `ggml-small.bin` | [Hugging Face - Whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) | ~500 Mo |

```bash
# Téléchargement (exemple avec curl)
cd backend/models
# Modèle base (recommandé pour commencer)
curl -L -o ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# Modèle small (plus précis)
curl -L -o ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

#### Modèle Piper TTS (synthèse vocale)

| Fichier | Source | Taille |
|---|---|---|
| `fr_FR-upmc-medium.onnx` | [Hugging Face - Piper](https://huggingface.co/rhasspy/piper-voices) | ~40 Mo |
| `fr_FR-upmc-medium.onnx.json` | [Hugging Face - Piper](https://huggingface.co/rhasspy/piper-voices) | ~1 Ko |

```bash
cd backend/models
curl -L -o fr_FR-upmc-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx
curl -L -o fr_FR-upmc-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx.json
```

#### Modèle Ollama (chatbot)

```bash
# Téléchargement via Ollama directement
ollama pull mistral
# ou ollama pull llama3
```

### 6.2 Arborescence des modèles

```
backend/
├── models/
│   ├── whisper-cli.exe          # Exécutable Whisper.cpp (Windows)
│   ├── ggml-base.bin            # Modèle Whisper
│   ├── ggml-small.bin           # Modèle Whisper (optionnel)
│   ├── piper.exe                # Exécutable Piper TTS (Windows)
│   ├── fr_FR-upmc-medium.onnx   # Modèle Piper TTS français
│   └── fr_FR-upmc-medium.onnx.json
```

---

## 7. Configuration de la base de données

### 7.1 Créer la base de données

```bash
# Connexion à PostgreSQL
psql -U postgres -h localhost

# Créer la base de données
CREATE DATABASE itsm_platform;

# Ajouter l'extension pgcrypto (nécessaire pour les fonctions cryptographiques)
\c itsm_platform
CREATE EXTENSION IF NOT EXISTS pgcrypto;

# Quitter
\q
```

### 7.2 Exécuter les migrations

```bash
# Importer le schéma principal
psql -U postgres -d itsm_platform -f backend/schema.sql

# Importer les migrations supplémentaires
psql -U postgres -d itsm_platform -f backend/migration_chatbot.sql
psql -U postgres -d itsm_platform -f backend/migration_sentiment.sql
```

### 7.3 Insérer les données initiales

Connectez-vous à la base et insérez les rôles et un administrateur par défaut :

```sql
-- Connexion
psql -U postgres -d itsm_platform

-- Insérer les rôles
INSERT INTO roles (id, name) VALUES
  (1, 'Admin'),
  (2, 'Technicien'),
  (3, 'Agent');

-- Créer un administrateur par défaut (mot de passe : admin123)
INSERT INTO users (username, email, password, role_id, status)
VALUES (
  'admin',
  'admin@dresi.gov',
  '$2b$10$VotreHashBcryptIci',  -- Générez avec bcrypt
  1,
  'active'
);

-- Activer les paramètres SMTP par défaut (optionnel)
INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('smtp_host', 'smtp.gmail.com'),
  ('smtp_port', '587'),
  ('smtp_user', ''),
  ('smtp_pass', ''),
  ('smtp_from', 'noreply@dresi.gov');
```

**Génération du hash bcrypt :**

```bash
# Avec Node.js
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(console.log);"
```

---

## 8. Lancement du projet

### 8.1 Démarrer le backend

```bash
cd backend

# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```

Le backend démarre sur `http://localhost:3000`.

**Ce qui est lancé automatiquement :**

- Serveur Express (API REST)
- Service ML Python (FastAPI) en processus enfant (port 8001)
- Migration automatique des colonnes de sentiment
- Migration QR Code
- Surveillance SLA (toutes les 15 min)
- Monitoring des tickets non assignés (toutes les 30 min)
- Découverte réseau (planifiée)
- Auto-ticketing (planifié)
- Clôture automatique des tickets résolus

### 8.2 Démarrer le frontend

```bash
cd frontend

# Mode développement
npm start

# Build production
npm run build

# Preview production
npm run serve
```

Le frontend démarre sur `http://localhost:3001`.

### 8.3 Démarrer le service ML manuellement (optionnel)

Si le lancement automatique échoue, vous pouvez démarrer le service ML manuellement :

```bash
cd backend/ml
python app.py
```

Le service ML démarre sur `http://localhost:8001`.

### 8.4 Accéder à l'application

Ouvrez `http://localhost:3001` dans votre navigateur.

- **Identifiants par défaut :** `admin` / `admin123` (si vous avez inséré les données initiales)
- **URL de l'API :** `http://localhost:3000/api`
- **Health check :** `http://localhost:3000/api/health`

---

## 9. Tests et vérifications

### 9.1 Vérifier l'API backend

```bash
# Health check
curl http://localhost:3000/api/health

# Réponse attendue :
# {"status":"OK","timestamp":"2026-06-26T13:00:00.000Z"}
```

### 9.2 Vérifier le service ML

```bash
curl http://localhost:8001/health

# Réponse attendue :
# {"status":"ok","service":"DRESI ML Service"}
```

### 9.3 Vérifier la base de données

```bash
psql -U postgres -d itsm_platform -c "\dt"

# Doit afficher toutes les tables :
# asset_anomalies, asset_assignments, asset_history, asset_live_state,
# asset_relations, asset_risk_scores, assets, audit_logs, auto_ticket_cooldown,
# chatbot_learned_cases, chatbot_logs, chatbot_messages, chatbot_sessions,
# knowledge_articles, knowledge_base, notification_preferences, notifications,
# roles, scan_history, system_settings, ticket_comments, ticket_history,
# tickets, unknown_devices, users
```

### 9.4 Vérifier le frontend

```bash
# Le frontend doit répondre sur http://localhost:3001
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001

# Réponse attendue : 200
```

### 9.5 Vérifier les dépendances

```bash
# Backend
cd backend && node -e "console.log('Modules chargés:', Object.keys(require.cache).length)"

# Frontend
cd frontend && npx vite --version

# Python ML
cd backend/ml && python -c "import fastapi, sklearn, pandas; print('ML dependencies OK')"
```

### 9.6 Vérifier Ollama

```bash
curl http://localhost:11434/api/tags

# Réponse attendue : liste des modèles disponibles
```

### 9.7 Tableau de vérification complet

| Service | URL | Commande de vérification |
|---|---|---|
| Backend API | `http://localhost:3000/api/health` | `curl localhost:3000/api/health` |
| ML Service | `http://localhost:8001/health` | `curl localhost:8001/health` |
| Frontend | `http://localhost:3001` | Ouvrir dans le navigateur |
| PostgreSQL | `localhost:5432` | `psql -U postgres -d itsm_platform -c "SELECT 1"` |
| Ollama | `http://localhost:11434` | `curl localhost:11434/api/tags` |

---

## 10. Dépannage

### 10.1 Erreurs de connexion PostgreSQL

**Erreur :** `ECONNREFUSED` ou `password authentication failed`

**Solutions :**

1. Vérifiez que PostgreSQL est en cours d'exécution :
   ```bash
   sudo systemctl status postgresql
   ```

2. Vérifiez le fichier `pg_hba.conf` :
   ```bash
   # Localiser le fichier
   psql -U postgres -c "SHOW hba_file;"
   
   # Assurez-vous que l'authentification est configurée :
   # host all all 127.0.0.1/32 md5
   ```

3. Testez la connexion :
   ```bash
   psql -U postgres -h localhost -d itsm_platform
   ```

### 10.2 Le service ML ne démarre pas

**Erreur :** `[ML-Launcher] Python non disponible, service ML désactivé`

**Solutions :**

1. Vérifiez que Python 3 est installé :
   ```bash
   python --version
   ```

2. Installez les dépendances manuellement :
   ```bash
   cd backend/ml
   pip install -r requirements.txt
   ```

3. Démarrez manuellement :
   ```bash
   python app.py
   ```

### 10.3 CORS / Connexion frontend-backend

**Erreur :** `Blocked by CORS policy` dans la console navigateur

**Solutions :**

1. Vérifiez que `FRONTEND_URL` dans `backend/.env` correspond au port du frontend :
   ```env
   FRONTEND_URL=http://localhost:3001
   ```

2. Vérifiez `VITE_API_URL` dans `frontend/.env` :
   ```env
   VITE_API_URL=http://localhost:3000
   ```

### 10.4 Erreurs SMTP (emails)

**Erreur :** `[EmailService] Erreur SMTP`

**Solutions :**

1. Vérifiez la configuration SMTP dans l'interface Paramètres ou dans `.env`
2. Pour Gmail, utilisez un **mot de passe d'application** (pas le mot de passe principal) :
   - Allez sur https://myaccount.google.com/apppasswords
   - Générez un mot de passe pour "Appareil"
3. Testez la connexion SMTP :
   ```bash
   node -e "const nodemailer = require('nodemailer');"
   ```

### 10.5 Whisper / Reconnaissance vocale

**Erreur :** `Whisper executable introuvable`

**Solutions :**

1. Téléchargez `whisper-cli.exe` depuis les releases GitHub
2. Mettez à jour `WHISPER_CPP_PATH` dans `.env` :
   ```env
   WHISPER_CPP_PATH=C:/chemin/vers/whisper-cli.exe
   ```
3. Téléchargez le modèle `ggml-base.bin` dans `backend/models/`

**Erreur :** `ffmpeg is not installed`

**Solution :** Installez ffmpeg et ajoutez-le au PATH

### 10.6 Le chatbot ne répond pas

**Solutions :**

1. Vérifiez qu'Ollama est lancé :
   ```bash
   ollama serve
   ```

2. Vérifiez que le modèle est téléchargé :
   ```bash
   ollama list
   ```

3. Vérifiez la configuration du chatbot dans les paramètres

### 10.7 Les notifications ne s'affichent pas

**Solutions :**

1. Vérifiez que les notifications sont activées dans les préférences utilisateur
2. Vérifiez l'intervalle de polling dans `frontend/.env` :
   ```env
   VITE_NOTIFICATION_POLL_INTERVAL=30000
   ```

### 10.8 La découverte réseau échoue

**Erreur :** `[ADScan] Erreur globale`

**Solutions :**

1. Vérifiez que PowerShell 7+ est installé
2. Vérifiez que le script `scan-ad.ps1` a les droits d'exécution
3. Vérifiez les paramètres AD dans `.env` :
   ```env
   AD_SERVER=ldap://votre-serveur-ad.com
   AD_DOMAIN=DRESI
   AD_USERNAME=service_account
   AD_PASSWORD=service_password
   ```

### 10.9 Port déjà utilisé

**Erreur :** `EADDRINUSE: address already in use`

**Solutions :**

```bash
# Trouver le processus utilisant le port 3000
netstat -ano | findstr :3000

# Tuer le processus (Windows)
taskkill /PID <PID> /F

# Changer de port dans .env
PORT=3002
```

### 10.10 Erreurs d'import Excel

**Solutions :**

1. Vérifiez le format du fichier (.xlsx ou .xls)
2. Vérifiez que la première ligne contient les en-têtes
3. Vérifiez la limite de taille dans `.env` :
   ```env
   MAX_FILE_SIZE=10485760  # 10 Mo
   ```

---

## 11. Guide de contribution

### 11.1 Structure des branches Git

```
main                    # Branche de production
├── develop             # Branche de développement
    ├── feature/*       # Nouvelles fonctionnalités
    ├── fix/*           # Corrections de bugs
    ├── refactor/*      # Refactoring
    ├── docs/*          # Documentation
    └── chore/*         # Tâches techniques (dépendances, config)
```

**Conventions de nommage :**

```bash
feature/gestion-des-sessions-distance
fix/expiration-token-jwt
refactor/service-email-optimisation
docs/api-authentication
chore/mise-a-jour-dependances
```

### 11.2 Workflow Git

```bash
# 1. Créer une branche depuis develop
git checkout develop
git pull origin develop
git checkout -b feature/ma-fonctionnalite

# 2. Faire les modifications et commits
git add .
git commit -m "feat: ajout de la gestion des sessions à distance"

# 3. Pusher et créer une Pull Request
git push origin feature/ma-fonctionnalite
# Créer une PR vers develop sur GitHub

# 4. Après review et merge, supprimer la branche
git branch -d feature/ma-fonctionnalite
```

**Conventions de message de commit :**

```
feat: nouvelle fonctionnalité
fix: correction de bug
refactor: refactoring de code
docs: documentation
chore: tâche technique
style: formatage (indentation, etc.)
test: ajout/modification de tests
perf: amélioration de performance
```

### 11.3 Bonnes pratiques de développement

#### Backend (Node.js/Express)

- Utilisez les **imports ES modules** (`import`/`export`) — le projet est configuré avec `"type": "module"`
- Suivez l'architecture **MVC** : routes → controllers → services
- Validez les entrées avec `express-validator`
- Gérez les erreurs avec des **middlewares** (voir `app.js`)
- Utilisez `dotenv` pour la configuration
- Écrivez les requêtes SQL avec **paramètres préparés** (`$1`, `$2`)
- Documentez les fonctions complexes avec JSDoc

#### Frontend (React/CoreUI)

- Utilisez les **composants fonctionnels** et les **hooks**
- Le routing est basé sur **HashRouter** (`/#/...`)
- Support **RTL** pour l'arabe (géré automatiquement via `languageMiddleware`)
- Lazy loading des pages avec `React.lazy()`
- Utilisez les variables d'environnement `VITE_*` accessibles via `import.meta.env`
- Les services API sont centralisés dans `src/services/`
- L'internationalisation utilise `i18next` avec 3 langues (fr, en, ar)

#### Base de données

- Les migrations sont dans `backend/schema.sql` et `backend/migration_*.sql`
- Les index sont préfixés par `idx_`
- Les contraintes de validation utilisent les préfixes `_check`
- Utilisez les types JSONB pour les données flexibles
- Utilisez les vues (VIEW) pour les requêtes complexes (ex: `asset_reliability`, `chatbot_top_cases`)

#### API

Toutes les routes sont préfixées par `/api` :

| Route | Description |
|---|---|
| `/api/auth` | Authentification (login, register, reset password) |
| `/api/users` | Gestion des utilisateurs |
| `/api/tickets` | Gestion des tickets |
| `/api/assets` | Gestion des actifs |
| `/api/knowledge` | Base de connaissance |
| `/api/notifications` | Notifications |
| `/api/anomalies` | Anomalies réseau |
| `/api/cmdb` | Smart CMDB |
| `/api/auto-ticketing` | Auto-ticketing |
| `/api/dashboard` | Tableau de bord |
| `/api/settings` | Paramètres système |
| `/api/chatbot` | Chatbot (messages, voix) |
| `/api/recommendations` | Recommandations technicien |
| `/api/sentiment` | Analyse de sentiment |
| `/api/qr` | QR codes |
| `/api/health` | Health check |

### 11.4 Tests

Les tests peuvent être ajoutés dans les dossiers `__tests__/` correspondants :

```bash
# Backend
backend/src/__tests__/

# Frontend
frontend/src/__tests__/
```

---

## Licence

Ce projet est sous licence MIT. Voir le fichier [`frontend/LICENSE`](frontend/LICENSE) pour plus de détails.

---

## Contact

- **Dépôt GitHub :** [https://github.com/saidasaidali/itsm_platform](https://github.com/saidasaidali/itsm_platform)
- **Documentation architecture :** [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md)
- **Guide développement :** [frontend/DEVELOPMENT.md](frontend/DEVELOPMENT.md)