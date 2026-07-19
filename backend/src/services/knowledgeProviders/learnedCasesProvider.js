// backend/src/services/knowledgeProviders/learnedCasesProvider.js
// Provider for learned cases (chatbot_learned_cases table)
import pool from '../../db.js';
import { extractKeywords } from '../../utils/nlpUtils.js';

export const learnedCasesProvider = {
  name: 'learned_case',

  /**
   * Recherche dans les cas appris (chatbot_learned_cases)
   * Utilise l'opérateur PostgreSQL && (chevauchement de tableaux) sur problem_keywords
   * @param {string} query - Requête utilisateur
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>} Résultats formatés
   */
  async search(query, limit = 3) {
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
            problem_keywords: row.problem_keywords || [], // Ajouté pour le calcul keywords du reranker
          },
        };
      });
    } catch (err) {
      console.error('[learnedCasesProvider] Erreur:', err.message);
      return [];
    }
  },

  clearCache() {
    // Pas de cache interne
  },
};

export default learnedCasesProvider;