// backend/src/services/autoTicketing/suggestionEngine.js
import pool from '../../db.js';

// ── Extraire des mots-clés significatifs du titre/description ──
function extractKeywords(text) {
  const stopWords = new Set([
    'le','la','les','de','des','du','un','une','et','ou','est','sont',
    'pour','dans','sur','avec','sans','ce','cette','mon','ma','mes',
    'que','qui','quoi','comment','pourquoi','plus','moins','très',
    'pas','par','au','aux','en','il','elle','ils','elles','on','nous',
    'vous','je','tu','me','te','se','ne','ni','si','car','donc',
  ]);
  return text
    .toLowerCase()
    .replace(/[^\wàâäéèêëïîôöùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 8);
}

// ── 1. Suggérer des articles de la base de connaissance ────────
// Seuil de pertinence minimum : évite de retourner des articles
// qui ne matchent que la catégorie ou un seul mot-clé périphérique
export async function suggestKnowledgeArticles(title, description, category) {
  const keywords = extractKeywords(`${title} ${description}`);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' & ');

  const { rows } = await pool.query(
    `SELECT k.id, k.title, k.summary, k.category,
            ts_rank(
              to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content),
              to_tsquery('french', $1)
            ) AS relevance
     FROM knowledge_articles k
     WHERE k.is_published = TRUE
       AND to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content)
           @@ to_tsquery('french', $1)
     ORDER BY
       -- Bonus si le titre contient un des mots-clés (résultat plus précis)
       ts_rank(to_tsvector('french', k.title), to_tsquery('french', $1)) DESC,
       relevance DESC,
       k.views_count DESC
     LIMIT 3`,
    [searchQuery]
  );

  // Filtre supplémentaire côté JS : ne garder que les résultats
  // avec une pertinence minimale pour éviter les faux positifs
  return rows.filter((r) => parseFloat(r.relevance) > 0.01);
}

// ── 2. Suggérer des tickets similaires déjà résolus ─────────────
export async function suggestSimilarTickets(title, description, category, excludeTicketId = null) {
  const keywords = extractKeywords(`${title} ${description}`);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' & ');
  const params = [searchQuery];
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
              to_tsquery('french', $1)
            ) AS relevance,
            (
              SELECT c.message FROM ticket_comments c
              WHERE c.ticket_id = t.id AND c.is_internal = TRUE
              ORDER BY c.created_at DESC LIMIT 1
            ) AS last_internal_note
     FROM tickets t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.status IN ('Résolu', 'Clôturé')
       AND to_tsvector('french', t.title || ' ' || t.description)
           @@ to_tsquery('french', $1)
       ${excludeClause}
     ORDER BY
       ts_rank(to_tsvector('french', t.title), to_tsquery('french', $1)) DESC,
       relevance DESC,
       t.resolved_at DESC
     LIMIT 3`,
    params
  );

  return rows.filter((r) => parseFloat(r.relevance) > 0.01);
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

// ── 4. Recherche pour le chatbot ────────────────────────────────
// Retourne les articles les plus pertinents avec leur contenu complet
// pour que le chatbot puisse construire une réponse à partir du texte réel
export async function searchKnowledgeForChat(query, limit = 3) {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' & ');

  const { rows } = await pool.query(
    `SELECT k.id, k.title, k.summary, k.content, k.category, k.keywords,
            ts_rank(
              to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content),
              to_tsquery('french', $1)
            ) AS relevance
     FROM knowledge_articles k
     WHERE k.is_published = TRUE
       AND to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content)
           @@ to_tsquery('french', $1)
     ORDER BY
       ts_rank(to_tsvector('french', k.title), to_tsquery('french', $1)) DESC,
       relevance DESC
     LIMIT $2`,
    [searchQuery, limit]
  );

  return rows.filter((r) => parseFloat(r.relevance) > 0.01);
}

export default {
  suggestKnowledgeArticles,
  suggestSimilarTickets,
  getSuggestions,
  searchKnowledgeForChat,
};