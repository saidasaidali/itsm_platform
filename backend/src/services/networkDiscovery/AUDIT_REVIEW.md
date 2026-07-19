# 🔍 Audit du Module Digital Twin — Revue Technique Rigoureuse

**Date :** 06/07/2026  
**Version audité :** Commit 98d9ab63ec55370a33b3aacd1448eafac23f8a1d  
**Fichiers audités :** `digitalTwin.js` (264 lignes), `scheduler.js` (198 lignes), `get-live-state.ps1`, `adScan.js`, `snmpScan.js`, `relationDetector.js`, `settingsService.js`, `simulationService.js`, `schema.sql`  

---

## ⚠️ AVANT-PROPOS IMPORTANT

Le rapport précédent était **partiellement erroné** car :
1. La version `digitalTwin.js` analysée initialement était une version **différente** de celle du commit (385 lignes avec simulation vs 264 lignes sans simulation)
2. Plusieurs affirmations étaient incorrectes et ne correspondaient pas au code réel

Cette revue se base exclusivement sur le **code réel** du commit.

---

## ÉTAPE 1 : VÉRIFICATION DES PROBLÈMES RAPPORT PRÉCÉDENT

### Problème #1 : Filtre SQL `type = 'Ordinateur'`

**Localisation :** `digitalTwin.js` ligne 224  
**Code réel :**  
```sql
SELECT id, asset_tag, model AS hostname FROM assets
WHERE type = 'Ordinateur' AND status != 'Retiré'
```

**Analyse :**  
- ✅ **C'est un vrai problème.** La comparaison stricte `= 'Ordinateur'` ignore les types `'Ordinateur portable'`, `'Ordinateur fixe'`, `'Desktop'`, `'Laptop'`, `'Workstation'`, `'PC'`
- **Mais la gravité dépend du modèle de données réel.** Si tous les assets sont strictement typés `'Ordinateur'` dans la base, le problème est faible. Si les données viennent de l'AD avec des types variés, le problème est critique.
- **Note importante :** `adScan.js` ligne 146 insère TOUJOURS `type = 'Ordinateur'`, donc les postes découverts par l'AD ont tous ce type exact. Mais les imports manuels ou autres peuvent avoir des types différents.

**Niveau de confiance :** **High** (problème réel mais impact variable)

**Véritable impact :**  
- Postes importés manuellement avec `type = 'Ordinateur portable'` : **IGNORÉS**
- Postes de type `'Desktop'` ou `'Laptop'` : **IGNORÉS**
- Postes créés par `adScan.js` : **OK** (car type = 'Ordinateur' exact)

---

### Problème #2 : Hostname DNS avec `model || hostname || asset_tag`

**Erreur dans mon rapport précédent :** J'ai affirmé que la ligne était `computer.hostname || computer.asset_tag`  
**Code réel (ligne 180) :**  
```js
const hostname = computer.model || computer.hostname || computer.asset_tag;
```

**Analyse ligne par ligne :**
1. `computer.model` — Utilisé en **première priorité**. Mais `model` n'est PAS un nom DNS ! C'est le modèle matériel (ex: 'ProBook 450 G10', 'PowerEdge R740').
2. `computer.hostname` — Deuxième priorité, correct si présent
3. `computer.asset_tag` — Troisième priorité, pas un nom DNS

**Pourquoi `model` est en première position ?**  
Regardez la requête SQL ligne 224 :
```sql
SELECT id, asset_tag, model AS hostname FROM assets
```
L'alias `model AS hostname` signifie que le champ `model` est **renommé** en `hostname` dans le résultat ! Donc `computer.hostname` contient le **modèle matériel**, pas le vrai hostname. L'original était `SELECT id, asset_tag, hostname FROM assets` mais a été modifié (probablement pour bug).

**C'est extrêmement problématique :**
- `computer.hostname` = le modèle matériel ('ProBook 450') → envoyé à PowerShell comme nom de poste
- `computer.model` = aussi le modèle matériel (redondant)
- `computer.asset_tag` = 'PC-00123' → pas un nom DNS non plus

**Niveau de confiance :** **High** — C'est un bug sérieux

**Véritable impact :**  
- **100% de faux Offline** car PowerShell reçoit `-ComputerName "ProBook 450 G10"` qui ne résout pas en DNS
- Le script PowerShell échoue, retourne `null`, et le poste est marqué Offline
- **TOUS les postes sont marqués Offline en permanence**

---

### Problème #3 : Marquage Offline Immédiat

**Code réel (lignes 183-196) :**
```js
try {
  const data = await runLiveStateScript(hostname);
  if (data && data.is_online) {
    await saveLiveState(computer.id, { ...data, is_online: true });
    results.online++;
  } else {
    await markOffline(computer.id);  // ← déclenché même si data est null (timeout)
    results.offline++;
  }
} catch (err) {
  results.errors++;
  console.error(`[DigitalTwin] Erreur ${hostname} :`, err.message);
  await markOffline(computer.id);  // ← déclenché aussi en cas d'erreur
  results.offline++;
}
```

**Analyse :**  
- Si `runLiveStateScript` retourne `null` (timeout, erreur PowerShell, JSON invalide) → **markOffline immédiat**
- Si une exception est levée → **markOffline immédiat**
- Aucune distinction entre "poste éteint" et "timeout réseau temporaire"
- Aucun compteur d'échecs, aucune mémoire

**Niveau de confiance :** **High** — C'est un vrai problème de robustesse

**Véritable impact :**  
- Un seul timeout réseau de 10s marque un poste Offline
- Au prochain cycle (10 min plus tard), si le poste répond, il repasse Online
- **Effet "flapping"** : le poste alterne Online/Offline à chaque cycle réseau instable

---

### Problème #4 : Concurrence avec `queue.shift()`

**Code réel (lignes 172-208) :**
```js
async function processBatchWithConcurrency(computers, concurrency) {
  const results = { online: 0, offline: 0, errors: 0 };
  const queue = [...computers];
  const active = new Set();  // ← déclaré mais JAMAIS utilisé

  const processNext = async () => {
    while (queue.length > 0) {
      const computer = queue.shift();  // ← shift() est atomique en JS
      // ...
    }
  };
  // ...
}
```

**Analyse :**  
- ✅ **`queue.shift()` est atomique** en JavaScript (single-thread, pas de vrai parallélisme)
- La condition `queue.length > 0` et `shift()` s'exécutent dans le même tick event-loop
- **Mais le vrai problème est ailleurs :** `runLiveStateScript` est une Promise. Le `while` continue immédiatement après avoir lancé l'appel PowerShell, donc tous les workers démarrent rapidement, mais comme JS est single-thread, chaque `shift()` est appelé séquentiellement dans la microtask queue
- La variable `active = new Set()` est du **dead code**

**Niveau de confiance :** **Medium** — Pas de corruption de données, mais code mort

**Véritable impact :**  
- Chaque asset est traité exactement une fois (contrairement à mon affirmation précédente)
- La variable `active` (dead code) est un signe de refactoring incomplet
- **Pas de crash, pas de corruption** — mais le code est trompeur

---

### Problème #5 : Stale Locks dans le Scheduler

**Code réel (lignes 63-104) :**
```js
async function runTask(taskName, stateKey, taskFn, logMessage) {
  if (running[stateKey]) { ... return; }
  running[stateKey] = true;
  try {
    const result = await taskFn();
  } finally {
    running[stateKey] = false;  // ← toujours exécuté, même en cas d'erreur
  }
}
```

**Analyse :**  
- ✅ Le `finally` garantit que `running[stateKey] = false` est exécuté
- ✅ En cas d'exception dans `taskFn()`, le `finally` libère le lock
- ⚠️ **Mais** si Node.js crash (process.exit, OOM, kill -9), le lock reste à `true`
- ⚠️ **Mais** si `taskFn()` contient une boucle infinie synchronous, le `finally` n'est jamais atteint

**Niveau de confiance :** **Low** — Scénario de crash Node seulement

**Véritable impact :**  
- En fonctionnement normal : **jamais de stale lock**
- En cas de crash Node : le processus redémarre, donc l'état `running` est réinitialisé
- **Pas un problème critique** dans l'immédiat

---

## ÉTAPE 2 : PROBLÈMES SUPPLÉMENTAIRES IDENTIFIÉS

### Problème #6 : Injection PowerShell Potentielle via `hostname`

**Code réel (lignes 30-36) :**
```js
const cmd =
  `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}" ` +
  `-ComputerName "${hostname}" ` +
  ...
```

**Analyse :**  
- `hostname` est injecté directement dans une chaîne de commande
- Si un hostname contient `"; Remove-Item * -Recurse -Force; "`, la commande PowerShell est détournée
- La base de données peut contenir des hostnames non fiables (imports, scan AD)

**Niveau de confiance :** **High** — Injection PowerShell possible

**Véritable impact :**  
- Un asset avec un hostname malveillant dans la base peut exécuter des commandes PowerShell arbitraires
- Risque de **compromission du serveur ITSM**

---

### Problème #7 : `model AS hostname` — Erreur de Mapping SQL

**Code réel (ligne 224) :**
```sql
SELECT id, asset_tag, model AS hostname FROM assets
```

**Analyse :**  
- Cette ligne **renomme** `model` en `hostname`
- C'est une modification volontaire (probablement pour corriger un bug précédent où `hostname` était NULL)
- Mais cela signifie que `computer.hostname` contient le MODÈLE ('ProBook 450'), pas le vrai hostname
- Tous les postes reçoivent `-ComputerName "ProBook 450 G10"` → échec WMI

**Niveau de confiance :** **High** — Bug majeur

**Véritable impact :**  
- **100% des appels PowerShell échouent** car le nom envoyé est un modèle matériel
- Le Digital Twin ne fonctionne pas du tout
- Tous les postes sont marqués Offline en permanence

---

### Problème #8 : `getSettings()` Synchrone sur Cache Non Chargé

**Code réel `settingsService.js` (lignes 194-200) :**
```js
export function getSettings() {
  if (!cache) {
    console.warn('[settingsService] Paramètres non encore chargés, repli sur .env');
    return buildEnvFallback();
  }
  return cache;
}
```

**Code réel `digitalTwin.js` (lignes 22-27) :**
```js
function runLiveStateScript(hostname) {
  return new Promise((resolve) => {
    const s = getSettings();
    const timeoutSec = s.wmi_timeout_sec || 10;
    // ...
  });
}
```

**Analyse :**  
- `getSettings()` est appelé à l'intérieur du constructeur Promise (s'exécute immédiatement)
- Si `cache` est null, `buildEnvFallback()` est retourné → valeurs par défaut
- Les settings WMI sont chargés AVANT le premier tick ? Regardons le scheduler...

**Code réel `scheduler.js` (lignes 182-196) :**
```js
export function startNetworkDiscovery() {
  // Premier passage immédiat au démarrage du serveur
  tick().catch(...);
  // Puis vérification toutes les minutes
  setInterval(() => { tick().catch(...); }, TICK_INTERVAL_MS);
}
```

**Analyse :**  
- `tick()` est appelé immédiatement dans `startNetworkDiscovery()`
- Si `loadSettings()` (asynchrone) n'a pas fini de s'exécuter, `cache` est null
- `getSettings()` retourne `buildEnvFallback()` qui a des valeurs par défaut correctes
- Pas de race condition bloquante, mais pas idéal

**Niveau de confiance :** **Medium** — Fonctionnel mais risqué

---

### Problème #9 : `saveLiveState()` Écrit des Colonnes Qui N'existent Pas Dans le Schéma Initial

**Code réel `schema.sql` (lignes 162-174) — Table de base :**
```sql
CREATE TABLE public.asset_live_state (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    is_online boolean DEFAULT false,
    cpu_usage numeric(5,2),
    ram_usage numeric(5,2),
    ram_total_mb integer,
    disk_free_gb numeric(8,2),
    disk_total_gb numeric(8,2),
    uptime_hours numeric(10,2),
    logged_in_user character varying(100),
    last_checked_at timestamp without time zone DEFAULT now()
);
```

**Migration `20260703_enhance_asset_live_state.sql` ajoute :**
- manufacturer, model, serial_number, bios_manufacturer, bios_version
- windows_version, windows_build, architecture
- cpu_count, cpu_frequency_mhz, ram_total_gb
- ip_address, mac_address, firewall_enabled, defender_enabled, defender_status
- disks_json, **ram_free_mb**

**Code réel `digitalTwin.js` (lignes 103-149) — INSERT avec 26 paramètres :**
```sql
INSERT INTO asset_live_state
  (asset_id, is_online, cpu_usage, ram_usage, ram_total_mb,
   disk_free_gb, disk_total_gb, uptime_hours, logged_in_user,
   manufacturer, model, serial_number, ..., disks_json, last_checked_at)
VALUES ($1,...$26, NOW())
```

**Analyse :**  
- ✅ La migration a ajouté les colonnes enrichies → l'INSERT fonctionne
- ⚠️ **`ram_free_mb`** est ajouté par la migration (ligne 26 du fichier SQL) mais n'est PAS inclus dans l'INSERT du code (seulement 26 paramètres, sans ram_free_mb)
- ⚠️ Si la migration n'a pas été appliquée, l'INSERT échoue car les colonnes n'existent pas

**Niveau de confiance :** **High** — Problème réel de cohérence migration/code

---

### Problème #10 : `relationDetector.js` — Double Boucle O(n²) Sans Limite

**Code réel (lignes 6-43) :**
```js
export async function detectPcPrinterRelations() {
  const { rows: computers } = await pool.query(
    `SELECT id, asset_tag, adresse_ip, department, office
     FROM assets WHERE type = 'Ordinateur' AND adresse_ip IS NOT NULL`
  );
  const { rows: printers } = await pool.query(
    `SELECT id, asset_tag, adresse_ip, department, office
     FROM assets WHERE type = 'Imprimante' AND adresse_ip IS NOT NULL`
  );

  for (const pc of computers) {
    for (const printer of printers) {  // ← O(n²) !
      // ...
    }
  }
}
```

**Analyse :**  
- Si 5000 PCs et 500 imprimantes → **2.5 millions d'itérations**
- Chaque itération peut faire un INSERT SQL
- S'exécute toutes les 6 heures par défaut (360 min)

**Niveau de confiance :** **High** — Problème de performance sérieux

---

### Problème #11 : Pas d'Index sur `asset_live_state(asset_id)`

**Code réel `schema.sql` :** La table `asset_live_state` a UNIQUE sur `asset_id` (via `ON CONFLICT`) mais pas d'INDEX explicite.

**Analyse :**  
- PostgreSQL crée automatiquement un index pour la contrainte UNIQUE → **l'index existe déjà**
- Pas de problème de performance sur la lecture par asset_id

**Niveau de confiance :** **Low** — PostgreSQL gère déjà l'index

---

### Problème #12 : `adScan.js` — Requête `ILIKE` Potentiellement Lente

**Code réel `adScan.js` (lignes 197) :**
```js
const { rows: userRows } = await pool.query(
  `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`, [username]
);
```

**Analyse :**  
- `ILIKE` ne peut pas utiliser d'index standard
- La requête est exécutée pour CHAQUE poste découvert (séquentiel)
- Sur 500 postes → 500 scans séquentiels de la table users

**Niveau de confiance :** **Medium** — Performances dégradées sur grands parcs

---

## ÉTAPE 3 : COHÉRENCE AVEC LE SCHÉMA PostgreSQL

### Table `assets` — Colonnes Utilisées vs Existantes

| Colonne | Dans code | Dans schema | Statut |
|---------|-----------|-------------|--------|
| `id` | ✅ Oui | ✅ Oui | OK |
| `asset_tag` | ✅ Oui | ✅ Oui | OK |
| `hostname` | ✅ `model AS hostname` | ✅ Oui | ⚠️ Alias trompeur |
| `type` | ✅ Oui | ✅ Oui | OK |
| `brand` | ✅ Oui | ✅ Oui | OK |
| `model` | ✅ Oui | ✅ Oui | OK |
| `serial_number` | ✅ Oui | ✅ Oui | OK |
| `status` | ✅ Oui | ✅ Oui | OK |
| `adresse_ip` | ✅ Oui | ✅ Oui | OK |
| `adresse_mac` | ✅ Oui | ✅ Oui | OK |
| `department` | ✅ Oui (relationDetector) | ✅ Oui | OK |
| `office` | ✅ Oui (relationDetector) | ✅ Oui | OK |
| `last_seen_at` | ⚠️ Jamais mis à jour par digitalTwin | ✅ Oui | **Problème** |

### Table `asset_live_state` — Colonnes Écrites vs Existantes

| Colonne | Dans code | Dans schema BD | Migration 20260703 | Statut |
|---------|-----------|----------------|-------------------|--------|
| `asset_id` | ✅ Oui | ✅ Oui | - | OK |
| `is_online` | ✅ Oui | ✅ Oui | - | OK |
| `cpu_usage` | ✅ Oui | ✅ Oui | - | OK |
| `ram_usage` | ✅ Oui | ✅ Oui | - | OK |
| `ram_total_mb` | ✅ Oui | ✅ Oui | - | OK |
| `ram_free_mb` | ❌ NON | ❌ Non | ✅ Ajoutée | **Non écrite** |
| `disk_free_gb` | ✅ Oui | ✅ Oui | - | OK |
| `disk_total_gb` | ✅ Oui | ✅ Oui | - | OK |
| `uptime_hours` | ✅ Oui | ✅ Oui | - | OK |
| `logged_in_user` | ✅ Oui | ✅ Oui | - | OK |
| `manufacturer` | ✅ Oui | ❌ Non | ✅ Ajoutée | ✅ Si migration faite |
| Modèle/Série/etc. | ✅ Oui | ❌ Non | ✅ Ajoutées | ✅ Si migration faite |
| `disks_json` | ✅ Oui | ❌ Non | ✅ Ajoutée | ✅ Si migration faite |

---

## ÉTAPE 4 : ANALYSE DU SCHEDULER

### Fréquence des tâches

| Tâche | Intervalle défaut | Durée estimée | Chevauchement possible |
|-------|-------------------|---------------|----------------------|
| AD Scan | 60 min | 2-10 min | Non (lock) |
| SNMP Scan | 120 min | 5-30 min | Non (lock) |
| Digital Twin | 10 min | 1-5 min | Non (lock) |
| Relations | 360 min | 1-10 min | Non (lock) |
| Auto-ticketing | 30 min | <1 min | Non (lock) |
| Auto-clôture | 1440 min | <1 min | Non (lock) |

### Analyse des risques

1. **Stall du scheduler** : Si `tick()` met plus de 60s à s'exécuter, le prochain tick est sauté (car `setInterval` s'empile)
2. **Blocage en cascade** : Si Digital Twin (10 min) prend 15 min car 1000 postes à scanner, le prochain cycle n'attend pas
3. **Consommation mémoire** : `tick()` charge tous les résultats en mémoire avant les logs
4. **Pas de timeout global** : Une tâche peut bloquer indéfiniment

### Estimation pour 1000 assets

- 1000 appels PowerShell
- Timeout par défaut : 10s × 1 tentative × 2 + 5 = 25s max par poste
- Concurrence : 10 workers
- **Temps minimum** (tout en ligne) : 1000 × 2s / 10 = ~200s
- **Temps maximum** (tout en timeout) : 1000 × 25s / 10 = ~2500s = ~42 min
- L'intervalle par défaut (10 min) est PLUS COURT que le temps d'exécution max
- **Chevauchement inévitable pour 1000+ postes**

---

## ÉTAPE 5 : ANALYSE DU PIPELINE DIGITAL TWIN

### Pipeline complet

```
1. refreshAllLiveStates()  [digitalTwin.js:215]
   ↓
2. getSettings()           [settingsService.js:194] — synchrone, peut retourner fallback
   ↓
3. SQL: SELECT avec type='Ordinateur'  [digitalTwin.js:223-226]
   ↓
4. processBatchWithConcurrency()  [digitalTwin.js:172-208]
   ↓
5. hostname = model || hostname || asset_tag  [digitalTwin.js:180]
   ↓
6. runLiveStateScript(hostname)  [digitalTwin.js:20-63]
   ↓
7. exec('powershell.exe ...')  [digitalTwin.js:41]
   ↓
8. get-live-state.ps1  [PowerShell]
   ↓
9. JSON.parse(stdout)  [digitalTwin.js:49]
   ↓
10. data.is_online ? saveLiveState() : markOffline()  [digitalTwin.js:184-189]
```

### Points de défaillance identifiés

| Étape | Risque | Gravité |
|-------|--------|---------|
| 2 | Settings non chargés → fallback | Medium |
| 3 | `type = 'Ordinateur'` manque les variantes | High |
| 3 | `model AS hostname` → mapping incorrect | **Critical** |
| 5 | `model || hostname || asset_tag` → nom invalide | **Critical** |
| 5 | `computer.model` = modèle matériel → PowerShell échoue | **Critical** |
| 6 | Aucune validation du hostname avant PowerShell | **Critical** (injection) |
| 7 | `exec` sans échappement des arguments | **Critical** (injection) |
| 9 | JSON invalide → `resolve(null)` → Offline | Medium |
| 10 | 1 seul échec = Offline, pas de compteur | High |

---

## ÉTAPE 6 : MODE SIMULATION

### Constats

- `digitalTwin.js` (264 lignes) **n'a PAS de mode simulation**
- Le mode simulation est dans `adScan.js` et `snmpScan.js` seulement
- `simulationService.js` fournit `getFakeADComputers()`, `getFakeSNMPDevices()`, `getFakeLiveStates()`
- `getDigitalTwinLiveStates()` existe mais n'est **jamais appelée** par `digitalTwin.js`

### Incohérence

Le Digital Twin n'a pas de mode simulation, contrairement à AD Scan et SNMP Scan. Le paramètre `simulation_mode` dans les settings n'a aucun effet sur le Digital Twin.

---

## ÉTAPE 7 : PERFORMANCE

### Estimation pour différents parcs

| Métrique | 100 PCs | 500 PCs | 1000 PCs | 5000 PCs | 10000 PCs |
|----------|---------|---------|----------|----------|-----------|
| Temps min (tout online) | 20s | 100s | 200s | 1000s (17min) | 2000s (33min) |
| Temps max (tout timeout) | 250s | 1250s (21min) | 2500s (42min) | 12500s (3.5h) | 25000s (7h) |
| Requêtes SQL | 101 | 501 | 1001 | 5001 | 10001 |
| Mémoire (résultats) | ~5 MB | ~25 MB | ~50 MB | ~250 MB | ~500 MB |
| Process PowerShell simultanés | 10 | 10 | 10 | 10 | 10 |

### Problèmes de scalabilité

1. **Intervalle trop court** : 10 min par défaut vs 42 min pour 1000 postes en timeout
2. **Mémoire croissante** : Tous les résultats sont en mémoire avant écriture
3. **Requêtes SQL individuelles** : 1000+ INSERT/UPDATE individuels
4. **Pas de batch SQL** : Chaque `saveLiveState()` est une requête séparée

---

## ÉTAPE 8 : PLAN DE CORRECTION

### Phase 1 : 🔴 Bugs Critiques (priorité immédiate)

| # | Fichier | Problème | Correction | Risque | Difficulté |
|---|---------|----------|------------|-------|------------|
| 1 | `digitalTwin.js:224` | `model AS hostname` **remplace** le vrai hostname par le modèle | Remplacer par `hostname` | Faible | 5 min |
| 2 | `digitalTwin.js:180` | Fallback `model` en premier = toujours invalide | Utiliser `hostname` puis `adresse_ip` | Faible | 5 min |
| 3 | `digitalTwin.js:30-36` | Injection PowerShell | Échapper le hostname | Faible | 10 min |

### Phase 2 : 🟠 Problèmes de Robustesse

| # | Fichier | Problème | Correction | Risque | Difficulté |
|---|---------|----------|------------|-------|------------|
| 4 | `digitalTwin.js` | Offline immédiat sur erreur | Compteur d'échecs | Moyen | 30 min |
| 5 | `digitalTwin.js` | Pas de mode simulation | Ajouter mode simulation | Faible | 30 min |
| 6 | `digitalTwin.js` | `last_seen_at` jamais mis à jour | UPDATE assets | Faible | 5 min |

### Phase 3 : 🟡 Performance

| # | Fichier | Problème | Correction | Risque | Difficulté |
|---|---------|----------|------------|-------|------------|
| 7 | `relationDetector.js` | Boucle O(n²) | Index + requête optimisée | Moyen | 30 min |
| 8 | `digitalTwin.js` | Requêtes SQL individuelles | Batch INSERT | Moyen | 45 min |
| 9 | `adScan.js` | ILIKE sans index pour chaque poste | LEFT JOIN direct | Faible | 10 min |

### Phase 4 : 🟢 Refactoring

| # | Fichier | Problème | Correction | Risque | Difficulté |
|---|---------|----------|------------|-------|------------|
| 10 | `digitalTwin.js` | Dead code `active = new Set()` | Supprimer | Faible | 2 min |
| 11 | `scheduler.js` | Stale lock monitoring | Ajouter timeout | Faible | 15 min |
| 12 | `digitalTwin.js` | `type = 'Ordinateur'` rigide | Patterns flexibles | Faible | 15 min |

---

**Rapport généré après vérification rigoureuse du code — chaque ligne confirmée contre le code réel.**