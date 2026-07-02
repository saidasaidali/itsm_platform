export const INTENTS = {
  GREETING: 'greeting',
  TICKET_CREATE: 'ticket_create',
  TICKET_STATUS: 'ticket_status',
  ASSET_LOCATE: 'asset_locate',
  ASSET_STATUS: 'asset_status',
  KB_SEARCH: 'kb_search',
  PLATFORM_GUIDE: 'platform_guide',
  SECURITY_INCIDENT: 'security_incident',
  GENERAL: 'general'
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
 * Extrait les mots-clés d'un texte en supprimant les stopwords
 * @param {string} text - Le texte à analyser
 * @param {string[]} stopwords - Liste de stopwords (défaut: FRENCH_STOPWORDS)
 * @returns {string[]} Liste des mots-clés
 */
export function extractKeywords(text, stopwords = FRENCH_STOPWORDS) {
  const words = normalizeText(text).split(' ');
  return words.filter(w => w.length > 2 && !stopwords.includes(w));
}

export function detectIntent(text, isSecurityIncident = false, language = 'fr') {
  const lowerText = text.toLowerCase();
  if (isSecurityIncident) return INTENTS.SECURITY_INCIDENT;

  const patterns = {
    [INTENTS.GREETING]: {
      fr: /bonjour|salut|hello|hey|coucou/,
      en: /hello|hi|hey|good morning/,
      ar: /مرحبا|السلام|صباح|مساء/
    },
    [INTENTS.TICKET_CREATE]: {
      fr: /creer ticket|nouveau ticket|ouvrir ticket|probleme|bug|ne marche pas|panne|erreur/,
      en: /create ticket|new ticket|open ticket|problem|bug|not working|issue|error/,
      ar: /إنشاء تذكرة|تذكرة جديدة|مشكلة|خطأ|لا يعمل|عطل/
    },
    [INTENTS.TICKET_STATUS]: {
      fr: /etat ticket|status ticket|ou en est mon ticket/,
      en: /ticket status|my ticket|ticket state/,
      ar: /حالة التذكرة|تذكرتي/
    },
    [INTENTS.ASSET_LOCATE]: {
      fr: /trouver asset|ou est mon|localiser asset/,
      en: /find asset|where is my|locate asset/,
      ar: /أين|موقع|بحث عن|جهاز/
    },
    [INTENTS.ASSET_STATUS]: {
      fr: /etat asset|status asset/,
      en: /asset status|device status/,
      ar: /حالة الجهاز/
    },
    [INTENTS.PLATFORM_GUIDE]: {
      fr: /comment utiliser|guide|plateforme|how to|tutoriel/,
      en: /how to use|guide|platform|tutorial/,
      ar: /كيفية استخدام|دليل|منصة|تعليم/
    },
    [INTENTS.KB_SEARCH]: {
      fr: /rechercher|chercher|documentation|article|base de connaissances/,
      en: /search|find|documentation|article|knowledge base/,
      ar: /بحث|ابحث|توثيق|مقال|قاعدة معرفية/
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