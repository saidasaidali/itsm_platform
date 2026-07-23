# Guide de Lancement - ITSM Platform

## Table des Matières

1. [Prérequis](#1-prérequis)
2. [Installation Rapide](#2-installation-rapide)
3. [Configuration Détaillée](#3-configuration-détaillée)
4. [Lancement du Projet](#4-lancement-du-projet)
5. [Modules Optionnels](#5-modules-optionnels)
6. [Dépannage](#6-dépannage)
7. [Architecture & Flux](#7-architecture--flux)

---

## 1. Prérequis

### Logiciels Obligatoires

| Logiciel          | Version Min. | Installation                                       |
|-------------------|--------------|----------------------------------------------------|
| **Node.js**       | ≥ 18         | [https://nodejs.org](https://nodejs.org)           |
| **npm**           | ≥ 9          | Livré avec Node.js                                 |
| **PostgreSQL**    | ≥ 14         | [https://postgresql.org](https://postgresql.org)   |
| **Git**           | ≥ 2.30       | [https://git-scm.com](https://git-scm.com)         |
| **Python**        | ≥ 3.10       | [https://python.org](https://python.org)           |

### Logiciels Recommandés (pour les fonctionnalités avancées)

| Logiciel           | Utilité                                        | Lien                                               |
|--------------------|------------------------------------------------|----------------------------------------------------|
| **Ollama**         | LLM local (chatbot, RAG, auto-ticketing)       | [https://ollama.com](https://ollama.com)           |
| **Tesseract OCR**  | OCR pour documents scannés                     | [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki) |
| **Poppler**        | Conversion PDF → images                        | [https://poppler.freedesktop.org](https://poppler.freedesktop.org) |
| **Docker**         | Conteneurisation (optionnel)                   | [https://docker.com](https://docker.com)           |

---

## 2. Installation Rapide

### Étape 1 : Cloner le Projet

```bash
git clone https://github.com/saidasaidali/itsm_platform.git
cd itsm-platform
```

### Étape 2 : Backend - Installer les Dépendances

```bash
cd backend
npm install
```

### Étape 3 : Frontend - Installer les Dépendances

```bash
cd frontend
npm install
```

### Étape 4 : ML (Python) - Installer les Dépendances

```bash
cd backend/ml
pip install -r requirements.txt
```

### Étape 5 : Configurer la Base de Données PostgreSQL

Lancez votre serveur PostgreSQL, puis créez la base de données :

```bash
# Connexion à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE itsm_platform;

# Quitter
\q
```

### Étape 6 : Configurer les Variables d'Environnement

```bash
# Copier les fichiers d'exemple (si .env n'existe pas)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Éditer `backend/.env`** avec vos informations :

```env
# ─── Serveur ───
PORT=3000
CORS_ORIGIN=http://localhost:3001

# ─── PostgreSQL ───
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itsm_platform
DB_USER=postgres
DB_PASSWORD=VOTRE_MOT_DE_PASSE

# ─── JWT ───
JWT_SECRET=CHANGEZ_CE_SECRET_PAR_UNE_CHAINE_ALEATOIRE
```

### Étape 7 : Initialiser le Schéma de la Base de Données

```bash
cd backend
psql -U postgres -d itsm_platform -f schema.sql
```

---

## 3. Configuration Détaillée

### 3.1 Configuration PostgreSQL

Assurez-vous que PostgreSQL est en cours d'exécution :

```bash
# Vérifier le statut
pg_isready

# Si PostgreSQL n'est pas lancé (Windows) :
net start postgresql-x64-16

# Si PostgreSQL n'est pas lancé (Linux/macOS) :
sudo systemctl start postgresql
```

### 3.2 Configuration du Frontend

Le fichier `frontend/.env` est très simple :

```env
VITE_API_URL=http://localhost:3000
```

> **Note :** L'URL doit correspondre au `PORT` défini dans `backend/.env`.

### 3.3 Configuration d'Ollama (Optionnel - Chatbot & RAG)

```bash
# Installer Ollama
# Télécharger depuis https://ollama.com

# Démarrer Ollama
ollama serve

# Dans un autre terminal, télécharger les modèles
ollama pull llama3.2:1b
ollama pull nomic-embed-text
```

Configurer dans `backend/.env` :

```env
OLLAMA_MODEL=llama3.2:1b
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
ENABLE_ML_SERVICE=true
```

### 3.4 Configuration du Réseau (Optionnel - Découverte Automatique)

```env
ENABLE_AD_SCAN=true
ENABLE_SNMP_SCAN=true
SNMP_NETWORK_BASE=192.168.1   # À adapter à votre réseau
```

### 3.5 Configuration Email (Optionnel - Notifications)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=votre.email@gmail.com
SMTP_PASS=votre_mot_de_passe_application
```

> **📧 Gmail :** Utilisez un mot de passe d'application (2FA requis) : [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

---

## 4. Lancement du Projet

### 4.1 Démarrer le Backend

```bash
cd backend
npm start
```

Le serveur démarre sur **http://localhost:3000**.

**Ce qui se passe automatiquement au démarrage :**
- ✅ Connexion à PostgreSQL
- ✅ Création automatique des tables et colonnes manquantes (migrations)
- ✅ Chargement des paramètres depuis la base de données
- ✅ Démarrage du service ML (si activé)
- ✅ Démarrage de la découverte réseau (si activée)
- ✅ Démarrage de l'indexation PDF
- ✅ Endpoint santé : `http://localhost:3000/api/health`

### 4.2 Démarrer le Frontend

```bash
cd frontend
npm start
```

Le serveur de développement Vite démarre sur **http://localhost:3001**.

### 4.3 Démarrer le Service ML (Python)

```bash
cd backend/ml
python app.py
```

Le service ML démarre sur **http://localhost:8001**.

### 4.4 Vérifier que tout fonctionne

```bash
# Test rapide
curl http://localhost:3000/api/health

# Réponse attendue :
# {"status":"OK","timestamp":"2026-07-23T12:00:00.000Z"}
```

### 4.5 Accéder à l'Application

Ouvrir dans un navigateur : **http://localhost:3001**

---

## 5. Modules Optionnels

### 5.1 Base de Connaissances (RAG avec PDF)

```bash
# Créer le dossier de stockage
mkdir backend/storage
mkdir backend/reports
```

1. Ajouter des articles dans l'interface "Base de Connaissances"
2. Les PDF sont automatiquement indexés pour la recherche RAG
3. Le chatbot utilise le LLM local (Ollama) pour répondre

### 5.2 Auto-Ticketing

```env
ENABLE_AUTO_TICKETING=true
AUTO_TICKET_INTERVAL_MIN=30
```

### 5.3 QR Codes

- Génération automatique de QR codes pour chaque actif
- Impression possible via l'interface

### 5.4 Calendrier & Planification

```bash
# Les tables sont créées automatiquement au démarrage
# Activer les rappels automatiques
```

### 5.5 Détection d'Anomalies (ML)

```env
ENABLE_ML_SERVICE=true
ML_AUTO_TRAIN=true
ML_AUTO_TRAIN_INTERVAL=604800  # 7 jours
```

---

## 6. Dépannage

### 6.1 Problèmes Courants

| Problème                          | Cause Possible                                  | Solution                                              |
|-----------------------------------|------------------------------------------------|-------------------------------------------------------|
| `ECONNREFUSED` PostgreSQL         | PostgreSQL non démarré                         | `net start postgresql-x64-16` ou `sudo systemctl start postgresql` |
| `relation "xxx" does not exist`   | Schéma non initialisé                          | `psql -U postgres -d itsm_platform -f backend/schema.sql` |
| `Cannot find module`              | Dépendances non installées                     | `npm install` dans `backend/` et `frontend/`          |
| CORS Error dans le navigateur     | Mauvais port dans CORS_ORIGIN                  | Vérifier que `CORS_ORIGIN=http://localhost:3001`      |
| Ollama connection refused         | Ollama non démarré                             | `ollama serve` (dans un nouveau terminal)             |
| Page blanche au chargement        | Erreur de build ou dépendance manquante        | `rm -rf node_modules && npm install` dans `frontend/` |
| Erreur JWT                        | JWT_SECRET non configuré                       | Ajouter `JWT_SECRET=une_chaine_aleatoire` dans `.env` |
| Port déjà utilisé                  | Un autre service utilise le port                | Changer `PORT=3000` dans `backend/.env` ou tuer le processus (`netstat -ano` + `taskkill`) |

### 6.2 Logs et Debug

```bash
# Voir les logs backend en temps réel
cd backend
npm start 2>&1 | tee logs.txt

# Vérifier les erreurs
cat stderr_backend.log

# Vérifier les logs ML
cat stdout_backend.log | grep -i ml

# Mode debug RAG (dans .env)
RAG_DEBUG_MODE=true
```

### 6.3 Réinitialisation Complète

```bash
# 1. Arrêter les serveurs (Ctrl+C)

# 2. Réinitialiser la base de données (⚠️ supprime toutes les données)
psql -U postgres -d itsm_platform -f backend/schema.sql

# 3. Supprimer et réinstaller les node_modules
cd backend && rm -rf node_modules && npm install
cd ../frontend && rm -rf node_modules && npm install

# 4. Redémarrer
# Terminal 1 : cd backend && npm start
# Terminal 2 : cd frontend && npm start
```

---

## 7. Architecture & Flux

### 7.1 Architecture 3 Couches

```
┌──────────────────────────────────────────────────────────┐
│                    NAVIGATEUR                           │
│               http://localhost:3001                      │
│                  React + CoreUI                         │
└──────────────────────┬───────────────────────────────────┘
                       │  APIs REST (Axios)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  BACKEND (Port 3000)                     │
│              Node.js + Express + PostgreSQL              │
│                                                          │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Contrôleurs  │  │ Services  │  │ Middlewares       │   │
│  │ (API REST)   │→ │ (Métier)  │→ │ (Auth, Langue)   │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Services Spécialisés                              │   │
│  │ Chatbot │ Découverte Réseau │ Auto-Ticketing     │   │
│  │ OCR     │ QR Code          │ Workflow Engine     │   │
│  │ SLA     │ Notifications    │ Recommandations     │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬───────────────────────────────────┘
                       │  HTTP / WebSocket
                       ▼
┌──────────────────────────────────────────────────────────┐
│             ML SERVICE (Port 8001 - Optionnel)           │
│              FastAPI + Scikit-learn + Pandas             │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Modèles : Anomalies │ Pannes │ Score de Risque   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Ports Utilisés

| Service    | Port  | URL                    |
|------------|-------|------------------------|
| Frontend   | 3001  | http://localhost:3001  |
| Backend    | 3000  | http://localhost:3000  |
| ML (Python)| 8001  | http://localhost:8001  |
| Ollama     | 11434 | http://localhost:11434 |
| PostgreSQL | 5432  | localhost:5432         |

### 7.3 Ordre de Démarrage Recommandé

```
1. PostgreSQL          (service système)
2. Ollama              (ollama serve)           [optionnel]
3. Backend (Node.js)   (cd backend && npm start)
4. Service ML (Python) (cd backend/ml && python app.py)  [optionnel]
5. Frontend (Vite)     (cd frontend && npm start)
```

---

## Annexe : Structure des Fichiers de Configuration

```
itsm-platform/
│
├── backend/
│   ├── .env                   # Variables d'environnement backend (À ÉDITER)
│   ├── .env.example           # Exemple de configuration
│   ├── package.json           # Dépendances Node.js backend
│   └── schema.sql             # Schéma de la base de données
│
├── frontend/
│   ├── .env                   # URL de l'API backend (À ÉDITER)
│   └── package.json           # Dépendances React
│
├── requirements.txt           # Dépendances Python (projet racine)
├── GUIDE_LANCEMENT.md         # Ce fichier
├── technologies.md            # Technologies utilisées
└── structure.txt              # Structure du projet
```

---

> **Problème ?** Ouvrez une issue sur [GitHub](https://github.com/saidasaidali/itsm_platform/issues)
>
> **Contributions ?** Consultez `frontend/.github/CONTRIBUTING.md`