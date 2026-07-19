// backend/src/services/knowledgeProviders/knowledgeBaseProvider.js
// Provider for Knowledge Base articles (PostgreSQL full-text search)
import pool from '../../db.js';

export const knowledgeBaseProvider = {
  name: 'knowledge_base',

  /**
   * Recherche dans les articles de la base de connaissances
   * @param {string} query - Requête utilisateur
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>} Résultats formatés
   */
  async search(query, limit = 5) {
    const tsConfig = 'french';

    // CORRECTION: utiliser websearch_to_tsquery pour une recherche plus tolérante
    // (gère les accents, les variations, les opérateurs implicites)
    // et ajouter un fallback LIKE élargi si la recherche full-text échoue
    const sql = `
      WITH fulltext_results AS (
        SELECT 
          id, title, summary, content, category, created_at,
          ts_rank(
            to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')),
            websearch_to_tsquery($2, $1)
          ) AS rank
        FROM knowledge_articles
        WHERE 
          is_published = TRUE
          AND (
            to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) 
            @@ websearch_to_tsquery($2, $1)
          )
      ),
      fallback_results AS (
        SELECT 
          id, title, summary, content, category, created_at,
          0.1 AS rank  -- Score faible pour le fallback LIKE
        FROM knowledge_articles
        WHERE 
          is_published = TRUE
          AND id NOT IN (SELECT id FROM fulltext_results)
          AND (
            lower(title) LIKE '%' || lower($1) || '%'
            OR lower(content) LIKE '%' || lower($1) || '%'
            OR lower(summary) LIKE '%' || lower($1) || '%'
          )
      )
      SELECT * FROM (
        SELECT * FROM fulltext_results
        UNION ALL
        SELECT * FROM fallback_results
      ) combined
      ORDER BY rank DESC, views_count DESC
      LIMIT $3
    `;

    const { rows } = await pool.query(sql, [query, tsConfig, limit]);

    // Log détaillé en mode debug
    const config = (await import('../ragConfig.js')).getConfig();
    if (config.debugMode) {
      console.log(`\n[knowledgeBaseProvider] 🔍 Recherche KB: "${query.substring(0, 50)}"`);
      console.log(`[knowledgeBaseProvider]   ${rows.length} résultats bruts trouvés`);
      if (rows.length > 0) {
        rows.forEach((row, i) => {
          const rank = parseFloat(row.rank) || 0;
          console.log(`[knowledgeBaseProvider]   [${i + 1}] ${row.title.substring(0, 60)} (rank: ${rank.toFixed(3)})`);
        });
      }
    }

    return rows.map(row => {
      const rank = parseFloat(row.rank) || 0;
      return {
        content: row.content || row.summary || '',
        fulltext_score: rank,  // CORRECTION: champ séparé pour le score full-text
        score: rank,  // Garder pour compatibilité
        source_type: 'knowledge_base',
        source_id: row.id,
        title: row.title,
        metadata: {
          category: row.category,
          created_at: row.created_at,
          views_count: row.views_count || 0,
          hit_count: row.hit_count || 0,
        },
      };
    });
  },

  /**
   * Nettoie le cache interne si existant
   */
  clearCache() {
    // Pas de cache interne pour ce provider
  },
};

export default knowledgeBaseProvider;