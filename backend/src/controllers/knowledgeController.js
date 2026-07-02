// src/controllers/knowledgeController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import chatbotBrain from '../services/chatbot/chatbotBrain.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { validateId } from '../utils/validationUtils.js';

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
  } catch (error) {
    console.error('Error fetching articles:', error);
    return res.status(500).json({ success: false, message: t(req, 'error_fetching_articles') });
  }
}

// ─── GET /api/knowledge/search — Pour le chatbot ─────────────
export const searchForChatbot = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim())
    return res.status(400).json({ success: false, message: t(req, 'param_q_required') });

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
});

// ─── GET /api/knowledge/:id ───────────────────────────────────
export const getArticleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

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
});

// ─── POST /api/knowledge ──────────────────────────────────────
export const createArticle = asyncHandler(async (req, res) => {
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

  const { rows } = await pool.query(
      `INSERT INTO knowledge_articles
         (title, summary, content, category, keywords, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, summary, content, category || 'Procédures', cleanKeywords, author_id]
    );
    return res.status(201).json({ success: true, message: t(req, 'article_created'), data: rows[0] });
});

// ─── PUT /api/knowledge/:id ───────────────────────────────────
export const updateArticle = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const { title, summary, content, category, keywords, is_published } = req.body;
  const { role, id: userId } = req.user;

  const cleanKeywords = Array.isArray(keywords)
    ? keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
    : typeof keywords === 'string'
      ? keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      : null;

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
});

// ─── DELETE /api/knowledge/:id ────────────────────────────────
export const deleteArticle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const { rowCount } = await pool.query(
      'DELETE FROM knowledge_articles WHERE id = $1', [id]
    );
    if (rowCount === 0)
      return res.status(404).json({ success: false, message: t(req, 'article_not_found') });
    return res.json({ success: true, message: t(req, 'article_deleted') });
});

  // ─── POST /api/knowledge/import — Import documents (Admin/Technicien) ─────────
  export const importArticlesFromExcel = asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Fichier manquant.', results: { created: [], skipped: [], errors: [] } });
      }

      const { buffer, mimetype, originalname } = req.file;
      const ext = originalname.split('.').pop()?.toLowerCase();
      const author_id = req.user.id;
      const articleIds = [];

      const normalize = (str) => str?.toString().toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const CATEGORY_MAP = {
        'procédures': 'Procédures',
        'procedures': 'Procédures',
        'solutions techniques': 'Solutions techniques',
        'solution technique': 'Solutions techniques',
        'faq': 'FAQ',
        'documentation materiel': 'Documentation matériel',
        'documentation matériel': 'Documentation matériel',
        'doc materiel': 'Documentation matériel',
      };

      const results = { created: [], skipped: [], errors: [] };

      // ── Excel (.xlsx / .xls) ────────────────────────────────────────────────
      if (ext === 'xlsx' || ext === 'xls' || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          return res.status(400).json({ success: false, message: 'Le fichier Excel est vide.', results: { created: [], skipped: [], errors: [] } });
        }

        for (const [i, row] of rows.entries()) {
          const keys = Object.keys(row);
          const findCol = (...names) => keys.find((k) => names.includes(normalize(k)));

          const title = row[findCol('titre', 'title', 'nom', 'name')]?.toString().trim();
          const summary = row[findCol('resume', 'résumé', 'summary', 'description')]?.toString().trim();
          const content = row[findCol('contenu', 'content', 'texte', 'text', 'description')]?.toString().trim();
          const categoryTxt = normalize(row[findCol('categorie', 'catégorie', 'category')]?.toString());
          const keywordsTxt = row[findCol('motscles', 'mots-clés', 'keywords', 'tags', 'mots cles')]?.toString().trim();

          if (!title || !summary || !content) {
            const missing = [];
            if (!title) missing.push('titre');
            if (!summary) missing.push('résumé');
            if (!content) missing.push('contenu');
            results.errors.push({ ligne: i + 2, titre: title || '—', raison: `Champs manquants : ${missing.join(', ')}.` });
            continue;
          }

          const category = CATEGORY_MAP[categoryTxt] || 'Procédures';
          const cleanKeywords = keywordsTxt ? keywordsTxt.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean) : [];

          try {
            const { rows: created } = await pool.query(
              `INSERT INTO knowledge_articles (title, summary, content, category, keywords, author_id, is_published)
               VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, title`,
              [title, summary, content, category, cleanKeywords, author_id]
            );
            results.created.push({ ligne: i + 2, id: created[0].id, titre: title, categorie: category });
            articleIds.push(created[0].id);
          } catch (err) {
            results.errors.push({ ligne: i + 2, titre: title, raison: `Erreur base de données : ${err.message}` });
          }
        }
      }

      // ── Word (.docx) ────────────────────────────────────────────────────────
      else if (ext === 'docx' || mimetype.includes('wordprocessingml')) {
        const { value: text } = await mammoth.extractRawText({ buffer });
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

        if (lines.length === 0) {
          return res.status(400).json({ success: false, message: 'Le document Word est vide.', results: { created: [], skipped: [], errors: [] } });
        }

        // Stratégie simple : 1er paragraphe = titre, 2e = résumé, reste = contenu
        const title = lines[0] || 'Document Word';
        const summary = lines[1] || '';
        const content = lines.slice(2).join('\n') || text;

        try {
          const { rows: created } = await pool.query(
            `INSERT INTO knowledge_articles (title, summary, content, category, keywords, author_id, is_published)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, title`,
            [title, summary, content, 'Procédures', [], author_id]
          );
          results.created.push({ ligne: 1, id: created[0].id, titre: title, categorie: 'Procédures' });
          articleIds.push(created[0].id);
        } catch (err) {
          results.errors.push({ ligne: 1, titre: title, raison: `Erreur base de données : ${err.message}` });
        }
      }

      // ── PDF (.pdf) ──────────────────────────────────────────────────────────
      else if (ext === 'pdf' || mimetype === 'application/pdf') {
        const data = await pdfParse(buffer);
        const text = data.text?.trim() || '';

        if (!text) {
          return res.status(400).json({ success: false, message: 'Le PDF ne contient pas de texte extractible.', results: { created: [], skipped: [], errors: [] } });
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const title = lines[0] || 'Document PDF';
        const summary = lines[1] || '';
        const content = lines.slice(2).join('\n') || text;

        try {
          const { rows: created } = await pool.query(
            `INSERT INTO knowledge_articles (title, summary, content, category, keywords, author_id, is_published)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, title`,
            [title, summary, content, 'Procédures', [], author_id]
          );
          results.created.push({ ligne: 1, id: created[0].id, titre: title, categorie: 'Procédures' });
          articleIds.push(created[0].id);
        } catch (err) {
          results.errors.push({ ligne: 1, titre: title, raison: `Erreur base de données : ${err.message}` });
        }
      }

      // ── Texte (.txt) ────────────────────────────────────────────────────────
      else if (ext === 'txt' || mimetype === 'text/plain') {
        const text = buffer.toString('utf-8').trim();

        if (!text) {
          return res.status(400).json({ success: false, message: 'Le fichier texte est vide.', results: { created: [], skipped: [], errors: [] } });
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const title = lines[0] || 'Document texte';
        const summary = lines[1] || '';
        const content = lines.slice(2).join('\n') || text;

        try {
          const { rows: created } = await pool.query(
            `INSERT INTO knowledge_articles (title, summary, content, category, keywords, author_id, is_published)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, title`,
            [title, summary, content, 'Procédures', [], author_id]
          );
          results.created.push({ ligne: 1, id: created[0].id, titre: title, categorie: 'Procédures' });
          articleIds.push(created[0].id);
        } catch (err) {
          results.errors.push({ ligne: 1, titre: title, raison: `Erreur base de données : ${err.message}` });
        }
      }

      // ── Format non supporté ─────────────────────────────────────────────────
      else {
        return res.status(400).json({ success: false, message: 'Format non supporté. Utilisez .xlsx, .docx, .pdf ou .txt.', results: { created: [], skipped: [], errors: [] } });
      }

      // Indexer les articles importés dans la base du chatbot
      try {
        for (const articleId of articleIds) {
          await chatbotBrain.learnFromArticle(articleId);
        }
      } catch (indexError) {
        console.error('[importArticlesFromExcel] Erreur indexation chatbot:', indexError.message);
      }

      return res.json({
        success: true,
        message: `Import terminé : ${results.created.length} créé(s), ${results.skipped.length} ignoré(s), ${results.errors.length} erreur(s).`,
        results,
      });
    } catch (error) {
      console.error('[importArticlesFromExcel] Erreur générale:', error);
      return res.status(500).json({ 
        success: false, 
        message: `Erreur lors de l'import: ${error.message}`, 
        results: { created: [], skipped: [], errors: [{ ligne: 0, titre: '—', raison: error.message }] } 
      });
    }
  });
