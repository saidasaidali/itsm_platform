/**
 * Test complet d'analyse du re-ranking avec les nouveaux paramètres
 * Vérifie :
 * 1. Le classement complet pour "Comment configurer le VPN ?"
 * 2. Si l'article VPN est dans le top 4
 * 3. Pourquoi les PDF ont des scores plus élevés
 * 4. Test avec une question hors-sujet pour valider le seuil
 */

import pool from './src/db.js';
import { searchAllProviders } from './src/services/knowledgeProviders/index.js';
import { rerankPipeline } from './src/services/reranker.js';
import { getConfig } from './src/services/ragConfig.js';

async function testCompleteRanking() {
  console.log('═'.repeat(80));
  console.log('TEST COMPLET: Analyse du re-ranking avec nouveaux paramètres');
  console.log('═'.repeat(80));

  const config = getConfig();
  config.debugMode = true;

  console.log('\n📊 CONFIGURATION ACTUELLE:');
  console.log(`   Seuil: ${config.similarityThreshold}`);
  console.log(`   Poids: vector=${config.weightVector}, fulltext=${config.weightFulltext}, keywords=${config.weightKeywords}, popularity=${config.weightPopularity}, freshness=${config.weightFreshness}`);

  // ─────────────────────────────────────────────────────────
  // TEST 1: "Comment configurer le VPN ?"
  // ─────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(80));
  console.log('TEST 1: "Comment configurer le VPN ?"');
  console.log('═'.repeat(80));

  const query1 = 'Comment configurer le VPN ?';
  
  // Recherche
  const { results: rawResults1 } = await searchAllProviders(query1, {
    limitPerSource: 10,
  });

  console.log(`\n📥 Résultats bruts: ${rawResults1.length}`);

  // Re-ranking
  const { results: rankedResults1, metrics: metrics1 } = rerankPipeline(rawResults1, query1, {
    maxResults: 5,
    threshold: config.similarityThreshold,
  });

  console.log(`\n📊 CLASSEMENT COMPLET (après filtrage):`);
  console.log(`   Seuil: ${config.similarityThreshold}`);
  console.log(`   Résultats retenus: ${metrics1.afterThreshold}/${metrics1.inputCount}`);
  console.log(`   Top 4 sélectionnés: ${rankedResults1.length}\n`);

  if (rankedResults1.length > 0) {
    console.log('🏆 TOP 4 FINAL:');
    rankedResults1.forEach((r, i) => {
      console.log(`\n[${i + 1}] ${r.title || 'Sans titre'}`);
      console.log(`    Source: ${r.source_type || r.provider}`);
      console.log(`    Score hybride: ${r.hybrid_score?.toFixed(3)}`);
      if (r.scores) {
        console.log(`    Détail:`);
        console.log(`      - vector:      ${r.scores.vector?.toFixed(3)} × ${config.weightVector} = ${(r.scores.vector * config.weightVector).toFixed(3)}`);
        console.log(`      - fulltext:    ${r.scores.fulltext?.toFixed(3)} × ${config.weightFulltext} = ${(r.scores.fulltext * config.weightFulltext).toFixed(3)}`);
        console.log(`      - keywords:    ${r.scores.keywords?.toFixed(3)} × ${config.weightKeywords} = ${(r.scores.keywords * config.weightKeywords).toFixed(3)}`);
        console.log(`      - popularity:  ${r.scores.popularity?.toFixed(3)} × ${config.weightPopularity} = ${(r.scores.popularity * config.weightPopularity).toFixed(3)}`);
        console.log(`      - freshness:   ${r.scores.freshness?.toFixed(3)} × ${config.weightFreshness} = ${(r.scores.freshness * config.weightFreshness).toFixed(3)}`);
      }
      console.log(`    Contenu: ${(r.content || '').substring(0, 150)}...`);
    });
  } else {
    console.log('❌ Aucun résultat retenu !');
  }

  // Vérifier si "Configuration du VPN" est dans le top 4
  const vpnInTop4 = rankedResults1.find(r => 
    r.title?.toLowerCase().includes('configuration du vpn') ||
    r.title?.toLowerCase().includes('vpn')
  );

  console.log(`\n\n✅ VÉRIFICATION:`);
  if (vpnInTop4) {
    console.log(`   ✅ "Configuration du VPN" est dans le top 4 (position #${rankedResults1.indexOf(vpnInTop4) + 1})`);
    console.log(`   Score: ${vpnInTop4.hybrid_score?.toFixed(3)}`);
  } else {
    console.log(`   ❌ "Configuration du VPN" N'EST PAS dans le top 4`);
    console.log(`   → Il est dépassé par d'autres résultats`);
  }

  // Analyser les PDF Scan*.pdf
  const scanPdfs = rankedResults1.filter(r => r.title?.startsWith('Scan'));
  if (scanPdfs.length > 0) {
    console.log(`\n\n📄 ANALYSE DES PDF Scan*.pdf:`);
    scanPdfs.forEach((pdf, i) => {
      console.log(`\n   [${i + 1}] ${pdf.title}`);
      console.log(`       Score: ${pdf.hybrid_score?.toFixed(3)}`);
      console.log(`       Contenu: ${(pdf.content || '').substring(0, 200)}...`);
    });
  }

  // ─────────────────────────────────────────────────────────
  // TEST 2: Question hors-sujet
  // ─────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(80));
  console.log('TEST 2: Question hors-sujet "Quelle est la couleur du logo ?"');
  console.log('═'.repeat(80));

  const query2 = 'Quelle est la couleur du logo ?';
  
  const { results: rawResults2 } = await searchAllProviders(query2, {
    limitPerSource: 10,
  });

  console.log(`\n📥 Résultats bruts: ${rawResults2.length}`);

  const { results: rankedResults2, metrics: metrics2 } = rerankPipeline(rawResults2, query2, {
    maxResults: 5,
    threshold: config.similarityThreshold,
  });

  console.log(`\n📊 RÉSULTATS:`);
  console.log(`   Seuil: ${config.similarityThreshold}`);
  console.log(`   Résultats retenus: ${metrics2.afterThreshold}/${metrics2.inputCount}`);
  console.log(`   Top 4 sélectionnés: ${rankedResults2.length}`);

  if (rankedResults2.length > 0) {
    console.log(`\n   Classement:`);
    rankedResults2.forEach((r, i) => {
      console.log(`   [${i + 1}] ${(r.title || 'Sans titre').substring(0, 60)} - Score: ${r.hybrid_score?.toFixed(3)}`);
    });
  } else {
    console.log(`   ✅ Aucun résultat retenu (correct pour une question hors-sujet)`);
  }

  // ─────────────────────────────────────────────────────────
  // RECOMMANDATIONS
  // ─────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(80));
  console.log('📋 RECOMMANDATIONS');
  console.log('═'.repeat(80));

  if (vpnInTop4 && rankedResults2.length === 0) {
    console.log('\n✅ PARFAIT: La configuration est optimale !');
    console.log('   - "Configuration du VPN" est dans le top 4');
    console.log('   - Les questions hors-sujet ne retournent pas de résultats');
  } else if (vpnInTop4 && rankedResults2.length > 0) {
    console.log('\n⚠️  ATTENTION: Le seuil est trop bas');
    console.log('   - "Configuration du VPN" est dans le top 4 ✓');
    console.log(`   - Mais ${rankedResults2.length} résultats hors-sujet passent aussi`);
    console.log('   → Augmenter légèrement le seuil (0.35 → 0.40)');
  } else if (!vpnInTop4 && scanPdfs.length > 0) {
    console.log('\n❌ PROBLÈME: Les PDF ont un meilleur score que l\'article VPN');
    console.log('   → Les PDF contiennent probablement le mot "configurer"');
    console.log('   → Augmenter le poids de keywords pour favoriser la correspondance exacte');
    console.log('   → Ou augmenter le seuil à 0.45 pour exclure les PDF génériques');
  } else {
    console.log('\n❌ PROBLÈME: "Configuration du VPN" n\'est pas dans le top 4');
    console.log('   → Baisser encore le seuil ou ajuster les poids');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('FIN DU TEST');
  console.log('═'.repeat(80) + '\n');

  await pool.end();
}

// Exécuter le test
testCompleteRanking().catch(err => {
  console.error('Erreur lors du test:', err);
  process.exit(1);
});