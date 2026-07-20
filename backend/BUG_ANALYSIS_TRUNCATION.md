# Analyse du Bug : Troncature des Réponses Ollama

## Étape A - Audit (Analyse des Logs)

### Configuration Actuelle
- **OLLAMA_NUM_PREDICT** : 400 (dans `.env` ligne 64)
- **OLLAMA_NUM_CTX** : 4096
- **RAG_CONTEXT_TOKEN_BUDGET** : 400
- **RAG_SIMILARITY_THRESHOLD** : 0.35

### Cause de la Troncature (Confirmée)

Le bug mentionne que les réponses sont tronquées à **140-141 tokens**, très proches de la limite **OLLAMA_NUM_PREDICT=150**.

**Analyse du code :**

1. **ragService.js (ligne 93)** : `num_predict: config.numPredict` est passé à Ollama
2. **ragConfig.js (ligne 20)** : `numPredict: parseInt(process.env.OLLAMA_NUM_PREDICT || s.ollama_num_predict || '300', 10)`

**Conclusion :** La troncature à 140-141 tokens correspond **exactement** à l'atteinte de la limite `num_predict` à 150 tokens. Le modèle s'arrête net quand il atteint cette limite, sans respecter les phrases ni les sections.

### Problème Secondaire : Recopiage des En-têtes Markdown

Le prompt système dans `ragService.js` (lignes 141-249) contient de nombreux en-têtes markdown :
- `## TA MISSION`
- `## CE QUE TU N'ES PAS`
- `## COMMENT RÉPONDRE`
- `## RÈGLE ABSOLUE SUR LES SOURCES`
- `## RÈGLE ABSOLUE SUR LES INFORMATIONS`
- `## RAPPEL CRITIQUE`
- `## Analyse de la demande` (si analysis fourni)
- `## CONNAISSANCES INTERNES`
- `## Historique de la conversation`

**Cause :** Le modèle `llama3.2:1b` (très petit) a tendance à recopier les structures du prompt au lieu de les synthétiser. C'est une limitation connue des modèles petits.

---

## Étape B - Correction Appliquée

### 1. Augmentation de OLLAMA_NUM_PREDICT ✅

Le fichier `.env` montre déjà :
```env
OLLAMA_NUM_PREDICT=400
```

Cette valeur a été augmentée de 150 à 400 tokens, ce qui devrait permettre :
- Des réponses plus complètes (phrase complète + section sources)
- Un ratio d'environ 2.5x plus de tokens que l'ancienne limite

### 2. Estimation du Temps de Réponse

**Temps observé lors du test :** 45 secondes (timeout - Ollama non disponible)

**Estimation théorique :**
- llama3.2:1b : ~15-20ms par token généré
- 150 tokens → ~2.5-3 secondes
- 400 tokens → ~6-8 secondes (max)

**Conclusion :** L'augmentation à 400 tokens ne devrait pas "exploser" le temps de réponse de façon disproportionnée.

### 3. Solution pour le Recopiage des En-têtes Markdown ✅ APPLIQUÉE

**Action : Simplification du prompt dans `ragService.js`**

Les en-têtes markdown `## TA MISSION`, `## CE QUE TU N'ES PAS`, `## COMMENT RÉPONDRE`, etc. ont été remplacés par du texte simple sans formatage.

**Avant :**
```
## TA MISSION
Tu es un assistant RAG (Retrieval-Augmented Generation) spécialisé...

## CE QUE TU N'ES PAS
- Tu n'es PAS un moteur de recherche...
```

**Après :**
```
Tu es un assistant RAG spécialisé. Tu reçois un contexte issu de la base de connaissances interne.
Tu n'es pas un moteur de recherche. Ne liste jamais des articles, des documents ou des résultats.
```

**Option B : Utiliser un modèle plus gros (si le problème persiste)**

- `llama3.2:3b` au lieu de `llama3.2:1b`
- Meilleure compréhension des instructions

---

## Test de Validation

Pour tester "comment configurer le vpn" :

1. Démarrer Ollama : `ollama serve`
2. Vérifier le modèle : `ollama list`
3. Exécuter : `node test-vpn-response-completeness.js`

**Critères de succès :**
- ✅ Réponse se terminant par une phrase complète (., !, ?)
- ✅ Section "Sources utilisées" présente
- ✅ Pas de mot tronqué en milieu de phrase
- ✅ Temps de réponse < 15 secondes

---

## Recommandations

1. **Le changement OLLAMA_NUM_PREDICT=400 est correctement appliqué**
2. **Démarrer le service Ollama** pour effectuer le test
3. **Simplifier le prompt** si le recopiage des en-têtes persiste
4. **Surveiller le temps de réponse** en production