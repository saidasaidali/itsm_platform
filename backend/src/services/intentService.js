// backend/src/services/intentService.js
// Service partagé de détection d'intention pour chatbotBrain et smartAssistantService
// Ré-exporte depuis nlpUtils.js pour maintenir la compatibilité

import { detectIntent, detectIntentWithConfidence } from '../utils/nlpUtils.js';

export { detectIntent, detectIntentWithConfidence };

export default {
  detectIntent,
  detectIntentWithConfidence
};
