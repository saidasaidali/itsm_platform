// backend/src/services/sentimentAnalyzer.js
// Analyse de sentiment basée sur des lexiques français — pas d'IA externe,
// fonctionne entièrement on-premise.

// ── Lexiques ──────────────────────────────────────────────────────────────────

const NEGATIVE_WORDS = new Set([
  'problème', 'probleme', 'bug', 'erreur', 'panne', 'bloqué', 'bloque',
  'impossible', 'echec', 'échoue', 'dysfonction', 'cassé', 'casse',
  'mauvais', 'nul', 'horrible', 'catastrophe', 'inutile', 'lent',
  'long', 'interminable', 'désagréable', 'inacceptable', 'honteux',
  'scandaleux', 'inadmissible', 'incompétent', 'incompetent', 'nul',
  'perdu', 'impossible', 'refuse', 'refusé', 'bloqué', 'coincé',
]);

const FRUSTRATION_WORDS = new Set([
  'toujours', 'encore', 'personne', 'jamais', 'rien', 'marre',
  'attendre', 'attend', 'attendu', 'relance', 'relancé', 'répond',
  'repond', 'réponse', 'reponse', 'silence', 'ignoré', 'ignore',
  'oublié', 'oublie', 'abandonné', 'abandonne', 'laisser', 'laissé',
  'en attente', 'sans réponse', 'sans reponse',
]);

const URGENCY_WORDS = new Set([
  'urgent', 'urgence', 'vite', 'immédiatement', 'immediatement',
  'maintenant', 'critique', 'bloquant', 'bloqué', 'production',
  'impact', 'grave', 'sérieux', 'serieux', 'prioritaire', 'important',
  'dès que', 'des que', 'asap', 'rapidement', 'au plus vite',
  'empêche', 'empeche', 'impossible de travailler',
]);

const DISSATISFACTION_WORDS = new Set([
  'déçu', 'decu', 'décevant', 'decevant', 'insatisfait', 'mécontant',
  'mecontent', 'pas content', 'pas satisfait', 'mal géré', 'mal gere',
  'mauvaise gestion', 'qualité', 'qualite', 'service médiocre',
  'pas professionnel', 'dommage', 'regrettable',
]);

// Amplificateurs : doublent le score d'un mot qui suit
const AMPLIFIERS = new Set([
  'très', 'tres', 'vraiment', 'tellement', 'trop', 'extrêmement',
  'extremement', 'complètement', 'completement', 'totalement',
  'absolument', 'franchement', 'carrément', 'carrement',
]);

// Patterns d'urgence temporelle : "depuis X jours/heures"
const TEMPORAL_PATTERNS = [
  /depuis\s+(\d+)\s+(jour|jours|heure|heures|semaine|semaines)/i,
  /(\d+)\s+(jour|jours|heure|heures|semaine|semaines)\s+sans/i,
  /cela\s+fait\s+(\d+)/i,
  /ça\s+fait\s+(\d+)/i,
  /ca\s+fait\s+(\d+)/i,
];

// Points d'exclamation répétés = urgence/frustration
const EXCLAMATION_PATTERN = /!{2,}/;
const CAPS_PATTERN         = /\b[A-ZÉÈÀÙÊ]{3,}\b/g;

// ── Analyse principale ────────────────────────────────────────────────────────

export function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') {
    return buildResult('neutre', 0, [], 0, false);
  }

  const lower   = text.toLowerCase();
  const words   = lower.split(/[\s,;.!?]+/).filter(Boolean);
  const emotions = { frustration: 0, urgence: 0, insatisfaction: 0 };
  let negativeScore = 0;
  let amplify       = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (AMPLIFIERS.has(word)) {
      amplify = true;
      continue;
    }

    const multiplier = amplify ? 2 : 1;
    amplify = false;

    if (NEGATIVE_WORDS.has(word))       negativeScore += 10 * multiplier;
    if (FRUSTRATION_WORDS.has(word))    emotions.frustration += 15 * multiplier;
    if (URGENCY_WORDS.has(word))        emotions.urgence      += 15 * multiplier;
    if (DISSATISFACTION_WORDS.has(word)) emotions.insatisfaction += 10 * multiplier;
  }

  // Points d'exclamation répétés
  if (EXCLAMATION_PATTERN.test(text)) {
    negativeScore         += 15;
    emotions.urgence      += 10;
    emotions.frustration  += 10;
  }

  // Mots en majuscules (cri)
  const capsMatches = text.match(CAPS_PATTERN) || [];
  if (capsMatches.length > 0) {
    negativeScore        += capsMatches.length * 5;
    emotions.frustration += capsMatches.length * 5;
  }

  // Patterns temporels ("depuis 3 jours...")
  for (const pattern of TEMPORAL_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const days = parseInt(m[1]) || 1;
      const boost = Math.min(days * 5, 40);
      emotions.frustration += boost;
      emotions.urgence      += boost / 2;
      negativeScore         += boost;
      break;
    }
  }

  // Calculer score global (0–100)
  const emotionTotal = emotions.frustration + emotions.urgence + emotions.insatisfaction;
  const totalScore   = Math.min(100, Math.round((negativeScore + emotionTotal) / 3));
  const intensity    = Math.min(100, Math.round(emotionTotal / 2));

  // Classifier
  const detectedEmotions = Object.entries(emotions)
    .filter(([, v]) => v >= 15)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);

  let sentiment;
  if (totalScore >= 60)      sentiment = 'négatif';
  else if (totalScore >= 30) sentiment = 'légèrement négatif';
  else if (totalScore < 5)   sentiment = 'positif';
  else                       sentiment = 'neutre';

  const isCritical = totalScore >= 60 || emotions.frustration >= 45 || emotions.urgence >= 45;

  return buildResult(sentiment, totalScore, detectedEmotions, intensity, isCritical);
}

function buildResult(sentiment, score, emotions, intensity, isCritical) {
  return { sentiment, score, emotions, intensity, isCritical };
}

// ── Actions déduites de l'analyse ─────────────────────────────────────────────

export function getSentimentActions(text) {
  const analysis = analyzeSentiment(text);

  return {
    shouldMarkCritical:  analysis.isCritical,
    shouldNotifyManager: analysis.score >= 60 || analysis.emotions.includes('frustration'),
    priority:            analysis.score >= 70 ? 'Haute' : analysis.score >= 40 ? 'Moyenne' : null,
    reason:              buildReason(analysis),
  };
}

function buildReason(analysis) {
  const parts = [];
  if (analysis.emotions.includes('frustration'))    parts.push('frustration détectée');
  if (analysis.emotions.includes('urgence'))        parts.push('urgence signalée');
  if (analysis.emotions.includes('insatisfaction')) parts.push('insatisfaction exprimée');
  if (analysis.score >= 70)                         parts.push(`score élevé (${analysis.score}/100)`);
  return parts.join(', ') || 'sentiment négatif général';
}