/**
 * Test de vérification de la complétude des réponses Ollama
 * Vérifie que les réponses se terminent correctement (phrase complète + section sources)
 * et mesure le temps de réponse
 */

import { processRagQuery } from './src/services/ragService.js';
import { getConfig, estimateTokens } from './src/services/ragConfig.js';

async function testVpnCompleteness() {
  console.log('═'.repeat(80));
  console.log('TEST DE COMPLÉTUDE DES RÉPONSES - llama3.2:1b');
  console.log('Question : "Comment configurer le VPN ?"');
  console.log('═'.repeat(80));

  const config = getConfig();
  console.log('\n📋 Configuration actuelle :');
  console.log(`   OLLAMA_NUM_PREDICT: ${config.numPredict}`);
  console.log(`   OLLAMA_NUM_CTX: ${config.numCtx}`);
  console.log(`   RAG_CONTEXT_TOKEN_BUDGET: ${config.contextTokenBudget}`);

  const startTime = Date.now();

  try {
    const result = await processRagQuery({
      userMessage: 'Comment configurer le VPN ?',
      maxKbArticles: 5,
    });

    const totalDuration = Date.now() - startTime;
    const responseTokens = estimateTokens(result.response || '');

    console.log('\n📊 RÉSULTATS :');
    console.log(`   Temps total : ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`   Sources trouvées : ${result.kbArticlesUsed || 0}`);
    console.log(`   Erreur Ollama : ${result.llmFailed ? 'OUI' : 'NON'}`);
    console.log(`   Longueur réponse : ${result.response?.length || 0} caractères (~${responseTokens} tokens)`);

    console.log('\n📝 RÉPONSE COMPLÈTE :');
    console.log('─'.repeat(80));
    console.log(result.response);
    console.log('─'.repeat(80));

    // Vérification de la complétude
    console.log('\n✅ VÉRIFICATION DE LA COMPLÉTUDE :');
    
    const response = result.response || '';
    
    // 1. Vérifier si la réponse se termine par une phrase complète
    const endsWithPeriod = /[.!?]$/.test(response.trim());
    const endsWithIncompleteWord = /[\w\u00C0-\u00FF]$/.test(response.trim()) && !endsWithPeriod;
    
    // 2. Vérifier si la section sources est présente
    const hasSourcesSection = /sources?/i.test(response) || /source/i.test(response);
    
    // 3. Vérifier si la réponse est tronquée (se termine brusquement)
    const lastChar = response.trim().slice(-1);
    const isTruncated = !endsWithPeriod && !hasSourcesSection;
    
    // 4. Vérifier les mots tronqués (ex: "configu" au lieu de "configurer")
    const hasTruncatedWord = /(\w{3,}\s*$)[\s\S]*$/.test(response) && !endsWithPeriod;

    if (isTruncated) {
      console.log('   ❌ RÉPONSE TRONQUÉE DÉTECTÉE');
      console.log('   → La réponse ne se termine pas par une phrase complète');
      console.log('   → La section "Sources" est probablement absente');
    } else {
      console.log('   ✅ Réponse complète (se termine correctement)');
    }

    if (hasSourcesSection) {
      console.log('   ✅ Section "Sources" présente');
    } else {
      console.log('   ⚠️ Section "Sources" absente (optionnel si contexte vide)');
    }

    // 5. Vérifier si le modèle recopie les en-têtes markdown
    const hasMarkdownHeaders = /##\s*(Analyse|CONNAISSANCES|INSTRUCTIONS)/i.test(response);
    if (hasMarkdownHeaders) {
      console.log('   ⚠️ Le modèle recopie les en-têtes markdown du prompt (limitation du modèle)');
    }

    // 6. Estimation du temps vs tokens
    const expectedTimeForTokens = responseTokens * 15; // ~15ms par token pour llama3.2:1b
    console.log(`\n⏱️  ANALYSE TEMPS :`);
    console.log(`   Temps observé : ${totalDuration}ms`);
    console.log(`   Temps estimé pour ${responseTokens} tokens : ~${expectedTimeForTokens}ms`);
    console.log(`   Ratio : ${(totalDuration / expectedTimeForTokens).toFixed(2)}x`);

    // 7. Comparaison avec l'ancienne limite (150 tokens)
    if (config.numPredict >= 400) {
      console.log(`\n📈 Configuration actuelle : num_predict=${config.numPredict} (correctement augmenté)`);
    } else {
      console.log(`\n⚠️ Configuration : num_predict=${config.numPredict} (devrait être >= 400)`);
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERREUR :', error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testVpnCompleteness().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});