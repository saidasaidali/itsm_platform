import { routeIntent } from '../services/ragService.js';

export const INTENTS = {
  GREETING: 'greeting',
  TICKET_CREATE: 'ticket_create',
  TICKET_STATUS: 'ticket_status',
  ASSET_LOCATE: 'asset_locate',
  ASSET_STATUS: 'asset_status',
  KB_SEARCH: 'kb_search',
  PLATFORM_GUIDE: 'platform_guide',
  SECURITY_INCIDENT: 'security_incident',
  GENERAL: 'general',
  ASK_INFORMATION: 'ask_information',
  ASK_PROCEDURE: 'ask_procedure',
  CONFIRMATION: 'confirmation',
  REJECTION: 'rejection',
  FOLLOW_UP: 'follow_up',
  INCIDENT: 'incident'
};

export const CATEGORIES = [
  'Performance', 'Réseau', 'Matériel', 'Logiciel', 'Sécurité', 'Accès', 'Autre'
];

// Mots-clés de sécurité pour la détection d'incidents
export const SECURITY_KEYWORDS = {
  fr: ['virus', 'malware', 'phishing', 'attaque', 'intrusion', 'fuite', 'ransomware', 'sécurité', 'securité'],
  en: ['virus', 'malware', 'phishing', 'attack', 'intrusion', 'leak', 'ransomware', 'security'],
  ar: ['فيروس', 'برمجية خبيثة', 'تصيد', 'هجوم', 'اختراق', 'تسرب', 'فدية', 'أمان']
};

// Stopwords français pour l'extraction de mots-clés
export const FRENCH_STOPWORDS = [
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'et', 'est', 'sont',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet',
  'cette', 'ces', 'dans', 'pour', 'sur', 'avec', 'par', 'pas', 'plus', 'que',
  'qui', 'quoi', 'dont', 'ou', 'où', 'il', 'elle', 'ils', 'elles', 'nous',
  'vous', 'je', 'tu', 'se', 'me', 'te', 'ne', 'ni', 'au', 'aux', 'en', 'y',
  'non', 'si', 'mais', 'car', 'donc', 'or', 'ni', 'là', 'très', 'trop',
  'peu', 'tout', 'tous', 'toute', 'toutes', 'chaque', 'certain', 'plusieurs',
  'quelque', 'quelques', 'même', 'comme', 'quand', 'comment', 'pourquoi'
];

export function detectLanguage(text) {
  const arabicPattern = /[\u0600-\u06FF]/;
  const hasArabic = arabicPattern.test(text);
  if (hasArabic) return 'ar';
  
  const englishPattern = /\b(the|is|at|which|on|a|an|and|or|but|in|with|for|to|of|my|computer|printer|network)\b/i;
  const hasEnglish = englishPattern.test(text);
  if (hasEnglish) return 'en';
  
  return 'fr';
}

export function normalizeText(text) {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Vocabulaire de base pour la correction de fautes de frappe françaises
 * dans le contexte IT/helpdesk.
 */
export const FRENCH_IT_VOCABULARY = [
  'imprimante', 'installer', 'configuration', 'configurer', 'vpn', 'reseau',
  'connexion', 'ordinateur', 'pc', 'poste', 'serveur', 'logiciel',
  'application', 'programme', 'materiel', 'hardware', 'software',
  'securite', 'motdepasse', 'password', 'compte', 'login',
  'acces', 'bloque', 'debloquer',
  'probleme', 'panne', 'erreur', 'bug', 'lent', 'rame',
  'performance', 'ralenti', 'ralentissement', 'redemarrer',
  'demarrage', 'arret', 'eteindre',
  'allumer', 'demarrer', 'desinstaller',
  'mettreajour', 'update', 'upgrade',
  'telecharger', 'download', 'importer', 'exporter',
  'sauvegarder', 'sauvegarde', 'backup', 'restaurer', 'restoration',
  'parametre', 'setting', 'reglage', 'option',
  'preference', 'fichier', 'file', 'document', 'dossier',
  'folder', 'repertoire', 'directory', 'chemin', 'path',
  'url', 'lien', 'link', 'site', 'page', 'web', 'internet', 'navigateur',
  'browser', 'firefox', 'chrome', 'edge', 'safari', 'explorer',
  'email', 'mail', 'courriel', 'message', 'envoyer', 'send', 'recevoir',
  'receive', 'piecejointe', 'attachment', 'piece',
  'joindre', 'attach', 'printer', 'scanner', 'numeriser',
  'scan', 'copier', 'copy', 'coller', 'paste', 'couper',
  'cut', 'selectionner', 'select', 'cliquer', 'click',
  'doublecliquer', 'doubleclick', 'clic', 'bouton', 'button', 'menu',
  'barre', 'toolbar', 'icone', 'icon', 'fenetre',
  'window', 'ecran', 'screen', 'monitor', 'affichage', 'display',
  'resolution', 'couleur', 'color',
  'son', 'audio', 'volume', 'micro', 'hautparleur', 'haut-parleur',
  'enceinte', 'speaker', 'casque', 'headphone', 'camera',
  'webcam', 'microphone', 'clavier', 'keyboard', 'souris', 'mouse',
  'trackpad', 'touchpad', 'batterie', 'battery', 'chargeur', 'charger',
  'alimentation', 'power', 'cable', 'fil', 'wire',
  'connecteur', 'connector', 'port', 'usb', 'hdmi', 'vga', 'displayport',
  'ethernet', 'rj45', 'wifi', 'wireless', 'sansfil', 'sans-fil',
  'bluetooth', 'dongle', 'adaptateur', 'adapter', 'convertisseur',
  'converter', 'dock', 'station', 'stationdaccueil', 'station-accueil',
  'ticket', 'incident', 'demande', 'request', 'service', 'assistance',
  'helpdesk', 'support', 'technicien', 'technician', 'utilisateur',
  'user', 'client', 'customer', 'employe', 'agent', 'staff',
  'departement', 'department', 'direction',
  'management', 'chef', 'boss', 'manager', 'responsable', 'superviseur',
  'supervisor', 'equipe', 'team', 'groupe', 'group',
  'projet', 'project', 'mission', 'tache', 'task', 'job',
  'calendrier', 'calendar', 'planning', 'planificateur', 'scheduler',
  'rendezvous', 'rdv', 'meeting', 'reunion', 'conference',
  'webinaire', 'webinar', 'formation', 'training',
  'cours', 'course', 'tutoriel', 'tutorial', 'guide', 'manuel', 'manual',
  'documentation', 'doc', 'notice', 'instruction', 'procedure',
  'etape', 'step', 'demarche', 'processus', 'process',
  'workflow', 'flux', 'flow', 'automatique', 'automatic', 'auto',
  'notification', 'alerte', 'alert', 'rappel', 'reminder',
  'sms', 'texto', 'push',
  'rapport', 'report', 'statistique', 'statistic', 'dashboard', 'tableau',
  'board', 'kpi', 'indicateur', 'metric', 'mesure', 'measure',
  'analyse', 'analysis', 'analytique', 'analytics', 'data', 'donnee',
  'information', 'info', 'renseignement', 'intelligence',
  'ia', 'ai', 'intelligence artificielle', 'artificial intelligence',
  'machine learning', 'ml', 'deep learning', 'neural',
  'modele', 'model', 'prediction',
  'score', 'confidence', 'confiance', 'seuil', 'threshold', 'filter',
  'filtre', 'search', 'recherche', 'query', 'requete',
  'keyword', 'motcle', 'tag', 'categorie',
  'category', 'type', 'genre', 'kind', 'sort', 'trier', 'order',
  'filter', 'filtrer', 'refine', 'affiner', 'advanced', 'avance',
  'avancee', 'option', 'optionnel', 'optional', 'mandatory', 'obligatoire',
  'required', 'necessaire', 'important', 'critical',
  'critique', 'urgent', 'priorite', 'priority', 'high',
  'eleve', 'medium', 'moyen', 'low', 'bas', 'faible',
  'normal', 'standard', 'default', 'defaut', 'custom',
  'personnalise', 'customise',
  'generique', 'generic', 'specifique',
  'specific', 'global', 'local', 'regional', 'national',
  'international', 'monde', 'world', 'globe', 'earth',
  'pays', 'country', 'nation', 'etat', 'state', 'province',
  'ville', 'city', 'town', 'commune', 'municipalite', 'municipality',
  'region', 'department', 'district',
  'zone', 'area', 'secteur', 'sector', 'domaine', 'domain', 'field',
  'branche', 'branch', 'industrie', 'industry',
  'business', 'entreprise', 'company', 'societe',
  'corporation', 'corp', 'organisation', 'organization',
  'structure', 'entite', 'entity', 'objet',
  'object', 'chose', 'thing', 'item', 'element', 'composant',
  'component', 'part', 'partie', 'section', 'segment', 'fraction',
  'portion', 'moitie', 'half', 'tiers', 'third',
  'quart', 'quarter', 'pourcentage', 'percentage', 'ratio', 'taux',
  'rate', 'proportion', 'part', 'share',
  'fragment', 'morceau', 'piece', 'bit', 'byte', 'octet',
  'kb', 'mo', 'mb', 'go', 'gb', 'to', 'tb', 'pb', 'ko', 'koctet',
  'mega', 'giga', 'tera', 'peta', 'exa', 'zetta', 'yotta',
  'donnee', 'data',
  'info', 'renseignement', 'connaissance', 'knowledge', 'savoir',
  'expertise', 'competence', 'skill', 'ability', 'capacite',
  'capability', 'potential', 'potentiel', 'talent',
  'aptitude', 'gift', 'don', 'present', 'cadeau',
  'formation', 'training', 'education', 'education', 'apprentissage',
  'learning', 'study', 'etude', 'research', 'recherche',
  'investigation', 'enquete', 'survey', 'poll', 'sondage',
  'vote', 'election', 'choix', 'choice', 'option',
  'alternative', 'possibilite', 'possibility', 'chance',
  'opportunite', 'opportunity', 'occasion', 'moment',
  'time', 'temps', 'period', 'periode', 'duration', 'duree',
  'interval', 'intervalle', 'gap', 'trou', 'hole', 'space',
  'espace', 'room', 'chambre', 'piece', 'office', 'bureau',
  'desk', 'table', 'tableau', 'board', 'poste',
  'position', 'job', 'emploi', 'work', 'travail', 'labor',
  'labour', 'effort', 'energy', 'energie', 'power',
  'puissance', 'force', 'strength', 'strong', 'fort', 'faible',
  'weak', 'lazy', 'paresseux', 'slow', 'lent', 'fast', 'rapide',
  'quick', 'vite', 'speedy', 'rapid', 'swift', 'prompt', 'immediate',
  'instant', 'instantanee', 'immediate', 'direct',
  'indirect', 'straight', 'droit', 'right',
  'left', 'gauche', 'up', 'haut', 'down', 'bas', 'top', 'sommet',
  'bottom', 'fond', 'middle', 'milieu', 'center', 'centre',
  'between', 'entre', 'among', 'parmi', 'inside', 'dedans',
  'outside', 'dehors', 'exterieur', 'external', 'interne',
  'internal', 'interior', 'interieur', 'exterior',
  'surface', 'zone', 'region', 'region', 'territoire',
  'territory', 'land', 'terre', 'ground', 'sol', 'floor', 'etage',
  'level', 'niveau', 'stage', 'etape', 'step',
  'phase', 'pas', 'footstep', 'foot', 'pied',
  'leg', 'jambe', 'arm', 'bras', 'hand', 'main', 'finger', 'doigt',
  'head', 'tete', 'face', 'visage', 'eye', 'oeil',
  'ear', 'oreille', 'nose', 'nez', 'mouth', 'bouche', 'tooth', 'dent',
  'neck', 'cou', 'shoulder', 'epaule', 'chest', 'poitrine',
  'back', 'dos', 'stomach', 'estomac', 'belly', 'ventre', 'waist',
  'taille', 'hip', 'hanche', 'knee', 'genou', 'toe', 'orteil', 'nail', 'ongle',
  'hair', 'cheveu', 'cheveux', 'skin', 'peau', 'flesh', 'chair',
  'bone', 'os', 'muscle', 'nerf', 'nerve', 'vein', 'veine',
  'blood', 'sang', 'heart', 'coeur', 'lung', 'poumon',
  'liver', 'foie', 'kidney', 'rein', 'intestine',
  'intestin', 'brain', 'cerveau', 'mind', 'esprit', 'spirit', 'ame',
  'soul', 'life', 'vie', 'death', 'mort', 'birth', 'naissance'
];

/**
 * Corrige un mot en utilisant la distance de Levenshtein sur un vocabulaire donné.
 * @param {string} word - Mot à corriger
 * @param {string[]} vocabulary - Liste de mots valides
 * @param {number} maxDistance - Distance maximale acceptée (défaut: 2)
 * @returns {string} Mot corrigé ou mot original si aucune correction trouvée
 */
export function correctTypo(word, vocabulary = FRENCH_IT_VOCABULARY, maxDistance = 2) {
  if (!word || word.length < 3) return word;
  
  const lowerWord = word.toLowerCase();
  
  // Si le mot est déjà dans le vocabulaire, pas de correction
  if (vocabulary.includes(lowerWord)) return lowerWord;
  
  // Trouver la meilleure correction
  let bestMatch = lowerWord;
  let bestDistance = maxDistance + 1;
  
  for (const vocabWord of vocabulary) {
    const dist = levenshtein(lowerWord, vocabWord);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = vocabWord;
    }
  }
  
  // Ne corriger que si la distance est raisonnable
  // Pour les mots courts (< 5 caractères) : distance max 1
  // Pour les mots moyens (5-7 caractères) : distance max 1
  // Pour les mots longs (> 7 caractères) : distance max 2
  const wordLen = lowerWord.length;
  const allowedDistance = wordLen <= 5 ? 1 : (wordLen <= 7 ? 1 : 2);
  
  if (bestDistance <= allowedDistance && bestDistance > 0) {
    return bestMatch;
  }
  
  return lowerWord;
}

/**
 * Extrait les mots-clés d'un texte en supprimant les stopwords et en corrigeant les fautes de frappe.
 * @param {string} text - Le texte à analyser
 * @param {string[]} stopwords - Liste de stopwords (défaut: FRENCH_STOPWORDS)
 * @param {boolean} correctTypos - Activer la correction de fautes de frappe (défaut: true)
 * @returns {string[]} Liste des mots-clés
 */
export function extractKeywords(text, stopwords = FRENCH_STOPWORDS, correctTypos = true) {
  const words = normalizeText(text).split(' ');
  const filtered = words.filter(w => w.length > 2 && !stopwords.includes(w));
  
  if (!correctTypos) return filtered;
  
  // Corriger les fautes de frappe
  return filtered.map(w => correctTypo(w));
}

// ─── Analyse complète d'intention avec contexte et routage ─────────────────
// Fonction unique utilisée par smartAssistantService.js ET chatbotBrain.js/ragService.js
// Combine : detectIntent() + detectIntentWithContext() + routeIntent()
// @param {string} userMessage - Message de l'utilisateur
// @param {string} sessionKey - Clé de session (pour charger le contexte)
// @param {boolean} hasKnowledgeBaseResults - Si des résultats KB ont été trouvés (pour le routage)
// @param {Function} loadConversationState - Fonction de chargement du cache (injection de dépendance)
// @returns {Promise<{intent: string, pendingAction: string|null, previousIntent: string|null, context: object|null, routing: {type: string, pipeline: string, description: string}}>}
export async function analyzeConversationIntent(userMessage, sessionKey, hasKnowledgeBaseResults = false, loadConversationState = null) {
  const language = detectLanguage(userMessage);
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // 1. Charger le contexte conversationnel si disponible
  let conversationState = null;
  let pendingAction = null;
  let previousIntent = null;
  
  if (loadConversationState && sessionKey) {
    try {
      conversationState = await loadConversationState(sessionKey);
      if (conversationState) {
        pendingAction = conversationState.pendingAction || null;
        previousIntent = conversationState.lastIntent || null;
      }
    } catch (e) {
      // Silencieux : le contexte est optionnel
    }
  }
  
  // 2. Gestion des confirmations/rejets en fonction de pendingAction
  const confirmPatterns = [
    /^(oui|ok|d'accord|accord|ouais|bien sûr|bien sur|exactement|c'est ça|cest ça|ouai|ouep|yep|yes|ya)$/i,
    /^(yes|ok|sure|exactly|right|correct|yep|yeah|yup)$/i,
    /^(نعم|أيوا|بالتأكيد|صحيح|موافق)$/i
  ];
  const rejectPatterns = [
    /^(non|no|nope|pas|jamais|refus|absolument pas|surtout pas)$/i,
    /^(no|nope|never|absolutely not|refuse)$/i,
    /^(لا|كلا|أبدا|مستحيل)$/i
  ];
  
  if (pendingAction === 'create_ticket' || pendingAction === 'incident_resolved') {
    if (confirmPatterns.some(p => p.test(lowerMessage))) {
      return {
        intent: INTENTS.CONFIRMATION,
        pendingAction,
        previousIntent,
        context: conversationState,
        routing: routeIntent(userMessage, hasKnowledgeBaseResults)
      };
    }
    if (rejectPatterns.some(p => p.test(lowerMessage))) {
      return {
        intent: INTENTS.REJECTION,
        pendingAction,
        previousIntent,
        context: conversationState,
        routing: routeIntent(userMessage, hasKnowledgeBaseResults)
      };
    }
  }
  
  // 3. Détection de question de suivi
  const followUpPatterns = [
    'et ensuite', 'et après', 'continue', 'continuez', 'continuer', 'explique', 'expliquer',
    'plus de détails', 'détails', 'pourquoi', 'comment', 'comment faire', 'comment procéder',
    'la démarche', 'la procédure', 'les étapes', 'étape suivante', 'première étape',
    'deuxième étape', 'troisième étape', 'suivant', 'suivante', 'autre chose', 'et', 'puis',
    'ensuite', 'après', 'ok', "d'accord", 'bien', 'je vois', 'donne-moi', 'donnez-moi',
    'montre-moi', 'montrez-moi', 'précise', 'préciser', 'développe', 'développer',
    'explication', 'explications'
  ];
  const isFollowUp = followUpPatterns.some(pattern => lowerMessage === pattern || lowerMessage.includes(pattern));
  if (isFollowUp && previousIntent) {
    return {
      intent: INTENTS.FOLLOW_UP,
      pendingAction: null,
      previousIntent,
      context: conversationState,
      routing: routeIntent(userMessage, hasKnowledgeBaseResults)
    };
  }
  
  // 4. Détection normale d'intention
  const intent = detectIntent(userMessage, false, language);
  
  return {
    intent,
    pendingAction: null,
    previousIntent: null,
    context: conversationState,
    routing: routeIntent(userMessage, hasKnowledgeBaseResults)
  };
}

export function detectIntent(text, isSecurityIncident = false, language = 'fr') {
  const lowerText = text.toLowerCase().trim();
  
  if (isSecurityIncident) return INTENTS.SECURITY_INCIDENT;

  // Détecter les réponses de confirmation/rejet AVANT tout autre traitement
  const confirmationPatterns = {
    fr: /^(oui|ok|d'accord|accord|ouais|bien sûr|bien sur|exactement|c'est ça|cest ça|ouai|ouep|yep|yes|ya)$/i,
    en: /^(yes|ok|sure|exactly|right|correct|yep|yeah|yup)$/i,
    ar: /^(نعم|أيوا|بالتأكيد|صحيح|موافق)$/i
  };
  
  const rejectionPatterns = {
    fr: /^(non|no|nope|pas|jamais|refus|absolument pas|surtout pas)$/i,
    en: /^(no|nope|never|absolutely not|refuse)$/i,
    ar: /^(لا|كلا|أبدا|مستحيل)$/i
  };
  
  const allConfirmationPatterns = Object.values(confirmationPatterns).flat();
  const allRejectionPatterns = Object.values(rejectionPatterns).flat();
  
  if (allConfirmationPatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.CONFIRMATION;
  }
  
  if (allRejectionPatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.REJECTION;
  }

  // Détecter les questions de suivi
  const followUpPatterns = {
    fr: /^(et ensuite|et après|continue|continuez|continuer|explique|expliquer|plus de détails|détails|pourquoi|comment|comment faire|comment procéder|la démarche|la procédure|les étapes|étape suivante|première étape|deuxième étape|troisième étape|suivant|suivante|autre chose|et|puis|ensuite|après|ok|d'accord|bien|je vois|donne-moi|donnez-moi|montre-moi|montrez-moi|précise|préciser|développe|développer|explication|explications)$/i,
    en: /^(and then|continue|explain|more details|why|how|the steps|next step|first step|second step|third step|following|next|ok|alright|give me|show me|clarify|develop|explanations)$/i,
    ar: /^(ثم|استمر|اشرح|المزيد من التفاصيل|لماذا|كيف|الخطوات|الخطوة التالية|حسنا|أعطني|أظهر|توضيح|تفسير)$/i
  };
  
  const allFollowUpPatterns = Object.values(followUpPatterns).flat();
  if (allFollowUpPatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.FOLLOW_UP;
  }

  // Détecter les demandes de procédure/comment faire
  const procedurePatterns = {
    fr: /comment (?:faire|procéder|créer|créer un|ouvrir|configurer|installer|utiliser|réinitialiser|changer|modifier|ajouter|supprimer|trouver|localiser|vérifier|consulter|voir|accéder|se connecter|débloquer|réparer|corriger|résoudre)|comment faire pour|comment puis-je|comment je peux|quelle est la procédure|quelles sont les étapes|comment s'y prendre/i,
    en: /how to (?:create|make|open|configure|install|use|reset|change|modify|add|delete|find|locate|check|view|access|connect|unlock|fix|repair|solve)|how can i|what is the procedure|what are the steps/i,
    ar: /كيف (?:أقوم|أعمل|أنشئ|أفتح|أضبط|أثبت|أستخدم|أعيد|أغير|أعدل|أضيف|أحذف|أجد|أبحث|أتحقق|أرى|أصل|أتصل|أفتح|أصلح|أحل)|كيف يمكنني|ما هي الإجراءات|ما هي الخطوات/i
  };
  
  const allProcedurePatterns = Object.values(procedurePatterns).flat();
  if (allProcedurePatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.ASK_PROCEDURE;
  }

  // Détecter les incidents (problèmes signalés)
  const incidentPatterns = {
    fr: /mon .+ (?:ne marche pas|ne fonctionne pas|est cassé|est en panne|est hors ligne|est bloqué|ne répond pas|est lent|bug|erreur|problème|imprimante|ordinateur|pc|serveur|réseau|connexion)|j'ai un problème|je n'arrive pas|impossible de|ne peux pas|ne peut pas/i,
    en: /my .+ (?:not working|broken|down|offline|stuck|not responding|slow|bug|error|issue|problem|printer|computer|server|network|connection)|i have a problem|i can't|cannot|unable to/i,
    ar: /جهازي .+ (?:لا يعمل|معطل|مكسور|غير متصل|بطيء|خطأ|مشكلة|طابعة|حاسوب|خادم|شبكة)|لدي مشكلة|لا أستطيع|لا يمكن/i
  };
  
  const allIncidentPatterns = Object.values(incidentPatterns).flat();
  if (allIncidentPatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.INCIDENT;
  }

  // Détecter les demandes d'information générale
  const informationPatterns = {
    fr: /^(?:qu'est-ce que|qu'est ce que|qu'est-ce qu'|qu'est ce qu'|c'est quoi|qu'est|que|quand|où|qui|combien|quel|quelle|quels|quelles|pourquoi|comment)\b/i,
    en: /^(?:what is|what are|what's|when|where|who|how many|which|why|how)\b/i,
    ar: /^(?:ما هو|ما هي|متى|أين|من|كم|أي|لماذا|كيف)\b/i
  };
  
  const allInformationPatterns = Object.values(informationPatterns).flat();
  if (allInformationPatterns.some(pattern => pattern.test(lowerText))) {
    return INTENTS.ASK_INFORMATION;
  }

  const patterns = {
    [INTENTS.GREETING]: {
      fr: /bonjour|salut|hello|hey|coucou|bonsoir/,
      en: /hello|hi|hey|good morning|good evening/,
      ar: /مرحبا|السلام|صباح|مساء|سلام/
    },
    [INTENTS.TICKET_CREATE]: {
      fr: /creer ticket|nouveau ticket|ouvrir ticket|bug|ne marche pas|panne|erreur|je veux créer|je veux ouvrir|aide-moi à créer|aidez-moi à créer/i,
      en: /create ticket|new ticket|open ticket|problem|bug|not working|issue|error|i want to create|i want to open|help me create/i,
      ar: /إنشاء تذكرة|تذكرة جديدة|مشكلة|خطأ|لا يعمل|عطل|أريد إنشاء|أريد فتح/i
    },
    [INTENTS.TICKET_STATUS]: {
      fr: /etat ticket|status ticket|ou en est mon ticket|statut de mon ticket|suivre mon ticket/i,
      en: /ticket status|my ticket|ticket state|track my ticket|status of my ticket/i,
      ar: /حالة التذكرة|تذكرتي|متابعة تذكرتي/i
    },
    [INTENTS.ASSET_LOCATE]: {
      fr: /trouver asset|ou est mon|localiser asset|où se trouve|localiser|trouver mon/i,
      en: /find asset|where is my|locate asset|where is|find my/i,
      ar: /أين|موقع|بحث عن|جهاز|أين يوجد|حدد موقع/i
    },
    [INTENTS.ASSET_STATUS]: {
      fr: /etat asset|status asset|état de|statut de l'/i,
      en: /asset status|device status|status of my/i,
      ar: /حالة الجهاز|حالة/i
    },
    [INTENTS.PLATFORM_GUIDE]: {
      fr: /comment utiliser|guide|plateforme|how to|tutoriel|comment naviguer|comment faire sur/i,
      en: /how to use|guide|platform|tutorial|how do i|how can i use/i,
      ar: /كيفية استخدام|دليل|منصة|تعليم|كيف أستخدم/i
    },
    [INTENTS.KB_SEARCH]: {
      fr: /rechercher|chercher|documentation|article|base de connaissances|trouver un article|chercher dans/i,
      en: /search|find|documentation|article|knowledge base|look for|find an article/i,
      ar: /بحث|ابحث|توثيق|مقال|قاعدة معرفية|ابحث عن/i
    }
  };

  for (const [intent, langs] of Object.entries(patterns)) {
    if (langs[language] && langs[language].test(lowerText)) return intent;
  }
  
  // Fallback for chatbotBrain which defaults to KB_SEARCH sometimes
  if (/rechercher|chercher|documentation|article|base de connaissances/.test(normalizeText(text))) {
    return INTENTS.KB_SEARCH;
  }
  
  return INTENTS.GENERAL;
}

/**
 * Détection d'intention avec scoring de confiance (utilisée par chatbotBrain)
 * Ajoute un score de confiance et une catégorie en fonction de l'intention détectée
 * @param {string} text - Le texte à analyser
 * @param {string} language - La langue du texte ('fr', 'en', 'ar')
 * @returns {{ intent: string, confidence: number, category: string }}
 */
export function detectIntentWithConfidence(text, language = 'fr') {
  const intent = detectIntent(text, false, language);
  let category = 'Autre';
  
  if (intent === INTENTS.TICKET_CREATE) {
    const classif = classifyCategoryByKeywords(text, language);
    category = classif.category;
  }
  
  // Assign simple confidence for backward compatibility
  let confidence = 0.85;
  if (intent === INTENTS.GREETING) confidence = 0.95;
  if (intent === INTENTS.TICKET_CREATE) confidence = 0.9;
  if (intent === INTENTS.ASSET_LOCATE || intent === INTENTS.ASSET_STATUS) confidence = 0.8;
  if (intent === INTENTS.GENERAL) return { intent: INTENTS.KB_SEARCH, confidence: 0.5 }; // Fallback like the old behavior
  
  return { intent, confidence, category };
}

export function classifyCategoryByKeywords(text, language = 'fr') {
  const lowerText = text.toLowerCase();
  
  const keywordCategories = {
    'Matériel': {
      fr: ['ordinateur', 'pc', 'poste', 'écran', 'ecran', 'clavier', 'souris', 'imprimante', 'serveur', 'matériel', 'hardware'],
      en: ['computer', 'pc', 'workstation', 'monitor', 'keyboard', 'mouse', 'printer', 'server', 'hardware'],
      ar: ['حاسوب', 'كمبيوتر', 'طابعة', 'خادم', 'معدات', 'جهاز']
    },
    'Réseau': {
      fr: ['réseau', 'reseau', 'wifi', 'connexion', 'internet', 'lan', 'wan', 'vpn', 'switch', 'routeur'],
      en: ['network', 'wifi', 'connection', 'internet', 'lan', 'wan', 'vpn', 'switch', 'router'],
      ar: ['شبكة', 'واي فاي', 'اتصال', 'إنترنت', 'موجه']
    },
    'Logiciel': {
      fr: ['logiciel', 'application', 'app', 'programme', 'software', 'erp', 'sage', 'office'],
      en: ['software', 'application', 'app', 'program', 'erp', 'office'],
      ar: ['برنامج', 'تطبيق', 'نظام', 'برمجيات']
    },
    'Performance': {
      fr: ['lent', 'rame', 'performance', 'ralenti', 'ralentissement', 'cpu', 'ram'],
      en: ['slow', 'lag', 'performance', 'sluggish', 'cpu', 'ram'],
      ar: ['بطيء', 'بطء', 'أداء', 'متأخر', 'معالج', 'ذاكرة']
    },
    'Sécurité': {
      fr: ['virus', 'malware', 'phishing', 'attaque', 'intrusion', 'fuite', 'ransomware', 'sécurité', 'securité'],
      en: ['virus', 'malware', 'phishing', 'attack', 'intrusion', 'leak', 'ransomware', 'security'],
      ar: ['فيروس', 'برمجية خبيثة', 'تصيد', 'هجوم', 'اختراق', 'تسرب', 'فدية', 'أمان']
    },
    'Accès': {
      fr: ['mot de passe', 'password', 'compte', 'login', 'accès', 'acces', 'bloqué', 'bloque'],
      en: ['password', 'account', 'login', 'access', 'blocked', 'locked'],
      ar: ['كلمة مرور', 'حساب', 'دخول', 'وصول', 'محظور', 'مقفل']
    }
  };

  let detectedCategory = 'Autre';
  let maxMatches = 0;

  for (const [category, keywordsByLang] of Object.entries(keywordCategories)) {
    const keywords = keywordsByLang[language] || keywordsByLang['fr'];
    const matches = keywords.filter(kw => lowerText.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedCategory = category;
    }
  }

  return { category: detectedCategory, maxMatches };
}