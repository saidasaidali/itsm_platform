// src/controllers/assetController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';

// ─── Utilitaire historique ────────────────────────────────────
async function addHistory(assetId, userId, actionType, action, oldValue = null, newValue = null) {
  await pool.query(
    `INSERT INTO asset_history (asset_id, user_id, action_type, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [assetId, userId, actionType, action, oldValue, newValue]
  );
}

// ─── GET /api/assets/stats ────────────────────────────────────
export async function getAssetStats(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                      AS total,
        COUNT(*) FILTER (WHERE status = 'En service')                AS in_service,
        COUNT(*) FILTER (WHERE status != 'En service')               AS offline,
        COUNT(*) FILTER (
          WHERE COALESCE(warranty_end, date_fin_garantie) IS NOT NULL
            AND COALESCE(warranty_end, date_fin_garantie)
                BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        )                                                             AS expiring_warranty
      FROM assets
    `);
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getAssetStats]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/assets ──────────────────────────────────────────
export async function getAssets(req, res) {
  try {
    const { status, type } = req.query;
    const params = [];
    let where = 'WHERE 1=1';

    if (status) { params.push(status); where += ` AND a.status = $${params.length}`; }
    if (type)   { params.push(type);   where += ` AND a.type = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getAssets]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/assets/warranty-alerts ─────────────────────────
export async function getWarrantyAlerts(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        u.username AS assigned_to_name,
        (COALESCE(a.warranty_end, a.date_fin_garantie) - CURRENT_DATE)::int AS days_remaining
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE COALESCE(a.warranty_end, a.date_fin_garantie) IS NOT NULL
        AND COALESCE(a.warranty_end, a.date_fin_garantie)
            BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY COALESCE(a.warranty_end, a.date_fin_garantie) ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getWarrantyAlerts]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/assets/:id ──────────────────────────────────────
export async function getAssetById(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Asset introuvable.' });

    // Historique complet avec auteur
    const { rows: history } = await pool.query(
      `SELECT h.*, u.username AS actor_name
       FROM asset_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.asset_id = $1
       ORDER BY h.created_at ASC`,
      [id]
    );

    // ✅ Tickets liés via asset_id (plus par description)
    const { rows: tickets } = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.category,
              t.created_at, u.username AS created_by_name
       FROM tickets t
       JOIN users u ON t.created_by = u.id
       WHERE t.asset_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    return res.json({ success: true, data: { ...rows[0], history, tickets } });
  } catch (err) {
    console.error('[getAssetById]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}
// ─── POST /api/assets ─────────────────────────────────────────
export async function createAsset(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const {
    asset_tag, type, brand, model, status, location,
    assigned_to, serial_number, department, office,
    purchase_date, warranty_end,
  } = req.body;
  const userId = req.user.id;

  // Convertir en null explicitement
  const assignedTo   = assigned_to   ? parseInt(assigned_to)  : null;
  const purchaseDate = purchase_date || null;
  const warrantyEnd  = warranty_end  || null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO assets
         (asset_tag, type, brand, model, status, location,
          assigned_to, serial_number, department, office,
          purchase_date, warranty_end, assigned_at)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7::integer, $8, $9, $10, $11, $12,
               CASE WHEN $7::integer IS NOT NULL THEN NOW() ELSE NULL END)
       RETURNING *`,
      [
        asset_tag,
        type,
        brand,
        model,
        status        || 'En service',
        location      || null,
        assignedTo,
        serial_number || null,
        department    || null,
        office        || null,
        purchaseDate,
        warrantyEnd,
      ]
    );

    await addHistory(
      rows[0].id, userId, 'created',
      `Équipement ${asset_tag} (${brand} ${model}) enregistré en inventaire`
    );

    if (assignedTo) {
      const { rows: userRows } = await pool.query(
        'SELECT username FROM users WHERE id = $1', [assignedTo]
      );
      await addHistory(
        rows[0].id, userId, 'assigned',
        `Affecté à ${userRows[0]?.username || assignedTo}`,
        null, String(assignedTo)
      );
    }

    return res.status(201).json({ success: true, message: 'Asset créé.', data: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'Tag asset déjà existant.' });
    console.error('[createAsset]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PUT /api/assets/:id ──────────────────────────────────────
export async function updateAsset(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  const {
    asset_tag, type, brand, model, status, location,
    assigned_to, serial_number, department, office,
    purchase_date, warranty_end,
  } = req.body;
  const userId = req.user.id;

  try {
    const { rows: existing } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!existing[0])
      return res.status(404).json({ success: false, message: 'Asset introuvable.' });
    const prev = existing[0];

    const newAssignedTo = assigned_to !== undefined
      ? (assigned_to ? parseInt(assigned_to) : null)
      : prev.assigned_to;

    const { rows } = await pool.query(
      `UPDATE assets SET
         asset_tag     = COALESCE($1,  asset_tag),
         type          = COALESCE($2,  type),
         brand         = COALESCE($3,  brand),
         model         = COALESCE($4,  model),
         status        = COALESCE($5,  status),
         location      = COALESCE($6,  location),
         assigned_to   = $7::integer,
         serial_number = COALESCE($8,  serial_number),
         department    = COALESCE($9,  department),
         office        = COALESCE($10, office),
         purchase_date = COALESCE($11, purchase_date),
         warranty_end  = COALESCE($12, warranty_end),
         assigned_at   = CASE
                           WHEN $7::integer IS NOT NULL
                            AND $7::integer IS DISTINCT FROM $13::integer
                           THEN NOW()
                           WHEN $7::integer IS NULL THEN NULL
                           ELSE assigned_at
                         END,
         updated_at    = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        asset_tag     || null,
        type          || null,
        brand         || null,
        model         || null,
        status        || null,
        location      || null,
        newAssignedTo,
        serial_number || null,
        department    || null,
        office        || null,
        purchase_date || null,
        warranty_end  || null,
        prev.assigned_to,
        id,
      ]
    );

    // Historique
    if (status && status !== prev.status) {
      await addHistory(id, userId, 'status_change',
        `Statut : ${prev.status} → ${status}`,
        prev.status, status
      );
    }

    const assignedChanged = newAssignedTo !== prev.assigned_to;
    if (assignedChanged) {
      if (!newAssignedTo) {
        await addHistory(id, userId, 'unassigned',
          `Désaffecté (était : ${prev.assigned_to_name || prev.assigned_to})`,
          String(prev.assigned_to), null
        );
      } else {
        const { rows: newUser } = await pool.query(
          'SELECT username FROM users WHERE id = $1', [newAssignedTo]
        );
        await addHistory(id, userId, 'assigned',
          `Réaffecté à ${newUser[0]?.username || newAssignedTo}` +
          (prev.assigned_to ? ` (précédent : ${prev.assigned_to_name})` : ''),
          prev.assigned_to ? String(prev.assigned_to) : null,
          String(newAssignedTo)
        );
      }
    }

    if (location && location !== prev.location) {
      await addHistory(id, userId, 'modified',
        `Emplacement : ${prev.location} → ${location}`,
        prev.location, location
      );
    }

    return res.json({ success: true, message: 'Asset mis à jour.', data: rows[0] });
  } catch (err) {
    console.error('[updateAsset]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/assets/:id/assign ────────────────────────────
export async function assignAsset(req, res) {
  const { id } = req.params;
  const { user_id, department, office } = req.body;
  const actorId = req.user.id;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows: assetRows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!assetRows[0])
      return res.status(404).json({ success: false, message: 'Asset introuvable.' });
    const asset = assetRows[0];

    if (asset.assigned_to && asset.assigned_to !== user_id) {
      await addHistory(id, actorId, 'unassigned',
        `Désaffecté de ${asset.assigned_to_name} (réaffectation)`,
        String(asset.assigned_to), null
      );
    }

    let newName = null;
    if (user_id) {
      const { rows: userRows } = await pool.query(
        'SELECT username FROM users WHERE id = $1', [user_id]
      );
      if (!userRows[0])
        return res.status(400).json({ success: false, message: 'Utilisateur introuvable.' });
      newName = userRows[0].username;
    }

    // Sans updated_at — compatible avec votre schéma actuel
    await pool.query(
      `UPDATE assets SET
         assigned_to = $1::integer,
         department  = COALESCE($2, department),
         office      = COALESCE($3, office),
         assigned_at = CASE WHEN $1::integer IS NOT NULL THEN NOW() ELSE NULL END
       WHERE id = $4`,
      [user_id ? parseInt(user_id) : null, department || null, office || null, id]
    );

    const action = user_id
      ? `Affecté à ${newName}${department ? ` — ${department}` : ''}${office ? ` (${office})` : ''}`
      : 'Désaffecté';

    await addHistory(id, actorId, user_id ? 'assigned' : 'unassigned',
      action,
      asset.assigned_to ? String(asset.assigned_to) : null,
      user_id ? String(user_id) : null
    );

    return res.json({ success: true, message: action });
  } catch (err) {
    console.error('[assignAsset]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── DELETE /api/assets/:id ───────────────────────────────────
export async function deleteAsset(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rowCount } = await pool.query('DELETE FROM assets WHERE id = $1', [id]);
    if (rowCount === 0)
      return res.status(404).json({ success: false, message: 'Asset introuvable.' });
    return res.json({ success: true, message: 'Asset supprimé.' });
  } catch (err) {
    console.error('[deleteAsset]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/assets/heartbeat — Agent poste Windows ────────
// ─── POST /api/assets/heartbeat — Agent poste Windows ────────
export async function heartbeat(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.ASSET_AGENT_KEY) {
    return res.status(401).json({ success: false, message: 'Non autorisé.' });
  }

  const { hostname, username, ip_address, mac_address, serial, os } = req.body;

  if (!serial && !mac_address) {
    return res.status(400).json({
      success: false,
      message: 'serial ou mac_address requis.',
    });
  }

  try {
    // Chercher l'asset existant par numéro de série OU MAC
    const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.numero_serie_fabricant = $1
          OR a.adresse_mac            = $2
       LIMIT 1`,
      [serial || null, mac_address || null]
    );

    let asset;

    if (!rows[0]) {
      // ── Équipement inconnu → création automatique ──────────
      const assetTag = `AUTO-${hostname || serial?.slice(-6) || Date.now()}`;

      const { rows: created } = await pool.query(
        `INSERT INTO assets
           (asset_tag, type, brand, model, status,
            numero_serie_fabricant, adresse_ip, adresse_mac,
            location, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          assetTag,
          'Ordinateur',           // type par défaut
          os || 'Inconnu',        // brand temporaire = OS détecté
          hostname || 'Inconnu',  // model temporaire = hostname
          'En service',
          serial || null,
          ip_address || null,
          mac_address || null,
          'Détecté automatiquement',
        ]
      );
      asset = created[0];

      await pool.query(
        `INSERT INTO asset_history (asset_id, action_type, action)
         VALUES ($1, 'created', $2)`,
        [asset.id, `Équipement détecté et créé automatiquement via l'agent (poste "${hostname}", utilisateur "${username}")`]
      );

      // Notifier les admins qu'un nouvel équipement a été auto-détecté
      const { rows: admins } = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'Admin' AND u.is_active = true`
      );
      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (title, message, user_id, "read", asset_id)
           VALUES ($1, $2, $3, FALSE, $4)`,
          [
            '🆕 Nouvel équipement détecté',
            `Poste "${hostname}" (SN: ${serial || '—'}) ajouté automatiquement à l'inventaire. ` +
            `Merci de compléter les informations (marque, modèle, affectation).`,
            admin.id,
            asset.id,
          ]
        );
      }

      console.log(`[Heartbeat] Nouvel équipement créé : ${assetTag} (${hostname})`);
    } else {
      asset = rows[0];
    }

    // ── Détecter changement d'utilisateur ───────────────────
    const { rows: userRows } = await pool.query(
      `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`,
      [username]
    );
    const detectedUserId = userRows[0]?.id || null;

    if (detectedUserId && asset.assigned_to && detectedUserId !== asset.assigned_to) {
      const { rows: admins } = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'Admin' AND u.is_active = true`
      );
      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (title, message, user_id, "read", asset_id)
           VALUES ($1, $2, $3, FALSE, $4)`,
          [
            "⚠️ Changement d'utilisateur détecté",
            `L'équipement "${asset.asset_tag}" était affecté à "${asset.assigned_to_name}" ` +
            `mais est utilisé par "${username}" depuis ${ip_address}.`,
            admin.id,
            asset.id,
          ]
        );
      }

      await pool.query(
        `INSERT INTO asset_history (asset_id, action_type, action)
         VALUES ($1, 'modified', $2)`,
        [asset.id, `Utilisateur détecté : "${username}" (attendu : "${asset.assigned_to_name}") depuis ${ip_address}`]
      );
    }

    // ── Mettre à jour IP / MAC / dernière vue ───────────────
    await pool.query(
      `UPDATE assets SET
         adresse_ip  = $1,
         adresse_mac = $2,
         updated_at  = NOW()
       WHERE id = $3`,
      [ip_address || null, mac_address || null, asset.id]
    );

    return res.json({
      success: true,
      status: rows[0] ? 'known' : 'created',
      asset_tag: asset.asset_tag,
      assigned_to: asset.assigned_to_name || null,
    });
  } catch (err) {
    console.error('[heartbeat]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}