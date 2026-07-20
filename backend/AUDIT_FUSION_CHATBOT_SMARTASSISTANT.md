# Audit de Fusion : Chatbot ↔ Smart Assistant

**Date :** 17/07/2026  
**Objectif :** Analyser les deux systèmes conversationnels pour produire une architecture fusionnée unique  
**Règle :** Aucune modification de fichier — audit en lecture seule

---

## 1. SMART ASSISTANT

### 1.1 Fichiers concernés

| Fichier | Rôle | Lignes |
|---|---|---|
| `backend/src/services/smartAssistantService.js` | Orchestrateur principal : pipeline complet (intention → analyse → RAG → réponse) | 1017 |
| `backend/src/controllers/smartAssistantController.js` | Contrôleur Express : validation, appel service, logging DB, réponse formatée | 321 |
| `backend/src/routes/smartAssistantRoutes.js` | Définition des routes API | 75 |
| `backend/src/services/sentimentAnalyzer.js` | Analyse de sentiment (importé) | — |
| `backend/src/services/technicianRecommender.js` | Recommandation de technicien (importé) | — |
| `backend/src/services/mlService.js` | ML risk scoring (importé) | — |
| `backend/src/services/networkDiscovery/digitalTwin.js` | Profil live des assets (importé) | — |
| `backend/src/services/notificationService.js` | Notifications (importé) | — |
| `backend/src/services/knowledgeBaseSearch.js` | Recherche KB (importé) | — |
| `backend/src/services/conversationCache.js` | Cache mémoire conversationnel | — |
| `backend/src/services/ragService.js` | Service RAG partagé (recherche unifiée, prompt, Ollama) | 550 |
| `backend/src/utils/nlpUtils.js` | Détection langue, intention, catégorisation, extraction mots-clés | 276 |
| `backend/src/services/intentService.js` | Ré-export de nlpUtils.js pour compatibilité | 12 |
| `backend/src/services/emailService.js` | Envoi d'emails (importé dynamiquement) | — |
| `frontend/src/components/SmartAssistant.jsx` | Composant React : chat UI complet (texte, voix, TTS, analyse) | 784 |
| `frontend/src/services/smartAssistantService.js` | Service API frontend : `sendMessage()`, `analyzeMessage()` | 54 |

### 1.2 Routes API exposées

| Méthode | Path | Controller | Auth |
|---|---|---|---|
| `POST` | `/api/smart-assistant/chat` | `processSmartMessage` | Private |
| `POST` | `/api/smart-assistant/analyze` | `analyzeMessage` | Private |
| `GET` | `/api/smart-assistant/stats` | `getStats` | Private (Admin) |
| `GET` | `/api/smart-assistant/metrics/realtime` | `getRealtimeMetrics` | Private (Admin) |
| `GET` | `/api/smart-assistant/security-incidents` | `getSecurityIncidents` | Private (Admin) |
| `PATCH` | `/api/smart-assistant/security-incidents/:id` | `updateSecurityIncident` | Private (Admin) |
| `POST` | `/api/smart-assistant/sync` | `syncLearnedCases` | Private (Admin) |
| `GET` | `/api/smart-assistant/session/:session_key` | `getSessionHistory` | Private |

### 1.3 Tables/colonnes PostgreSQL utilisées

| Table | Colonnes clés | Usage |
|---|---|---|
| `assets` | `id, asset_tag, type, brand, model, status, numero_inventaire_unique, assigned_to` | Identification d'équipement |
| `asset_assignments` | `asset_id, user_id` | Recherche d'asset par utilisateur |
| `smart_assistant_logs` | `user_id, session_key, user_message, intent, confidence, sentiment*, entities, asset_id, ticket_category, ticket_priority, ml_risk_score, is_security_incident, ticket_created_id, processing_time_ms, bot_response, sources` | Logging complet de chaque interaction |
| `smart_assistant_stats` | `date, ...` | Statistiques agrégées |
| `active_security_incidents` | `incident_status, severity, detected_at` | Incidents de sécurité actifs |
| `security_incidents` | `id, status, actions_taken, resolution_notes` | Mise à jour des incidents |
| `smart_assistant_metrics` | `metric_date, hour, total_messages, tickets_created, security_incidents_detected, avg_processing_time_ms` | Métriques temps réel |
| `chatbot_learned_cases` | `id, problem_keywords, problem_summary, solution_text, source_type, source_id, hit_count, confidence_score` | Cas appris (lecture/écriture via `searchLearnedCases`, `learnFromTicket`, `learnFromArticle`) |
| `tickets` | `id, title, description, category, priority, status, created_by, assigned_to, asset_id, sentiment*` | Création de ticket |
| `ticket_comments` | `ticket_id, content` | Apprentissage depuis commentaires |
| `knowledge_articles` | `id, title, summary, content` | Apprentissage depuis articles |
| `users` | `id, email, username, role_id, status, email_notifications` | Notification admins sécurité |
| `roles` | `id, name` | Filtrage admin |

### 1.4 Composant frontend

- **Composant :** `frontend/src/components/SmartAssistant.jsx`
- **Service API :** `frontend/src/services/smartAssistantService.js`
  - `sendMessage(message, sessionKey)` → `POST /api/smart-assistant/chat`
  - `analyzeMessage(message)` → `POST /api/smart-assistant/analyze`
- **Fonctionnalités :** Chat textuel, reconnaissance vocale (Web Speech API), synthèse vocale (TTS), affichage d'analyse détaillée (sentiment, asset, classification, prédiction ML, technicien, sécurité, ticket créé), sources KB cliquables, support RTL arabe, session persistante par utilisateur

---

## 2. CHATBOT

### 2.1 Fichiers concernés

| Fichier | Rôle | Lignes |
|---|---|---|
| `backend/src/services/chatbot/chatbotBrain.js` | Cœur du chatbot : session, message, recherche mémoire/KB, RAG, réponse | 237 |
| `backend/src/controllers/chatbotController.js` | Contrôleur Express : `askChatbot`, `sendMessage`, `voiceMessage`, `syncAll`, `getTopCases`, `getSessionHistory` | 97 |
| `backend/src/routes/chatbotRoutes.js` | Définition des routes API | 12 |
| `backend/src/services/ragService.js` | Service RAG partagé (recherche unifiée, buildRagPrompt, callOllama, routeIntent) | 550 |
| `backend/src/services/knowledgeBaseSearch.js` | Recherche KB (importé) | — |
| `backend/src/utils/nlpUtils.js` | Détection intention, extraction mots-clés | 276 |
| `backend/src/services/intentService.js` | `detectIntentWithConfidence` (importé) | 12 |
| `frontend/src/components/chatbot/` (probablement) | Composant React chatbot (non analysé — non listé dans les fichiers ouverts) | — |

### 2.2 Routes API exposées

| Méthode | Path | Controller | Auth |
|---|---|---|---|
| `POST` | `/api/chatbot/ask` | `askChatbot` | Non spécifié (pas de middleware auth visible) |
| `POST` | `/api/chatbot/message` | `sendMessage` | Non spécifié |
| `POST` | `/api/chatbot/sync-all` | `syncAll` | Non spécifié |
| `GET` | `/api/chatbot/top-cases` | `getTopCases` | Non spécifié |
| `GET` | `/api/chatbot/history/:session_key` | `getSessionHistory` | Non spécifié |
| `POST` | `/api/chatbot/voice` | `voiceMessage` (dans app.js) | Non spécifié |

### 2.3 Tables/colonnes PostgreSQL utilisées

| Table | Colonnes clés | Usage |
|---|---|---|
| `chatbot_sessions` | `id, session_key, user_id, last_active` | Sessions de conversation |
| `chatbot_messages` | `id, session_id, role, content, intent, confidence, created_at` | Historique des messages |
| `chatbot_learned_cases` | `id, problem_keywords (text[]), problem_summary, solution_text, source_type, source_id, hit_count, confidence_score` | Cas appris (lecture/écriture) |
| `chatbot_logs` | `session_key, intent, confidence, query, response` | Logs de chaque interaction |
| `chatbot_top_cases` | (vue ou table) | Top cas pour affichage |
| `tickets` | `id, title, description, status` | Apprentissage depuis tickets résolus |
| `ticket_comments` | `ticket_id, content` | Apprentissage depuis commentaires |
| `knowledge_articles` | `id, title, summary, content` | Apprentissage depuis articles |

### 2.4 Composant frontend

- **Composant :** Non listé dans les fichiers ouverts. Probablement `frontend/src/components/chatbot/Chatbot.jsx` ou similaire.
- **Service API :** Non listé. Probablement `frontend/src/services/chatbotService.js`.
- **Format de réponse :** `{ answer, sources, hasResults }` (via `askChatbot`) ou `{ success, data: { answer, sources, hasResults } }` (via `sendMessage`).

---

## 3. RECOUVREMENTS / DUPLICATIONS

### 3.1 Logiques dupliquées

| Fonctionnalité | Smart Assistant | Chatbot | Statut |
|---|---|---|---|
| **Détection d'intention** | `detectIntentWithContext()` (smartAssistantService.js:290) + `detectIntent()` (nlpUtils.js:74) | `detectIntentWithConfidence()` (chatbotBrain.js:100) + `detectIntent()` (nlpUtils.js:74) | **DUPLIQUÉ** — Les deux utilisent `nlpUtils.js` mais avec des wrappers différents. Le Smart Assistant a une logique de contexte conversationnel (`pendingAction`, `followUp`) que le Chatbot n'a pas. |
| **Appel LLM (Ollama)** | Via `ragService.processRagQuery()` (smartAssistantService.js:655) | Via `ragService.callOllama()` (chatbotBrain.js:156) | **DUPLIQUÉ** — Les deux appellent Ollama mais avec des prompts différents. Le Smart Assistant utilise `processRagQuery()` (buildRagPrompt + callOllama), le Chatbot utilise `buildRagPrompt()` directement + `callOllama()`. |
| **Recherche unifiée RAG** | `ragService.searchUnifiedKnowledge()` (smartAssistantService.js:579) | `ragService.searchUnifiedKnowledge()` (chatbotBrain.js:130) | **PARTAGÉ** — Même fonction, même service. |
| **Recherche KB** | `searchKnowledgeBase()` (smartAssistantService.js:864) | `searchKB()` (chatbotBrain.js:46) | **DUPLIQUÉ** — Même fonction `searchKnowledgeBase()` appelée avec des paramètres différents. |
| **Recherche cas appris** | `searchLearnedCases()` (smartAssistantService.js:753) | `searchMemory()` (chatbotBrain.js:33) | **DUPLIQUÉ** — Même requête SQL sur `chatbot_learned_cases`. |
| **Apprentissage (ticket → cas)** | `learnFromTicket()` (smartAssistantService.js:775) | `learnFromTicket()` (chatbotBrain.js:61) | **DUPLIQUÉ** — Code identique à 95%. |
| **Apprentissage (article → cas)** | `learnFromArticle()` (smartAssistantService.js:807) | `learnFromArticle()` (chatbotBrain.js:82) | **DUPLIQUÉ** — Code identique à 95%. |
| **Sync en masse** | `syncAll()` (smartAssistantService.js:832) | `syncAll()` (chatbotBrain.js:217) | **DUPLIQUÉ** — Même logique, itère sur tickets résolus + articles. |
| **Analyse de sentiment** | `analyzeSentiment()` (smartAssistantService.js:530) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **Classification de ticket** | `classifyTicket()` (smartAssistantService.js:252) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **Détection incident sécurité** | `detectSecurityIncident()` (smartAssistantService.js:260) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **Recommandation technicien** | `recommendTechnician()` (smartAssistantService.js:545) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **ML risk scoring** | `getRiskScore()` (smartAssistantService.js:540) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **Identification asset** | `identifyAsset()` (smartAssistantService.js:230) | Non utilisé | **UNIQUE** au Smart Assistant. |
| **Routeur d'intention RAG** | Non utilisé (décision via `detectIntentWithContext`) | `ragService.routeIntent()` (chatbotBrain.js:134) | **UNIQUE** au Chatbot. |
| **Cache conversationnel** | `conversationCache.js` (mémoire) | `ragService.conversationContextCache` (mémoire) | **DUPLIQUÉ** — Deux caches mémoire différents pour le même usage. |
| **Session management** | Session key générée côté frontend, stockée dans `smart_assistant_logs` | Table `chatbot_sessions` + `chatbot_messages` en DB | **DIFFÉRENT** — Le Chatbot persiste les messages en DB, le Smart Assistant log seulement. |
| **Voix** | Web Speech API côté client (SmartAssistant.jsx:165) | Whisper.cpp côté serveur (chatbotController.js:35) | **DIFFÉRENT** — Approches radicalement différentes. |

### 3.2 Différences de format de réponse

| Point | Smart Assistant (`POST /api/smart-assistant/chat`) | Chatbot (`POST /api/chatbot/message`) |
|---|---|---|
| **Format** | `{ success: true, data: { response, analysis, sources, metadata } }` | `{ success: true, data: { answer, sources, hasResults } }` |
| **Clé texte** | `data.response` (string) | `data.answer` (string) |
| **Sources** | `data.sources` (array avec `id, title, summary, type`) | `data.sources` (array avec `id, title, summary`) |
| **Analyse** | `data.analysis` (objet complet : sentiment, asset, classification, mlPrediction, technician, securityIncident, ticketCreated) | Absent |
| **Métadonnées** | `data.metadata` (processingTime, entitiesDetected, ragUsed, metrics) | Absent |
| **hasResults** | Absent | `data.hasResults` (boolean) |

---

## 4. PROPOSITION D'ARCHITECTURE FUSIONNÉE

### 4.1 Principe général

Un **seul point d'entrée conversationnel** qui route en interne vers :
- **Pipeline RAG** (base de connaissances, PDF, tickets résolus, cas appris) pour les questions documentaires/procédurales
- **Pipeline Smart** (classification, sécurité, ML, auto-ticketing, recommandation technicien) pour les demandes d'analyse et d'action

Le routage se fait par **intention détectée** via `nlpUtils.js` enrichie.

### 4.2 Architecture cible

```
[Frontend unique] → POST /api/smart-assistant/chat (inchangé)
                          │
                    [Orchestrateur fusionné]
                          │
              ┌───────────┴───────────┐
              │                       │
     [Routeur d'intention]    [Contexte conversationnel]
              │                       │
     ┌────────┼────────┐              │
     │        │        │              │
 [RAG]   [Smart]   [Mixte]           │
     │        │        │              │
     └────────┴────────┘              │
              │                       │
        [Génération réponse] ←────────┘
              │
        [Logging + Notifications]
```

### 4.3 Impact sur les routes existantes

**Aucun renommage.** Les routes actuelles restent inchangées :

- `POST /api/smart-assistant/chat` → **Point d'entrée unique** (inchangé)
- `POST /api/smart-assistant/analyze` → Conservé (inchangé)
- `POST /api/chatbot/message` → **Redirigé** vers le même orchestrateur (wrapper de compatibilité)
- `POST /api/chatbot/ask` → **Redirigé** vers le même orchestrateur (wrapper de compatibilité)
- `POST /api/chatbot/voice` → Conservé (Whisper) mais redirige le texte vers l'orchestrateur unique
- Toutes les routes stats/security/sync/history → Conservées telles quelles

### 4.4 Impact sur le(s) composant(s) frontend

**Stratégie : Fusion progressive**

1. **Phase 1** : Le composant `SmartAssistant.jsx` devient le composant unique de chat. Il est déjà complet (texte, voix, TTS, analyse, sources).
2. **Phase 2** : Si un composant `Chatbot.jsx` existe, il est soit :
   - Remplacé par `SmartAssistant.jsx` (si les fonctionnalités sont un sous-ensemble)
   - Soit modifié pour appeler `POST /api/smart-assistant/chat` au lieu de `POST /api/chatbot/message`
3. **Phase 3** : Adaptation du format de réponse côté frontend pour gérer `data.response` (nouveau) et `data.answer` (legacy) pendant la transition.

### 4.5 Liste des fichiers à créer/modifier (dans l'ordre)

#### Phase 1 : Unification backend (services)

| Ordre | Fichier | Action | Objectif | Risque | Dépendances |
|---|---|---|---|---|---|
| 1 | `backend/src/services/conversationService.js` | **CRÉER** | Service de gestion d'état conversationnel unifié (fusion de `conversationCache.js` + `ragService.conversationContextCache` + tables `chatbot_sessions`/`chatbot_messages`) | ⚠️ Migration des sessions existantes | Aucune |
| 2 | `backend/src/services/chatbot/chatbotBrain.js` | **MODIFIER** | Remplacer la logique interne par des appels à l'orchestrateur fusionné. Garder l'export pour compatibilité. | ⚠️ Changement de comportement pour les consommateurs existants | Dépend de (1) |
| 3 | `backend/src/services/smartAssistantService.js` | **MODIFIER** | Intégrer le routeur d'intention du chatbot (`ragService.routeIntent`). Fusionner les logiques dupliquées (`searchLearnedCases`, `learnFromTicket`, `learnFromArticle`, `syncAll`). | ⚠️ Gros fichier (1017 lignes) — nécessite refactoring | Dépend de (1) |
| 4 | `backend/src/services/ragService.js` | **MODIFIER** | Supprimer `conversationContextCache` (migré vers `conversationService.js`). Supprimer `searchLearnedCases` et `searchKnowledgeBase` internes (déjà dupliqués). | Faible | Dépend de (1) |
| 5 | `backend/src/services/conversationCache.js` | **SUPPRIMER** | Remplacé par `conversationService.js` | Faible | Dépend de (1) |

#### Phase 2 : Unification backend (contrôleurs/routes)

| Ordre | Fichier | Action | Objectif | Risque | Dépendances |
|---|---|---|---|---|---|
| 6 | `backend/src/controllers/chatbotController.js` | **MODIFIER** | Rediriger `askChatbot` et `sendMessage` vers l'orchestrateur fusionné. Adapter le format de réponse pour compatibilité. | ⚠️ Changement de format de réponse pour les clients existants | Dépend de (3) |
| 7 | `backend/src/controllers/smartAssistantController.js` | **MODIFIER** | Simplifier (moins de logging redondant). Supprimer les appels directs à `analyzeSentiment` (déjà dans le service). | Faible | Dépend de (3) |
| 8 | `backend/src/routes/chatbotRoutes.js` | **MODIFIER** | Ajouter middleware auth (actuellement manquant). | ⚠️ Breaking change si des clients non authentifiés utilisent le chatbot | Dépend de (6) |

#### Phase 3 : Unification frontend

| Ordre | Fichier | Action | Objectif | Risque | Dépendances |
|---|---|---|---|---|---|
| 9 | `frontend/src/services/smartAssistantService.js` | **MODIFIER** | Ajouter une fonction `sendChatbotMessage()` pour compatibilité avec l'ancien format chatbot (adapte `data.answer` → `data.response`). | Faible | Dépend de (6) |
| 10 | `frontend/src/components/SmartAssistant.jsx` | **MODIFIER** | Ajouter support du format de réponse legacy (`data.answer`). Rendre le composant configurable (mode smart vs mode chatbot). | Faible | Dépend de (9) |
| 11 | `frontend/src/components/chatbot/Chatbot.jsx` (si existe) | **MODIFIER** | Remplacer l'appel API par `POST /api/smart-assistant/chat` via `smartAssistantService.sendMessage()`. | ⚠️ Changement UI/UX potentiel | Dépend de (9) |

#### Phase 4 : Nettoyage

| Ordre | Fichier | Action | Objectif | Risque | Dépendances |
|---|---|---|---|---|---|
| 12 | `backend/src/services/chatbot/` (dossier) | **RESTRUCTURER** | Garder `chatbotBrain.js` comme wrapper de compatibilité. Supprimer les fichiers devenus inutiles. | Faible | Dépend de (2) |
| 13 | `backend/src/app.js` | **MODIFIER** | Vérifier que les deux routeurs (`chatbotRoutes` et `smartAssistantRoutes`) coexistent sans conflit. | Faible | Dépend de (8) |
| 14 | `backend/schema.sql` | **MODIFIER** | Ajouter commentaires/documentation sur les tables partagées. Optionnel : ajouter une vue unifiée pour les logs. | Faible | Aucune |

### 4.6 Résumé des duplications à éliminer

| Duplication | Solution |
|---|---|
| `searchLearnedCases()` × 2 | Une seule fonction dans `ragService.js` ou `conversationService.js` |
| `learnFromTicket()` × 2 | Une seule fonction partagée |
| `learnFromArticle()` × 2 | Une seule fonction partagée |
| `syncAll()` × 2 | Une seule fonction partagée |
| Cache conversationnel × 2 | Un seul `conversationService.js` |
| Détection d'intention × 2 wrappers | Unifier dans `nlpUtils.js` avec support du contexte |
| Appel Ollama × 2 patterns | Unifier via `ragService.processRagQuery()` (le plus complet) |
| Routeur d'intention RAG × 2 | Fusionner `detectIntentWithContext()` (Smart) et `routeIntent()` (Chatbot) |

### 4.7 Recommandations clés

1. **Conserver `POST /api/smart-assistant/chat` comme route canonique** — elle est la plus complète (analyse, métadonnées, logging DB).
2. **Faire de `chatbotBrain.js` un adaptateur** qui appelle l'orchestrateur fusionné et transforme le format de réponse.
3. **Unifier le cache conversationnel** : privilégier le cache mémoire (`conversationCache.js`) du Smart Assistant qui est plus sophistiqué (pendingAction, followUp), et abandonner le cache du chatbot dans `ragService.conversationContextCache`.
4. **Conserver les deux approches vocales** : Web Speech API (client) pour la réactivité, Whisper (serveur) pour la précision — elles ne sont pas en conflit.
5. **Ne pas toucher aux tables PostgreSQL** — les deux systèmes utilisent déjà des tables partagées (`chatbot_learned_cases`, `tickets`, `knowledge_articles`). La fusion est déjà partiellement réalisée au niveau données.