/**
 * Tests pour la logique conversationnelle du Smart Assistant
 * 
 * Ces tests vérifient que :
 * 1. Les réponses "Oui/Non" sont correctement gérées comme des confirmations
 * 2. Les questions de suivi utilisent le contexte conversationnel
 * 3. L'intention est correctement détectée avant le pipeline RAG
 */

import { 
  detectIntent, 
  INTENTS,
  detectLanguage 
} from '../src/utils/nlpUtils.js';

import { 
  detectIntentWithContext,
  loadConversationState,
  saveConversationState,
  resetConversationState,
  createEmptyConversationState
} from '../src/services/smartAssistantService.js';

import pool from '../src/db.js';

// Couleurs pour les tests
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, testName) {
  if (condition) {
    log(`✅ PASS: ${testName}`, 'green');
    return true;
  } else {
    log(`❌ FAIL: ${testName}`, 'red');
    return false;
  }
}

// ── Tests de détection d'intention ────────────────────────────────────────────

async function testIntentDetection() {
  log('\n=== TESTS DE DÉTECTION D\'INTENTION ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  // Test 1: "Comment créer un ticket ?" → ask_procedure
  const intent1 = detectIntent("Comment créer un ticket ?", false, 'fr');
  if (assert(intent1 === INTENTS.ASK_PROCEDURE, '"Comment créer un ticket ?" → ask_procedure')) passed++;
  else failed++;

  // Test 2: "Créer un ticket" → ticket_create
  const intent2 = detectIntent("Créer un ticket", false, 'fr');
  if (assert(intent2 === INTENTS.TICKET_CREATE, '"Créer un ticket" → ticket_create')) passed++;
  else failed++;

  // Test 3: "Je veux ouvrir un ticket" → ticket_create
  const intent3 = detectIntent("Je veux ouvrir un ticket", false, 'fr');
  if (assert(intent3 === INTENTS.TICKET_CREATE, '"Je veux ouvrir un ticket" → ticket_create')) passed++;
  else failed++;

  // Test 4: "Mon imprimante est hors ligne" → incident
  const intent4 = detectIntent("Mon imprimante est hors ligne", false, 'fr');
  if (assert(intent4 === INTENTS.INCIDENT, '"Mon imprimante est hors ligne" → incident')) passed++;
  else failed++;

  // Test 5: "Oui" → confirmation
  const intent5 = detectIntent("Oui", false, 'fr');
  if (assert(intent5 === INTENTS.CONFIRMATION, '"Oui" → confirmation')) passed++;
  else failed++;

  // Test 6: "Non" → rejection
  const intent6 = detectIntent("Non", false, 'fr');
  if (assert(intent6 === INTENTS.REJECTION, '"Non" → rejection')) passed++;
  else failed++;

  // Test 7: "Donne-moi la démarche" → follow_up
  const intent7 = detectIntent("Donne-moi la démarche", false, 'fr');
  if (assert(intent7 === INTENTS.FOLLOW_UP, '"Donne-moi la démarche" → follow_up')) passed++;
  else failed++;

  // Test 8: "Explique" → follow_up
  const intent8 = detectIntent("Explique", false, 'fr');
  if (assert(intent8 === INTENTS.FOLLOW_UP, '"Explique" → follow_up')) passed++;
  else failed++;

  // Test 9: "Les étapes" → follow_up
  const intent9 = detectIntent("Les étapes", false, 'fr');
  if (assert(intent9 === INTENTS.FOLLOW_UP, '"Les étapes" → follow_up')) passed++;
  else failed++;

  // Test 10: "Pourquoi" → follow_up
  const intent10 = detectIntent("Pourquoi", false, 'fr');
  if (assert(intent10 === INTENTS.FOLLOW_UP, '"Pourquoi" → follow_up')) passed++;
  else failed++;

  log(`\nRésultats: ${passed} passés, ${failed} échoués\n`, passed > 0 ? 'green' : 'red');
  
  return { passed, failed };
}

// ── Tests de gestion du contexte conversationnel ───────────────────────────────

async function testConversationContext() {
  log('\n=== TESTS DE GESTION DU CONTEXTE CONVERSATIONNEL ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  const testSessionKey = 'test_session_' + Date.now();

  try {
    // Test 1: Créer un état de conversation vide
    const emptyState = createEmptyConversationState();
    if (assert(
      emptyState.pendingAction === null && 
      emptyState.lastIntent === null &&
      emptyState.lastQuestion === null,
      'Création d\'un état de conversation vide'
    )) passed++;
    else failed++;

    // Test 2: Sauvegarder un état de conversation
    const testState = {
      ...createEmptyConversationState(),
      pendingAction: 'create_ticket',
      lastIntent: INTENTS.ASK_PROCEDURE,
      lastQuestion: "Comment créer un ticket ?",
      lastResponse: "Je vais vous aider à créer un ticket...",
      lastCategory: 'Logiciel'
    };

    await saveConversationState(testSessionKey, testState);
    if (assert(true, 'Sauvegarde de l\'état de conversation')) passed++;
    else failed++;

    // Test 3: Charger l'état de conversation
    const loadedState = await loadConversationState(testSessionKey);
    if (assert(
      loadedState.pendingAction === 'create_ticket' &&
      loadedState.lastIntent === INTENTS.ASK_PROCEDURE &&
      loadedState.lastQuestion === "Comment créer un ticket ?",
      'Chargement de l\'état de conversation'
    )) passed++;
    else failed++;

    // Test 4: Détecter une confirmation avec contexte
    const intentResult1 = await detectIntentWithContext("Oui", testSessionKey);
    if (assert(
      intentResult1.intent === INTENTS.CONFIRMATION &&
      intentResult1.pendingAction === 'create_ticket',
      'Détection de confirmation avec pendingAction'
    )) passed++;
    else failed++;

    // Test 5: Détecter un rejet avec contexte
    const intentResult2 = await detectIntentWithContext("Non", testSessionKey);
    if (assert(
      intentResult2.intent === INTENTS.REJECTION &&
      intentResult2.pendingAction === 'create_ticket',
      'Détection de rejet avec pendingAction'
    )) passed++;
    else failed++;

    // Test 6: Détecter une question de suivi avec contexte
    const intentResult3 = await detectIntentWithContext("Donne-moi la démarche", testSessionKey);
    if (assert(
      intentResult3.intent === INTENTS.FOLLOW_UP &&
      intentResult3.previousIntent === INTENTS.ASK_PROCEDURE,
      'Détection de question de suivi avec contexte'
    )) passed++;
    else failed++;

    // Test 7: Réinitialiser l'état de conversation
    await resetConversationState(testSessionKey);
    const resetState = await loadConversationState(testSessionKey);
    if (assert(
      resetState.pendingAction === null &&
      resetState.lastIntent === null,
      'Réinitialisation de l\'état de conversation'
    )) passed++;
    else failed++;

  } catch (error) {
    log(`\n❌ Erreur lors des tests: ${error.message}\n`, 'red');
    console.error(error);
    failed++;
  }

  log(`\nRésultats: ${passed} passés, ${failed} échoués\n`, passed > 0 ? 'green' : 'red');
  
  return { passed, failed };
}

// ── Tests de scénarios complets ───────────────────────────────────────────────

async function testCompleteScenarios() {
  log('\n=== TESTS DE SCÉNARIOS COMPLETS ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  const testSessionKey = 'test_scenario_' + Date.now();

  try {
    // Scénario 1: Création de ticket avec confirmation
    log('\n--- Scénario 1: Création de ticket avec confirmation ---\n', 'yellow');

    // Étape 1: User demande comment créer un ticket
    const state1 = createEmptyConversationState();
    await saveConversationState(testSessionKey, state1);

    const intent1 = await detectIntentWithContext("Comment créer un ticket ?", testSessionKey);
    log(`1. User: "Comment créer un ticket ?" → Intent: ${intent1.intent}`, 'blue');
    
    // Simuler la réponse du système
    const updatedState1 = {
      ...state1,
      lastIntent: intent1.intent,
      lastQuestion: "Comment créer un ticket ?",
      lastResponse: "Je vais vous aider à créer un ticket...",
      pendingAction: 'create_ticket'
    };
    await saveConversationState(testSessionKey, updatedState1);

    // Étape 2: User répond "Oui"
    const intent2 = await detectIntentWithContext("Oui", testSessionKey);
    log(`2. User: "Oui" → Intent: ${intent2.intent}, PendingAction: ${intent2.pendingAction}`, 'blue');
    
    if (assert(
      intent2.intent === INTENTS.CONFIRMATION && 
      intent2.pendingAction === 'create_ticket',
      'Scénario 1: "Oui" est détecté comme confirmation de création de ticket'
    )) passed++;
    else failed++;

    // Scénario 2: Question de suivi
    log('\n--- Scénario 2: Question de suivi ---\n', 'yellow');

    await resetConversationState(testSessionKey);
    
    const state2 = createEmptyConversationState();
    state2.lastIntent = INTENTS.KB_SEARCH;
    state2.lastQuestion = "Comment réinitialiser mon mot de passe ?";
    state2.lastResponse = "Voici la procédure pour réinitialiser votre mot de passe...";
    await saveConversationState(testSessionKey, state2);

    const intent3 = await detectIntentWithContext("Donne-moi la démarche", testSessionKey);
    log(`1. User: "Comment réinitialiser mon mot de passe ?"`, 'blue');
    log(`2. System: "Voici la procédure..."`, 'blue');
    log(`3. User: "Donne-moi la démarche" → Intent: ${intent3.intent}`, 'blue');
    
    if (assert(
      intent3.intent === INTENTS.FOLLOW_UP &&
      intent3.previousIntent === INTENTS.KB_SEARCH,
      'Scénario 2: "Donne-moi la démarche" est détecté comme question de suivi'
    )) passed++;
    else failed++;

    // Scénario 3: Incident avec demande de procédure
    log('\n--- Scénario 3: Incident avec demande de procédure ---\n', 'yellow');

    await resetConversationState(testSessionKey);
    
    const intent4 = detectIntent("Mon imprimante est hors ligne", false, 'fr');
    log(`1. User: "Mon imprimante est hors ligne" → Intent: ${intent4}`, 'blue');
    
    if (assert(
      intent4 === INTENTS.INCIDENT,
      'Scénario 3: "Mon imprimante est hors ligne" est détecté comme incident'
    )) passed++;
    else failed++;

    const intent5 = detectIntent("Donne-moi la démarche", false, 'fr');
    log(`2. User: "Donne-moi la démarche" → Intent: ${intent5}`, 'blue');
    
    if (assert(
      intent5 === INTENTS.FOLLOW_UP,
      'Scénario 3: "Donne-moi la démarche" est détecté comme question de suivi (pas une nouvelle recherche)'
    )) passed++;
    else failed++;

  } catch (error) {
    log(`\n❌ Erreur lors des tests: ${error.message}\n`, 'red');
    console.error(error);
    failed++;
  }

  log(`\nRésultats: ${passed} passés, ${failed} échoués\n`, passed > 0 ? 'green' : 'red');
  
  return { passed, failed };
}

// ── Fonction principale ───────────────────────────────────────────────────────

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║   TESTS DE LA LOGIQUE CONVERSATIONNELLE DU SMART ASSISTANT ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝\n', 'blue');

  const results = {
    passed: 0,
    failed: 0
  };

  try {
    // Vérifier la connexion à la base de données
    log('Vérification de la connexion à la base de données...', 'yellow');
    await pool.query('SELECT 1');
    log('✅ Connexion à la base de données OK\n', 'green');

    // Exécuter les tests
    const intentResults = await testIntentDetection();
    results.passed += intentResults.passed;
    results.failed += intentResults.failed;

    const contextResults = await testConversationContext();
    results.passed += contextResults.passed;
    results.failed += contextResults.failed;

    const scenarioResults = await testCompleteScenarios();
    results.passed += scenarioResults.passed;
    results.failed += scenarioResults.failed;

  } catch (error) {
    log(`\n❌ Erreur fatale: ${error.message}\n`, 'red');
    console.error(error);
    results.failed++;
  }

  // Résumé final
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║                     RÉSUMÉ DES TESTS                       ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝\n', 'blue');
  
  log(`Total: ${results.passed + results.failed} tests`, 'yellow');
  log(`Passés: ${results.passed}`, 'green');
  log(`Échoués: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  if (results.failed === 0) {
    log('\n✅ Tous les tests sont passés avec succès !\n', 'green');
  } else {
    log('\n❌ Certains tests ont échoué. Veuillez vérifier les erreurs ci-dessus.\n', 'red');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Exécuter les tests
runAllTests().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});