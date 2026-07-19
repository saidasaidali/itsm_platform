// backend/src/services/knowledgeProviders/resolvedTicketsProvider.js
// Provider for resolved tickets (PostgreSQL full-text search on tickets with status 'Résolu')
import pool from '../../db.js';

export const resolvedTicketsProvider = {
  name: 'resolved_ticket',

  /**
   * Recherche dans les tickets résolus
   * @param {string} query - Requête utilisateur
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>} Résultats formatés
   */
  async search(query, limit = 5) {
    const tsConfig = 'french';

    const sql = `
      SELECT 
        t.id, t.title, t.description, t.category, t.priority, t.status,
        t.resolved_at, t.created_at, t.updated_at,
        -- Note: ts_rank ne peut pas utiliser solution_notes si la colonne n'existe pas
        -- On utilise title + description + le contenu des commentaires via une sous-requête
        ts_rank(
          to_tsvector($2, coalesce(t.title,'') || ' ' || coalesce(t.description,'')),
          plainto_tsquery($2, $1)
        ) AS rank
      FROM tickets t
      WHERE 
        t.status IN ('Résolu', 'Fermé', 'Resolved', 'Closed')
        AND (
          to_tsvector($2, coalesce(t.title,'') || ' ' || coalesce(t.description,'')) 
          @@ plainto_tsquery($2, $1)
          OR lower(t.title) LIKE '%' || lower($1) || '%'
          OR lower(t.description) LIKE '%' || lower($1) || '%'
        )
      ORDER BY rank DESC, t.resolved_at DESC NULLS LAST
      LIMIT $3
    `;

    try {
      const { rows } = await pool.query(sql, [query, tsConfig, limit]);

      return rows.map(row => ({
        content: `[Ticket #${row.id} - ${row.status}] ${row.title}\n${(row.description || '').substring(0, 1000)}`,
        score: parseFloat(row.rank) || 0,
        source_type: 'resolved_ticket',
        source_id: row.id,
        title: `Ticket #${row.id}: ${row.title}`,
        metadata: {
          category: row.category,
          priority: row.priority,
          status: row.status,
          resolved_at: row.resolved_at,
          created_at: row.created_at,
        },
      }));
    } catch (err) {
      console.error('[resolvedTicketsProvider] Erreur:', err.message);
      return [];
    }
  },

  clearCache() {
    // Pas de cache interne
  },
};

export default resolvedTicketsProvider;