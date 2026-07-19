// backend/test-rag-pipeline-diagnostic.js
// Diagnostic complet du pipeline RAG modulaire
// Teste l'ensemble du pipeline : providers → reranker → contextBuilder → prompt
// Utilisation : node test-rag-pipeline-diagnostic.js

import { searchAllProviders } from './src/services/knowledgeProviders/index.js';
import { rerankPipeline } from './src/services/reranker.js';
import { buildContext, calculateAvailableBudget } from './src/services/contextBuilder.js';
import { buildRagPrompt, canAnswerWithoutLlm, buildDirectResponse, callOllama } from './src/services/ragService.js';
import { getConfig, estimateTokens } from './src/services/ragConfig.js';

// ── Questions de test ──────────────────────────────────────────────────────
const TEST_QUESTIONS = [
  "Comment configurer un VPN sur Windows ?",
  "Comment réinitialiser un mot de passe utilisateur ?",
  "Ma connexion réseau est lente, que faire ?",
  "Quelle est la procédure pour installer un logiciel ?",
  "Comment créer un ticket d'incident ?",
];

// ── Test un provider spécifique ─────────────────────────────────────────────
async function testSingleProvider(providerName, query) {
  console.log(`\n  ┌─ Provider: ${providerName}`);
  console.log(`  │  Requête: "${query.substring(0, 60)}..."`);
  
  const { searchAllProviders: search } = await import('./src/services/knowledgeProviders/index.js');
  const { results, metrics } = await search(query, { limitPerSource: 5 });
  
  const providerResults = results.filter(r => r.provider === providerName || r.source_type === providerName);
  
  console.log(`  │  Résultats: ${providerResults.length}`);
  providerResults.forEach((r, i) => {
    console.log(`  │  [${i + 1}] score=${r.score?.toFixed(4) || 'N/A'} title="${(r.title || '').substring(0, 50)}"`);
  });
  console.log(`  │  Durée: ${metrics.sourceMetrics[providerName]?.duration || 0}ms`);
  console.log(`  └─`);
  
  return providerResults;
}

// ── Test complet du pipeline ────────────────────────────────────────────────
async function testPipeline(query) {
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`🧪 TEST PIPELINE COMPLET`);
  console.log(`📝 Question: "${query}"`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log('═'.repeat(90));
  
  const tStart = Date.now();
  const config = getConfig();
  
  // ── ÉTAPE 1: Interrogation des providers ────────────────────────────────
  console.log(`\n📡 ÉTAPE 1: INTERROGATION DES PROVIDERS`);
  console.log('─'.repeat(60));
  
  const t1 = Date.now();
  const { results: rawResults, metrics: searchMetrics } = await searchAllProviders(query, {
    limitPerSource: 5,
  });
  const searchDuration = Date.now() - t1;
  
  console.log(`\n  📊 Providers interrogés: ${searchMetrics.providersCount}`);
  console.log(`  📊 Résultats bruts totaux: ${rawResults.length}`);
  console.log(`  ⏱  Durée recherche: ${searchDuration}ms`);
  
  // Détail par provider
  for (const [provider, m] of Object.entries(searchMetrics.sourceMetrics)) {
    const status = m.success ? '✅' : '❌';
    console.log(`  ${status} ${provider}: ${m.count} résultats en ${m.duration}ms`);
    if (!m.success) console.log(`     Erreur: ${m.error}`);
  }
  
  // ── ÉTAPE 2: Re-ranking ──────────────────────────────────────────────────
  console.log(`\n📊 ÉTAPE 2: RE-RANKING`);
  console.log('─'.repeat(60));
  
  const t2 = Date.now();
  const { results: rankedResults, metrics: rerankMetrics } = rerankPipeline(rawResults, query, {
    maxResults: config.maxResults,
    threshold: config.similarityThreshold,
  });
  const rerankDuration = Date.now() - t2;
  
  console.log(`\n  📊 Re-ranking terminé en ${rerankDuration}ms`);
  console.log(`  📊 Flux: ${rerankMetrics.inputCount} entrées → ${rerankMetrics.afterDedup} dédupl. → ${rerankMetrics.afterThreshold} filtrés → ${rerankMetrics.finalCount} sélectionnés`);
  console.log(`  ⏱  Timing: dédup=${rerankMetrics.timing.dedup}ms, scoring=${rerankMetrics.timing.scoring}ms, filtrage=${rerankMetrics.timing.filtering}ms, sélection=${rerankMetrics.timing.selection}ms`);
  
  // Détail des résultats retenus
  rankedResults.forEach((r, i) => {
    const source = r.source_type || r.provider || '?';
    const score = (r.hybrid_score * 100).toFixed(1);
    const title = (r.title || '').substring(0, 55);
    console.log(`  [${i + 1}] 📌 ${source} | score: ${score}% | "${title}"`);
  });
  
  if (rankedResults.length === 0) {
    console.log(`  ⚠️  Aucun résultat pertinent après re-ranking`);
    console.log(`\n${'═'.repeat(90)}\n`);
    return;
  }
  
  // ── ÉTAPE 3: Vérification réponse sans LLM ───────────────────────────────
  console.log(`\n🤖 ÉTAPE 3: DÉCISION D'APPEL LLM`);
  console.log('─'.repeat(60));
  
  const canSkip = canAnswerWithoutLlm(rankedResults, config);
  const bestScore = rankedResults[0]?.hybrid_score || 0;
  console.log(`\n  Meilleur score: ${(bestScore * 100).toFixed(1)}%`);
  console.log(`  Seuil skip LLM: ${(config.confidenceSkipLlm * 100).toFixed(0)}%`);
  console.log(`  Décision: ${canSkip ? '✅ RÉPONSE DIRECTE SANS LLM' : '⚠️  APPEL LLM NÉCESSAIRE'}`);
  
  if (canSkip) {
    const directResponse = buildDirectResponse(rankedResults);
    console.log(`\n  Réponse directe:\n  ${directResponse.substring(0, 300)}...`);
  }
  
  // ── ÉTAPE 4: Construction du contexte ─────────────────────────────────────
  console.log(`\n📝 ÉTAPE 4: CONSTRUCTION DU CONTEXTE`);
  console.log('─'.repeat(60));
  
  const budget = calculateAvailableBudget(null, []);
  const { context, usedTokens, includedResults, excludedResults } = buildContext(rankedResults, {
    tokenBudget: budget,
    maxResults: config.maxResults,
    includeSources: true,
  });
  
  console.log(`\n  Budget tokens alloué: ${budget}`);
  console.log(`  Tokens utilisés: ${usedTokens}`);
  console.log(`  Sources incluses: ${includedResults.length}`);
  console.log(`  Sources exclues (budget insuffisant): ${excludedResults.length}`);
  console.log(`  Taille du contexte: ${context.length} caractères`);
  
  // Top 3 sources incluses avec leur score
  includedResults.slice(0, 3).forEach((r, i) => {
    const source = r.source_type || r.provider || '?';
    const score = (r.hybrid_score * 100).toFixed(1);
    console.log(`  [${i + 1}] ${source} (${score}%) | "${(r.title || '').substring(0, 45)}"`);
  });
  
  // ── ÉTAPE 5: Construction du prompt ──────────────────────────────────────
  console.log(`\n🧠 ÉTAPE 5: CONSTRUCTION DU PROMPT`);
  console.log('─'.repeat(60));
  
  const analysis = {
    intent: 'kb_search',
    sentiment: { sentiment: 'neutre', score: 0 },
    ticketClassification: { category: 'Autre', priority: 'Normale' },
  };
  
  const prompt = buildRagPrompt({
    userMessage: query,
    unifiedKnowledge: rankedResults,
    conversationHistory: [],
    platformInfo: null,
    analysis,
  });
  
  const promptTokens = estimateTokens(prompt);
  console.log(`\n  Taille du prompt: ${prompt.length} caractères`);
  console.log(`  Tokens estimés: ${promptTokens}`);
  console.log(`  Tokens disponibles (numCtx): ${config.numCtx}`);
  console.log(`  Utilisation: ${((promptTokens / config.numCtx) * 100).toFixed(1)}%`);
  
  // Afficher les 10 premières lignes du prompt
  const promptLines = prompt.split('\n');
  console.log(`\n  ┌─ Début du prompt (10 premières lignes) ─────────────────────`);
  promptLines.slice(0, 10).forEach(line => console.log(`  │ ${line}`));
  console.log(`  └─ ... ${promptLines.length - 10} lignes supplémentaires ... ───`);
  
  // Vérifier que les sources sont bien citées
  const hasSourceCitations = prompt.includes('[Article KB:') || prompt.includes('[Document:') || prompt.includes('[Ticket');
  console.log(`\n  ✅ Citations de sources dans le prompt: ${hasSourceCitations ? 'OUI' : 'NON'}`);
  
  // Vérifier la présence de chaque type de source
  const kbCount = (prompt.match(/\[Article KB:/g) || []).length;
  const docCount = (prompt.match(/\[Document:/g) || []).length;
  const ticketCount = (prompt.match(/\[Ticket/g) || []).length;
  const procCount = (prompt.match(/\[Procédure:/g) || []).length;
  
  console.log(`  Sources KB: ${kbCount}, Documents: ${docCount}, Tickets: ${ticketCount}, Procédures: ${procCount}`);
  
  // ── ÉTAPE 6: Appel Ollama (optionnel) ────────────────────────────────────
  if (!canSkip && rankedResults.length > 0) {
    console.log(`\n🔮 ÉTAPE 6: APPEL OLLAMA`);
    console.log('─'.repeat(60));
    
    console.log(`\n  Modèle: ${config.model}`);
    console.log(`  Timeout: ${config.timeout}ms`);
    
    const tOllama = Date.now();
    try {
      const llmResponse = await callOllama(prompt);
      const ollamaDuration = Date.now() - tOllama;
      
      console.log(`\n  ⏱  Durée appel Ollama: ${ollamaDuration}ms`);
      
      if (llmResponse) {
        console.log(`\n  ┌─ RÉPONSE D'OLLAMA ───────────────────────────────────────────`);
        console.log(`  ${llmResponse.split('\n').join('\n  ')}`);
        console.log(`  └─ Fin réponse (${llmResponse.length} caractères) ────────────────`);
        
        // Vérifier les citations dans la réponse
        const responseHasSources = llmResponse.includes('[') && (llmResponse.includes(']'));
        console.log(`\n  ✅ Citations dans la réponse: ${responseHasSources ? 'OUI' : 'NON - Le LLM n\'a pas cité ses sources'}`);
      } else {
        console.log(`  ❌ Échec de l'appel Ollama`);
      }
    } catch (err) {
      console.log(`  ❌ Erreur appel Ollama: ${err.message}`);
    }
  }
  
  // ── RÉSULTATS GLOBAUX ───────────────────────────────────────────────────
  const totalDuration = Date.now() - tStart;
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`📊 RÉSULTATS GLOBAUX DU DIAGNOSTIC`);
  console.log('═'.repeat(90));
  console.log(`\n  Question: "${query}"`);
  console.log(`  Durée totale: ${totalDuration}ms`);
  console.log(`  Providers interrogés: ${searchMetrics.totalSources} résultats bruts`);
  console.log(`  Après re-ranking: ${rankedResults.length} résultats retenus`);
  console.log(`  Budget contexte: ${usedTokens}/${budget} tokens utilisés`);
  console.log(`  Taille prompt: ${prompt.length} caractères (${promptTokens} tokens estimés / ${config.numCtx} max)`);
  console.log(`  Appel LLM: ${canSkip ? 'ÉVITÉ (réponse directe)' : 'OUI'}`);
  console.log(`  Sources KB: ${kbCount}, Documents: ${docCount}, Tickets: ${ticketCount}, Procédures: ${procCount}`);
  console.log(`\n${'═'.repeat(90)}\n`);
  
  return {
    question: query,
    totalDuration,
    rawResultsCount: rawResults.length,
    rankedResultsCount: rankedResults.length,
    contextTokens: usedTokens,
    promptLength: prompt.length,
    llmSkipped: canSkip,
    sourcesBreakdown: { kb: kbCount, documents: docCount, tickets: ticketCount, procedures: procCount },
  };
}

// ── Test d'une question spécifique ciblant KB ───────────────────────────────
async function testKbQuestion() {
  console.log(`\n\n${'█'.repeat(90)}`);
  console.log(`█ TEST 1: QUESTION CIBLANT LA BASE DE CONNAISSANCES`);
  console.log(`█ Vérifie que les articles KB sont trouvés et utilisés dans la réponse`);
  console.log(`${'█'.repeat(90)}`);
  
  return await testPipeline("Comment configurer un VPN sur Windows ?");
}

// ── Test d'une question spécifique ciblant les tickets résolus ──────────────
async function testResolvedTicketQuestion() {
  console.log(`\n\n${'█'.repeat(90)}`);
  console.log(`█ TEST 2: QUESTION CIBLANT LES TICKETS RÉSOLUS`);
  console.log(`█ Vérifie que les tickets résolus sont trouvés et influencent la réponse`);
  console.log(`${'█'.repeat(90)}`);
  
  return await testPipeline("Problème de connexion réseau lente");
}

// ── Test d'une question générique ───────────────────────────────────────────
async function testGenericQuestion() {
  console.log(`\n\n${'█'.repeat(90)}`);
  console.log(`█ TEST 3: QUESTION GÉNÉRIQUE (toutes sources)`);
  console.log(`█ Vérifie que toutes les sources sont interrogées et fusionnées`);
  console.log(`${'█'.repeat(90)}`);
  
  return await testPipeline("Comment réinitialiser un mot de passe ?");
}

// ── Test d'une question sans contexte ───────────────────────────────────────
async function testNoContextQuestion() {
  console.log(`\n\n${'█'.repeat(90)}`);
  console.log(`█ TEST 4: QUESTION SANS CONTEXTE CONNU`);
  console.log(`█ Vérifie que le système refuse d'inventer une réponse`);
  console.log(`${'█'.repeat(90)}`);
  
  return await testPipeline("Quel est le numéro de série du serveur principal ?");
}

// ── Rapport récapitulatif ───────────────────────────────────────────────────
function printSummary(results) {
  console.log(`\n\n${'═'.repeat(90)}`);
  console.log(`📋 RAPPORT RÉCAPITULATIF DES TESTS`);
  console.log('═'.repeat(90));
  console.log(`\n  ${'Test'.padEnd(45)} ${'Résultats'.padEnd(12)} ${'Temps'.padEnd(10)} ${'LLM'}`);
  console.log(`  ${'─'.repeat(45)} ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);
  
  for (const r of results) {
    const name = r.question.substring(0, 42) + '...';
    const count = `${r.rankedResultsCount} résultats`;
    const time = `${r.totalDuration}ms`;
    const llm = r.llmSkipped ? '✅ Évité' : '⚠️ Oui';
    console.log(`  ${name.padEnd(45)} ${count.padEnd(12)} ${time.padEnd(10)} ${llm}`);
  }
  
  console.log(`\n  ✅ Tous les tests sont terminés`);
  console.log(`${'═'.repeat(90)}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'█'.repeat(90)}`);
  console.log(`█ DIAGNOSTIC COMPLET DU PIPELINE RAG MODULAIRE`);
  console.log(`█ ${new Date().toISOString()}`);
  console.log(`█ Contexte: ${getConfig().numCtx} tokens, Budget: ${getConfig().contextTokenBudget} tokens`);
  console.log(`█ Seuil similarité: ${getConfig().similarityThreshold}, Skip LLM: >${getConfig().confidenceSkipLlm}`);
  console.log(`${'█'.repeat(90)}`);
  
  const results = [];
  
  // Test 1: KB
  results.push(await testKbQuestion());
  
  // Test 2: Tickets résolus
  results.push(await testResolvedTicketQuestion());
  
  // Test 3: Générique
  results.push(await testGenericQuestion());
  
  // Test 4: Sans contexte
  results.push(await testNoContextQuestion());
  
  // Rapport
  printSummary(results);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});