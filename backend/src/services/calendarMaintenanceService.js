// backend/src/services/calendarMaintenanceService.js
// Service de maintenance préventive intégré au calendrier
import pool from '../db.js';
import { notifyEventCreated, notifyRefreshAll } from './calendarSyncService.js';

const MAINTENANCE_TYPES = {
  monthly: { label: 'Maintenance mensuelle', interval: 'month', months: 1 },
  quarterly: { label: 'Maintenance trimestrielle', interval: 'month', months: 3 },
  yearly: { label: 'Maintenance annuelle', interval: 'year', months: 12 },
  warranty: { label: 'Maintenance basée garantie', interval: 'warranty', months: 0 },
  usage: { label: 'Maintenance basée utilisation', interval: 'usage', months: 0 },
};

const MAINTENANCE_COLORS = {
  monthly: '#17a2b8',
  quarterly: '#28a745',
  yearly: '#007bff',
  warranty: '#ffc107',
  usage: '#6f42c1',
};

/**
 * Crée ou met à jour la configuration de maintenance pour un équipement
 */
export async function configureMaintenance(assetId, config) {
  const { maintenance_type, interval_months, start_date, notes, assigned_to } = config;

  const { rows } = await pool.query(`
    INSERT INTO calendar_maintenance_config 
      (asset_id, maintenance_type, interval_months, start_date, next_due, notes, assigned_to, enabled)
    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
    ON CONFLICT (asset_id) 
    DO UPDATE SET 
      maintenance_type = EXCLUDED.maintenance_type,
      interval_months = EXCLUDED.interval_months,
      start_date = EXCLUDED.start_date,
      next_due = EXCLUDED.next_due,
      notes = EXCLUDED.notes,
      assigned_to = EXCLUDED.assigned_to,
      enabled = true,
      updated_at = NOW()
    RETURNING *
  `, [
    assetId, maintenance_type, interval_months,
    start_date || new Date(),
    start_date ? new Date(start_date) : new Date(),
    notes, assigned_to || null
  ]);

  // Générer les événements immédiatement
  await generateMaintenanceEvent(rows[0]);

  return rows[0];
}

/**
 * Désactive la maintenance pour un équipement
 */
export async function disableMaintenance(assetId) {
  await pool.query(`
    UPDATE calendar_maintenance_config 
    SET enabled = false, updated_at = NOW() 
    WHERE asset_id = $1
  `, [assetId]);
}

/**
 * Calcule la prochaine date de maintenance
 */
function calculateNextDue(config, fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();

  switch (config.maintenance_type) {
    case 'monthly':
      base.setMonth(base.getMonth() + (config.interval_months || 1));
      return base.toISOString();

    case 'quarterly':
      base.setMonth(base.getMonth() + 3);
      return base.toISOString();

    case 'yearly':
      base.setFullYear(base.getFullYear() + 1);
      return base.toISOString();

    case 'warranty':
      // Déclenché X mois avant fin de garantie
      return null; // Calculé dynamiquement

    case 'usage':
      // Basé sur 6 mois par défaut
      base.setMonth(base.getMonth() + 6);
      return base.toISOString();

    default:
      base.setMonth(base.getMonth() + 1);
      return base.toISOString();
  }
}

/**
 * Génère un événement de maintenance pour une configuration
 */
async function generateMaintenanceEvent(config) {
  // Vérifier si un événement existe déjà pour éviter les doublons
  const { rows: existing } = await pool.query(`
    SELECT id FROM calendar_events 
    WHERE asset_id = $1 
      AND event_type = 'maintenance_preventive'
      AND DATE(start_date) = DATE($2)
      AND status NOT IN ('cancelled')
  `, [config.asset_id, config.next_due]);

  if (existing.length > 0) {
    return existing[0]; // Éviter les doublons
  }

  // Récupérer les infos de l'équipement
  const { rows: assets } = await pool.query(`
    SELECT asset_tag, brand, model, department, location, assigned_to 
    FROM assets WHERE id = $1
  `, [config.asset_id]);

  if (assets.length === 0) return null;

  const asset = assets[0];

  // Titre selon le type
  const typeLabels = {
    monthly: `🔧 Maintenance mensuelle`,
    quarterly: `🔧 Maintenance trimestrielle`,
    yearly: `🔧 Maintenance annuelle`,
    warranty: `📅 Maintenance fin de garantie`,
    usage: `🔧 Maintenance basée utilisation`,
  };

  const title = `${typeLabels[config.maintenance_type] || 'Maintenance'} - ${asset.asset_tag}`;

  // Dates : toute la journée
  const startDate = new Date(config.next_due);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  // Créer l'événement
  const { rows } = await pool.query(`
    INSERT INTO calendar_events (
      title, description, event_type, start_date, end_date, all_day,
      color, asset_id, assigned_to, department, site, status,
      created_by,
      reminder_1d, reminder_1h
    )
    VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, 'scheduled', 
            (SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'Admin') LIMIT 1),
            true, true)
    RETURNING *
  `, [
    title,
    `Maintenance ${config.maintenance_type} programmée pour l'équipement ${asset.brand} ${asset.model} (${asset.asset_tag}).${config.notes ? '\n\nNotes: ' + config.notes : ''}`,
    'maintenance_preventive',
    startDate.toISOString(),
    endDate.toISOString(),
    MAINTENANCE_COLORS[config.maintenance_type] || '#28a745',
    config.asset_id,
    config.assigned_to || asset.assigned_to,
    asset.department,
    asset.location,
  ]);

  const event = rows[0];

  // Notifier les clients SSE
  notifyEventCreated(event);

  return event;
}

/**
 * Planifie la prochaine maintenance pour une configuration
 */
export async function scheduleNextMaintenance(configId) {
  const { rows: configs } = await pool.query(`
    SELECT * FROM calendar_maintenance_config WHERE id = $1 AND enabled = true
  `, [configId]);

  if (configs.length === 0) return null;

  const config = configs[0];
  const nextDue = calculateNextDue(config, config.next_due);

  // Mettre à jour la prochaine échéance
  await pool.query(`
    UPDATE calendar_maintenance_config 
    SET next_due = $1, last_generated = NOW(), updated_at = NOW()
    WHERE id = $2
  `, [nextDue, configId]);

  if (nextDue) {
    config.next_due = nextDue;
    return await generateMaintenanceEvent(config);
  }

  return null;
}

/**
 * Génère les maintenances basées sur la garantie (X mois avant expiration)
 */
async function generateWarrantyMaintenances() {
  const { rows: assets } = await pool.query(`
    SELECT id, asset_tag, brand, model, date_fin_garantie, 
           department, location, assigned_to
    FROM assets 
    WHERE date_fin_garantie IS NOT NULL
      AND date_fin_garantie >= CURRENT_DATE
      AND date_fin_garantie <= CURRENT_DATE + INTERVAL '90 days'
      AND status NOT IN ('Retiré', 'Hors service')
  `);

  for (const asset of assets) {
    // Vérifier si une config existe déjà
    const { rows: existing } = await pool.query(`
      SELECT id FROM calendar_maintenance_config 
      WHERE asset_id = $1 AND maintenance_type = 'warranty'
    `, [asset.id]);

    if (existing.length > 0) continue; // Déjà configuré

    // Créer une config automatique
    await pool.query(`
      INSERT INTO calendar_maintenance_config 
        (asset_id, maintenance_type, interval_months, start_date, next_due, enabled, auto_generated)
      VALUES ($1, 'warranty', 0, $2, $2, true, true)
      ON CONFLICT (asset_id) DO NOTHING
    `, [asset.id, asset.date_fin_garantie]);

    // Créer l'événement
    const startDate = new Date(asset.date_fin_garantie);
    startDate.setMonth(startDate.getMonth() - 1); // 1 mois avant expiration
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const { rows: events } = await pool.query(`
      INSERT INTO calendar_events (
        title, description, event_type, start_date, end_date, all_day,
        color, asset_id, department, location, status, created_by,
        reminder_1d, reminder_1h
      )
      VALUES ($1, $2, 'maintenance_preventive', $3, $4, true, $5, $6, $7, $8, 'scheduled',
              (SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'Admin') LIMIT 1),
              true, true)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [
      `📅 Fin garantie - ${asset.asset_tag}`,
      `La garantie de l'équipement ${asset.brand} ${asset.model} (${asset.asset_tag}) expire le ${new Date(asset.date_fin_garantie).toLocaleDateString('fr-FR')}. Maintenance préventive recommandée avant expiration.`,
      startDate.toISOString(),
      endDate.toISOString(),
      MAINTENANCE_COLORS.warranty,
      asset.id,
      asset.department,
      asset.location,
    ]);

    if (events[0]) notifyEventCreated(events[0]);
  }
}

/**
 * Exécute le générateur de maintenances planifiées
 */
export async function runMaintenanceScheduler() {
  console.log('[Maintenance] Exécution du planificateur de maintenances...');

  // 1. Générer les maintenances basées sur garantie
  await generateWarrantyMaintenances();

  // 2. Récupérer toutes les configurations actives dont la date est passée
  const { rows: configs } = await pool.query(`
    SELECT cmc.*, a.asset_tag, a.brand, a.model
    FROM calendar_maintenance_config cmc
    JOIN assets a ON cmc.asset_id = a.id
    WHERE cmc.enabled = true
      AND cmc.next_due <= NOW()
      AND a.status NOT IN ('Retiré', 'Hors service')
    ORDER BY cmc.next_due ASC
  `);

  let eventsCreated = 0;
  for (const config of configs) {
    const event = await generateMaintenanceEvent(config);
    if (event) {
      eventsCreated++;
      // Planifier la prochaine occurrence
      await scheduleNextMaintenance(config.id);
    }
  }

  console.log(`[Maintenance] ${eventsCreated} événement(s) de maintenance créé(s)`);
  notifyRefreshAll();
  return eventsCreated;
}

/**
 * Récupère toutes les configurations de maintenance
 */
export async function getAllMaintenanceConfigs() {
  const { rows } = await pool.query(`
    SELECT 
      cmc.*,
      a.asset_tag, a.brand, a.model, a.type as asset_type,
      a.date_fin_garantie, a.status as asset_status,
      u.username as assigned_name
    FROM calendar_maintenance_config cmc
    JOIN assets a ON cmc.asset_id = a.id
    LEFT JOIN users u ON cmc.assigned_to = u.id
    ORDER BY cmc.next_due ASC
  `);
  return rows;
}

/**
 * Récupère les événements de maintenance à venir
 */
export async function getUpcomingMaintenances(limit = 20) {
  const { rows } = await pool.query(`
    SELECT 
      ce.*,
      a.asset_tag, a.brand, a.model, a.type as asset_type,
      u.username as assigned_name
    FROM calendar_events ce
    JOIN assets a ON ce.asset_id = a.id
    LEFT JOIN users u ON ce.assigned_to = u.id
    WHERE ce.event_type = 'maintenance_preventive'
      AND ce.start_date >= NOW()
      AND ce.status NOT IN ('cancelled', 'completed')
    ORDER BY ce.start_date ASC
    LIMIT $1
  `, [limit]);
  return rows;
}

/**
 * Configure la maintenance automatique pour tous les équipements actifs
 * basée sur leur type
 */
export async function autoConfigureAllAssets() {
  const { rows: assets } = await pool.query(`
    SELECT id, type, brand, model
    FROM assets 
    WHERE status NOT IN ('Retiré', 'Hors service')
      AND id NOT IN (SELECT asset_id FROM calendar_maintenance_config WHERE enabled = true)
    ORDER BY type
  `);

  // Règles de maintenance par type d'équipement
  const maintenanceRules = {
    'Serveur': { type: 'monthly', months: 1 },
    'Switch': { type: 'quarterly', months: 3 },
    'Imprimante': { type: 'quarterly', months: 3 },
    'Ordinateur portable': { type: 'yearly', months: 12 },
    'Ordinateur fixe': { type: 'yearly', months: 12 },
    'Téléphone': { type: 'yearly', months: 12 },
    'Écran': { type: 'yearly', months: 12 },
  };

  let configured = 0;
  for (const asset of assets) {
    const rule = maintenanceRules[asset.type] || { type: 'yearly', months: 12 };

    await configureMaintenance(asset.id, {
      maintenance_type: rule.type,
      interval_months: rule.months,
      start_date: new Date(),
      notes: `Maintenance automatique configurée pour ${asset.brand} ${asset.model}`,
    });

    configured++;
  }

  console.log(`[Maintenance] ${configured} équipement(s) configuré(s) automatiquement`);
  return configured;
}

export default {
  configureMaintenance,
  disableMaintenance,
  scheduleNextMaintenance,
  runMaintenanceScheduler,
  getAllMaintenanceConfigs,
  getUpcomingMaintenances,
  autoConfigureAllAssets,
  MAINTENANCE_TYPES,
  MAINTENANCE_COLORS
};