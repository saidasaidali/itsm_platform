/**
 * Test de validation pour la recherche "Comment configurer le VPN ?"
 * Ce test vérifie que l'article "Configuration du VPN" est bien trouvé et correctement scoré.
 */

import pool from './src/db.js';
import { searchAllProviders } from './src/services/knowledgeProviders/index.js';
import { rerankPipeline } from './src/services/reranker.js';
import { getConfig } from './src/services/ragConfig.js';

async function testVpnSearch() {
  console.log('═'.repeat(80));
  console.log('TEST: Recherche "Comment configurer le VPN ?"');
  console.log('═'.repeat(80));

  const config = getConfig();
  config.debugMode = true; // Activer les logs détaillés

  const query = 'Comment configurer le VPN ?';

  // Étape 1: Vérifier que l'article existe dans la base de données
  console.log('\n📋 ÉTAPE 1: Vérification de l\'article dans la base de données');
  console.log('─'.repeat(80));
  
  const articleCheck = await pool.query(
    `SELECT id, title, summary, content, views_count, hit_count 
     FROM knowledge_articles 
     WHERE lower(title) LIKE '%vpn%' OR lower(content) LIKE '%vpn%'`
  );

  if (articleCheck.rows.length === 0) {
    console.log('❌ Aucun article VPN trouvé dans la base de données!');
    console.log('   → Créez un article "Configuration du VPN" pour tester.');
    await pool.end();
    return;
  }

  console.log(`✅ ${articleCheck.rows.length} article(s) VPN trouvé(s):`);
  articleCheck.rows.forEach((row, i) => {
    console.log(`   [${i + 1}] ID: ${row.id}, Titre: "${row.title}"`);
    console.log(`       Views: ${row.views_count || 0}, Hits: ${row.hit_count || 0}`);
  });

  // Étape 2: Recherche via les providers
  console.log('\n📋 ÉTAPE 2: Recherche via les providers');
  console.log('─'.repeat(80));
  
  const { results: rawResults, metrics: searchMetrics } = await searchAllProviders(query, {
    limitPerSource: 10,
  });

  console.log(`\n✅ Résultats bruts: ${rawResults.length}`);
  console.log(`   Métriques par provider:`);
  Object.entries(searchMetrics.sourceMetrics).forEach(([provider, metrics]) => {
    console.log(`   - ${provider}: ${metrics.count} résultats (${metrics.duration}ms)`);
  });

  if (rawResults.length === 0) {
    console.log('\n❌ AUCUN RÉSULTAT BRUT - Le problème vient de la recherche SQL');
    console.log('   → Vérifiez la requête SQL dans knowledgeBaseProvider.js');
    await pool.end();
    return;
  }

  // Afficher les résultats bruts
  console.log('\n📊 Résultats bruts détaillés:');
  rawResults.forEach((result, i) => {
    console.log(`\n[${i + 1}] ${result.title || 'Sans titre'}`);
    console.log(`    Provider: ${result.provider || result.source_type}`);
    console.log(`    Score brut: ${result.score?.toFixed(3) || 'N/A'}`);
    console.log(`    Fulltext score: ${result.fulltext_score?.toFixed(3) || 'N/A'}`);
    console.log(`    Contenu (extrait): ${(result.content || '').substring(0, 100)}...`);
  });

  // Étape 3: Re-ranking
  console.log('\n\n📋 ÉTAPE 3: Re-ranking et filtrage');
  console.log('─'.repeat(80));
  
  const { results: rankedResults, metrics: rerankMetrics } = rerankPipeline(rawResults, query, {
    maxResults: config.maxResults,
    threshold: config.similarityThreshold,
  });

  console.log('\n📊 Métriques de re-ranking:');
  console.log(`   Entrées: ${rerankMetrics.inputCount}`);
  console.log(`   Après déduplication: ${rerankMetrics.afterDedup}`);
  console.log(`   Après scoring: ${rerankMetrics.afterScoring}`);
  console.log(`   Après filtrage (seuil ${config.similarityThreshold}): ${rerankMetrics.afterThreshold}`);
  console.log(`   Résultats finaux: ${rerankMetrics.finalCount}`);
  console.log(`\n   Timing:`);
  console.log(`   - Déduplication: ${rerankMetrics.timing.dedup}ms`);
  console.log(`   - Scoring: ${rerankMetrics.timing.scoring}ms`);
  console.log(`   - Filtrage: ${rerankMetrics.timing.filtering}ms`);
  console.log(`   - Sélection: ${rerankMetrics.timing.selection}ms`);

  // Étape 4: Résultats finaux
  console.log('\n\n📋 ÉTAPE 4: Résultats finaux');
  console.log('─'.repeat(80));
  
  if (rankedResults.length === 0) {
    console.log('\n❌ AUCUN RÉSULTAT APRÈS RE-RANKING');
    console.log('   → Le seuil est trop élevé ou les scores sont incorrects');
    console.log('   → Seuil actuel:', config.similarityThreshold);
    console.log('   → Poids des scores:', {
      vector: config.weightVector,
      fulltext: config.weightFulltext,
      keywords: config.weightKeywords,
      popularity: config.weightPopularity,
      freshness: config.weightFreshness,
    });
  } else {
    console.log(`\n✅ ${rankedResults.length} résultat(s) retenu(s):`);
    rankedResults.forEach((result, i) => {
      console.log(`\n[${i + 1}] ${result.title || 'Sans titre'}`);
      console.log(`    Source: ${result.source_type || result.provider}`);
      console.log(`    Score hybride: ${result.hybrid_score?.toFixed(3) || 'N/A'}`);
      console.log(`    Scores détaillés:`);
      if (result.scores) {
        console.log(`      - vector: ${result.scores.vector?.toFixed(3) || 0}`);
        console.log(`      - fulltext: ${result.scores.fulltext?.toFixed(3) || 0}`);
        console.log(`      - keywords: ${result.scores.keywords?.toFixed(3) || 0}`);
        console.log(`      - popularity: ${result.scores.popularity?.toFixed(3) || 0}`);
        console.log(`      - freshness: ${result.scores.freshness?.toFixed(3) || 0}`);
      }
      console.log(`    Contenu (extrait): ${(result.content || '').substring(0, 150)}...`);
    });
  }

  // Étape 5: Analyse et recommandations
  console.log('\n\n📋 ÉTAPE 5: Analyse et recommandations');
  console.log('─'.repeat(80));
  
  const vpnArticle = rawResults.find(r => 
    r.title?.toLowerCase().includes('vpn') || 
    r.content?.toLowerCase().includes('vpn')
  );

  if (vpnArticle) {
    console.log('\n✅ Article VPN trouvé dans les résultats bruts:');
    console.log(`   Titre: "${vpnArticle.title}"`);
    console.log(`   Score brut: ${vpnArticle.score?.toFixed(3) || 'N/A'}`);
    console.log(`   Fulltext score: ${vpnArticle.fulltext_score?.toFixed(3) || 'N/A'}`);
    
    if (rerankMetrics.afterThreshold === 0) {
      console.log('\n⚠️  PROBLÈME IDENTIFIÉ:');
      console.log('   L\'article VPN existe mais est rejeté après le seuil de 0.65');
      console.log('   → Le score est trop bas');
      console.log('   → Causes possibles:');
      console.log('     1. Le score full-text est 0 (plainto_tsquery ne match pas)');
      console.log('     2. Le score de mots-clés est bas (pas de correspondance exacte)');
      console.log('     3. Les poids sont mal calculés');
      
      console.log('\n💡 SOLUTIONS:');
      console.log('   1. Vérifier que plainto_tsquery match "vpn" (acronyme)');
      console.log('   2. Ajouter un fallback LIKE plus agressif');
      console.log('   3. Augmenter le score de keywords si le LIKE match');
      console.log('   4. Baisser temporairement le seuil à 0.3 pour tester');
    } else {
      console.log('\n✅ Article VPN retenu après filtrage!');
    }
  } else {
    console.log('\n❌ Article VPN NON trouvé dans les résultats bruts');
    console.log('   → Le problème vient de la recherche SQL');
    console.log('   → Vérifiez la requête dans knowledgeBaseProvider.js');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('FIN DU TEST');
  console.log('═'.repeat(80) + '\n');

  await pool.end();
}

// Exécuter le test
testVpnSearch().catch(err => {
  console.error('Erreur lors du test:', err);
  process.exit(1);
});