// backend/src/services/autoTicketing/suggestionEngine.js
// Suggère des articles de la base de connaissance + tickets similaires résolus
import pool from '../../db.js';

// ── Extraire des mots-clés significatifs du titre/description ──
function extractKeywords(text) {
  const stopWords = new Set([
    'le','la','les','de','des','du','un','une','et','ou','est','sont',
    'pour','dans','sur','avec','sans','ce','cette','mon','ma','mes',
    'que','qui','quoi','comment','pourquoi','plus','moins','très',
  ]);
  return text
    .toLowerCase()
    .replace(/[^\wàâäéèêëïîôöùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 8); // garder les 8 mots les plus pertinents
}

// ── 1. Suggérer des articles de la base de connaissance ────────
export async function suggestKnowledgeArticles(title, description, category) {
  const keywords = extractKeywords(`${title} ${description}`);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' ');

  const { rows } = await pool.query(
    `SELECT k.id, k.title, k.summary, k.category,
            ts_rank(
              to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content),
              plainto_tsquery('french', $1)
            ) AS relevance
     FROM knowledge_articles k
     WHERE k.is_published = TRUE
       AND (
         to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content)
         @@ plainto_tsquery('french', $1)
         OR k.category = $2
         OR k.keywords && $3::text[]
       )
     ORDER BY relevance DESC, k.views_count DESC
     LIMIT 3`,
    [searchQuery, category || '', keywords]
  );

  return rows;
}

// ── 2. Suggérer des tickets similaires déjà résolus ─────────────
export async function suggestSimilarTickets(title, description, category, excludeTicketId = null) {
  const keywords = extractKeywords(`${title} ${description}`);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' ');
  const params = [searchQuery, category || ''];
  let excludeClause = '';
  if (excludeTicketId) {
    params.push(excludeTicketId);
    excludeClause = `AND t.id != $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.description, t.category, t.resolved_at,
            u.username AS resolved_by_name,
            ts_rank(
              to_tsvector('french', t.title || ' ' || t.description),
              plainto_tsquery('french', $1)
            ) AS relevance,
            (
              SELECT c.message FROM ticket_comments c
              WHERE c.ticket_id = t.id AND c.is_internal = TRUE
              ORDER BY c.created_at DESC LIMIT 1
            ) AS last_internal_note
     FROM tickets t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.status IN ('Résolu', 'Clôturé')
       AND (
         to_tsvector('french', t.title || ' ' || t.description)
         @@ plainto_tsquery('french', $1)
         OR t.category = $2
       )
       ${excludeClause}
     ORDER BY relevance DESC, t.resolved_at DESC
     LIMIT 3`,
    params
  );

  return rows;
}

// ── 3. Combiner les deux pour une suggestion complète ───────────
export async function getSuggestions(title, description, category, excludeTicketId = null) {
  const [articles, similarTickets] = await Promise.all([
    suggestKnowledgeArticles(title, description, category),
    suggestSimilarTickets(title, description, category, excludeTicketId),
  ]);

  return {
    articles,
    similarTickets,
    hasSuggestions: articles.length > 0 || similarTickets.length > 0,
  };
}

export default { suggestKnowledgeArticles, suggestSimilarTickets, getSuggestions };