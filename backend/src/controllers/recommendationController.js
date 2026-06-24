// backend/src/controllers/recommendationController.js
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { recommendTechnician, getTechnicianStats } from '../services/technicianRecommender.js';
import { t } from '../utils/i18n.js';

// ─── GET /api/recommendations/technician?category=X&priority=Y ─────────────────
export async function getTechnicianRecommendation(req, res) {
  try {
    const { category, priority } = req.query;
    
    const result = await recommendTechnician(category, priority);
    
    if (!result) {
      return res.json({ 
        success: true, 
        data: null,
        message: t(req, 'no_technicians_available')
      });
    }

    // Enrichir avec les statistiques détaillées
    const enriched = await Promise.all(
      result.top3.map(async (tech) => {
        const stats = await getTechnicianStats(tech.id);
        return {
          ...tech,
          stats,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        recommended: result.recommended,
        top3: enriched,
      }
    });
  } catch (err) {
    console.error('[getTechnicianRecommendation]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/recommendations/technician/:id/stats ─────────────────────────────
export async function getTechnicianDetails(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
    }

    const stats = await getTechnicianStats(id);
    
    if (!stats) {
      return res.status(404).json({ success: false, message: t(req, 'technician_not_found') });
    }

    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[getTechnicianDetails]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}