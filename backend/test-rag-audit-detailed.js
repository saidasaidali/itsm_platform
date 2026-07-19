// Script d'audit détaillé du système RAG
// Répond aux questions de l'étape A

import pg from 'pg';
import { getConfig } from './src/services/ragConfig.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'itsm_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function audit() {
  console.log('═'.repeat(80));
  console.log('AUDIT RAG - Étape A');
  console.log('═'.repeat(80));

  // 1. Rechercher articles contenant "VPN"
  console.log('\n1. ARTICLES CONTENANT "VPN":');
  console.log('-'.repeat(80));
  
  const vpnQuery = `
    SELECT id, title, category, created_at
    FROM knowledge_articles
    WHERE lower(title) LIKE '%vpn%' 
       OR lower(content) LIKE '%vpn%'
       OR lower(summary) LIKE '%vpn%'
    ORDER BY id
  `;
  
  const vpnResult = await pool.query(vpnQuery);
  console.log(`   Articles trouvés: ${vpnResult.rows.length}`);
  vpnResult.rows.forEach(row => {
    console.log(`   - ${row.id}: ${row.title} (${row.category})`);
  });

  // 2. Vérifier les embeddings des KB-001, KB-006, KB-009, KB-012
  console.log('\n2. EMBEDDINGS DANS document_chunks:');
  console.log('-'.repeat(80));
  
  const embeddingQuery = `
    SELECT 
      dc.document_id,
      pd.original_filename,
      COUNT(*) as chunk_count,
      COUNT(dc.embedding) as embedding_count,
      MIN(LENGTH(dc.embedding::text)) as min_embedding_length,
      MAX(LENGTH(dc.embedding::text)) as max_embedding_length
    FROM document_chunks dc
    JOIN pdf_documents pd ON pd.id = dc.document_id
    WHERE pd.original_filename LIKE 'KB-00%'
    GROUP BY dc.document_id, pd.original_filename
    ORDER BY dc.document_id
  `;
  
  const embeddingResult = await pool.query(embeddingQuery);
  console.log(`   Documents KB trouvés: ${embeddingResult.rows.length}`);
  embeddingResult.rows.forEach(row => {
    console.log(`   - ${row.original_filename}:`);
    console.log(`     Chunks: ${row.chunk_count}, Embeddings: ${row.embedding_count}`);
    console.log(`     Longueur embedding: ${row.min_embedding_length} - ${row.max_embedding_length} chars`);
  });

  // 3. Vérifier la configuration RAG
  console.log('\n3. CONFIGURATION RAG:');
  console.log('-'.repeat(80));
  
  const config = getConfig();
  console.log(`   RAG_SIMILARITY_THRESHOLD: ${config.similarityThreshold}`);
  console.log(`   RAG_MAX_RESULTS: ${config.maxResults}`);
  console.log(`   Poids vector: ${config.weightVector}`);
  console.log(`   Poids fulltext: ${config.weightFulltext}`);
  console.log(`   Poids keywords: ${config.weightKeywords}`);
  console.log(`   Poids popularity: ${config.weightPopularity}`);
  console.log(`   Poids freshness: ${config.weightFreshness}`);

  // 4. Tester le score pour "VPN"
  console.log('\n4. TEST RECHERCHE "VPN":');
  console.log('-'.repeat(80));
  
  const testQuery = `
    SELECT 
      id,
      title,
      ts_rank(
        to_tsvector('french', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')),
        plainto_tsquery('french', $1)
      ) as rank
    FROM knowledge_articles
    WHERE 
      to_tsvector('french', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) 
      @@ plainto_tsquery('french', $1)
      OR lower(title) LIKE '%' || lower($1) || '%'
      OR lower(content) LIKE '%' || lower($1) || '%'
    ORDER BY rank DESC
    LIMIT 5
  `;
  
  const testResult = await pool.query(testQuery, ['VPN']);
  console.log(`   Résultats pour "VPN": ${testResult.rows.length}`);
  testResult.rows.forEach((row, i) => {
    console.log(`   [${i + 1}] ${row.id}: ${row.title}`);
    console.log(`       Rank (fulltext): ${row.rank}`);
  });

  // 5. Vérifier les cas appris
  console.log('\n5. CAS APPRIS CONTENANT "VPN":');
  console.log('-'.repeat(80));
  
  const learnedQuery = `
    SELECT id, problem_summary, confidence_score, hit_count
    FROM chatbot_learned_cases
    WHERE lower(problem_summary) LIKE '%vpn%'
       OR lower(solution_text) LIKE '%vpn%'
    ORDER BY id
  `;
  
  const learnedResult = await pool.query(learnedQuery);
  console.log(`   Cas appris trouvés: ${learnedResult.rows.length}`);
  learnedResult.rows.forEach(row => {
    console.log(`   - ${row.id}: ${row.problem_summary}`);
    console.log(`     Confidence: ${row.confidence_score}, Hits: ${row.hit_count}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('FIN DE L\'AUDIT');
  console.log('═'.repeat(80) + '\n');

  await pool.end();
}

audit().catch(err => {
  console.error('Erreur audit:', err);
  process.exit(1);
});