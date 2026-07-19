// backend/src/services/smartAssistantService.js
// Smart IT Assistant - Orchestration de tous les services intelligents
import pool from '../db.js';
import { analyzeSentiment } from './sentimentAnalyzer.js';
import { recommendTechnician } from './technicianRecommender.js';
import { getRiskScore, saveRiskScore } from './mlService.js';
import { getAssetLiveProfile } from './networkDiscovery/digitalTwin.js';
import notificationService from './notificationService.js';
import { detectLanguage, classifyCategoryByKeywords, extractKeywords, SECURITY_KEYWORDS, INTENTS, analyzeConversationIntent } from '../utils/nlpUtils.js';
import { detectIntent } from './intentService.js';
import { searchKnowledgeBase } from './knowledgeBaseSearch.js';
import ragService, { learnFromTicket as learnFromTicketShared, learnFromArticle as learnFromArticleShared } from './ragService.js';
import { 
  loadConversationState as loadFromCache,
  saveConversationState as saveToCache,
  resetConversationState as resetCache
} from './conversationService.js';

const translations = {
  fr: {
    greeting: "Bonjour ! Je suis votre assistant IT intelligent. Comment puis-je vous aider aujourd'hui ?",
    ticket_create_help: "Je vais vous aider à créer un ticket.",
    asset_identified: "📱 **Équipement identifié**",
    category: "📋 **Catégorie**",
    priority_suggested: "⚡ **Priorité suggérée**",
    attention_urgency: "⚠️ **Attention** : Votre message indique un niveau d'urgence élevé (score: {{score}}/100).",
    ml_prediction: "🔮 **Prédiction ML** : Risque de panne: {{risk_level}} (score: {{risk_score}}/100)",
    recommended_technician: "👨‍🔧 **Technicien recommandé**",
    ticket_created_auto: "✅ Ticket créé automatiquement avec toutes ces informations.",
    notification_sent: "📧 Une notification a été envoyée au technicien assigné.",
    ticket_status_help: "Je vais consulter le statut de vos tickets. Pour quel ticket souhaitez-vous avoir des informations ?",
    asset_found: "J'ai trouvé l'équipement :",
    asset_not_found: "Je n'ai pas pu identifier l'équipement dont vous parlez. Pouvez-vous me donner son numéro d'inventaire ou sa référence ?",
    asset_status_title: "**État de l'équipement {{tag}}** :",
    asset_status: "Statut: {{status}}",
    asset_online: "En ligne: {{status}}",
    asset_cpu: "CPU: {{value}}%",
    asset_ram: "RAM: {{value}}%",
    asset_user: "Utilisateur connecté: {{user}}",
    predictive_analysis: "🔮 **Analyse prédictive** : Risque de panne dans les 7 jours: {{risk_level}}",
    asset_not_identified: "Je n'ai pas identifié l'équipement. Pouvez-vous préciser de quel équipement il s'agit ?",
    kb_articles_found: "J'ai trouvé {{count}} article(s) dans la base de connaissances :",
    kb_no_articles: "Je n'ai pas trouvé d'article correspondant dans la base de connaissances.",
    default_understanding: "Je comprends votre demande.",
    asset_mentioned: "Je vois que vous mentionnez l'équipement {{tag}}.",
    kb_suggestions: "Voici des articles qui pourraient vous aider :",
    create_ticket_suggestion: "Souhaitez-vous créer un ticket pour obtenir de l'aide ?",
    security_incident_detected: "🚨 **INCIDENT DE SÉCURITÉ DÉTECTÉ**",
    security_type: "Type: {{type}}",
    security_severity: "Sévérité: {{severity}}",
    security_ticket_created: "Un ticket critique a été créé automatiquement et l'équipe de sécurité a été notifiée.",
    security_ticket_suggestion: "Je vous recommande de créer un ticket immédiatement pour signaler cet incident.",
    ticket_title_security: "[SÉCURITÉ] {{type}}: {{message}}",
    ticket_description: "**Message original** : {{message}}\n\n**Analyse automatique** :\n- Catégorie: {{category}}\n- Priorité: {{priority}}\n- Sentiment: {{sentiment}} (score: {{score}}/100)\n",
    ticket_asset: "- Asset: {{tag}} (ID: {{id}})\n",
    ticket_ml_risk: "- Risque ML: {{risk_level}} ({{risk_score}}/100)\n",
    security_alert: "⚠️ **ALERTE** : Sentiment critique détecté. Vérification urgente requise.",
    security_incident_section: "🚨 **INCIDENT DE SÉCURITÉ** : {{type}}\nSévérité: {{severity}}\n",
    new_ticket_assigned: "Nouveau ticket assigné",
    new_ticket_message: "Ticket #{{id}} - {{title}}",
    ticket_created_success: "Ticket créé avec succès",
    ticket_created_message: "Votre ticket #{{id}} a été créé et assigné.",
    security_incident_notification: "🚨 Incident de sécurité détecté",
    security_notification_message: "Ticket #{{id}} - {{type}} - Sévérité: {{severity}}",
    email_subject_security: "[URGENT] Incident de sécurité: {{type}}",
    email_body_security: "Bonjour {{username}},\n\nUn incident de sécurité a été détecté et un ticket critique a été créé automatiquement.\n\nDétails:\n- Ticket: #{{id}}\n- Type: {{type}}\n- Sévérité: {{severity}}\n- Description: {{description}}\n\nVeuillez prendre en charge ce ticket immédiatement.\n\nCordialement,\nSmart IT Assistant",
    rejection_response: "Très bien. N'hésitez pas à revenir vers moi si vous avez besoin d'aide.",
    follow_up_no_context: "Je n'ai pas de contexte précédent. Pouvez-vous me rappeler votre question ?",
    follow_up_using_context: "Suite à votre question précédente sur \"{{context}}\" :",
    procedure_found: "Voici la procédure à suivre :",
    procedure_not_found: "Je n'ai pas trouvé de procédure correspondante dans la base de connaissances.",
    incident_solution_found: "Voici une solution qui pourrait vous aider :",
    incident_ask_resolved: "Le problème est-il résolu ?",
    incident_no_solution: "Je n'ai pas trouvé de solution dans la base de connaissances.",
    incident_ticket_proposal: "Souhaitez-vous que je crée un ticket pour que nos experts puissent vous aider ?",
    info_response: "Voici ce que j'ai trouvé à ce sujet :",
    info_not_found: "Je n'ai pas trouvé d'information correspondante.",
    procedure_step: "**Étape {{num}}** :",
    documents_found: "J'ai également trouvé {{count}} document(s) interne(s) :"
  },
  en: {
    greeting: "Hello! I'm your intelligent IT assistant. How can I help you today?",
    ticket_create_help: "I'll help you create a ticket.",
    asset_identified: "📱 **Asset identified**",
    category: "📋 **Category**",
    priority_suggested: "⚡ **Suggested priority**",
    attention_urgency: "⚠️ **Attention**: Your message indicates a high urgency level (score: {{score}}/100).",
    ml_prediction: "🔮 **ML Prediction**: Failure risk: {{risk_level}} (score: {{risk_score}}/100)",
    recommended_technician: "👨‍🔧 **Recommended technician**",
    ticket_created_auto: "✅ Ticket created automatically with all this information.",
    notification_sent: "📧 A notification has been sent to the assigned technician.",
    ticket_status_help: "I'll check the status of your tickets. Which ticket would you like information about?",
    asset_found: "I found the equipment:",
    asset_not_found: "I couldn't identify the equipment you're talking about. Can you give me its inventory number or reference?",
    asset_status_title: "**Status of equipment {{tag}}** :",
    asset_status: "Status: {{status}}",
    asset_online: "Online: {{status}}",
    asset_cpu: "CPU: {{value}}%",
    asset_ram: "RAM: {{value}}%",
    asset_user: "Logged in user: {{user}}",
    predictive_analysis: "🔮 **Predictive analysis**: Failure risk in 7 days: {{risk_level}}",
    asset_not_identified: "I haven't identified the equipment. Can you specify which equipment it is?",
    kb_articles_found: "I found {{count}} article(s) in the knowledge base:",
    kb_no_articles: "I didn't find any matching article in the knowledge base.",
    default_understanding: "I understand your request.",
    asset_mentioned: "I see you're mentioning equipment {{tag}}.",
    kb_suggestions: "Here are articles that could help you:",
    create_ticket_suggestion: "Would you like to create a ticket to get help?",
    security_incident_detected: "🚨 **SECURITY INCIDENT DETECTED**",
    security_type: "Type: {{type}}",
    security_severity: "Severity: {{severity}}",
    security_ticket_created: "A critical ticket has been created automatically and the security team has been notified.",
    security_ticket_suggestion: "I recommend creating a ticket immediately to report this incident.",
    ticket_title_security: "[SECURITY] {{type}}: {{message}}",
    ticket_description: "**Original message**: {{message}}\n\n**Automatic analysis**:\n- Category: {{category}}\n- Priority: {{priority}}\n- Sentiment: {{sentiment}} (score: {{score}}/100)\n",
    ticket_asset: "- Asset: {{tag}} (ID: {{id}})\n",
    ticket_ml_risk: "- ML Risk: {{risk_level}} ({{risk_score}}/100)\n",
    security_alert: "⚠️ **ALERT**: Critical sentiment detected. Urgent verification required.",
    security_incident_section: "🚨 **SECURITY INCIDENT**: {{type}}\nSeverity: {{severity}}\n",
    new_ticket_assigned: "New ticket assigned",
    new_ticket_message: "Ticket #{{id}} - {{title}}",
    ticket_created_success: "Ticket created successfully",
    ticket_created_message: "Your ticket #{{id}} has been created and assigned.",
    security_incident_notification: "🚨 Security incident detected",
    security_notification_message: "Ticket #{{id}} - {{type}} - Severity: {{severity}}",
    email_subject_security: "[URGENT] Security incident: {{type}}",
    email_body_security: "Hello {{username}},\n\nA security incident has been detected and a critical ticket has been created automatically.\n\nDetails:\n- Ticket: #{{id}}\n- Type: {{type}}\n- Severity: {{severity}}\n- Description: {{description}}\n\nPlease handle this ticket immediately.\n\nBest regards,\nSmart IT Assistant",
    rejection_response: "Very well. Feel free to come back to me if you need help.",
    follow_up_no_context: "I don't have previous context. Can you remind me of your question?",
    follow_up_using_context: "Following your previous question about \"{{context}}\" :",
    procedure_found: "Here is the procedure to follow:",
    procedure_not_found: "I didn't find a matching procedure in the knowledge base.",
    incident_solution_found: "Here is a solution that might help you:",
    incident_ask_resolved: "Is the problem resolved?",
    incident_no_solution: "I didn't find a solution in the knowledge base.",
    incident_ticket_proposal: "Would you like me to create a ticket so our experts can help you?",
    info_response: "Here is what I found on this topic:",
    info_not_found: "I didn't find any matching information.",
    procedure_step: "**Step {{num}}** :",
    documents_found: "I also found {{count}} internal document(s):"
  },
  ar: {
    greeting: "مرحباً! أنا مساعدك الذكي لتقنية المعلومات. كيف يمكنني مساعدتك اليوم؟",
    ticket_create_help: "سأساعدك في إنشاء تذكرة.",
    asset_identified: "📱 **المعدات المحددة**",
    category: "📋 **الفئة**",
    priority_suggested: "⚡ **الأولوية المقترحة**",
    attention_urgency: "⚠️ **انتباه**: رسالتك تشير إلى مستوى عالي من الاستعجال (الدرجة: {{score}}/100).",
    ml_prediction: "🔮 **تنبؤ التعلم الآلي**: خطر العطل: {{risk_level}} (الدرجة: {{risk_score}}/100)",
    recommended_technician: "👨‍🔧 **التقني الموصى به**",
    ticket_created_auto: "✅ تم إنشاء التذكرة تلقائياً مع جميع هذه المعلومات.",
    notification_sent: "📧 تم إرسال إشعار إلى التقني المعين.",
    ticket_status_help: "سأستشار حالة تذاكرك. لأي تذكرة تريد الحصول على معلومات؟",
    asset_found: "لقد وجدت المعدات:",
    asset_not_found: "لم أتمكن من تحديد المعدات التي تتحدث عنها. هل يمكنك إعطائي رقم الجرد أو المرجع؟",
    asset_status_title: "**حالة المعدات {{tag}}** :",
    asset_status: "الحالة: {{status}}",
    asset_online: "متصل: {{status}}",
    asset_cpu: "المعالج: {{value}}%",
    asset_ram: "الذاكرة: {{value}}%",
    asset_user: "المستخدم المتصل: {{user}}",
    predictive_analysis: "🔮 **التحليل التنبؤي**: خطر العطل في 7 أيام: {{risk_level}}",
    asset_not_identified: "لم أتمكن من تحديد المعدات. هل يمكنك تحديد أي معدات تقصد؟",
    kb_articles_found: "لقد وجدت {{count}} مقال(ات) في قاعدة المعرفة:",
    kb_no_articles: "لم أجد أي مقال مطابق في قاعدة المعرفة.",
    default_understanding: "أفهم طلبك.",
    asset_mentioned: "أرى أنك تذكر المعدات {{tag}}.",
    kb_suggestions: "إليك مقالات يمكن أن تساعدك:",
    create_ticket_suggestion: "هل تريد إنشاء تذكرة للحصول على مساعدة؟",
    security_incident_detected: "🚨 **تم اكتشاف حادث أمني**",
    security_type: "النوع: {{type}}",
    security_severity: "الخطورة: {{severity}}",
    security_ticket_created: "تم إنشاء تذكرة حرجة تلقائياً وتم إبلاغ فريق الأمن.",
    security_ticket_suggestion: "أنصحك بإنشاء تذكرة فوراً للإبلاغ عن هذا الحادث.",
    ticket_title_security: "[أمن] {{type}}: {{message}}",
    ticket_description: "**الرسالة الأصلية**: {{message}}\n\n**التحليل التلقائي**:\n- الفئة: {{category}}\n- الأولوية: {{priority}}\n- المشاعر: {{sentiment}} (الدرجة: {{score}}/100)\n",
    ticket_asset: "- المعدات: {{tag}} (المعرف: {{id}})\n",
    ticket_ml_risk: "- خطر التعلم الآلي: {{risk_level}} ({{risk_score}}/100)\n",
    security_alert: "⚠️ **تنبيه**: تم اكتشاف مشاعر حرجة. التحقق العاجل مطلوب.",
    security_incident_section: "🚨 **حادث أمني**: {{type}}\nالخطورة: {{severity}}\n",
    new_ticket_assigned: "تذكرة جديدة معينة",
    new_ticket_message: "التذكرة #{{id}} - {{title}}",
    ticket_created_success: "تم إنشاء التذكرة بنجاح",
    ticket_created_message: "تم إنشاء تذكرتك #{{id}} وتعيينها.",
    security_incident_notification: "🚨 تم اكتشاف حادث أمني",
    security_notification_message: "التذكرة #{{id}} - {{type}} - الخطورة: {{severity}}",
    email_subject_security: "[عاجل] حادث أمني: {{type}}",
    email_body_security: "مرحباً {{username}},\n\nتم اكتشاف حادث أمني وتم إنشاء تذكرة حرجة تلقائياً.\n\nالتفاصيل:\n- التذكرة: #{{id}}\n- النوع: {{type}}\n- الخطورة: {{severity}}\n- الوصف: {{description}}\n\nيرجى معالجة هذه التذكرة فوراً.\n\nمع التحية،\nالمساعد الذكي للتقنية",
    rejection_response: "حسناً. لا تتردد في العودة إلي إذا كنت بحاجة إلى مساعدة.",
    follow_up_no_context: "ليس لدي سياق سابق. هل يمكنك تذكيري بسؤالك؟",
    follow_up_using_context: "استجابةً لسؤالك السابق حول \"{{context}}\" :",
    procedure_found: "إليك الإجراء المطلوب اتباعه:",
    procedure_not_found: "لم أجد إجراءً مطابقاً في قاعدة المعرفة.",
    incident_solution_found: "إليك حل قد يساعدك:",
    incident_ask_resolved: "هل تم حل المشكلة؟",
    incident_no_solution: "لم أجد حلاً في قاعدة المعرفة.",
    incident_ticket_proposal: "هل تريد مني إنشاء تذكرة ليتمكن خبراؤنا من مساعدتك؟",
    info_response: "إليك ما وجدته حول هذا الموضوع:",
    info_not_found: "لم أجد معلومات مطابقة.",
    procedure_step: "**الخطوة {{num}}** :",
    documents_found: "وجدت أيضاً {{count}} وثيقة(وثائق) داخلية:"
  }
};

function getTranslation(lang, key, variables = {}) {
  const langKey = lang || 'fr';
  let text = translations[langKey]?.[key] || translations['fr'][key] || key;
  Object.keys(variables).forEach(varKey => {
    text = text.replace(new RegExp(`{{${varKey}}}`, 'g'), variables[varKey]);
  });
  return text;
}

export { detectLanguage };

export function extractEntities(text, language = 'fr') {
  const entities = { assetIds: [], assetTags: [], userMentions: [], urgencyKeywords: [], securityKeywords: [] };
  const assetTagPattern = /\b(ASSET-\d+|#\d+|[A-Z]{2,}-\d{3,})\b/gi;
  entities.assetTags = text.match(assetTagPattern) || [];
  const userMentionPattern = /@(\w+)/g;
  entities.userMentions = (text.match(userMentionPattern) || []).map(m => m.substring(1));
  const urgencyWords = { fr: ['urgent', 'urgence', 'vite', 'immédiatement', 'critique', 'bloquant', 'production'], en: ['urgent', 'urgency', 'quick', 'immediately', 'critical', 'blocking', 'production'], ar: ['عاجل', 'طارئ', 'سريع', 'فوري', 'حرج', 'محظور', 'إنتاج'] };
  const securityWords = SECURITY_KEYWORDS;
  const lowerText = text.toLowerCase();
  entities.urgencyKeywords = urgencyWords[language].filter(word => lowerText.includes(word));
  entities.securityKeywords = securityWords[language].filter(word => lowerText.includes(word));
  return entities;
}

export async function identifyAsset(text, userId, language = 'fr') {
  const entities = extractEntities(text, language);
  if (entities.assetTags.length > 0) {
    const { rows } = await pool.query('SELECT id, asset_tag, type, brand, model, status FROM assets WHERE asset_tag = $1', [entities.assetTags[0]]);
    if (rows.length > 0) return { asset: rows[0], confidence: 0.95, method: 'explicit_tag' };
  }
  const inventairePattern = /\b\d{4,}\b/;
  const inventaireMatch = text.match(inventairePattern);
  if (inventaireMatch) {
    const { rows } = await pool.query('SELECT id, asset_tag, type, brand, model, status FROM assets WHERE numero_inventaire_unique = $1', [inventaireMatch[0]]);
    if (rows.length > 0) return { asset: rows[0], confidence: 0.9, method: 'inventory_number' };
  }
  const assetTypes = { 'ordinateur': 'Ordinateur', 'pc': 'Ordinateur', 'poste': 'Ordinateur', 'serveur': 'Serveur', 'imprimante': 'Imprimante', 'écran': 'Ordinateur', 'ecran': 'Ordinateur', 'clavier': 'Ordinateur', 'souris': 'Ordinateur', 'computer': 'Ordinateur', 'laptop': 'Ordinateur', 'server': 'Serveur', 'printer': 'Imprimante', 'monitor': 'Ordinateur', 'keyboard': 'Ordinateur', 'mouse': 'Ordinateur', 'حاسوب': 'Ordinateur', 'كمبيوتر': 'Ordinateur', 'لابتوب': 'Ordinateur', 'خادم': 'Serveur', 'طابعة': 'Imprimante', 'شاشة': 'Ordinateur', 'لوحة مفاتيح': 'Ordinateur', 'فأرة': 'Ordinateur' };
  for (const [keyword, type] of Object.entries(assetTypes)) {
    if (text.toLowerCase().includes(keyword)) {
      const { rows } = await pool.query(`SELECT a.id, a.asset_tag, a.type, a.brand, a.model, a.status FROM assets a LEFT JOIN asset_assignments aa ON aa.asset_id = a.id WHERE a.type = $1 AND (aa.user_id = $2 OR a.assigned_to = $2) ORDER BY a.created_at DESC LIMIT 1`, [type, userId]);
      if (rows.length > 0) return { asset: rows[0], confidence: 0.7, method: 'user_context' };
    }
  }
  return { asset: null, confidence: 0, method: 'none' };
}

export function classifyTicket(text, sentiment, language = 'fr') {
  const { category: detectedCategory, maxMatches } = classifyCategoryByKeywords(text, language);
  let priority = 'Normale';
  if (sentiment.isCritical || sentiment.score >= 70) priority = 'Haute';
  else if (sentiment.score >= 40 || sentiment.emotions.includes('urgence')) priority = 'Moyenne';
  return { category: detectedCategory, priority, confidence: maxMatches > 0 ? Math.min(0.9, 0.5 + maxMatches * 0.1) : 0.3 };
}

export function detectSecurityIncident(text, sentiment, language = 'fr') {
  const lowerText = text.toLowerCase();
  const securityPatterns = [
    { pattern: /virus|malware|ransomware|فيروس|برمجية خبيثة|فدية/, severity: 'critical', type: 'Malware' },
    { pattern: /phishing|hameçonnage|تصيد/, severity: 'high', type: 'Phishing' },
    { pattern: /intrusion|piratage|hack|اختراق/, severity: 'critical', type: 'Intrusion' },
    { pattern: /fuite.*données|data.*leak|تسرب.*بيانات/, severity: 'critical', type: 'Data Leak' },
    { pattern: /accès.*non.*autorisé|وصول.*غير.*مصرح/, severity: 'high', type: 'Unauthorized Access' },
    { pattern: /attaque.*ddos|هجوم.*DDoS/, severity: 'high', type: 'DDoS' }
  ];
  for (const { pattern, severity, type } of securityPatterns) {
    if (pattern.test(lowerText)) return { isSecurityIncident: true, severity, type, autoCreateTicket: severity === 'critical' || sentiment.isCritical };
  }
  return { isSecurityIncident: false };
}

// ── Gestion de l'état conversationnel (Cache mémoire) ─────────────────────────

function createEmptyConversationState() {
  return { pendingAction: null, lastIntent: null, lastQuestion: null, lastResponse: null, lastKnowledge: [], lastArticles: [], lastDocuments: [], lastCategory: null, lastPriority: null, lastAsset: null, lastTechnician: null, createdAt: new Date() };
}

async function saveConversationState(sessionKey, state) { await saveToCache(sessionKey, state); }

async function loadConversationState(sessionKey) { return (await loadFromCache(sessionKey)) || createEmptyConversationState(); }

async function resetConversationState(sessionKey) { await resetCache(sessionKey); console.log(`[SmartAssistant] État réinitialisé pour session: ${sessionKey}`); }

// ── Détection d'intention avec contexte ───────────────────────────────────────

async function detectIntentWithContext(userMessage, sessionKey) {
  console.log(`[SmartAssistant] Détection intention: "${userMessage.substring(0, 50)}..."`);
  
  const result = await analyzeConversationIntent(userMessage, sessionKey, false, loadConversationState);
  
  console.log(`[SmartAssistant] Contexte: pendingAction=${result.pendingAction}, previousIntent=${result.previousIntent}`);
  if (result.intent === INTENTS.FOLLOW_UP) {
    console.log(`[SmartAssistant] 🔄 Question de suivi, contexte: ${result.previousIntent}`);
  }
  console.log(`[SmartAssistant] 🎯 Intention: ${result.intent}`);
  
  return result;
}

// ── Recherche combinée via l'architecture RAG modulaire ────────────────────────

async function searchAllSources(query, assetType = null) {
  console.log(`[SmartAssistant] 🔍 Recherche unifiée via RAG modulaire...`);
  
  // Utilise searchUnifiedKnowledge qui interroge TOUS les providers en parallèle :
  // KB + PDF vectoriel + Tickets résolus + Cas appris
  let unifiedResults = [];
  try {
    unifiedResults = await ragService.searchUnifiedKnowledge(query, 5);
    console.log(`[SmartAssistant] 📊 Résultats unifiés: ${unifiedResults.length} (toutes sources)`);
  } catch (e) {
    console.error(`[SmartAssistant] Erreur recherche unifiée: ${e.message}`);
  }
  
  // Séparer par source pour compatibilité avec le code existant
  const kbArticles = unifiedResults.filter(r => r.source_type === 'knowledge_base');
  const documents = unifiedResults.filter(r => r.source_type === 'internal_document');
  const resolvedTickets = unifiedResults.filter(r => r.source_type === 'resolved_ticket');
  const learnedCases = unifiedResults.filter(r => r.source_type === 'learned_case');
  
  if (resolvedTickets.length > 0) {
    console.log(`[SmartAssistant] 🎫 Tickets résolus trouvés: ${resolvedTickets.length}`);
  }
  if (learnedCases.length > 0) {
    console.log(`[SmartAssistant] 📋 Cas appris trouvés: ${learnedCases.length}`);
  }
  
  return { kbArticles, documents, resolvedTickets, learnedCases };
}

// ── Fonctions de fallback spécialisées ─────────────────────────────────────────

function fallbackProcedure(lang) {
  console.log(`[Fallback] Intent = ask_procedure`);
  console.log(`[Fallback] Aucune connaissance trouvée`);
  console.log(`[Fallback] Utilisation de fallbackProcedure()`);
  return "Je n'ai trouvé aucune procédure concernant cette demande dans la base de connaissances interne.\n\nSi vous le souhaitez, je peux créer un ticket afin qu'un technicien vous accompagne.";
}

function fallbackIncident(lang) {
  console.log(`[Fallback] Intent = incident`);
  console.log(`[Fallback] Aucune solution trouvée`);
  console.log(`[Fallback] Utilisation de fallbackIncident()`);
  return "Votre problème n'a pas de solution connue dans la base de connaissances.\n\nSouhaitez-vous créer un ticket ?";
}

function fallbackInformation(lang) {
  console.log(`[Fallback] Intent = information`);
  console.log(`[Fallback] Aucune information trouvée`);
  console.log(`[Fallback] Utilisation de fallbackInformation()`);
  return "Je n'ai trouvé aucune information dans la base de connaissances interne.";
}

function fallbackDefault(lang) {
  console.log(`[Fallback] Intent = default`);
  console.log(`[Fallback] Aucune connaissance trouvée`);
  console.log(`[Fallback] Utilisation de fallbackDefault()`);
  return "Je n'ai pas trouvé de réponse correspondante dans la base de connaissances.";
}

// ── Génération de réponse intelligente (synthèse RAG) ─────────────────────────

export async function generateResponse(analysisResult) {
  const { intent, entities, asset, sentiment, ticketClassification, mlPrediction, technicianRecommendation, kbArticles, securityIncident, ticketCreated } = analysisResult;
  const lang = detectLanguage(entities) || 'fr';

  // Cas spéciaux qui ne nécessitent pas de synthèse RAG
  if (intent === 'greeting') {
    return getTranslation(lang, 'greeting');
  }

  if (securityIncident?.isSecurityIncident) {
    let r = getTranslation(lang, 'security_incident_detected') + '\n' + getTranslation(lang, 'security_type', { type: securityIncident.type }) + '\n' + getTranslation(lang, 'security_severity', { severity: securityIncident.severity.toUpperCase() }) + '\n\n';
    if (ticketCreated) r += getTranslation(lang, 'security_ticket_created');
    else r += getTranslation(lang, 'security_ticket_suggestion');
    return r;
  }

  // Pour les intentions qui nécessitent une réponse RAG, on retourne null
  // pour signaler au pipeline qu'il faut utiliser le LLM
  // Les cas ci-dessous sont gérés directement (informations système)
  if (intent === 'ticket_create' || intent === 'ticket_status' || 
      intent === 'asset_locate' || intent === 'asset_status') {
    return null; // Sera géré par le pipeline RAG
  }

  // Pour les autres cas, on laisse le pipeline RAG générer la réponse
  return null;
}

// ── Pipeline principal ─────────────────────────────────────────────────────────

export async function processSmartMessage(userMessage, userId, sessionKey) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[SmartAssistant] 🚀 Message: "${userMessage.substring(0, 50)}..."`);
  console.log(`${'='.repeat(80)}`);
  
  const metrics = { intentDetection: 0, kbSearch: 0, pdfSearch: 0, ticketSearch: 0, reranking: 0, contextBuilding: 0, llmCall: 0, total: 0 };
  const startTime = Date.now();
  const language = detectLanguage(userMessage);
  console.log(`[SmartAssistant] 🌍 Langue: ${language}`);

  // ── ÉTAPE 1: Détection d'intention ────────────────────────────────────────
  const t1 = Date.now();
  console.log(`[SmartAssistant] 📋 ÉTAPE 1: Détection d'intention...`);
  const intentResult = await detectIntentWithContext(userMessage, sessionKey);
  const intent = intentResult.intent;
  metrics.intentDetection = Date.now() - t1;
  console.log(`[SmartAssistant] ✅ Intention: ${intent} (${metrics.intentDetection}ms)`);

  // ── ÉTAPE 2: Contexte conversationnel ─────────────────────────────────────
  console.log(`[SmartAssistant] 📚 ÉTAPE 2: Contexte...`);
  const conversationState = await loadConversationState(sessionKey);
  console.log(`[SmartAssistant] ✅ pendingAction=${conversationState.pendingAction}, lastIntent=${conversationState.lastIntent}`);

  // ── ÉTAPE 3: Gestion des confirmations/rejets ─────────────────────────────
  if (intent === INTENTS.CONFIRMATION || intent === INTENTS.REJECTION) {
    console.log(`[SmartAssistant] 🔄 ÉTAPE 3: Confirmation/Rejet...`);
    
    // Cas 1: Confirmation de création de ticket
    if (intent === INTENTS.CONFIRMATION && conversationState.pendingAction === 'create_ticket') {
      console.log(`[SmartAssistant] ✅ Confirmation création ticket`);
      console.log(`[SmartAssistant] ⏭️ Pas de RAG - action directe`);
      
      const originalMessage = conversationState.lastQuestion || userMessage;
      const sentiment = analyzeSentiment(originalMessage);
      const assetResult = await identifyAsset(originalMessage, userId, language);
      const securityIncident = detectSecurityIncident(originalMessage, sentiment, language);
      const ticketClassification = classifyTicket(originalMessage, sentiment, language);
      
      let technicianRecommendation = null;
      if (ticketClassification.category !== 'Autre') {
        try { technicianRecommendation = await recommendTechnician(ticketClassification.category, ticketClassification.priority); } catch (e) {}
      }
      
      try {
        const ticketCreated = await createSmartTicket({ userMessage: originalMessage, userId, asset: assetResult.asset, classification: ticketClassification, sentiment, mlPrediction: null, technician: technicianRecommendation?.recommended, securityIncident, language });
        console.log(`[SmartAssistant] 🎫 Ticket #${ticketCreated.id}`);
        
        if (ticketCreated.assigned_to) await notificationService.createNotification({ userId: ticketCreated.assigned_to, title: getTranslation(language, 'new_ticket_assigned'), message: getTranslation(language, 'new_ticket_message', { id: ticketCreated.id, title: ticketCreated.title }), ticketId: ticketCreated.id, assetId: ticketCreated.asset_id });
        await notificationService.createNotification({ userId, title: getTranslation(language, 'ticket_created_success'), message: getTranslation(language, 'ticket_created_message', { id: ticketCreated.id }), ticketId: ticketCreated.id, assetId: ticketCreated.asset_id });
        
        await resetConversationState(sessionKey);
        
        let response = `✅ **Ticket créé automatiquement**\n\n**Ticket #${ticketCreated.id}**\n**Titre**: ${ticketCreated.title}\n**Catégorie**: ${ticketClassification.category}\n**Priorité**: ${ticketClassification.priority}\n`;
        if (assetResult.asset) response += `**Équipement**: ${assetResult.asset.asset_tag}\n`;
        if (technicianRecommendation) response += `**Technicien assigné**: ${technicianRecommendation.recommended.username}\n`;
        response += `\n${getTranslation(language, 'notification_sent')}`;
        
        metrics.total = Date.now() - startTime;
        console.log(`[SmartAssistant] ✅ Terminé ${metrics.total}ms`);
        return { response, analysis: { intent: 'ticket_create', sentiment, asset: assetResult.asset, classification: ticketClassification, securityIncident, ticketCreated }, sources: [], metadata: { processingTime: metrics.total, entitiesDetected: true, ragUsed: false, contextualResponse: true } };
      } catch (error) {
        console.error('[SmartAssistant] Erreur création ticket:', error.message);
        await resetConversationState(sessionKey);
        metrics.total = Date.now() - startTime;
        return { response: "Désolé, une erreur est survenue lors de la création du ticket.", analysis: { intent: 'ticket_create', sentiment, ticketClassification }, sources: [], metadata: { processingTime: metrics.total, contextualResponse: true, error: true } };
      }
    }
    
    // Cas 2: Rejet de création de ticket
    if (intent === INTENTS.REJECTION && conversationState.pendingAction === 'create_ticket') {
      console.log(`[SmartAssistant] ❌ Création annulée`);
      await resetConversationState(sessionKey);
      metrics.total = Date.now() - startTime;
      return { response: getTranslation(language, 'rejection_response'), analysis: { intent: 'ticket_create', sentiment: { score: 0, sentiment: 'neutral' } }, sources: [], metadata: { processingTime: metrics.total, contextualResponse: true } };
    }
    
    // Cas 3: Incident résolu (Oui)
    if (intent === INTENTS.CONFIRMATION && conversationState.pendingAction === 'incident_resolved') {
      console.log(`[SmartAssistant] ✅ Incident résolu`);
      await resetConversationState(sessionKey);
      metrics.total = Date.now() - startTime;
      return { response: "Parfait ! N'hésitez pas à revenir vers moi si vous avez d'autres questions.", analysis: { intent: 'incident', sentiment: { score: 0, sentiment: 'positive' } }, sources: [], metadata: { processingTime: metrics.total, contextualResponse: true } };
    }
    
    // Cas 4: Incident non résolu (Non) → proposer ticket
    if (intent === INTENTS.REJECTION && conversationState.pendingAction === 'incident_resolved') {
      console.log(`[SmartAssistant] ❌ Incident non résolu → proposition ticket`);
      await resetConversationState(sessionKey);
      // Mettre pendingAction à create_ticket pour la prochaine réponse
      await saveConversationState(sessionKey, { ...createEmptyConversationState(), pendingAction: 'create_ticket', lastQuestion: conversationState.lastQuestion || userMessage });
      metrics.total = Date.now() - startTime;
      return { response: getTranslation(language, 'incident_ticket_proposal'), analysis: { intent: 'incident', sentiment: { score: 0, sentiment: 'negative' } }, sources: [], metadata: { processingTime: metrics.total, contextualResponse: true } };
    }
  }

  // ── ÉTAPE 4: Questions de suivi ───────────────────────────────────────────
  let enrichedUserMessage = userMessage;
  if (intent === INTENTS.FOLLOW_UP) {
    console.log(`[SmartAssistant] 🔄 ÉTAPE 4: Question de suivi...`);
    if (conversationState.lastQuestion) {
      enrichedUserMessage = `Contexte: ${conversationState.lastQuestion}\nQuestion: ${userMessage}`;
      console.log(`[SmartAssistant] ✅ Message enrichi`);
    } else {
      console.log(`[SmartAssistant] ⚠️ Aucun contexte`);
    }
  }

  // ── Analyse du message ────────────────────────────────────────────────────
  console.log(`[SmartAssistant] 📊 Analyse...`);
  const sentiment = analyzeSentiment(userMessage);
  const entities = extractEntities(userMessage, language);
  const assetResult = await identifyAsset(userMessage, userId, language);
  const securityIncident = detectSecurityIncident(userMessage, sentiment, language);
  const ticketClassification = classifyTicket(userMessage, sentiment, language);
  
  if (securityIncident.isSecurityIncident) console.log(`[SmartAssistant] 🚨 Incident sécurité:`, securityIncident);

  let mlPrediction = null;
  if (assetResult.asset) {
    try { mlPrediction = await getRiskScore(assetResult.asset.id); if (mlPrediction) await saveRiskScore(assetResult.asset.id, mlPrediction.risk_score, mlPrediction.risk_level); } catch (e) {}
  }

  let technicianRecommendation = null;
  if (ticketClassification.category !== 'Autre') {
    try { technicianRecommendation = await recommendTechnician(ticketClassification.category, ticketClassification.priority); } catch (e) {}
  }

  // ── ÉTAPE 5: Recherche dans les sources de connaissance ────────────────────
  console.log(`[SmartAssistant] 🔍 ÉTAPE 5: Recherche de connaissances...`);
  console.log(`[SmartAssistant] 🛤️ Pipeline: ${intent}`);
  
  let kbArticles = [];
  let documents = [];
  let unifiedKnowledge = [];
  let response = null;
  let ragUsed = false;
  let shouldProposeTicket = false;

  // Toujours faire une nouvelle recherche, même pour les follow_up
  // Le contexte conversationnel est déjà enrichi dans enrichedUserMessage (ligne 497)
  // On ne réutilise JAMAIS les anciens résultats de recherche (lastKnowledge)
  if (intent !== INTENTS.GREETING && intent !== INTENTS.CONFIRMATION && intent !== INTENTS.REJECTION) {
    // RECHERCHE UNIFIÉE UNIQUE : une seule interrogation de tous les providers
    // (KB + PDF vectoriel + Tickets résolus + Cas appris en parallèle)
    const tSearch = Date.now();
    try {
      unifiedKnowledge = await ragService.searchUnifiedKnowledge(enrichedUserMessage, 5);
      
      // Profiling détaillé par source
      const bySource = {};
      unifiedKnowledge.forEach(r => {
        const src = r.source_type || r.provider || 'unknown';
        bySource[src] = (bySource[src] || 0) + 1;
      });
      
      metrics.vectorSearch = Date.now() - tSearch;
      console.log(`[SmartAssistant] 📊 Résultats unifiés: ${unifiedKnowledge.length} (toutes sources) en ${metrics.vectorSearch}ms`);
      console.log(`[SmartAssistant] 📈 Détail par source:`, JSON.stringify(bySource));
      
      // Debug: afficher le contenu brut récupéré
      if (process.env.RAG_DEBUG_MODE === 'true') {
        console.log(`[SmartAssistant] 🔍 DEBUG - Contenu brut des sources:`);
        unifiedKnowledge.forEach((r, i) => {
          console.log(`[SmartAssistant]   [${i + 1}] ${r.source_type || r.provider} | Score: ${(r.hybrid_score || 0).toFixed(2)} | ${(r.title || '').substring(0, 60)}`);
          console.log(`[SmartAssistant]        Contenu (${(r.content || '').length} chars): ${(r.content || '').substring(0, 150)}...`);
        });
      }
    } catch (e) { 
      console.error('[SmartAssistant] Erreur recherche unifiée:', e.message); 
      metrics.vectorSearch = Date.now() - tSearch;
    }
    
    // Extraire les KB articles pour compatibilité
    kbArticles = unifiedKnowledge.filter(r => r.source_type === 'knowledge_base');
    documents = unifiedKnowledge.filter(r => r.source_type === 'internal_document');
    
    const resolvedTickets = unifiedKnowledge.filter(r => r.source_type === 'resolved_ticket');
    const learnedCases = unifiedKnowledge.filter(r => r.source_type === 'learned_case');
    
    if (resolvedTickets.length > 0) console.log(`[SmartAssistant] 🎫 Tickets résolus: ${resolvedTickets.length}`);
    if (learnedCases.length > 0) console.log(`[SmartAssistant] 📋 Cas appris: ${learnedCases.length}`);
  }

  // ── ÉTAPE 6: Génération de la réponse (synthèse RAG ou fallback) ───────────
  const analysisResult = { intent, entities, asset: assetResult.asset, sentiment, ticketClassification, mlPrediction, technicianRecommendation, kbArticles, learnedCases: [], securityIncident, ticketCreated: null };

  // Essayer d'abord la génération intelligente (greeting, sécurité → réponse directe)
  // Pour les autres cas, generateResponse() retourne null → on utilise le RAG
  let templateResponse = await generateResponse(analysisResult);

  if (templateResponse !== null) {
    // Cas spéciaux gérés directement (greeting, sécurité)
    response = templateResponse;
    shouldProposeTicket = false;
    ragUsed = false;
    console.log(`[SmartAssistant] ✅ Réponse directe (template)`);
  } else if (intent === INTENTS.TICKET_CREATE) {
    // Création automatique de ticket
    console.log(`[SmartAssistant] 🛤️ Pipeline: CREATION TICKET`);
    let ticketCreated = null;
    try {
      ticketCreated = await createSmartTicket({ userMessage, userId, asset: assetResult.asset, classification: ticketClassification, sentiment, mlPrediction, technician: technicianRecommendation?.recommended, securityIncident, language });
      console.log(`[SmartAssistant] ✅ Ticket #${ticketCreated.id}`);
    } catch (e) { console.error('[SmartAssistant] Erreur création ticket:', e.message); }
    analysisResult.ticketCreated = ticketCreated;
    response = getTranslation(language, 'ticket_created_auto');
    shouldProposeTicket = false;
  } else if (intent === INTENTS.SECURITY_INCIDENT) {
    console.log(`[SmartAssistant] 🛤️ Pipeline: SECURITE`);
    let ticketCreated = null;
    if (securityIncident.autoCreateTicket) {
      try { ticketCreated = await createSmartTicket({ userMessage, userId, asset: assetResult.asset, classification: ticketClassification, sentiment, mlPrediction, technician: technicianRecommendation?.recommended, securityIncident, language }); } catch (e) {}
    }
    analysisResult.ticketCreated = ticketCreated;
    response = getTranslation(language, 'security_incident_detected');
    shouldProposeTicket = false;
  } else if (unifiedKnowledge.length > 0) {
    // ✅ SYNTHÈSE RAG : utiliser le LLM pour produire une réponse experte
    console.log(`[SmartAssistant] 🧠 Pipeline: SYNTHÈSE RAG (${unifiedKnowledge.length} sources)`);
    console.log(`[SmartAssistant] ⏭️ Appel à Ollama pour synthèse experte`);
    
    try {
      // Pour le prompt Ollama, on utilise le message original (sans le préfixe "Contexte: ...")
      // Le contexte enrichi a déjà servi pour la recherche des sources pertinentes
      const ollamaMessage = intent === INTENTS.FOLLOW_UP ? userMessage : enrichedUserMessage;
      // Historique minimal : on ne passe PAS la réponse complète précédente
      // pour éviter que le modèle recopie le titre/format de l'ancienne réponse
      // On passe juste la question précédente pour le contexte
      const history = conversationState.lastQuestion ? [
        { role: 'user', content: conversationState.lastQuestion },
        { role: 'assistant', content: `[Réponse précédente sur le sujet: ${conversationState.lastQuestion.substring(0, 50)}]` },
      ] : [];
      const ragResult = await ragService.processRagQuery({
        userMessage: ollamaMessage,
        conversationHistory: history,
        analysis: {
          intent,
          sentiment,
          ticketClassification,
        },
        maxKbArticles: 5,
      });
      
      response = ragResult.response;
      ragUsed = true;
      
      if (ragResult.pipelineMetrics) {
        metrics.llmCall = ragResult.pipelineMetrics.steps.llmCall || 0;
      }
      
      console.log(`[SmartAssistant] ✅ Synthèse RAG terminée`);
    } catch (ragError) {
      console.error(`[SmartAssistant] ❌ Erreur synthèse RAG: ${ragError.message}`);
      // Fallback si le RAG échoue
      response = "Je n'ai pas trouvé d'information sur ce sujet dans les connaissances internes de la plateforme. Souhaitez-vous que je crée un ticket pour qu'un expert vous aide ?";
    }
    shouldProposeTicket = false;
  } else {
    // Aucune connaissance trouvée → fallback
    console.log(`[SmartAssistant] ⚠️ Aucune connaissance trouvée - fallback`);
    response = "Je n'ai pas trouvé d'information sur ce sujet dans les connaissances internes de la plateforme. Souhaitez-vous que je crée un ticket pour qu'un expert vous aide ?";
    shouldProposeTicket = true;
  }

  // ── ÉTAPE 7: Sauvegarde état ──────────────────────────────────────────────
  console.log(`[SmartAssistant] 💾 ÉTAPE 7: Sauvegarde état conversation...`);
  const newPendingAction = shouldProposeTicket ? 'create_ticket' : (conversationState.pendingAction === 'incident_resolved' ? 'incident_resolved' : null);
  await saveConversationState(sessionKey, {
    pendingAction: newPendingAction,
    lastIntent: intent,
    lastQuestion: userMessage,
    lastResponse: response,
    lastKnowledge: unifiedKnowledge,
    lastArticles: kbArticles,
    lastDocuments: [],
    lastCategory: ticketClassification.category,
    lastPriority: ticketClassification.priority,
    lastAsset: assetResult.asset,
    lastTechnician: technicianRecommendation?.recommended,
    createdAt: conversationState.createdAt
  });

  // ── Notifications ────────────────────────────────────────────────────────
  if (analysisResult.ticketCreated) {
    try {
      if (analysisResult.ticketCreated.assigned_to) await notificationService.createNotification({ userId: analysisResult.ticketCreated.assigned_to, title: getTranslation(language, 'new_ticket_assigned'), message: getTranslation(language, 'new_ticket_message', { id: analysisResult.ticketCreated.id, title: analysisResult.ticketCreated.title }), ticketId: analysisResult.ticketCreated.id, assetId: analysisResult.ticketCreated.asset_id });
      await notificationService.createNotification({ userId, title: getTranslation(language, 'ticket_created_success'), message: getTranslation(language, 'ticket_created_message', { id: analysisResult.ticketCreated.id }), ticketId: analysisResult.ticketCreated.id, assetId: analysisResult.ticketCreated.asset_id });
      if (securityIncident.isSecurityIncident) await notifySecurityAdmins(analysisResult.ticketCreated, securityIncident, language);
    } catch (e) { console.error('[SmartAssistant] Erreur notifications:', e.message); }
  }

  // ── Résultat ──────────────────────────────────────────────────────────────
  metrics.total = Date.now() - startTime;
  
  // PROFILING COMPLET: afficher les temps de chaque étape
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`[SmartAssistant] 📊 PROFILING COMPLET - "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
  console.log(`[SmartAssistant] ⏱️  Temps total: ${metrics.total}ms`);
  console.log(`[SmartAssistant]   ① Détection intention:  ${metrics.intentDetection}ms`);
  console.log(`[SmartAssistant]   ② Recherche KB/PDF/Tickets: ${metrics.vectorSearch}ms`);
  if (metrics.llmCall > 0) console.log(`[SmartAssistant]   ③ Génération Ollama:   ${metrics.llmCall}ms`);
  console.log(`[SmartAssistant]   ─────────────────────────────`);
  console.log(`[SmartAssistant]   TOTAL:                 ${metrics.total}ms`);
  console.log(`[SmartAssistant]   🎯 Intention:          ${intent}`);
  console.log(`[SmartAssistant]   🎫 Ticket proposé:      ${shouldProposeTicket ? 'OUI' : 'NON'}`);
  console.log(`[SmartAssistant]   🧠 RAG utilisé:         ${ragUsed ? 'OUI' : 'NON'}`);
  console.log(`[SmartAssistant]   📚 Sources trouvées:    ${unifiedKnowledge.length}`);
  console.log(`[SmartAssistant]   💾 Cache contexte:      NON (toujours nouvelle recherche)`);
  console.log(`${'═'.repeat(80)}\n`);
  
  // Debug: afficher le contexte envoyé à Ollama
  if (process.env.RAG_DEBUG_MODE === 'true' && ragUsed) {
    console.log(`[SmartAssistant] 🔍 DEBUG - Réponse finale:`);
    console.log(`[SmartAssistant]   Longueur: ${response?.length || 0} caractères`);
    console.log(`[SmartAssistant]   Preview: "${response?.substring(0, 200)}..."`);
  }

  return {
    response,
    analysis: { intent, sentiment, asset: assetResult.asset, classification: ticketClassification, mlPrediction, technician: technicianRecommendation?.recommended, securityIncident, ticketCreated: analysisResult.ticketCreated },
    sources: kbArticles.map(a => ({ id: a.id, title: a.title, summary: a.summary, type: 'knowledge_base' })),
    metadata: { processingTime: metrics.total, entitiesDetected: Object.values(entities).some(arr => arr.length > 0), ragUsed, unifiedKnowledgeCount: unifiedKnowledge.length, kbArticlesCount: kbArticles.length, metrics }
  };
}

// ── Recherche dans les cas appris (legacy chatbot, table chatbot_learned_cases) ─

export async function searchLearnedCases(keywords) {
  // Délègue à la fonction partagée dans ragService.js
  const { searchLearnedCases: searchShared } = await import('./ragService.js');
  return searchShared(keywords);
}

/**
 * Apprendre à partir d'un ticket résolu (insère dans chatbot_learned_cases)
 * Délègue à la fonction partagée dans ragService.js
 * @param {number} ticketId - ID du ticket résolu
 */
export async function learnFromTicket(ticketId) {
  return learnFromTicketShared(ticketId);
}

/**
 * Apprendre à partir d'un article de la base de connaissances
 * Délègue à la fonction partagée dans ragService.js
 * @param {number} articleId - ID de l'article KB
 */
export async function learnFromArticle(articleId) {
  return learnFromArticleShared(articleId);
}

/**
 * Synchronisation en masse des cas appris depuis les tickets résolus et les articles KB
 * @returns {Promise<{synced_tickets: number, synced_articles: number}>}
 */
export async function syncAll() {
  // Délègue à la fonction partagée dans ragService.js
  const { syncAll: syncAllShared } = await import('./ragService.js');
  return syncAllShared();
}

// ── Fonctions utilitaires ──────────────────────────────────────────────────────

async function searchKBEnhanced(query, assetType = null) {
  return await searchKnowledgeBase(query, { assetType, language: 'fr', limit: 5 });
}

async function createSmartTicket({ userMessage, userId, asset, classification, sentiment, mlPrediction, technician, securityIncident, language }) {
  const title = securityIncident.isSecurityIncident 
    ? getTranslation(language, 'ticket_title_security', { type: securityIncident.type, message: userMessage.substring(0, 100) })
    : userMessage.substring(0, 100);

  const description = getTranslation(language, 'ticket_description', {
    message: userMessage,
    category: classification.category,
    priority: classification.priority,
    sentiment: sentiment.sentiment,
    score: sentiment.score
  });
  
  if (asset) {
    description += getTranslation(language, 'ticket_asset', { tag: asset.asset_tag, id: asset.id });
  }
  
  if (mlPrediction) {
    description += getTranslation(language, 'ticket_ml_risk', { risk_level: mlPrediction.risk_level, risk_score: mlPrediction.risk_score });
  }
  
  if (sentiment.isCritical) {
    description += `\n${getTranslation(language, 'security_alert')}\n`;
  }

  if (securityIncident.isSecurityIncident) {
    description += `\n${getTranslation(language, 'security_incident_section', { type: securityIncident.type, severity: securityIncident.severity })}`;
  }

  const ticketData = {
    title,
    description,
    category: classification.category,
    priority: classification.priority,
    status: 'Nouveau',
    created_by: userId,
    asset_id: asset?.id || null,
    sentiment: sentiment.sentiment,
    sentiment_score: sentiment.score,
    sentiment_emotions: JSON.stringify(sentiment.emotions),
    sentiment_intensity: sentiment.intensity,
    sentiment_is_critical: sentiment.isCritical,
    sentiment_analyzed_at: new Date(),
    is_auto_generated: true,
    auto_trigger_type: 'smart_assistant'
  };

  if (securityIncident.isSecurityIncident) {
    ticketData.priority = 'Critique';
  }

  const mockReq = { body: ticketData, user: { id: userId } };
  const mockRes = {
    json: (data) => data,
    status: () => ({ json: (data) => data })
  };
  
  const ticketResult = await createTicket(mockReq, mockRes);
  const ticket = ticketResult.data || ticketResult;

  if (technician && ticket.id) {
    const assignReq = { params: { id: ticket.id }, body: { assigned_to: technician.id }, user: { id: userId } };
    const assignRes = {
      json: (data) => data,
      status: () => ({ json: (data) => data })
    };
    await assignTicket(assignReq, assignRes);
  }

  return ticket;
}

async function notifySecurityAdmins(ticket, securityIncident, language) {
  try {
    const { rows: admins } = await pool.query(
      `SELECT u.id, u.email, u.username
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('Admin', 'Administrateur') 
         AND u.status = 'active'
         AND u.email_notifications = true`
    );

    for (const admin of admins) {
      await notificationService.createNotification({
        userId: admin.id,
        title: getTranslation(language, 'security_incident_notification'),
        message: getTranslation(language, 'security_notification_message', { 
          id: ticket.id, 
          type: securityIncident.type, 
          severity: securityIncident.severity 
        }),
        ticketId: ticket.id
      });

      try {
        const emailService = (await import('./emailService.js')).default;
        await emailService.sendEmail({
          to: admin.email,
          subject: getTranslation(language, 'email_subject_security', { type: securityIncident.type }),
          body: getTranslation(language, 'email_body_security', {
            username: admin.username,
            id: ticket.id,
            type: securityIncident.type,
            severity: securityIncident.severity,
            description: ticket.description
          })
        });
      } catch (emailError) {
        console.error('[SmartAssistant] Erreur envoi email sécurité:', emailError.message);
      }
    }
  } catch (error) {
    console.error('[SmartAssistant] Erreur notification admins sécurité:', error.message);
  }
}

// Fonctions helper (à importer depuis les contrôleurs)
async function createTicket(req, res) {
  const { default: ticketController } = await import('../controllers/ticketController.js');
  return ticketController.createTicket(req, res);
}

async function assignTicket(req, res) {
  const { default: ticketController } = await import('../controllers/ticketController.js');
  return ticketController.assignTicket(req, res);
}

// Export des fonctions internes pour les tests
export {
  createEmptyConversationState,
  saveConversationState,
  loadConversationState,
  resetConversationState,
  detectIntentWithContext
};

export default {
  processSmartMessage,
  extractEntities,
  identifyAsset,
  classifyTicket,
  detectSecurityIncident,
  detectLanguage,
  createSmartTicket,
  notifySecurityAdmins,
  searchLearnedCases,
  learnFromTicket,
  learnFromArticle,
  syncAll
};