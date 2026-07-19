// Script de test standalone V2 de la correction learnedCasesProvider
// Avec correspondance de mots entiers
import pg from 'pg';
import { extractKeywords } from './src/utils/nlpUtils.js';
import { getConfig } from './src/services/ragConfig.js';

// Créer une connexion DB séparée
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'itsm_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Fonction de recherche avec correspondance de mots entiers
async function searchLearnedCases(query, limit = 3) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  try {
    const { rows } = await pool.query(
      `SELECT id, problem_summary, solution_text, source_type, source_id, hit_count, confidence_score, problem_keywords, created_at
       FROM chatbot_learned_cases 
       WHERE problem_keywords && $1 
       ORDER BY hit_count DESC, confidence_score DESC 
       LIMIT $2`,
      [keywords, limit]
    );

    return rows.map(row => {
      // Score basé sur la popularité (hit_count) et la fraîcheur
      // Le confidence_score est conservé dans les métadonnées pour information
      const hitCount = row.hit_count || 0;
      
      // Score de popularité normalisé (0 à 1)
      // hit_count de 0 → 0.0, hit_count de 10+ → 1.0
      const popularityScore = Math.min(hitCount / 10.0, 1.0);
      
      // Score de fraîcheur (plus récent = meilleur)
      const now = Date.now();
      const createdDate = new Date(row.created_at).getTime();
      const ageDays = (now - createdDate) / (1000 * 60 * 60 * 24);
      const freshnessScore = Math.max(0, Math.min(1, 1 - ageDays / 365));
      
      // Score final = moyenne de popularité et fraîcheur
      const finalScore = (popularityScore * 0.7 + freshnessScore * 0.3);

      return {
        content: row.solution_text || row.problem_summary,
        score: finalScore, // Score de pertinence basé sur popularité + fraîcheur
        source_type: 'learned_case',
        source_id: row.id,
        title: row.problem_summary,
        metadata: {
          hit_count: row.hit_count,
          confidence_score: row.confidence_score, // Gardé pour info
          source_type: row.source_type,
          source_ref_id: row.source_id,
          created_at: row.created_at,
        },
      };
    });
  } catch (err) {
    console.error('[learnedCasesProvider] Erreur:', err.message);
    return [];
  }
}

async function testFix() {
  console.log('═'.repeat(80));
  console.log('TEST FINAL V2 - Correspondance de mots entiers');
  console.log('═'.repeat(80));

  const config = getConfig();
  
  // Test 1: Recherche "VPN" (devrait matcher)
  console.log('\n1. TEST RECHERCHE "VPN" (devrait matcher):');
  console.log('-'.repeat(80));
  
  const resultsVpn = await searchLearnedCases('VPN', 5);
  
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
  
  const resultsPrint = await searchLearnedCases('IMPRIMANTE', 5);
  
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
  
  const resultsConfig = await searchLearnedCases('configuration', 5);
  
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

  await pool.end();
}

testFix().catch(err => {
  console.error('Erreur test:', err);
  process.exit(1);
});