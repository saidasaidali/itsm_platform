// backend/src/services/technicianRecommender.js
// Système de recommandation de technicien basé sur l'IA
import pool from '../db.js';

/**
 * Calcule un score de recommandation pour chaque technicien
 * 
 * FORMULE DE CALCUL (score sur 100) :
 * 
 * Score Total = (Disponibilité × 0.50) + (Compétences Catégorie × 0.25) + 
 *               (Taux Résolution × 0.15) + (Vitesse × 0.10)
 * 
 * CRITÈRES :
 * 1. Disponibilité (50%) - PRIORITAIRE
 *    - 0 tickets actifs = 100 pts
 *    - 1 ticket = 90 pts
 *    - 2 tickets = 80 pts
 *    - 3 tickets = 60 pts
 *    - 4 tickets = 40 pts
 *    - 5 tickets = 20 pts
 *    - 6+ tickets = 0-10 pts
 * 
 * 2. Compétences dans la catégorie du ticket (25%)
 *    - Basé sur le taux de résolution dans cette catégorie (6 derniers mois)
 *    - Bonus de +20 si expérience
 * 
 * 3. Taux de résolution global (15%)
 *    - Basé sur tous les tickets résolus (3 derniers mois)
 * 
 * 4. Vitesse de résolution (10%)
 *    - < 4h = 100 pts
 *    - 4-24h = 70-100 pts
 *    - 24-72h = 40-70 pts
 *    - > 72h = 0-40 pts
 * 
 * TRI :
 * - Par score DÉCROISSANT (meilleur en premier)
 * - En cas d'égalité : priorité au technicien avec le moins de tickets actifs
 */
export async function recommendTechnician(ticketCategory, ticketPriority) {
  try {
    // 1. Récupérer tous les techniciens actifs avec leurs stats complètes
    const { rows: technicians } = await pool.query(`
      SELECT 
        u.id, 
        u.username,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('Résolu', 'Clôturé')) AS active_tickets,
        COUNT(t.id) FILTER (WHERE t.status IN ('Résolu', 'Clôturé') AND t.category = $1) AS category_resolved,
        COUNT(t.id) FILTER (WHERE t.category = $1) AS category_total,
        COUNT(t.id) FILTER (WHERE t.status IN ('Résolu', 'Clôturé')) AS total_resolved,
        COUNT(t.id) AS total_tickets,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_hours
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.created_at > NOW() - INTERVAL '6 months'
      WHERE r.name = 'Technicien' AND u.status = 'active'
      GROUP BY u.id, u.username
      ORDER BY active_tickets ASC
    `, [ticketCategory]);

    if (technicians.length === 0) return null;

    console.log(`[Recommendation] Analyse de ${technicians.length} techniciens pour catégorie: ${ticketCategory}`);
    console.log('[Recommendation] Données brutes depuis la plateforme:');
    technicians.forEach(tech => {
      console.log(`  ${tech.username}:`, {
        tickets_actifs: tech.active_tickets,
        tickets_categorie_total: tech.category_total,
        tickets_categorie_resolus: tech.category_resolved,
        tickets_total: tech.total_tickets,
        tickets_resolus_total: tech.total_resolved,
        vitesse_moyenne_heures: tech.avg_hours ? `${Math.round(tech.avg_hours)}h` : 'N/A'
      });
    });

    // 2. Calculer le score pour chaque technicien de manière transparente
    const recommendations = technicians.map(tech => {
      const activeTickets = parseInt(tech.active_tickets) || 0;
      
      // Critère 1: Disponibilité (50% du score)
      // 0 tickets = 100, 1 = 90, 2 = 80, 3 = 60, 4 = 40, 5 = 20, 6+ = 0
      let workloadScore;
      if (activeTickets === 0) workloadScore = 100;
      else if (activeTickets === 1) workloadScore = 90;
      else if (activeTickets === 2) workloadScore = 80;
      else if (activeTickets === 3) workloadScore = 60;
      else if (activeTickets === 4) workloadScore = 40;
      else if (activeTickets === 5) workloadScore = 20;
      else workloadScore = Math.max(0, 10 - (activeTickets - 6) * 2);

      // Critère 2: Compétences dans la catégorie (25%)
      const categoryTotal = parseInt(tech.category_total) || 0;
      const categoryResolved = parseInt(tech.category_resolved) || 0;
      const categoryRate = categoryTotal > 0 ? categoryResolved / categoryTotal : 0.5;
      const categoryScore = Math.min(100, categoryRate * 100 + 20); // Bonus si expérience

      // Critère 3: Taux de résolution global (15%)
      const totalTickets = parseInt(tech.total_tickets) || 0;
      const totalResolved = parseInt(tech.total_resolved) || 0;
      const skillScore = totalTickets > 0 ? (totalResolved / totalTickets) * 100 : 50;

      // Critère 4: Vitesse de résolution (10%)
      const avgHours = parseFloat(tech.avg_hours) || 0;
      let speedScore = 50;
      if (avgHours > 0) {
        if (avgHours <= 4) speedScore = 100;
        else if (avgHours <= 24) speedScore = 100 - ((avgHours - 4) / 20) * 30;
        else if (avgHours <= 72) speedScore = 70 - ((avgHours - 24) / 48) * 30;
        else speedScore = Math.max(0, 40 - ((avgHours - 72) / 48) * 40);
      }

      // Score total pondéré
      const total = 
        workloadScore * 0.50 +
        categoryScore * 0.25 +
        skillScore * 0.15 +
        speedScore * 0.10;

      return {
        id: tech.id,
        username: tech.username,
        active_tickets: activeTickets,
        score: Math.round(total * 10) / 10,
        details: {
          workloadScore: Math.round(workloadScore),
          categoryScore: Math.round(categoryScore),
          skillScore: Math.round(skillScore),
          speedScore: Math.round(speedScore),
          total: Math.round(total * 10) / 10,
        }
      };
    });

    // 3. Trier par score DÉCROISSANT (meilleur score en premier)
    recommendations.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.active_tickets - b.active_tickets; // En cas d'égalité, prioriser le moins chargé
    });

    // 4. Logs détaillés pour debug
    console.log(`[Recommendation] Classement final pour ${ticketCategory}:`);
    console.log(`[Recommendation] Formule: (disponibilité × 0.50) + (catégorie × 0.25) + (compétences × 0.15) + (vitesse × 0.10)`);
    recommendations.slice(0, 5).forEach((r, i) => {
      const calculatedScore = (
        r.details.workloadScore * 0.50 +
        r.details.categoryScore * 0.25 +
        r.details.skillScore * 0.15 +
        r.details.speedScore * 0.10
      ).toFixed(1);
      console.log(`  ${i + 1}. ${r.username} - Score: ${r.score}/100`, {
        disponibilite: `${r.details.workloadScore}/100 (${r.active_tickets} tickets actifs) → ${(r.details.workloadScore * 0.50).toFixed(1)} pts`,
        competences_categorie: `${r.details.categoryScore}/100 → ${(r.details.categoryScore * 0.25).toFixed(1)} pts`,
        taux_resolution_global: `${r.details.skillScore}/100 → ${(r.details.skillScore * 0.15).toFixed(1)} pts`,
        vitesse_resolution: `${r.details.speedScore}/100 → ${(r.details.speedScore * 0.10).toFixed(1)} pts`,
        total_calcule: `${calculatedScore} pts`
      });
    });

    // 5. Retourner le meilleur technicien avec le top 3
    return {
      recommended: recommendations[0],
      top3: recommendations.slice(0, 3),
      all: recommendations,
    };
  } catch (err) {
    console.error('[recommendTechnician]', err.message);
    return null;
  }
}

/**
 * Récupère les statistiques détaillées d'un technicien
 */
export async function getTechnicianStats(technicianId) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.username,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('Résolu', 'Clôturé')) AS active_tickets,
        COUNT(t.id) FILTER (WHERE t.status IN ('Résolu', 'Clôturé')) AS resolved_tickets,
        AVG(
          EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
        ) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution_hours,
        COUNT(t.id) FILTER (WHERE t.category = 'Matériel') AS hardware_tickets,
        COUNT(t.id) FILTER (WHERE t.category = 'Logiciel') AS software_tickets,
        COUNT(t.id) FILTER (WHERE t.category = 'Réseau') AS network_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [technicianId]);

    return rows[0] || null;
  } catch (err) {
    console.error('[getTechnicianStats]', err.message);
    return null;
  }
}

export default {
  recommendTechnician,
  getTechnicianStats,
};
