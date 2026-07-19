// Script de test de la correction learnedCasesProvider
import { learnedCasesProvider } from './src/services/knowledgeProviders/learnedCasesProvider.js';
import { getConfig } from './src/services/ragConfig.js';

async function testFix() {
  console.log('═'.repeat(80));
  console.log('TEST DE LA CORRECTION - learnedCasesProvider');
  console.log('═'.repeat(80));

  const config = getConfig();
  
  // Test 1: Recherche "VPN" (devrait matcher)
  console.log('\n1. TEST RECHERCHE "VPN" (devrait matcher):');
  console.log('-'.repeat(80));
  
  const resultsVpn = await learnedCasesProvider.search('VPN', 5);
  
  console.log(`   Résultats: ${resultsVpn.length}`);
  resultsVpn.forEach((result, i) => {
    console.log(`\n   [${i + 1}] ${result.title}`);
    console.log(`       Score brut: ${result.score?.toFixed(4)}`);
    console.log(`       Confidence (métadonnée): ${result.metadata?.confidence_score}`);
    console.log(`       Hit count: ${result.metadata?.hit_count}`);
  });

  // Test 2: Recherche "IMPRIMANTE" (ne devrait PAS matcher)
  console.log('\n\n2. TEST RECHERCHE "IMPRIMANTE" (ne devrait PAS matcher):');
  console.log('-'.repeat(80));
  
  const resultsPrint = await learnedCasesProvider.search('IMPRIMANTE', 5);
  
  console.log(`   Résultats: ${resultsPrint.length}`);
  if (resultsPrint.length === 0) {
    console.log('   ✅ Aucun résultat (correct)');
  } else {
    resultsPrint.forEach((result, i) => {
      console.log(`\n   [${i + 1}] ${result.title}`);
      console.log(`       Score brut: ${result.score?.toFixed(4)}`);
    });
  }

  // Test 3: Recherche "configuration" (devrait matcher partiellement)
  console.log('\n\n3. TEST RECHERCHE "configuration" (match partiel):');
  console.log('-'.repeat(80));
  
  const resultsConfig = await learnedCasesProvider.search('configuration', 5);
  
  console.log(`   Résultats: ${resultsConfig.length}`);
  resultsConfig.forEach((result, i) => {
    console.log(`\n   [${i + 1}] ${result.title}`);
    console.log(`       Score brut: ${result.score?.toFixed(4)}`);
    console.log(`       Confidence (métadonnée): ${result.metadata?.confidence_score}`);
  });

  // Test 4: Simulation du calcul hybride pour "VPN"
  console.log('\n\n4. SIMULATION SCORE HYBRIDE POUR "VPN":');
  console.log('-'.repeat(80));
  
  if (resultsVpn.length > 0) {
    const result = resultsVpn[0];
    const vectorScore = result.score || 0;
    const fullTextScore = typeof result.score === 'number' ? result.score : 0;
    
    const contentLower = (result.content || '').toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    const queryKeywords = ['vpn'];
    const keywordMatches = queryKeywords.filter(kw => 
      contentLower.includes(kw) || titleLower.includes(kw)
    ).length;
    const keywordScore = queryKeywords.length > 0 
      ? keywordMatches / queryKeywords.length 
      : 0;
    
    const metadata = result.metadata || {};
    const hitCount = metadata.hit_count || 0;
    const viewsCount = metadata.views || metadata.views_count || 0;
    const confidenceScore = parseFloat(metadata.confidence_score) || 0;
    const popularityScore = Math.min(
      (hitCount * 0.1 + viewsCount * 0.05 + confidenceScore * 0.5) / 1.0,
      1.0
    );
    
    const now = Date.now();
    let freshnessScore = 0.5;
    const dateStr = metadata.resolved_at || metadata.created_at || null;
    if (dateStr) {
      const ageMs = now - new Date(dateStr).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      freshnessScore = Math.max(0, Math.min(1, 1 - ageDays / 365));
    }
    
    const hybridScore = 
      vectorScore * config.weightVector +
      fullTextScore * config.weightFulltext +
      keywordScore * config.weightKeywords +
      popularityScore * config.weightPopularity +
      freshnessScore * config.weightFreshness;
    
    console.log(`   vector (${config.weightVector}): ${vectorScore.toFixed(4)} → ${(vectorScore * config.weightVector).toFixed(4)}`);
    console.log(`   fulltext (${config.weightFulltext}): ${fullTextScore.toFixed(4)} → ${(fullTextScore * config.weightFulltext).toFixed(4)}`);
    console.log(`   keywords (${config.weightKeywords}): ${keywordScore.toFixed(4)} → ${(keywordScore * config.weightKeywords).toFixed(4)}`);
    console.log(`   popularity (${config.weightPopularity}): ${popularityScore.toFixed(4)} → ${(popularityScore * config.weightPopularity).toFixed(4)}`);
    console.log(`   freshness (${config.weightFreshness}): ${freshnessScore.toFixed(4)} → ${(freshnessScore * config.weightFreshness).toFixed(4)}`);
    console.log(`   TOTAL HYBRID: ${hybridScore.toFixed(4)}`);
    console.log(`   SEUIL (${config.similarityThreshold}): ${hybridScore >= config.similarityThreshold ? '✅ PASSE' : '❌ ÉCHEC'}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('FIN DU TEST');
  console.log('═'.repeat(80) + '\n');
}

testFix().catch(err => {
  console.error('Erreur test:', err);
  process.exit(1);
});