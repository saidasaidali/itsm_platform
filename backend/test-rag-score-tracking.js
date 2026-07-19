// Script de tracking des scores RAG pour identifier l'origine du 0.87
import pg from 'pg';
import { searchAllProviders } from './src/services/knowledgeProviders/index.js';
import { rerankPipeline } from './src/services/reranker.js';
import { getConfig } from './src/services/ragConfig.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'itsm_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function trackScores() {
  console.log('═'.repeat(80));
  console.log('TRACKING DES SCORES RAG - Recherche "VPN"');
  console.log('═'.repeat(80));

  const config = getConfig();
  const query = 'VPN';

  // 1. Recherche brute via tous les providers
  console.log('\n1. RÉSULTATS BRUTS DES PROVIDERS:');
  console.log('-'.repeat(80));
  
  const { results: rawResults, metrics: searchMetrics } = await searchAllProviders(query, {
    limitPerSource: 10,
  });

  console.log(`   Total résultats bruts: ${rawResults.length}`);
  console.log(`   Sources interrogées: ${searchMetrics.totalSources}`);
  
  rawResults.forEach((result, i) => {
    console.log(`\n   [${i + 1}] ${result.source_type || result.provider}:`);
    console.log(`       Titre: ${(result.title || '').substring(0, 60)}`);
    console.log(`       Score brut: ${result.score}`);
    console.log(`       Source ID: ${result.source_id}`);
  });

  // 2. Re-ranking complet
  console.log('\n\n2. APRÈS RE-RANKING:');
  console.log('-'.repeat(80));
  
  const { results: rankedResults, metrics: rerankMetrics } = rerankPipeline(rawResults, query, {
    maxResults: config.maxResults,
    threshold: config.similarityThreshold,
  });

  console.log(`   Résultats après re-ranking: ${rerankMetrics.finalCount}`);
  console.log(`   Seuil appliqué: ${config.similarityThreshold}`);
  
  rankedResults.forEach((result, i) => {
    console.log(`\n   [${i + 1}] ${result.source_type || result.provider}:`);
    console.log(`       Titre: ${(result.title || '').substring(0, 60)}`);
    console.log(`       Hybrid score: ${result.hybrid_score?.toFixed(4)}`);
    console.log(`       Scores détaillés:`);
    console.log(`         - vector: ${result.scores?.vector?.toFixed(4)}`);
    console.log(`         - fulltext: ${result.scores?.fulltext?.toFixed(4)}`);
    console.log(`         - keywords: ${result.scores?.keywords?.toFixed(4)}`);
    console.log(`         - popularity: ${result.scores?.popularity?.toFixed(4)}`);
    console.log(`         - freshness: ${result.scores?.freshness?.toFixed(4)}`);
  });

  // 3. Vérifier les cas appris en détail
  console.log('\n\n3. DÉTAIL DES CAS APPRIS:');
  console.log('-'.repeat(80));
  
  const learnedCases = rawResults.filter(r => r.source_type === 'learned_case');
  if (learnedCases.length > 0) {
    const learnedQuery = `
      SELECT id, problem_summary, confidence_score, hit_count, problem_keywords, created_at
      FROM chatbot_learned_cases
      WHERE id = ANY($1::integer[])
    `;
    
    const learnedResult = await pool.query(learnedQuery, [learnedCases.map(r => r.source_id)]);
    
    learnedResult.rows.forEach(row => {
      console.log(`\n   Cas #${row.id}:`);
      console.log(`     Problème: ${row.problem_summary}`);
      console.log(`     Confidence: ${row.confidence_score}`);
      console.log(`     Hit count: ${row.hit_count}`);
      console.log(`     Keywords: ${row.problem_keywords?.join(', ')}`);
      console.log(`     Créé: ${row.created_at}`);
    });
  } else {
    console.log('   Aucun cas appris trouvé dans les résultats');
  }

  // 4. Vérifier les articles KB en détail
  console.log('\n\n4. DÉTAIL DES ARTICLES KB:');
  console.log('-'.repeat(80));
  
  const kbArticles = rawResults.filter(r => r.source_type === 'knowledge_base');
  if (kbArticles.length > 0) {
    const kbQuery = `
      SELECT id, title, views_count, created_at, updated_at
      FROM knowledge_articles
      WHERE id = ANY($1::integer[])
    `;
    
    const kbResult = await pool.query(kbQuery, [kbArticles.map(r => r.source_id)]);
    
    kbResult.rows.forEach(row => {
      console.log(`\n   Article #${row.id}:`);
      console.log(`     Titre: ${row.title}`);
      console.log(`     Vues: ${row.views_count}`);
      console.log(`     Créé: ${row.created_at}`);
      console.log(`     Mis à jour: ${row.updated_at}`);
    });
  } else {
    console.log('   Aucun article KB trouvé dans les résultats');
  }

  // 5. Simulation du calcul de score pour chaque résultat
  console.log('\n\n5. SIMULATION DU CALCUL DE SCORE HYBRIDE:');
  console.log('-'.repeat(80));
  
  const queryKeywords = ['vpn']; // Mots-clés extraits de "VPN"
  
  rawResults.forEach((result, i) => {
    const vectorScore = result.score || 0;
    const fullTextScore = typeof result.score === 'number' ? result.score : 0;
    
    const contentLower = (result.content || '').toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
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
    
    console.log(`\n   [${i + 1}] ${result.source_type}:`);
    console.log(`       vector (${config.weightVector}): ${vectorScore.toFixed(4)} → ${(vectorScore * config.weightVector).toFixed(4)}`);
    console.log(`       fulltext (${config.weightFulltext}): ${fullTextScore.toFixed(4)} → ${(fullTextScore * config.weightFulltext).toFixed(4)}`);
    console.log(`       keywords (${config.weightKeywords}): ${keywordScore.toFixed(4)} → ${(keywordScore * config.weightKeywords).toFixed(4)}`);
    console.log(`       popularity (${config.weightPopularity}): ${popularityScore.toFixed(4)} → ${(popularityScore * config.weightPopularity).toFixed(4)}`);
    console.log(`       freshness (${config.weightFreshness}): ${freshnessScore.toFixed(4)} → ${(freshnessScore * config.weightFreshness).toFixed(4)}`);
    console.log(`       TOTAL HYBRID: ${hybridScore.toFixed(4)}`);
    console.log(`       PASSES THRESHOLD (${config.similarityThreshold}): ${hybridScore >= config.similarityThreshold ? 'OUI' : 'NON'}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('FIN DU TRACKING');
  console.log('═'.repeat(80) + '\n');

  await pool.end();
}

trackScores().catch(err => {
  console.error('Erreur tracking:', err);
  process.exit(1);
});