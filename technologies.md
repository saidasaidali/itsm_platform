# Technologies Utilisées - ITSM Platform

## 1. FRONTEND (React / Vite / CoreUI)

### Framework & Bibliothèques Principales

| Technologie          | Version   | Rôle                                      |
|----------------------|-----------|-------------------------------------------|
| React                | ^19.2.4   | Framework UI (composants, state, hooks)   |
| React DOM            | ^19.2.4   | Rendu DOM côté navigateur                 |
| React Router DOM     | ^7.13.2   | Routage client-side (SPA)                 |
| Redux                | 5.0.1     | Gestion d'état globale                    |
| React Redux          | ^9.2.0    | Intégration React ↔ Redux                 |
| Vite                 | ^8.0.3    | Bundler / dev server (build rapide)       |
| CoreUI               | ^5.6.1    | UI Kit (composants, layout, thèmes)       |
| CoreUI React         | ^5.10.0   | Composants React CoreUI                   |
| CoreUI Icons         | ^3.0.1    | Bibliothèque d'icônes                     |
| CoreUI Chart.js      | ^4.2.0    | Intégration CoreUI + Chart.js             |
| CoreUI Utils         | ^2.0.2    | Utilitaires CoreUI                        |

### Graphiques & Visualisation

| Technologie              | Version   | Rôle                                      |
|--------------------------|-----------|-------------------------------------------|
| Chart.js                 | ^4.5.1    | Graphiques et visualisations              |
| React Chart.js 2         | ^5.3.1    | Wrapper React pour Chart.js               |
| Reactflow                | ^11.11.4  | Diagrammes de flux (cartes réseau, workflows) |
| FullCalendar             | ^6.1.21   | Calendrier et planification               |

### Internationalisation (i18n)

| Technologie                      | Version   | Rôle                                      |
|----------------------------------|-----------|-------------------------------------------|
| i18next                          | ^26.3.1   | Moteur d'internationalisation             |
| react-i18next                    | ^17.0.8   | Intégration React ↔ i18next               |
| i18next-browser-languagedetector | ^8.2.1    | Détection automatique de la langue        |

### UI / Utilitaires

| Technologie        | Version   | Rôle                                      |
|--------------------|-----------|-------------------------------------------|
| Popper.js          | ^2.11.8   | Positionnement des tooltips/popovers      |
| Simplebar React    | ^3.3.2    | Barre de défilement personnalisée         |
| Classnames         | ^2.5.1    | Gestion conditionnelle des classes CSS    |
| PropTypes          | ^15.8.1   | Validation des props React                |
| Core JS            | ^3.49.0   | Polyfills ES6+ pour compatibilité         |

### Styles

| Technologie   | Version   | Rôle                                      |
|---------------|-----------|-------------------------------------------|
| Sass (SCSS)   | ^1.98.0   | Préprocesseur CSS (variables, mixins)     |
| Autoprefixer  | ^10.4.27  | Ajout automatique des préfixes CSS        |
| PostCSS       | ^8.5.8    | Transformation CSS post-compilation       |

### Outils de Développement

| Technologie              | Version   | Rôle                                      |
|--------------------------|-----------|-------------------------------------------|
| ESLint                   | ^9.39.2   | Linter JavaScript/JSX                     |
| ESLint React Plugin      | ^7.37.5   | Règles ESLint spécifiques React            |
| ESLint React Hooks       | ^7.0.1    | Règles ESLint pour les Hooks              |
| ESLint Prettier          | ^5.5.5    | Intégration ESLint + Prettier             |
| Prettier                 | 3.8.1     | Formateur de code automatique             |
| Globals                  | ^16.5.0   | Définitions des globales ESLint           |
| Vite Plugin React        | ^6.0.1    | Plugin Vite pour React (Fast Refresh)     |

---

## 2. BACKEND (Node.js / Express)

### Framework & Serveur

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| Node.js          | -         | Runtime JavaScript côté serveur            |
| Express          | ^5.2.1    | Framework HTTP (routes, middlewares)      |
| Helmet           | ^8.2.0    | Sécurisation des en-têtes HTTP            |
| CORS             | ^2.8.6    | Gestion du Cross-Origin Resource Sharing  |

### Authentification & Sécurité

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| JSON Web Token   | ^9.0.3    | Authentification par tokens JWT           |
| bcrypt           | ^6.0.0    | Hash et vérification des mots de passe    |
| express-validator| ^7.3.2    | Validation des entrées utilisateur        |

### Base de Données

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| PostgreSQL       | -         | Base de données relationnelle              |
| pg               | ^8.21.0   | Pilote PostgreSQL pour Node.js            |

### Machine Learning & IA

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| Ollama           | ^0.5.12   | Client API pour modèles LLM locaux        |
| Tesseract.js     | ^7.0.0    | OCR (Reconnaissance optique de caractères)|
| Canvas           | ^3.2.3    | Manipulation d'images côté serveur        |

### Rapports & Documents

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| PDFKit           | ^0.19.1   | Génération de documents PDF               |
| PDF Parse        | ^1.1.1    | Extraction de texte depuis des PDF        |
| Mammoth          | ^1.8.0    | Conversion DOCX → HTML / texte            |
| XLSX             | ^0.18.5   | Lecture/écriture de fichiers Excel        |

### Réseau & Découverte

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| net-snmp         | ^3.26.3   | Requêtes SNMP pour supervision réseau     |
| PowerShell       | -         | Scripts AD Scan & Live State              |

### Notifications & Email

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| Nodemailer       | ^9.0.0    | Envoi d'emails transactionnels            |

### Configuration & Environnement

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| dotenv           | ^17.4.2   | Gestion des variables d'environnement     |

---

## 3. MACHINE LEARNING (Python)

### Framework & API

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| FastAPI           | 0.111.0   | Framework API REST Python (asynchrone)    |
| Uvicorn           | 0.29.0    | Serveur ASGI pour FastAPI                 |
| Python Dotenv     | 1.0.1     | Variables d'environnement Python          |

### Data Science & ML

| Technologie      | Version   | Rôle                                      |
|------------------|-----------|-------------------------------------------|
| Scikit-learn     | 1.4.2     | Algorithmes ML (régression, clustering)   |
| Pandas           | 2.2.2     | Manipulation et analyse de données        |
| Joblib           | 1.4.2     | Sérialisation de modèles entraînés        |

### Base de Données

| Technologie          | Version   | Rôle                                      |
|----------------------|-----------|-------------------------------------------|
| psycopg2-binary       | 2.9.9     | Pilote PostgreSQL pour Python             |

### Modèles ML Implémentés (Scripts Python)

| Fichier                   | Rôle                                      |
|---------------------------|-------------------------------------------|
| anomaly_detector.py       | Détection d'anomalies sur les actifs      |
| failure_predictor.py      | Prédiction de pannes (maintenance prédictive) |
| risk_scorer.py            | Score de risque des équipements           |
| dataset_builder.py        | Construction des datasets d'entraînement  |

### Modèle LLM Local (GGML)

| Fichier            | Format    | Rôle                                      |
|--------------------|-----------|-------------------------------------------|
| ggml-small.bin    | GGML      | Modèle de langage local (LLM) pour le chatbot & RAG |

---

## 4. INFRASTRUCTURE & DÉPLOIEMENT

### CI/CD & Qualité

| Technologie       | Rôle                                      |
|-------------------|-------------------------------------------|
| GitHub Actions    | Pipeline CI/CD automatisé                 |
| ESLint            | Analyse statique du code                  |
| Prettier          | Formatage automatique du code             |

### Conteneurisation

| Technologie       | Rôle                                      |
|-------------------|-------------------------------------------|
| Docker            | Conteneurisation des services             |
| Docker Compose    | Orchestration multi-conteneurs            |
| Kubernetes        | Orchestration de conteneurs en production |

---

## 5. RÉCAPITULATIF PAR COUCHE

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19)                        │
│  CoreUI 5, Chart.js, Reactflow, FullCalendar                   │
│  i18next, Redux, React Router 7, Vite 8, Sass                 │
│  ESLint 9, Prettier 3                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│                   APIs HTTP (Express 5 / FastAPI)              │
│                                                                │
├─────────────────────────────────────────────────────────────────┤
│                     BACKEND (Node.js)                          │
│  Express 5, JWT, bcrypt, PostgreSQL (pg)                       │
│  Ollama (LLM), Tesseract.js (OCR), net-snmp, Nodemailer        │
│  PDFKit, XLSX, Mammoth, Canvas                                 │
├─────────────────────────────────────────────────────────────────┤
│                     ML (Python)                                │
│  FastAPI, Scikit-learn, Pandas, Joblib                         │
│  Modèles : Anomalies, Prédiction pannes, Score risque          │
├─────────────────────────────────────────────────────────────────┤
│                     BASE DE DONNÉES                            │
│  PostgreSQL                                                    │
├─────────────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                             │
│  Docker, Kubernetes, GitHub Actions                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. MODULES FONCTIONNELS & TECHNOLOGIES ASSOCIÉES

| Module                | Technologies Clés                                            |
|-----------------------|--------------------------------------------------------------|
| Authentification      | JWT, bcrypt, express-validator                               |
| Gestion des Actifs    | QR Code (canvas), SNMP (net-snmp), PowerShell                |
| Ticketing             | PDFKit, Mammoth, XLSX                                        |
| Auto-Ticketing        | Ollama (LLM), ML (scikit-learn)                              |
| Chatbot Intelligent   | Ollama (LLM), Tesseract.js, PDF Parse                        |
| Dashboard             | Chart.js, Reactflow, FullCalendar                            |
| Découverte Réseau     | SNMP, Active Directory (PowerShell), Jumeau Numérique        |
| Détection Anomalies   | Scikit-learn, Pandas, Joblib                                 |
| Prédiction Pannes     | Scikit-learn, Pandas, Joblib                                 |
| Score de Risque       | Scikit-learn, Pandas, Joblib                                 |
| Base de Connaissances | RAG (LLM), OCR (Tesseract), i18n                             |
| Notifications         | Nodemailer, Webhooks                                         |
| Internationalisation  | i18next, react-i18next                                       |
| Paramètres            | dotenv, PostgreSQL                                           |
| Rapports & Exports    | PDFKit, XLSX, Chart.js                                       |

---

## 7. LICENCES

| Technologie           | Licence            |
|-----------------------|--------------------|
| React                 | MIT                |
| CoreUI                | MIT                |
| Vite                  | MIT                |
| Express               | MIT                |
| Chart.js              | MIT                |
| Redux                 | MIT                |
| i18next               | MIT                |
| FastAPI               | MIT                |
| Scikit-learn          | BSD-3-Clause       |
| Pandas                | BSD-3-Clause       |
| PostgreSQL (pg)       | PostgreSQL License |
| CoreUI Template       | MIT                |

---

> Document généré automatiquement à partir de l'analyse des fichiers package.json, requirements.txt et de la structure du projet.