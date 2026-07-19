import pool from '../db.js';

/**
 * Recherche full-text dans la base de connaissances
 * @param {string} query - La requête de recherche
 * @param {object} options - Options de recherche
 * @param {string} [options.language='fr'] - Langue ('fr' ou 'en')
 * @param {number} [options.limit=5] - Nombre de résultats max
 * @param {number} [options.offset=0] - Offset pour pagination
 * @param {boolean} [options.includeLikeFallback=true] - Inclure fallback LIKE
 * @param {string} [options.select='*'] - Colonnes à sélectionner
 * @param {string} [options.orderBy='rank DESC'] - Ordre de tri
 * @param {string} [options.additionalWhere=''] - Conditions WHERE supplémentaires
 * @param {Array} [options.additionalParams=[]] - Paramètres supplémentaires
 * @returns {Promise<Array>} Résultats de la recherche
 */
export async function searchKnowledgeBase(query, options = {}) {
  const {
    assetType = null,
    language = 'fr',
    limit = 5,
    offset = 0,
    includeLikeFallback = true,
    select = 'id, title, summary, content, category, created_at',
    orderBy = 'rank DESC',
    additionalWhere = '',
    additionalParams = []
  } = options;

  let queryText = query;
  if (assetType) {
    queryText += ` ${assetType}`;
  }

  const tsConfig = language === 'en' ? 'english' : 'french';
  const rankExpr = `ts_rank(to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')), plainto_tsquery($2, $1))`;

  const whereClauses = [
    `to_tsvector($2, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) @@ plainto_tsquery($2, $1)`,
    includeLikeFallback ? `(lower(title) LIKE '%' || lower($1) || '%' OR lower(content) LIKE '%' || lower($1) || '%')` : null,
    additionalWhere || null
  ].filter(Boolean);

  const sql = `
    SELECT ${select}, ${rankExpr} AS rank
    FROM knowledge_articles
    WHERE ${whereClauses.join(' OR ')}
    ORDER BY ${orderBy}
    LIMIT $${additionalParams.length + 3} OFFSET $${additionalParams.length + 4}
  `;

  try {
    const queryParams = [queryText, tsConfig, ...additionalParams, limit, offset];
    const { rows } = await pool.query(sql, queryParams);
    return rows;
  } catch (error) {
    console.error('[KnowledgeBaseSearch] Error:', error.message);
    console.error('[KnowledgeBaseSearch] SQL:', sql);
    console.error('[KnowledgeBaseSearch] QueryParams count:', queryParams.length);
    console.error('[KnowledgeBaseSearch] Expected placeholders:', additionalParams.length + 4);
    return [];
  }
}
