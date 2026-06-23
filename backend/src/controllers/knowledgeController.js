// src/controllers/knowledgeController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';

// ─── GET /api/knowledge — Liste + recherche full-text ─────────
export async function getArticles(req, res) {
  try {
    const { category, search } = req.query;
    const params = [];
    let where = 'WHERE k.is_published = TRUE';

    if (category && category !== 'Tous') {
      params.push(category);
      where += ` AND k.category = $${params.length}`;
    }

    if (search) {
      params.push(search);
      where += `
        AND (
          to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content)
          @@ plainto_tsquery('french', $${params.length})
          OR k.title    ILIKE '%' || $${params.length} || '%'
          OR k.summary  ILIKE '%' || $${params.length} || '%'
          OR $${params.length} = ANY(k.keywords)
        )`;
    }

    const { rows } = await pool.query(
      `SELECT k.id, k.title, k.summary, k.category, k.keywords,
              k.views_count, k.is_published, k.created_at, k.updated_at,
              u.username AS author_name
       FROM knowledge_articles k
       LEFT JOIN users u ON k.author_id = u.id
       ${where}
       ORDER BY k.updated_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getArticles]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/knowledge/search — Pour le chatbot ─────────────
export async function searchForChatbot(req, res) {
  const { q } = req.query;
  if (!q?.trim())
    return res.status(400).json({ success: false, message: t(req, 'param_q_required') });

  try {
    const { rows } = await pool.query(
      `SELECT k.id, k.title, k.summary, k.category, k.keywords,
              u.username AS author_name,
              ts_rank(
                to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content),
                plainto_tsquery('french', $1)
              ) AS relevance
       FROM knowledge_articles k
       LEFT JOIN users u ON k.author_id = u.id
       WHERE k.is_published = TRUE
         AND (
           to_tsvector('french', k.title || ' ' || k.summary || ' ' || k.content)
           @@ plainto_tsquery('french', $1)
           OR k.title   ILIKE '%' || $1 || '%'
           OR $1 = ANY(k.keywords)
         )
       ORDER BY relevance DESC
       LIMIT 5`,
      [q.trim()]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[searchForChatbot]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/knowledge/:id ───────────────────────────────────
export async function getArticleById(req, res) {
  const { id } = req.params;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') });

  try {
    // Incrémenter le compteur de vues
    await pool.query(
      `UPDATE knowledge_articles SET views_count = views_count + 1 WHERE id = $1`,
      [id]
    );

    const { rows } = await pool.query(
      `SELECT k.*, u.username AS author_name
       FROM knowledge_articles k
       LEFT JOIN users u ON k.author_id = u.id
       WHERE k.id = $1`,
      [id]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: t(req, 'article_not_found') });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getArticleById]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── POST /api/knowledge ──────────────────────────────────────
export async function createArticle(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { title, summary, content, category, keywords } = req.body;
  const author_id = req.user.id;

  // Nettoyer les mots-clés : "VPN, réseau, accès" → ['vpn','réseau','accès']
  const cleanKeywords = Array.isArray(keywords)
    ? keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
    : typeof keywords === 'string'
      ? keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      : [];

  try {
    const { rows } = await pool.query(
      `INSERT INTO knowledge_articles
         (title, summary, content, category, keywords, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, summary, content, category || 'Procédures', cleanKeywords, author_id]
    );
    return res.status(201).json({ success: true, message: t(req, 'article_created'), data: rows[0] });
  } catch (err) {
    console.error('[createArticle]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PUT /api/knowledge/:id ───────────────────────────────────
export async function updateArticle(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') });

  const { title, summary, content, category, keywords, is_published } = req.body;
  const { role, id: userId } = req.user;

  const cleanKeywords = Array.isArray(keywords)
    ? keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
    : typeof keywords === 'string'
      ? keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      : null;

  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM knowledge_articles WHERE id = $1', [id]
    );
    if (!existing[0])
      return res.status(404).json({ success: false, message: t(req, 'article_not_found') });

    // Un technicien ne peut modifier que ses propres articles
    if (role === 'Technicien' && existing[0].author_id !== userId)
      return res.status(403).json({ success: false, message: t(req, 'can_only_edit_own_articles') });

    const { rows } = await pool.query(
      `UPDATE knowledge_articles SET
         title        = COALESCE($1, title),
         summary      = COALESCE($2, summary),
         content      = COALESCE($3, content),
         category     = COALESCE($4, category),
         keywords     = COALESCE($5, keywords),
         is_published = COALESCE($6, is_published),
         updated_at   = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, summary, content, category, cleanKeywords, is_published, id]
    );
    return res.json({ success: true, message: t(req, 'article_updated'), data: rows[0] });
  } catch (err) {
    console.error('[updateArticle]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── DELETE /api/knowledge/:id ────────────────────────────────
export async function deleteArticle(req, res) {
  const { id } = req.params;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM knowledge_articles WHERE id = $1', [id]
    );
    if (rowCount === 0)
      return res.status(404).json({ success: false, message: t(req, 'article_not_found') });
    return res.json({ success: true, message: t(req, 'article_deleted') });
  } catch (err) {
    console.error('[deleteArticle]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}