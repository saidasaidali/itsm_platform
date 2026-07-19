/**
 * Test de performance avec llama3.2:1b
 * Question : "Comment configurer le VPN ?"
 * Mesure : temps total + qualité de la réponse
 */

import { processRagQuery } from './src/services/ragService.js';

async function testVpnSpeed() {
  console.log('═'.repeat(80));
  console.log('TEST DE PERFORMANCE - llama3.2:1b');
  console.log('Question : "Comment configurer le VPN ?"');
  console.log('═'.repeat(80));

  const startTime = Date.now();

  try {
    const result = await processRagQuery({
      userMessage: 'Comment configurer le VPN ?',
      maxKbArticles: 5,
    });

    const totalDuration = Date.now() - startTime;

    console.log('\n📊 RÉSULTATS :');
    console.log(`   Temps total : ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`   Sources trouvées : ${result.kbArticlesUsed || 0}`);
    console.log(`   Erreur Ollama : ${result.llmFailed ? 'OUI' : 'NON'}`);
    console.log(`   Depuis le cache : ${result.fromCache ? 'OUI' : 'NON'}`);

    console.log('\n📝 RÉPONSE GÉNÉRÉE :');
    console.log('─'.repeat(80));
    console.log(result.response);
    console.log('─'.repeat(80));

    console.log('\n📈 MÉTRIQUES DÉTAILLÉES :');
    if (result.pipelineMetrics) {
      console.log(`   Recherche KB/PDF/Tickets : ${result.pipelineMetrics.steps.search || 0}ms`);
      console.log(`   Construction contexte : ${result.pipelineMetrics.steps.promptBuilding || 0}ms`);
      console.log(`   Appel Ollama : ${result.pipelineMetrics.steps.llmCall || 0}ms`);
    }
    console.log(`   Longueur prompt : ${result.promptLength || 0} caractères`);
    console.log(`   Longueur réponse : ${result.response?.length || 0} caractères`);

    console.log('\n✅ ÉVALUATION :');
    if (totalDuration < 30000) {
      console.log(`   ✅ RAPIDE : ${(totalDuration / 1000).toFixed(1)}s < 30s`);
    } else {
      console.log(`   ❌ TROP LENT : ${(totalDuration / 1000).toFixed(1)}s > 30s`);
    }

    if (result.response && !result.response.includes('Je n\'ai pas trouvé')) {
      console.log('   ✅ RÉPONSE PERTINENTE');
    } else {
      console.log('   ❌ PAS DE RÉPONSE PERTINENTE');
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERREUR :', error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testVpnSpeed().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});