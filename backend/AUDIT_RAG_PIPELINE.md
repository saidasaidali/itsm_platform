# Audit Complet du Pipeline RAG - Base de Connaissances

## Résumé du Problème

**Requête :** "Comment configurer le VPN ?"
**Article existant :** "Configuration du VPN"
**Résultat :** 0 résultat retenu (seuil: 0.65)

## Architecture du Pipeline

```
Utilisateur → searchUnifiedKnowledge() 
           → searchAllProviders() [4 providers en parallèle]
           → rerankPipeline() [déduplication → scoring → filtrage → sélection]
           → buildRagPrompt() → Ollama
```

## Analyse des Fichiers

### 1. knowledgeBaseProvider.js (Lignes 14-47)

**Fonction de recherche :**
```javascript
async search(query, limit = 5) {
  const tsConfig = 'french';
  
  const sql = `
    SELECT 
      id, title, summary, content, category, created_at,
      ts_rank(
        to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')),
        plainto_tsquery($2, $1)
      ) AS rank
    FROM knowledge_articles
    WHERE 
      to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) 
      @@ plainto_tsquery($2, $1)
      OR lower(title) LIKE '%' || lower($1) || '%'
      OR lower(content) LIKE '%' || lower($1) || '%'
    ORDER BY rank DESC, views_count DESC
    LIMIT $3
  `;

  const { rows } = await pool.query(sql, [query, tsConfig, limit]);

  return rows.map(row => ({
    content: row.content || row.summary || '',
    score: parseFloat(row.rank) || 0,  // ⚠️ PROBLÈME ICI
    source_type: 'knowledge_base',
    source_id: row.id,
    title: row.title,
    metadata: {
      category: row.category,
      created_at: row.created_at,
    },
  }));
}
```

**PROBLÈME #1 :** Le champ `rank` de PostgreSQL peut être NULL si la requête ne matche pas en full-text, même si le LIKE match. Dans ce cas, `parseFloat(NULL)` retourne `NaN`, et `NaN || 0` donne bien `0`, mais c'est un score de 0 qui va être filtré.

**PROBLÈME #2 :** Aucun log détaillé sur les résultats de chaque provider.

### 2. reranker.js (Lignes 20-89)

**Calcul du score hybride :**
```javascript
export function rerank(results, query) {
  const config = getConfig();
  const queryKeywords = extractKeywords(query);
  const now = Date.now();

  return results.map(result => {
    // 1. Score vectoriel
    const vectorScore = result.score || 0;

    // 2. Score full-text
    const fullTextScore = typeof result.score === 'number' ? result.score : 0;  // ⚠️ ERREUR

    // 3. Score de correspondance de mots-clés
    const contentLower = (result.content || '').toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const keywordMatches = queryKeywords.filter(kw => 
      contentLower.includes(kw) || titleLower.includes(kw)
    ).length;
    const keywordScore = queryKeywords.length > 0 
      ? keywordMatches / queryKeywords.length 
      : 0;

    // 4. Score de popularité
    const metadata = result.metadata || {};
    const hitCount = metadata.hit_count || 0;
    const viewsCount = metadata.views || metadata.views_count || 0;
    const confidenceScore = parseFloat(metadata.confidence_score) || 0;
    const popularityScore = Math.min(
      (hitCount * 0.1 + viewsCount * 0.05 + confidenceScore * 0.5) / 1.0,
      1.0
    );

    // 5. Score de fraîcheur
    let freshnessScore = 0.5;
    const dateStr = metadata.resolved_at || metadata.created_at || null;
    if (dateStr) {
      const ageMs = now - new Date(dateStr).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      freshnessScore = Math.max(0, Math.min(1, 1 - ageDays / 365));
    }

    // Score hybride pondéré
    const hybridScore = 
      vectorScore * config.weightVector +
      fullTextScore * config.weightFulltext +
      keywordScore * config.weightKeywords +
      popularityScore * config.weightPopularity +
      freshnessScore * config.weightFreshness;

    return {
      ...result,
      hybrid_score: Math.min(1, Math.max(0, hybridScore)),
      tokens: totalTokens,
      scores: {
        vector: vectorScore,
        fulltext: fullTextScore,
        keywords: keywordScore,
        popularity: popularityScore,
        freshness: freshnessScore,
        hybrid: hybridScore,
      },
    };
  });
}
```

**PROBLÈME #3 :** `fullTextScore` utilise `result.score` au lieu d'un champ dédié `result.fulltext_score`. Si le provider ne remplit pas `score` avec le score full-text, alors `fullTextScore = vectorScore`, ce qui double le poids du même score.

**PROBLÈME #4 :** Aucun log détaillé par résultat.

### 3. reranker.js - Déduplication (Lignes 109-127)

```javascript
export function deduplicate(results) {
  const unique = [];
  const seen = new Set();

  for (const result of results) {
    const normalized = (result.content || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);  // ⚠️ PROBLÈME ICI
    
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }

  return unique;
}
```

**PROBLÈME #5 :** La déduplication ne prend en compte que les 200 premiers caractères du contenu. Si deux articles ont le même début (ex: introduction similaire), ils seront dédupliqués à tort.

**PROBLÈME #6 :** La déduplication ne tient pas compte du titre. Deux articles avec le même contenu mais des titres différents (ex: "Configuration du VPN" et "VPN Setup Guide") seront considérés comme des doublons.

### 4. reranker.js - Filtrage par seuil (Lignes 97-102)

```javascript
export function filterByThreshold(results, threshold = null) {
  const config = getConfig();
  const thr = threshold !== null ? threshold : config.similarityThreshold;

  return results.filter(r => r.hybrid_score >= thr);
}
```

**PROBLÈME #7 :** Le seuil de 0.65 est très élevé si les scores sont calculés correctement. Mais si les scores sont incorrects (voir PROBLÈME #3), alors même un bon match peut avoir un score < 0.65.

### 5. nlpUtils.js - Extraction de mots-clés (Lignes 71-74)

```javascript
export function extractKeywords(text, stopwords = FRENCH_STOPWORDS) {
  const words = normalizeText(text).split(' ');
  return words.filter(w => w.length > 2 && !stopwords.includes(w));
}
```

**PROBLÈME #8 :** "vpn" fait 3 caractères, donc il est gardé. Mais "VPN" en majuscules sera normalisé en "vpn". C'est correct.

**PROBLÈME #9 :** La liste de stopwords contient "comment" (ligne 41), donc pour "Comment configurer le VPN ?", les mots-clés extraits seront : `['configurer', 'vpn']`.

**PROBLÈME #10 :** Le titre "Configuration du VPN" contient "configuration" et "vpn". Le stemming n'est pas appliqué, donc "configurer" ≠ "configuration". C'est un problème de correspondance.

### 6. knowledgeBaseSearch.js (Lignes 17-63)

Cette fonction utilise `plainto_tsquery` qui fait du stemming automatique en PostgreSQL. Donc "configurer" et "configuration" devraient matcher. Mais le problème est que `plainto_tsquery` est très basique et peut échouer sur des termes techniques comme "VPN".

## Diagnostic des Points de Perte

### Étape 1 : Recherche SQL
- **Risque :** `plainto_tsquery` peut ne pas matcher "vpn" car c'est un acronyme
- **Risque :** Le LIKE est case-sensitive malgré `lower()`, mais ça devrait fonctionner
- **Log manquant :** On ne voit pas combien de résultats renvoie chaque provider

### Étape 2 : Score SQL
- **Risque :** `ts_rank` peut retourner 0 ou NULL si la requête ne matche pas en full-text
- **Log manquant :** On ne voit pas le score SQL de chaque résultat

### Étape 3 : Déduplication
- **Risque :** Déduplication sur 200 caractères seulement
- **Risque :** Pas de prise en compte du titre
- **Log manquant :** On ne voit pas pourquoi un résultat est dédupliqué

### Étape 4 : Re-ranking
- **Risque :** `fullTextScore` utilise le mauvais champ (`result.score` au lieu de `result.fulltext_score`)
- **Risque :** Les poids peuvent être mal calculés
- **Log manquant :** On ne voit pas les scores détaillés

### Étape 5 : Filtrage
- **Risque :** Seuil de 0.65 trop élevé si les scores sont bas
- **Log manquant :** On ne voit pas pourquoi un résultat est rejeté

### Étape 6 : Sélection
- **Risque :** Distribution équitable peut exclure un bon résultat si une autre source a de meilleurs scores
- **Log manquant :** On ne voit pas la sélection finale

## Cause Racine Identifiée

**PROBLÈME PRINCIPAL :** Dans `reranker.js`, ligne 30 :
```javascript
const fullTextScore = typeof result.score === 'number' ? result.score : 0;
```

Cette ligne utilise `result.score` qui est le score SQL (ts_rank). Mais si le provider ne retourne pas de score (ou un score de 0), alors `fullTextScore = 0`.

Ensuite, ligne 27 :
```javascript
const vectorScore = result.score || 0;
```

Donc `vectorScore = fullTextScore`, ce qui signifie que le score full-text est compté DEUX FOIS dans le calcul hybride, mais avec des poids différents :
- `vectorScore * 0.40`
- `fullTextScore * 0.30`

Total : `score * 0.70` au lieu de `score * 0.30` pour le full-text seul.

**PROBLÈME SECONDAIRE :** Le LIKE dans la requête SQL peut matcher, mais si `ts_rank` retourne 0 (car `plainto_tsquery` ne matche pas), alors le score final est 0, et le résultat est filtré par le seuil de 0.65.

**PROBLÈME TERTIAIRE :** Aucun log détaillé pour diagnostiquer ces problèmes.

## Solution

1. **Corriger le calcul des scores** dans `reranker.js` pour utiliser des champs séparés
2. **Améliorer la déduplication** pour prendre en compte le titre
3. **Ajouter des logs détaillés** à chaque étape du pipeline
4. **Vérifier la normalisation** des textes pour "configurer" vs "configuration"
5. **Tester la correspondance** "comment configurer le VPN" → "Configuration du VPN"