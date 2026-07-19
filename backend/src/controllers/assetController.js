// src/controllers/assetController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import anomalyDetector from '../services/networkDiscovery/anomalyDetector.js';
import { getFullPrediction } from '../services/mlService.js';
import { getSettings } from '../services/settingsService.js';
import * as XLSX from 'xlsx';
import asyncHandler from '../middlewares/asyncHandler.js';
import { validateId } from '../utils/validationUtils.js';

// ─── Utilitaire historique ────────────────────────────────────
async function addHistory(assetId, userId, actionType, action, oldValue = null, newValue = null) {
  await pool.query(
    `INSERT INTO asset_history (asset_id, user_id, action_type, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [assetId, userId, actionType, action, oldValue, newValue]
  );
}

// ─── GET /api/assets/stats ────────────────────────────────────
export const getAssetStats = asyncHandler(async (req, res) => {
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
});

// ─── GET /api/assets ──────────────────────────────────────────
export const getAssets = asyncHandler(async (req, res) => {
  const { status, type, service, department } = req.query;
    const params = [];
    let where = 'WHERE 1=1';

    if (status)    { params.push(status);    where += ` AND a.status = $${params.length}`; }
    if (type)      { params.push(type);      where += ` AND a.type = $${params.length}`; }
    if (service)   { params.push(service);   where += ` AND a.service = $${params.length}`; }
    if (department){ params.push(department);where += ` AND a.department = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name,
              rs.risk_score, rs.risk_level
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN LATERAL (
         SELECT risk_score, risk_level FROM asset_risk_scores
         WHERE asset_id = a.id
         ORDER BY computed_at DESC
         LIMIT 1
       ) rs ON TRUE
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
});

// ─── GET /api/assets/warranty-alerts ─────────────────────────
export const getWarrantyAlerts = asyncHandler(async (req, res) => {
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
});

// ─── GET /api/assets/:id ──────────────────────────────────────
export const getAssetById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: t(req, 'asset_not_found') });

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
});
// ─── POST /api/assets ─────────────────────────────────────────
export const createAsset = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const {
    asset_tag, type, brand, model, status, location,
    assigned_to, serial_number, department, office,
    purchase_date, warranty_end, service,
  } = req.body;
  const userId = req.user.id;

  // Convertir en null explicitement
  const assignedTo   = assigned_to   ? parseInt(assigned_to)  : null;
  const purchaseDate = purchase_date || null;
  const warrantyEnd  = warranty_end  || null;

  const { rows } = await pool.query(
      `INSERT INTO assets
         (asset_tag, type, brand, model, status, location,
          assigned_to, serial_number, department, office,
          purchase_date, warranty_end, assigned_at, service)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7::integer, $8, $9, $10, $11, $12,
               CASE WHEN $7::integer IS NOT NULL THEN NOW() ELSE NULL END, $13)
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
        service       || null,
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

    return res.status(201).json({ success: true, message: t(req, 'asset_created'), data: rows[0] });
});

// ─── PUT /api/assets/:id ──────────────────────────────────────
export const updateAsset = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const {
    asset_tag, type, brand, model, status, location,
    assigned_to, serial_number, department, office, service,
    purchase_date, warranty_end,
  } = req.body;
  const userId = req.user.id;

  const { rows: existing } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!existing[0])
      return res.status(404).json({ success: false, message: t(req, 'asset_not_found') });
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
         service       = COALESCE($11, service),
         purchase_date = COALESCE($12, purchase_date),
         warranty_end  = COALESCE($13, warranty_end),
         assigned_at   = CASE
                           WHEN $7::integer IS NOT NULL
                            AND $7::integer IS DISTINCT FROM $14::integer
                           THEN NOW()
                           WHEN $7::integer IS NULL THEN NULL
                           ELSE assigned_at
                         END,
         updated_at    = NOW()
       WHERE id = $15
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
        service       || null,
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

    return res.json({ success: true, message: t(req, 'asset_updated'), data: rows[0] });
});

// ─── PATCH /api/assets/:id/assign ────────────────────────────
export const assignAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { user_id, department, office } = req.body;
  const actorId = req.user.id;
  if (!validateId(id, req, res)) return;

  const { rows: assetRows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.id = $1`,
      [id]
    );
    if (!assetRows[0])
      return res.status(404).json({ success: false, message: t(req, 'asset_not_found') });
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
        return res.status(400).json({ success: false, message: t(req, 'user_not_found') });
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
});

// ─── DELETE /api/assets/:id ───────────────────────────────────
export const deleteAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id, req, res)) return;

  const { rowCount } = await pool.query('DELETE FROM assets WHERE id = $1', [id]);
    if (rowCount === 0)
      return res.status(404).json({ success: false, message: t(req, 'asset_not_found') });
    return res.json({ success: true, message: t(req, 'asset_deleted') });
});



// ─── POST /api/assets/heartbeat — Agent poste Windows ────────
export const heartbeat = asyncHandler(async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const s = getSettings();
  if (!apiKey || apiKey !== s.asset_agent_key) {
    return res.status(401).json({ success: false, message: t(req, 'not_authorized') });
  }

  const { hostname, username, ip_address, mac_address, serial, os } = req.body;

  if (!serial && !mac_address) {
    return res.status(400).json({
      success: false,
      message: t(req, 'serial_or_mac_required'),
    });
  }

  const { rows } = await pool.query(
      `SELECT a.*, u.username AS assigned_to_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       WHERE a.serial_number = $1
          OR a.adresse_mac   = $2
       LIMIT 1`,
      [serial || null, mac_address || null]
    );

    let asset;
    let isNew = false;

    if (!rows[0]) {
      // ── Machine inconnue sur le réseau ──────────────────────
      await anomalyDetector.detectUnknownDevice(ip_address, mac_address, hostname);

      isNew = true;
      const assetTag = `AUTO-${hostname || serial?.slice(-6) || Date.now()}`;

      try {
        const { rows: created } = await pool.query(
          `INSERT INTO assets
             (asset_tag, type, brand, model, status,
              serial_number, adresse_ip, adresse_mac,
              location, last_seen_at, discovery_method, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'heartbeat_agent', NOW())
           RETURNING *`,
          [
            assetTag,
            'Ordinateur',
            os || 'Inconnu',
            hostname || 'Inconnu',
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

        const { rows: admins } = await pool.query(
          `SELECT u.id FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE r.name = 'Admin' AND u.status = 'active'`
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
      } catch (err) {
        // ── Doublon détecté par la base (index unique) ───────
        if (err.code === '23505') {
          console.warn(`[Heartbeat] Doublon évité pour ${hostname} (SN: ${serial}) — bascule en mise à jour.`);
          const { rows: existing } = await pool.query(
            `SELECT a.*, u.username AS assigned_to_name
             FROM assets a LEFT JOIN users u ON a.assigned_to = u.id
             WHERE a.serial_number = $1 OR a.adresse_mac = $2 LIMIT 1`,
            [serial || null, mac_address || null]
          );
          if (!existing[0]) {
            return res.status(409).json({ success: false, message: t(req, 'asset_conflict') });
          }
          asset = existing[0];
          isNew = false;
        } else {
          throw err;
        }
      }
    } else {
      asset = rows[0];

      // ── Détection de réapparition après absence ─────────────
      if (asset.last_seen_at) {
        const daysSince = Math.floor((Date.now() - new Date(asset.last_seen_at)) / 86400000);
        if (daysSince >= 3) {
          await anomalyDetector.detectReappeared(asset, daysSince);
        }
      }

      // ── Détection changement MAC ─────────────────────────────
      await anomalyDetector.detectMacChange(asset, mac_address);

      // ── Détection changement IP ──────────────────────────────
      await anomalyDetector.detectIpChange(asset, ip_address);
    }

    // ── Détection utilisateur différent ────────────────────────
    const { rows: userRows } = await pool.query(
      `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`,
      [username]
    );
    const detectedUserId = userRows[0]?.id || null;

    if (!isNew) {
      await anomalyDetector.detectUserMismatch(asset, username, detectedUserId, ip_address);
    }

    // ── Mise à jour finale IP / MAC / dernière vue ──────────────
    await pool.query(
      `UPDATE assets SET
         adresse_ip    = $1,
         adresse_mac   = $2,
         last_seen_at  = NOW(),
         updated_at    = NOW()
       WHERE id = $3`,
      [ip_address || null, mac_address || null, asset.id]
    );

    return res.json({
      success: true,
      status: isNew ? 'created' : 'known',
      asset_tag: asset.asset_tag,
      assigned_to: asset.assigned_to_name || null,
    });
});


// ─── GET /api/assets/services — Liste des services distincts ──────────────────
export const getAssetServicesList = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT service FROM assets WHERE service IS NOT NULL AND service != '' ORDER BY service ASC`
  );
  return res.json({ success: true, data: rows.map(r => r.service) });
});

// ─── GET /api/assets/departments — Liste des départements distincts ───────────
export const getAssetDepartmentsList = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT department FROM assets WHERE department IS NOT NULL AND department != '' ORDER BY department ASC`
  );
  return res.json({ success: true, data: rows.map(r => r.department) });
});

// GET /api/assets/:id/ml-prediction
export const getAssetMLPrediction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prediction = await getFullPrediction(id);
    if (!prediction) {
      return res.json({
        success: true,
        prediction: null,
        message: 'Service ML non disponible ou données insuffisantes.',
      });
    }
    return res.json({ success: true, prediction });
});

// ─── POST /api/assets/import — Import Excel (Admin) ────────────────────────────
// Comportement GLPI : import ligne par ligne, continue malgré les erreurs,
// enregistre immédiatement chaque ligne valide, retourne un rapport détaillé.
export const importAssetsFromExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Fichier Excel manquant.' });
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Le fichier est vide.' });
  }

  const normalize = (str) => str?.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const STATUS_MAP = {
    'en service': 'En service',
    'en panne': 'En panne',
    'en maintenance': 'En maintenance',
    'retire': 'Retiré',
    'retiré': 'Retiré',
  };

  const results = { created: [], skipped: [], errors: [] };
  const userId = req.user?.id || null;

  // Cache pour éviter les requêtes répétées sur la table users
  const userCache = new Map();

  // Helper: récupérer un utilisateur par username/email (avec cache)
  const findUser = async (txt) => {
    if (!txt) return null;
    const key = txt.toLowerCase();
    if (userCache.has(key)) return userCache.get(key);

    const { rows } = await pool.query(
      `SELECT id, username FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 1`,
      [txt]
    );
    const user = rows[0] || null;
    if (user) userCache.set(key, user);
    return user;
  };

  // Helper: valider et parser une date
  const parseDate = (txt) => {
    if (!txt || txt.toString().trim() === '') return null;
    const d = new Date(txt);
    if (isNaN(d.getTime())) return '__INVALID__';
    return d.toISOString().split('T')[0];
  };

  // Traitement ligne par ligne (comportement GLPI)
  for (const [i, row] of rows.entries()) {
    const keys = Object.keys(row);
    const findCol = (...names) => keys.find((k) => names.includes(normalize(k)));

    const tagCol      = findCol('tag', 'asset_tag', 'code', 'reference');
    const typeCol     = findCol('type', 'categorie');
    const brandCol    = findCol('marque', 'brand', 'fabricant');
    const modelCol    = findCol('modele', 'modèle', 'model');
    const statusCol   = findCol('statut', 'status');
    const locationCol = findCol('emplacement', 'location');
    const assignedCol = findCol('affecte a', 'affecté à', 'assigned_to', 'utilisateur');
    const serialCol   = findCol('numero de serie', 'numéro de série', 'serial_number', 'serial', 'sn');
    const deptCol     = findCol('departement', 'department');
    const officeCol   = findCol('bureau', 'office');
    const serviceCol  = findCol('service');
    const purchaseCol = findCol('date achat', 'date d\'achat', 'purchase_date');
    const warrantyCol = findCol('garantie', 'warranty_end', 'date fin garantie');

    const assetTag     = row[tagCol]?.toString().trim();
    const type         = row[typeCol]?.toString().trim();
    const brand        = row[brandCol]?.toString().trim();
    const model        = row[modelCol]?.toString().trim();
    const statusTxt    = normalize(row[statusCol]?.toString());
    const location     = row[locationCol]?.toString().trim();
    const assignedTxt  = row[assignedCol]?.toString().trim();
    const serialNumber = row[serialCol]?.toString().trim();
    const department   = row[deptCol]?.toString().trim();
    const office       = row[officeCol]?.toString().trim();
    const service      = row[serviceCol]?.toString().trim() || null;
    const purchaseTxt  = row[purchaseCol]?.toString().trim();
    const warrantyTxt  = row[warrantyCol]?.toString().trim();

    // ── Validation 1: champs obligatoires ──────────────────────────────
    if (!assetTag || !type || !brand || !model) {
      const missing = [];
      if (!assetTag) missing.push('Tag');
      if (!type) missing.push('Type');
      if (!brand) missing.push('Marque');
      if (!model) missing.push('Modèle');
      results.errors.push({
        ligne: i + 2,
        tag: assetTag || '—',
        raison: `Champs obligatoires manquants : ${missing.join(', ')}.`
      });
      continue;
    }

    // ── Validation 2: unicité asset_tag ────────────────────────────────
    const { rows: existing } = await pool.query(
      'SELECT id FROM assets WHERE asset_tag = $1',
      [assetTag]
    );
    if (existing[0]) {
      results.skipped.push({ ligne: i + 2, tag: assetTag, raison: 'Tag déjà existant dans la base.' });
      continue;
    }

    // ── Validation 3: statut autorisé ──────────────────────────────────
    const status = STATUS_MAP[statusTxt];
    if (statusTxt && !status) {
      results.errors.push({
        ligne: i + 2,
        tag: assetTag,
        raison: `Statut invalide : "${row[statusCol]}". Valeurs autorisées : En service, En panne, En maintenance, Retiré.`
      });
      continue;
    }
    const finalStatus = status || 'En service';

    // ── Validation 4: assigned_to existe ───────────────────────────────
    let assignedTo = null;
    if (assignedTxt) {
      const user = await findUser(assignedTxt);
      if (!user) {
        results.errors.push({
          ligne: i + 2,
          tag: assetTag,
          raison: `Utilisateur "${assignedTxt}" introuvable dans la base.`
        });
        continue;
      }
      assignedTo = user.id;
    }

    // ── Validation 5: format des dates ─────────────────────────────────
    const purchaseDate = parseDate(purchaseTxt);
    if (purchaseTxt && purchaseDate === '__INVALID__') {
      results.errors.push({
        ligne: i + 2,
        tag: assetTag,
        raison: `Date d'achat invalide : "${purchaseTxt}". Format attendu : JJ/MM/AAAA ou AAAA-MM-JJ.`
      });
      continue;
    }

    const warrantyEnd = parseDate(warrantyTxt);
    if (warrantyTxt && warrantyEnd === '__INVALID__') {
      results.errors.push({
        ligne: i + 2,
        tag: assetTag,
        raison: `Date de fin de garantie invalide : "${warrantyTxt}". Format attendu : JJ/MM/AAAA ou AAAA-MM-JJ.`
      });
      continue;
    }

    // ── Insertion immédiate (pas de transaction globale) ───────────────
    try {
      const { rows: created } = await pool.query(
        `INSERT INTO assets
          (asset_tag, type, brand, model, status, location,
           assigned_to, serial_number, department, office, service,
           purchase_date, warranty_end, assigned_at)
         VALUES ($1, $2, $3, $4, $5, $6,
                 $7::integer, $8, $9, $10, $11, $12, $13,
                 CASE WHEN $7::integer IS NOT NULL THEN NOW() ELSE NULL END)
         RETURNING *`,
        [
          assetTag,
          type,
          brand,
          model,
          finalStatus,
          location || null,
          assignedTo,
          serialNumber || null,
          department || null,
          office || null,
          service,
          purchaseDate,
          warrantyEnd,
        ]
      );

      const assetId = created[0].id;

      // Historique : création
      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, action_type, action)
         VALUES ($1, $2, 'created', $3)`,
        [assetId, userId, `Équipement ${assetTag} (${brand} ${model}) importé depuis Excel`]
      );

      // Historique : affectation si applicable
      if (assignedTo) {
        const user = userCache.get(assignedTxt.toLowerCase()) || await findUser(assignedTxt);
        await pool.query(
          `INSERT INTO asset_history (asset_id, user_id, action_type, action, new_value)
           VALUES ($1, $2, 'assigned', $3, $4)`,
          [assetId, userId, `Affecté à ${user?.username || assignedTxt}`, String(assignedTo)]
        );
      }

      results.created.push({
        ligne: i + 2,
        tag: assetTag,
        type,
        brand,
        model,
        status: finalStatus,
      });
    } catch (err) {
      // Erreur d'insertion (contrainte DB, etc.)
      console.error(`[ImportAssets] Erreur ligne ${i + 2} (${assetTag}):`, err.message);
      results.errors.push({
        ligne: i + 2,
        tag: assetTag,
        raison: `Erreur base de données : ${err.message || 'Contrainte violée'}.`
      });
    }
  }

  // ── Rapport final ───────────────────────────────────────────────────
  const message = `Import terminé : ${results.created.length} créé(s), ${results.skipped.length} ignoré(s), ${results.errors.length} erreur(s).`;

  return res.json({
    success: true,
    message,
    summary: {
      total: rows.length,
      created: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    },
    results,
  });
});
