# Guide de Test et Diagnostic du Pipeline RAG

## 🎯 Objectif

Ce guide vous permet de diagnostiquer le problème de recherche "Comment configurer le VPN ?" et de vérifier que les corrections fonctionnent.

## 📋 Prérequis

1. **Article de test** : Assurez-vous qu'un article "Configuration du VPN" existe dans la base de connaissances
2. **Mode debug activé** : Les logs détaillés doivent être activés
3. **Environnement de test** : Utilisez la base de données de test ou de développement

## 🚀 Exécution du Test

### 1. Activer le mode debug

Dans le fichier `.env` du backend, ajoutez ou modifiez :

```env
RAG_DEBUG_MODE=true
```

Ou vérifiez que `debug_mode` est activé dans la table `settings`.

### 2. Exécuter le test de diagnostic

```bash
cd backend
node test-vpn-search-debug.js
```

### 3. Analyser les logs

Le test va afficher 5 étapes détaillées :

#### ÉTAPE 1: Vérification de l'article dans la base de données
```
✅ 1 article(s) VPN trouvé(s):
   [1] ID: 123, Titre: "Configuration du VPN"
       Views: 45, Hits: 12
```

**Ce qu'il faut vérifier :**
- ✅ L'article existe bien
- ❌ Si aucun article n'est trouvé → Créez l'article avant de continuer

#### ÉTAPE 2: Recherche via les providers
```
✅ Résultats bruts: 3
   Métriques par provider:
   - knowledge_base: 1 résultats (45ms)
   - pdf: 0 résultats (12ms)
   - resolved_tickets: 1 résultats (23ms)
   - learned_cases: 1 résultats (8ms)
```

**Ce qu'il faut vérifier :**
- ✅ Le provider `knowledge_base` retourne au moins 1 résultat
- ✅ Le score brut est > 0
- ❌ Si 0 résultat → Problème dans la requête SQL

**Logs détaillés du provider :**
```
[knowledgeBaseProvider] 🔍 Recherche KB: "Comment configurer le VPN ?"
[knowledgeBaseProvider]   1 résultats bruts trouvés
[knowledgeBaseProvider]   [1] Configuration du VPN (rank: 0.823)
```

**Ce qu'il faut vérifier :**
- ✅ Le `rank` (score full-text) est > 0 (idéalement > 0.5)
- ❌ Si rank = 0 → `plainto_tsquery` ne match pas, vérifiez la configuration PostgreSQL

#### ÉTAPE 3: Re-ranking et filtrage
```
📊 Métriques de re-ranking:
   Entrées: 3
   Après déduplication: 3
   Après scoring: 3
   Après filtrage (seuil 0.65): 1
   Résultats finaux: 1
```

**Ce qu'il faut vérifier :**
- ✅ Le nombre de résultats diminue progressivement (normal)
- ✅ Au moins 1 résultat passe le seuil de 0.65
- ❌ Si 0 après filtrage → Les scores sont trop bas

**Logs détaillés du re-ranking :**
```
[reranker] 📊 Re-ranking de 3 résultats pour: "Comment configurer le VPN ?"
[reranker] Mots-clés extraits: [configurer, vpn]

[reranker] Résultat #1: Configuration du VPN
[reranker]   Source: knowledge_base
[reranker]   Scores:
[reranker]     - vector:      0.000 (poids: 0.40)
[reranker]     - fulltext:    0.823 (poids: 0.30)
[reranker]     - keywords:    0.500 (poids: 0.15)
[reranker]     - popularity:  0.150 (poids: 0.10)
[reranker]     - freshness:   0.500 (poids: 0.05)
[reranker]   Score hybride: 0.487
[reranker]   Seuil: 0.65 → REJETÉ
```

**Ce qu'il faut vérifier :**
- ✅ `fulltext` > 0.5 (bon match PostgreSQL)
- ✅ `keywords` > 0 (au moins un mot-clé match)
- ⚠️ `vector` = 0 (normal, pas de recherche vectorielle pour KB)
- ❌ Si `hybrid_score` < 0.65 → Le seuil est trop élevé pour ce cas

**Calcul du score hybride :**
```
hybrid_score = (0.000 × 0.40) + (0.823 × 0.30) + (0.500 × 0.15) + (0.150 × 0.10) + (0.500 × 0.05)
             = 0.000 + 0.247 + 0.075 + 0.015 + 0.025
             = 0.362
```

**Si le score est < 0.65 :**
- Le problème vient du calcul des poids
- Les poids actuels : fulltext (0.30) + keywords (0.15) = 0.45
- Même avec un fulltext_score de 0.823, le max possible est : 0.823 × 0.30 + 1.0 × 0.15 + 1.0 × 0.10 + 1.0 × 0.05 = 0.247 + 0.15 + 0.10 + 0.05 = 0.547
- **Donc le seuil de 0.65 est trop élevé pour les articles KB !**

#### ÉTAPE 4: Résultats finaux
```
✅ 1 résultat(s) retenu(s):

[1] Configuration du VPN
    Source: knowledge_base
    Score hybride: 0.487
    Scores détaillés:
      - vector: 0.000
      - fulltext: 0.823
      - keywords: 0.500
      - popularity: 0.150
      - freshness: 0.500
```

**Ce qu'il faut vérifier :**
- ✅ L'article "Configuration du VPN" est présent
- ✅ Le score full-text est élevé (0.823)
- ❌ Si l'article n'est pas là → Vérifiez le seuil et les scores

#### ÉTAPE 5: Analyse et recommandations

Le test va afficher automatiquement des recommandations selon le cas.

## 🔍 Diagnostic des Problèmes Courants

### Problème 1: Aucun résultat brut (ÉTAPE 2)

**Symptôme :**
```
❌ AUCUN RÉSULTAT BRUT - Le problème vient de la recherche SQL
```

**Causes possibles :**
1. L'article n'existe pas dans la base de données
2. La requête SQL est incorrecte
3. `plainto_tsquery` ne match pas "vpn"

**Solutions :**
```sql
-- Vérifier que l'article existe
SELECT id, title, content FROM knowledge_articles WHERE lower(title) LIKE '%vpn%';

-- Tester la recherche full-text
SELECT 
  id, title,
  ts_rank(to_tsvector('french', title || ' ' || content), plainto_tsquery('french', 'configurer vpn')) AS rank
FROM knowledge_articles
WHERE to_tsvector('french', title || ' ' || content) @@ plainto_tsquery('french', 'configurer vpn');

-- Tester le LIKE
SELECT id, title FROM knowledge_articles 
WHERE lower(title) LIKE '%vpn%' OR lower(content) LIKE '%vpn%';
```

### Problème 2: Score full-text = 0 (ÉTAPE 3)

**Symptôme :**
```
[reranker]     - fulltext:    0.000 (poids: 0.30)
```

**Causes possibles :**
1. `plainto_tsquery` ne reconnaît pas "vpn" comme un mot valide
2. La configuration PostgreSQL `french` ne gère pas bien les acronymes
3. Le stemming supprime "vpn"

**Solutions :**
```sql
-- Tester la requête tsquery directement
SELECT plainto_tsquery('french', 'configurer vpn');

-- Si ça retourne 'configur', c'est normal (stemming)
-- Mais si 'vpn' disparaît, c'est un problème

-- Solution: utiliser un dictionnaire personnalisé ou désactiver le stemming pour VPN
-- Ou utiliser: websearch_to_tsquery qui est plus permissif
```

### Problème 3: Score hybride < 0.65 (ÉTAPE 3)

**Symptôme :**
```
[reranker]   Score hybride: 0.487
[reranker]   Seuil: 0.65 → REJETÉ
```

**Calcul :**
```
hybrid_score = (vector × 0.40) + (fulltext × 0.30) + (keywords × 0.15) + (popularity × 0.10) + (freshness × 0.05)
```

**Analyse :**
- `vector` = 0 (pas de recherche vectorielle pour KB)
- `fulltext` = 0.823 (bon)
- `keywords` = 0.5 (2 mots-clés sur 4)
- `popularity` = 0.15 (faible)
- `freshness` = 0.5 (moyen)

**Score max possible :**
```
max = (0 × 0.40) + (1.0 × 0.30) + (1.0 × 0.15) + (1.0 × 0.10) + (1.0 × 0.05)
    = 0.00 + 0.30 + 0.15 + 0.10 + 0.05
    = 0.60
```

**Conclusion :** Le seuil de 0.65 est **impossible à atteindre** pour les articles KB sans recherche vectorielle !

**Solution :** Baisser le seuil à **0.50** pour les articles KB, ou augmenter le poids de `fulltext`.

### Problème 4: Déduplication incorrecte (ÉTAPE 3)

**Symptôme :**
```
[reranker]   ❌ Dédupliqué: "Configuration du VPN"
```

**Cause :**
- Deux articles ont le même contenu (ou début de contenu)
- La déduplication utilise seulement le contenu, pas le titre

**Solution :** ✅ **DÉJÀ CORRIGÉ** - La déduplication inclut maintenant le titre

## ✅ Corrections Apportées

### 1. knowledgeBaseProvider.js

**Avant :**
```javascript
score: parseFloat(row.rank) || 0,
```

**Après :**
```javascript
fulltext_score: rank,  // Champ séparé pour le score full-text
score: rank,  // Garder pour compatibilité
```

**Bénéfice :** Le score full-text est maintenant correctement identifié dans le reranker.

### 2. reranker.js - Calcul des scores

**Avant :**
```javascript
const fullTextScore = typeof result.score === 'number' ? result.score : 0;
```

**Après :**
```javascript
const fullTextScore = result.fulltext_score !== undefined 
  ? result.fulltext_score 
  : (typeof result.score === 'number' ? result.score : 0);
```

**Bénéfice :** Utilise le champ `fulltext_score` si disponible, sinon fallback sur `score`.

### 3. reranker.js - Déduplication

**Avant :**
```javascript
const normalized = (result.content || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 200);
```

**Après :**
```javascript
const normalized = ((result.title || '') + ' ' + (result.content || ''))
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
  .replace(/[^\w\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 500);
```

**Bénéfice :**
- Inclut le titre pour éviter de dédupliquer des articles différents
- Supprime les accents pour une meilleure correspondance
- Augmente la précision à 500 caractères

### 4. reranker.js - Logs détaillés

**Ajouté :** Logs détaillés à chaque étape du pipeline en mode debug :
- `rerank()` : Affiche les scores de chaque résultat
- `filterByThreshold()` : Affiche les résultats acceptés/rejetés
- `selectTopResults()` : Affiche la sélection finale
- `deduplicate()` : Affiche les résultats dédupliqués

## 🎯 Solution Finale Recommandée

### Option 1: Baisser le seuil (Rapide)

Dans `.env` :
```env
RAG_SIMILARITY_THRESHOLD=0.50
```

**Avantages :** Rapide, simple
**Inconvénients :** Peut laisser passer des résultats moins pertinents

### Option 2: Ajuster les poids (Recommandé)

Dans `.env` :
```env
RAG_WEIGHT_FULLTEXT=0.50  # Augmenter de 0.30 à 0.50
RAG_WEIGHT_KEYWORDS=0.20  # Augmenter de 0.15 à 0.20
RAG_WEIGHT_VECTOR=0.10    # Diminuer de 0.40 à 0.10
RAG_SIMILARITY_THRESHOLD=0.55  # Baisser légèrement
```

**Calcul avec les nouveaux poids :**
```
hybrid_score = (0 × 0.10) + (0.823 × 0.50) + (0.5 × 0.20) + (0.15 × 0.10) + (0.5 × 0.10)
             = 0.000 + 0.412 + 0.100 + 0.015 + 0.050
             = 0.577
```

**Résultat :** ✅ Dépasse le seuil de 0.55 !

### Option 3: Améliorer la recherche SQL (Avancé)

Modifier `knowledgeBaseProvider.js` pour utiliser `websearch_to_tsquery` :

```javascript
const sql = `
  SELECT 
    id, title, summary, content, category, created_at,
    ts_rank(
      to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')),
      websearch_to_tsquery($2, $1)
    ) AS rank
  FROM knowledge_articles
  WHERE 
    to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) 
    @@ websearch_to_tsquery($2, $1)
    OR lower(title) LIKE '%' || lower($1) || '%'
    OR lower(content) LIKE '%' || lower($1) || '%'
  ORDER BY rank DESC, views_count DESC
  LIMIT $3
`;
```

**Avantages :** `websearch_to_tsquery` est plus permissif et gère mieux les acronymes
**Inconvénients :** Légèrement plus lent

## 📊 Interprétation des Résultats

### Cas 1: Article trouvé et accepté (SUCCÈS)

```
✅ Résultats finaux: 1

[1] Configuration du VPN
    Source: knowledge_base
    Score hybride: 0.577
    Scores détaillés:
      - fulltext: 0.823
      - keywords: 0.500
```

**Action :** Aucune correction nécessaire, le système fonctionne !

### Cas 2: Article trouvé mais rejeté (SEUIL TROP ÉLEVÉ)

```
❌ AUCUN RÉSULTAT APRÈS RE-RANKING
```

**Action :** Appliquer l'Option 1 ou 2 ci-dessus

### Cas 3: Article non trouvé (PROBLÈME SQL)

```
❌ Article VPN NON trouvé dans les résultats bruts
```

**Action :** Vérifier la requête SQL et la configuration PostgreSQL

## 🧪 Tests Complémentaires

### Test 1: Vérifier la configuration PostgreSQL

```sql
-- Vérifier que la recherche full-text fonctionne
SELECT 
  title,
  ts_rank(to_tsvector('french', title || ' ' || content), plainto_tsquery('french', 'configurer vpn')) AS rank
FROM knowledge_articles
WHERE title ILIKE '%vpn%';
```

### Test 2: Vérifier les stopwords

```javascript
// Dans nlpUtils.js, vérifier que "vpn" n'est pas dans les stopwords
console.log(FRENCH_STOPWORDS.includes('vpn')); // Doit retourner false
```

### Test 3: Vérifier la normalisation

```javascript
// Tester la correspondance
const query = "Comment configurer le VPN ?";
const title = "Configuration du VPN";

const queryKeywords = extractKeywords(query);
const titleLower = title.toLowerCase();

console.log('Query keywords:', queryKeywords); // ['configurer', 'vpn']
console.log('Title:', titleLower); // 'configuration du vpn'
console.log('Match:', queryKeywords.some(kw => titleLower.includes(kw))); // true (vpn match)
```

## 📝 Checklist de Validation

- [ ] L'article "Configuration du VPN" existe dans la base de données
- [ ] Le mode debug est activé (`RAG_DEBUG_MODE=true`)
- [ ] Le test `test-vpn-search-debug.js` s'exécute sans erreur
- [ ] ÉTAPE 1: L'article est trouvé dans la base de données
- [ ] ÉTAPE 2: Le provider `knowledge_base` retourne au moins 1 résultat
- [ ] ÉTAPE 2: Le `rank` (score full-text) est > 0.5
- [ ] ÉTAPE 3: Le score hybride dépasse le seuil de 0.65 (ou le seuil ajusté)
- [ ] ÉTAPE 4: L'article "Configuration du VPN" est dans les résultats finaux
- [ ] Le chatbot répond correctement à la question "Comment configurer le VPN ?"

## 🐛 En cas de problème

1. **Vérifier les logs** : Les logs détaillés indiquent exactement où le résultat est perdu
2. **Vérifier la base de données** : S'assurer que l'article existe et a du contenu
3. **Vérifier la configuration** : S'assurer que `RAG_DEBUG_MODE=true` est activé
4. **Exécuter le test** : Lancer `node test-vpn-search-debug.js` et analyser chaque étape
5. **Ajuster les paramètres** : Modifier le seuil et les poids selon les résultats

## 📚 Ressources

- [Documentation PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Guide des poids RAG](backend/AUDIT_RAG_PIPELINE.md)
- [Configuration RAG](backend/src/services/ragConfig.js)