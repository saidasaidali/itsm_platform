// backend/src/services/smartAssistantService.js
// Smart IT Assistant - Orchestration de tous les services intelligents
import pool from '../db.js';
import { analyzeSentiment } from './sentimentAnalyzer.js';
import { recommendTechnician } from './technicianRecommender.js';
import { getRiskScore, saveRiskScore } from './mlService.js';
import { getAssetLiveProfile } from './networkDiscovery/digitalTwin.js';
import notificationService from './notificationService.js';
import { detectLanguage, classifyCategoryByKeywords, SECURITY_KEYWORDS } from '../utils/nlpUtils.js';
import { detectIntent } from './intentService.js';
import { searchKnowledgeBase } from './knowledgeBaseSearch.js';

/**
 * Pipeline complet du Smart IT Assistant
 * 
 * Flux: User Message → Intent Analysis → Entity Extraction → 
 *       Asset Identification → Sentiment Analysis → 
 *       ML Risk Prediction → Technician Recommendation → 
 *       Knowledge Base Search → Response Generation → 
 *       (Optional) Auto Ticket Creation → Notification
 */

// ── Détection de langue ────────────────────────────────────────────────────────

export { detectLanguage };

// ── Extraction d'entités (Asset ID, User mentions, etc.) ──────────────────────

export function extractEntities(text, language = 'fr') {
  const entities = {
    assetIds: [],
    assetTags: [],
    userMentions: [],
    urgencyKeywords: [],
    securityKeywords: []
  };

  const assetTagPattern = /\b(ASSET-\d+|#\d+|[A-Z]{2,}-\d{3,})\b/gi;
  const assetTagMatches = text.match(assetTagPattern) || [];
  entities.assetTags = assetTagMatches;

  const userMentionPattern = /@(\w+)/g;
  const userMentionMatches = text.match(userMentionPattern) || [];
  entities.userMentions = userMentionMatches.map(m => m.substring(1));

  const urgencyWords = {
    fr: ['urgent', 'urgence', 'vite', 'immédiatement', 'critique', 'bloquant', 'production'],
    en: ['urgent', 'urgency', 'quick', 'immediately', 'critical', 'blocking', 'production'],
    ar: ['عاجل', 'طارئ', 'سريع', 'فوري', 'حرج', 'محظور', 'إنتاج']
  };

  const securityWords = SECURITY_KEYWORDS;

  const lowerText = text.toLowerCase();
  entities.urgencyKeywords = urgencyWords[language].filter(word => lowerText.includes(word));
  entities.securityKeywords = securityWords[language].filter(word => lowerText.includes(word));

  return entities;
}

// ── Identification de l'asset concerné ────────────────────────────────────────

export async function identifyAsset(text, userId, language = 'fr') {
  const entities = extractEntities(text, language);
  
  if (entities.assetTags.length > 0) {
    const { rows } = await pool.query(
      'SELECT id, asset_tag, type, brand, model, status FROM assets WHERE asset_tag = $1',
      [entities.assetTags[0]]
    );
    if (rows.length > 0) return { asset: rows[0], confidence: 0.95, method: 'explicit_tag' };
  }

  const inventairePattern = /\b\d{4,}\b/;
  const inventaireMatch = text.match(inventairePattern);
  if (inventaireMatch) {
    const { rows } = await pool.query(
      'SELECT id, asset_tag, type, brand, model, status FROM assets WHERE numero_inventaire_unique = $1',
      [inventaireMatch[0]]
    );
    if (rows.length > 0) return { asset: rows[0], confidence: 0.9, method: 'inventory_number' };
  }

  const assetTypes = {
    'ordinateur': 'Ordinateur', 'pc': 'Ordinateur', 'poste': 'Ordinateur',
    'serveur': 'Serveur', 'imprimante': 'Imprimante', 'écran': 'Ordinateur',
    'ecran': 'Ordinateur', 'clavier': 'Ordinateur', 'souris': 'Ordinateur',
    'computer': 'Ordinateur', 'laptop': 'Ordinateur', 'server': 'Serveur',
    'printer': 'Imprimante', 'monitor': 'Ordinateur', 'keyboard': 'Ordinateur',
    'mouse': 'Ordinateur',
    'حاسوب': 'Ordinateur', 'كمبيوتر': 'Ordinateur', 'لابتوب': 'Ordinateur',
    'خادم': 'Serveur', 'طابعة': 'Imprimante', 'شاشة': 'Ordinateur',
    'لوحة مفاتيح': 'Ordinateur', 'فأرة': 'Ordinateur'
  };

  for (const [keyword, type] of Object.entries(assetTypes)) {
    if (text.toLowerCase().includes(keyword)) {
      const { rows } = await pool.query(
        `SELECT a.id, a.asset_tag, a.type, a.brand, a.model, a.status
         FROM assets a
         LEFT JOIN asset_assignments aa ON aa.asset_id = a.id
         WHERE a.type = $1 
           AND (aa.user_id = $2 OR a.assigned_to = $2)
         ORDER BY a.created_at DESC
         LIMIT 1`,
        [type, userId]
      );
      if (rows.length > 0) return { asset: rows[0], confidence: 0.7, method: 'user_context' };
    }
  }

  return { asset: null, confidence: 0, method: 'none' };
}

// ── Classification intelligente de ticket ──────────────────────────────────────

export function classifyTicket(text, sentiment, language = 'fr') {
  const { category: detectedCategory, maxMatches } = classifyCategoryByKeywords(text, language);

  let priority = 'Normale';
  if (sentiment.isCritical || sentiment.score >= 70) {
    priority = 'Haute';
  } else if (sentiment.score >= 40 || sentiment.emotions.includes('urgence')) {
    priority = 'Moyenne';
  }

  return {
    category: detectedCategory,
    priority,
    confidence: maxMatches > 0 ? Math.min(0.9, 0.5 + maxMatches * 0.1) : 0.3
  };
}

// ── Détection d'incidents de sécurité ─────────────────────────────────────────

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
    if (pattern.test(lowerText)) {
      return {
        isSecurityIncident: true,
        severity,
        type,
        autoCreateTicket: severity === 'critical' || sentiment.isCritical
      };
    }
  }

  return { isSecurityIncident: false };
}

// ── Génération de réponse intelligente ────────────────────────────────────────

export async function generateResponse(analysisResult) {
  const {
    intent,
    entities,
    asset,
    sentiment,
    ticketClassification,
    mlPrediction,
    technicianRecommendation,
    kbArticles,
    securityIncident,
    ticketCreated
  } = analysisResult;

  let response = '';

  if (securityIncident?.isSecurityIncident) {
    response += `🚨 **INCIDENT DE SÉCURITÉ DÉTECTÉ**\n`;
    response += `Type: ${securityIncident.type}\n`;
    response += `Sévérité: ${securityIncident.severity.toUpperCase()}\n\n`;
    
    if (ticketCreated) {
      response += `Un ticket critique a été créé automatiquement et l'équipe de sécurité a été notifiée.\n`;
    } else {
      response += `Je vous recommande de créer un ticket immédiatement pour signaler cet incident.\n`;
    }
    return response;
  }

  let liveProfile = null;
  if (intent === 'asset_status' && asset) {
    try {
      liveProfile = await getAssetLiveProfile(asset.id);
    } catch (error) {
      console.error('[SmartAssistant] Erreur récupération profil live:', error.message);
    }
  }

  switch (intent) {
    case 'greeting':
      response = 'Bonjour ! Je suis votre assistant IT intelligent. Comment puis-je vous aider aujourd\'hui ?';
      break;

    case 'ticket_create':
      response = `Je vais vous aider à créer un ticket.\n\n`;
      
      if (asset) {
        response += `📱 **Asset identifié**: ${asset.asset_tag} (${asset.type} - ${asset.brand} ${asset.model})\n`;
      }
      
      response += `📋 **Catégorie**: ${ticketClassification.category}\n`;
      response += `⚡ **Priorité suggérée**: ${ticketClassification.priority}\n`;
      
      if (sentiment.isCritical) {
        response += `\n⚠️ **Attention**: Votre message indique un niveau d'urgence élevé (score: ${sentiment.score}/100).\n`;
      }
      
      if (mlPrediction) {
        response += `\n🔮 **Prédiction ML**: Risque de panne: ${mlPrediction.risk_level} (score: ${mlPrediction.risk_score}/100)\n`;
      }
      
      if (technicianRecommendation) {
        response += `\n👨‍🔧 **Technicien recommandé**: ${technicianRecommendation.recommended.username}`;
        response += ` (score: ${technicianRecommendation.recommended.score}/100)\n`;
      }
      
      response += `\n✅ Ticket créé automatiquement avec toutes ces informations.`;
      
      if (ticketCreated) {
        response += `\n📧 Une notification a été envoyée au technicien assigné.`;
      }
      break;

    case 'ticket_status':
      response = 'Je vais consulter le statut de vos tickets. Pour quel ticket souhaitez-vous avoir des informations ?';
      break;

    case 'asset_locate':
      if (asset) {
        response = `J'ai trouvé l'équipement :\n`;
        response += `- **Tag**: ${asset.asset_tag}\n`;
        response += `- **Type**: ${asset.type}\n`;
        response += `- **Statut**: ${asset.status}\n`;
        response += `- **Localisation**: ${asset.location || 'Non spécifiée'}\n`;
      } else {
        response = 'Je n\'ai pas pu identifier l\'équipement dont vous parlez. Pouvez-vous me donner son numéro d\'inventaire ou sa référence ?';
      }
      break;

    case 'asset_status':
      if (asset) {
        response = `**État de l'équipement ${asset.asset_tag}**:\n`;
        response += `- Statut: ${asset.status}\n`;
        
        if (liveProfile) {
          response += `- En ligne: ${liveProfile.is_online ? '✅ Oui' : '❌ Non'}\n`;
          if (liveProfile.is_online) {
            response += `- CPU: ${liveProfile.cpu_usage}%\n`;
            response += `- RAM: ${liveProfile.ram_usage}%\n`;
            response += `- Utilisateur connecté: ${liveProfile.logged_in_user || 'Aucun'}\n`;
          }
        }

        if (mlPrediction) {
          response += `\n🔮 **Analyse prédictive**: Risque de panne dans les 7 jours: ${mlPrediction.risk_level}`;
        }
      } else {
        response = 'Je n\'ai pas identifié l\'équipement. Pouvez-vous préciser de quel équipement il s\'agit ?';
      }
      break;

    case 'kb_search':
      if (kbArticles && kbArticles.length > 0) {
        response = `J'ai trouvé ${kbArticles.length} article(s) dans la base de connaissances :\n\n`;
        kbArticles.forEach((article, idx) => {
          response += `${idx + 1}. **${article.title}**\n`;
          response += `   ${article.summary}\n\n`;
        });
      } else {
        response = 'Je n\'ai pas trouvé d\'article correspondant dans la base de connaissances. ';
        response += 'Souhaitez-vous que je crée un ticket pour que nos experts puissent vous aider ?';
      }
      break;

    default:
      response = 'Je comprends votre demande. ';
      
      if (asset) {
        response += `Je vois que vous mentionnez l'équipement ${asset.asset_tag}. `;
      }
      
      if (kbArticles && kbArticles.length > 0) {
        response += `Voici des articles qui pourraient vous aider :\n\n`;
        kbArticles.forEach((article, idx) => {
          response += `${idx + 1}. ${article.title}\n`;
        });
      } else {
        response += 'Souhaitez-vous créer un ticket pour obtenir de l\'aide ?';
      }
  }

  return response;
}

// ── Pipeline principal ─────────────────────────────────────────────────────────

export async function processSmartMessage(userMessage, userId, sessionKey) {
  console.log(`[SmartAssistant] Traitement du message: "${userMessage.substring(0, 50)}..."`);
  
  const startTime = Date.now();

  const language = detectLanguage(userMessage);
  console.log(`[SmartAssistant] Langue détectée: ${language}`);

  const sentiment = analyzeSentiment(userMessage);
  console.log(`[SmartAssistant] Sentiment: ${sentiment.sentiment} (score: ${sentiment.score}/100)`);

  const entities = extractEntities(userMessage, language);
  console.log(`[SmartAssistant] Entités extraites:`, entities);

  const assetResult = await identifyAsset(userMessage, userId, language);
  console.log(`[SmartAssistant] Asset identifié:`, assetResult);

  const securityIncident = detectSecurityIncident(userMessage, sentiment, language);
  if (securityIncident.isSecurityIncident) {
    console.log(`[SmartAssistant] 🚨 Incident de sécurité détecté:`, securityIncident);
  }

  const ticketClassification = classifyTicket(userMessage, sentiment, language);
  console.log(`[SmartAssistant] Classification:`, ticketClassification);

  let mlPrediction = null;
  if (assetResult.asset) {
    try {
      mlPrediction = await getRiskScore(assetResult.asset.id);
      if (mlPrediction) {
        console.log(`[SmartAssistant] Prédiction ML:`, mlPrediction);
        await saveRiskScore(assetResult.asset.id, mlPrediction.risk_score, mlPrediction.risk_level);
      }
    } catch (error) {
      console.error('[SmartAssistant] Erreur prédiction ML:', error.message);
    }
  }

  let technicianRecommendation = null;
  if (ticketClassification.category !== 'Autre') {
    try {
      technicianRecommendation = await recommendTechnician(ticketClassification.category, ticketClassification.priority);
      console.log(`[SmartAssistant] Technicien recommandé:`, technicianRecommendation?.recommended?.username);
    } catch (error) {
      console.error('[SmartAssistant] Erreur recommandation technicien:', error.message);
    }
  }

  const kbArticles = await searchKBEnhanced(userMessage, assetResult.asset?.type);
  console.log(`[SmartAssistant] Articles KB trouvés: ${kbArticles.length}`);

  const intent = detectIntent(userMessage, securityIncident.isSecurityIncident, language);

  let ticketCreated = null;
  const shouldAutoCreate = 
    intent === 'ticket_create' ||
    securityIncident.autoCreateTicket ||
    (sentiment.isCritical && ticketClassification.confidence > 0.5);

  if (shouldAutoCreate) {
    try {
      ticketCreated = await createSmartTicket({
        userMessage,
        userId,
        asset: assetResult.asset,
        classification: ticketClassification,
        sentiment,
        mlPrediction,
        technician: technicianRecommendation?.recommended,
        securityIncident
      });
      console.log(`[SmartAssistant] Ticket créé: #${ticketCreated.id}`);
    } catch (error) {
      console.error('[SmartAssistant] Erreur création ticket:', error.message);
    }
  }

  const analysisResult = {
    intent,
    entities,
    asset: assetResult.asset,
    sentiment,
    ticketClassification,
    mlPrediction,
    technicianRecommendation,
    kbArticles,
    securityIncident,
    ticketCreated
  };

  const response = generateResponse(analysisResult);

  if (ticketCreated) {
    try {
      if (ticketCreated.assigned_to) {
        await notificationService.createNotification({
          userId: ticketCreated.assigned_to,
          title: 'Nouveau ticket assigné',
          message: `Ticket #${ticketCreated.id} - ${ticketCreated.title}`,
          ticketId: ticketCreated.id,
          assetId: ticketCreated.asset_id
        });
      }

      await notificationService.createNotification({
        userId,
        title: 'Ticket créé avec succès',
        message: `Votre ticket #${ticketCreated.id} a été créé et assigné.`,
        ticketId: ticketCreated.id,
        assetId: ticketCreated.asset_id
      });

      if (securityIncident.isSecurityIncident) {
        await notifySecurityAdmins(ticketCreated, securityIncident);
      }
    } catch (error) {
      console.error('[SmartAssistant] Erreur notifications:', error.message);
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`[SmartAssistant] Traitement terminé en ${processingTime}ms`);

  return {
    response,
    analysis: {
      intent,
      sentiment,
      asset: assetResult.asset,
      classification: ticketClassification,
      mlPrediction,
      technician: technicianRecommendation?.recommended,
      securityIncident,
      ticketCreated
    },
    sources: kbArticles.map(a => ({
      id: a.id,
      title: a.title,
      summary: a.summary
    })),
    metadata: {
      processingTime,
      entitiesDetected: Object.values(entities).some(arr => arr.length > 0)
    }
  };
}

// ── Fonctions utilitaires ──────────────────────────────────────────────────────

async function searchKBEnhanced(query, assetType = null) {
  return await searchKnowledgeBase(query, { assetType, language: 'fr', limit: 5 });
}

async function createSmartTicket({ userMessage, userId, asset, classification, sentiment, mlPrediction, technician, securityIncident }) {
  const title = securityIncident.isSecurityIncident 
    ? `[SÉCURITÉ] ${securityIncident.type}: ${userMessage.substring(0, 100)}`
    : userMessage.substring(0, 100);

  const description = `**Message original**: ${userMessage}\n\n`;
  description += `**Analyse automatique**:\n`;
  description += `- Catégorie: ${classification.category}\n`;
  description += `- Priorité: ${classification.priority}\n`;
  description += `- Sentiment: ${sentiment.sentiment} (score: ${sentiment.score}/100)\n`;
  
  if (asset) {
    description += `- Asset: ${asset.asset_tag} (ID: ${asset.id})\n`;
  }
  
  if (mlPrediction) {
    description += `- Risque ML: ${mlPrediction.risk_level} (${mlPrediction.risk_score}/100)\n`;
  }
  
  if (sentiment.isCritical) {
    description += `\n⚠️ **ALERTE**: Sentiment critique détecté. Vérification urgente requise.\n`;
  }

  if (securityIncident.isSecurityIncident) {
    description += `\n🚨 **INCIDENT DE SÉCURITÉ**: ${securityIncident.type}\n`;
    description += `Sévérité: ${securityIncident.severity}\n`;
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

async function notifySecurityAdmins(ticket, securityIncident) {
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
        title: '🚨 Incident de sécurité détecté',
        message: `Ticket #${ticket.id} - ${securityIncident.type} - Sévérité: ${securityIncident.severity}`,
        ticketId: ticket.id
      });

      try {
        const emailService = (await import('./emailService.js')).default;
        await emailService.sendEmail({
          to: admin.email,
          subject: `[URGENT] Incident de sécurité: ${securityIncident.type}`,
          body: `
            Bonjour ${admin.username},
            
            Un incident de sécurité a été détecté et un ticket critique a été créé automatiquement.
            
            Détails:
            - Ticket: #${ticket.id}
            - Type: ${securityIncident.type}
            - Sévérité: ${securityIncident.severity}
            - Description: ${ticket.description}
            
            Veuillez prendre en charge ce ticket immédiatement.
            
            Cordialement,
            Smart IT Assistant
          `
        });
      } catch (emailError) {
        console.error('[SmartAssistant] Erreur envoi email sécurité:', emailError.message);
      }
    }
  } catch (error) {
    console.error('[SmartAssistant] Erreur notification admins sécurité:', error.message);
  }
}

export default {
  processSmartMessage,
  extractEntities,
  identifyAsset,
  classifyTicket,
  detectSecurityIncident,
  detectLanguage,
  createSmartTicket,
  notifySecurityAdmins
};
