// backend/src/controllers/smartCmdbController.js
import pool from '../db.js';
import digitalTwin from '../services/networkDiscovery/digitalTwin.js';
import relationDetector from '../services/networkDiscovery/relationDetector.js';

// GET /api/cmdb/asset/:id/twin — Digital Twin complet d'un équipement
export async function getAssetTwin(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows: assetRows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!assetRows[0]) return res.status(404).json({ success: false, message: 'Équipement introuvable.' });

    const liveState = await digitalTwin.getAssetLiveProfile(id);
    const relations = await relationDetector.getAssetRelations(id);

    const { rows: history } = await pool.query(
      `SELECT h.*, u.username AS actor_name
       FROM asset_history h LEFT JOIN users u ON h.user_id = u.id
       WHERE h.asset_id = $1 ORDER BY h.created_at DESC LIMIT 20`,
      [id]
    );

    const { rows: tickets } = await pool.query(
      `SELECT id, title, status, priority, created_at
       FROM tickets WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        asset: assetRows[0],
        liveState,
        relations,
        history,
        tickets,
      },
    });
  } catch (err) {
    console.error('[getAssetTwin]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// GET /api/cmdb/user/:userId/map — Carte réseau d'un utilisateur
export async function getUserMap(req, res) {
  const { userId } = req.params;
  if (isNaN(userId)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const map = await relationDetector.getUserNetworkMap(parseInt(userId));
    return res.json({ success: true, data: map });
  } catch (err) {
    console.error('[getUserMap]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// POST /api/cmdb/refresh-live — Forcer le rafraîchissement (Admin)
export async function refreshLiveStates(req, res) {
  try {
    const result = await digitalTwin.refreshAllLiveStates();
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[refreshLiveStates]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// POST /api/cmdb/detect-relations — Forcer la détection de relations (Admin)
export async function detectRelations(req, res) {
  try {
    const count = await relationDetector.detectPcPrinterRelations();
    return res.json({ success: true, data: { relationsCreated: count } });
  } catch (err) {
    console.error('[detectRelations]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// GET /api/cmdb/dashboard — Vue d'ensemble live de tous les postes
export async function getLiveDashboard(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.asset_tag, a.brand, a.model, u.username AS assigned_to_name,
              l.is_online, l.cpu_usage, l.ram_usage, l.uptime_hours, l.last_checked_at
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN asset_live_state l ON l.asset_id = a.id
       WHERE a.type = 'Ordinateur' AND a.status != 'Retiré'
       ORDER BY l.is_online DESC NULLS LAST, a.asset_tag ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getLiveDashboard]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}