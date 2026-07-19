// backend/src/services/networkDiscovery/relationDetector.js
// Détecte automatiquement les relations entre équipements et utilisateurs
// Architecture centralisée : utilise SimulationService en mode simulation

import pool from '../../db.js';
import { getSettings } from '../settingsService.js';
import { getAssets, getRelations, getSimulationContext } from '../mock/simulationService.js';

// ── Types de machines considérés comme "Ordinateur" ─────────────────────────────
const COMPUTER_TYPES = [
  'Ordinateur',
  'Ordinateur portable',
  'Ordinateur fixe',
  'Desktop',
  'Laptop',
  'Workstation',
  'PC',
];

// ── Vérifie si un type d'actif est un ordinateur ───────────────────────────────
function isComputerType(type) {
  if (!type) return false;
  return COMPUTER_TYPES.includes(type);
}

// ── Récupère les 3 premiers octets d'une IP (sous-réseau) ─────────────────────
function getSubnet(ip) {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.');
  }
  return null;
}

// ── Vérifie si deux IPs sont sur le même sous-réseau ───────────────────────────
function sameSubnet(ip1, ip2) {
  if (!ip1 || !ip2) return false;
  return getSubnet(ip1) === getSubnet(ip2);
}

// ── Vérifie si deux équipements sont au même department ───────────────────────
function sameDepartment(dep1, dep2) {
  if (!dep1 || !dep2) return false;
  return dep1 === dep2;
}

// ── Vérifie si deux équipements sont au même office ─────────────────────────────
function sameOffice(off1, off2) {
  if (!off1 || !off2) return false;
  return off1 === off2;
}

// ── Clé unique pour identifier une relation (source-target-type) ──────────────
function relationKey(sourceId, targetId, relationType) {
  return `${sourceId}-${targetId}-${relationType}`;
}

// ── Précharge toutes les relations existantes en une seule requête ────────────
async function fetchExistingRelations(relationType) {
  const { rows } = await pool.query(
    `SELECT source_asset_id, target_asset_id
     FROM asset_relations
     WHERE relation_type = $1`,
    [relationType]
  );

  const existing = new Set();
  rows.forEach((r) => {
    existing.add(relationKey(r.source_asset_id, r.target_asset_id, relationType));
  });

  return existing;
}

// ── Récupère les ordinateurs depuis la base (ou enrichis avec simulation) ───────────
async function fetchComputers() {
  const s = getSettings();
  const isSimulation = s.simulation_mode === true || s.simulation_mode === 'true';

  // Mode production: requête en base - chercher tous les types possibles
  const { rows } = await pool.query(
    `SELECT id, asset_tag, hostname, adresse_ip, department, office, type
     FROM assets
     WHERE type = ANY($1) OR type IN ('PC', 'Desktop', 'Laptop', 'Workstation')`,
    [COMPUTER_TYPES]
  );

  // En mode simulation, enrichir avec les métadonnées simulées
  if (isSimulation) {
    const simulatedAssets = getAssets();
    const simulatedByHostname = new Map();
    simulatedAssets.forEach(a => {
      if (a.hostname) simulatedByHostname.set(a.hostname.toLowerCase(), a);
      if (a.asset_tag) simulatedByHostname.set(a.asset_tag.toLowerCase(), a);
    });

    return rows.map(asset => {
      const key = (asset.hostname || asset.asset_tag || '').toLowerCase();
      const simulated = simulatedByHostname.get(key);
      if (simulated) {
        return {
          ...asset,
          adresse_ip: asset.adresse_ip || simulated.ip_address,
          department: asset.department || simulated.department,
          office: asset.office || simulated.office,
        };
      }
      return asset;
    });
  }

  return rows;
}

// ── Récupère les imprimantes depuis la base (ou enrichis avec simulation) ───────────
async function fetchPrinters() {
  const s = getSettings();
  const isSimulation = s.simulation_mode === true || s.simulation_mode === 'true';

  // Mode production: requête en base - chercher aussi les types alternatifs
  const { rows } = await pool.query(
    `SELECT id, asset_tag, hostname, adresse_ip, department, office, type
     FROM assets
     WHERE type = 'Imprimante' OR type ILIKE '%printer%' OR type ILIKE '%imprimante%'`
  );

  // En mode simulation, enrichir avec les métadonnées simulées ET mettre à jour la base
  if (isSimulation) {
    const simulatedAssets = getAssets();
    const simulatedByHostname = new Map();
    simulatedAssets.forEach(a => {
      if (a.hostname) simulatedByHostname.set(a.hostname.toLowerCase(), a);
      if (a.asset_tag) simulatedByHostname.set(a.asset_tag.toLowerCase(), a);
    });

    // Mettre à jour les assets existants avec les métadonnées manquantes
    for (const asset of rows) {
      const key = (asset.hostname || asset.asset_tag || '').toLowerCase();
      const simulated = simulatedByHostname.get(key);

      if (simulated && (asset.department === null || asset.office === null || asset.adresse_ip === null)) {
        console.log(`[RelationDetector] Mise à jour asset ${asset.asset_tag}: dept=${asset.department}→${simulated.department}, office=${asset.office}→${simulated.office}`);

        await pool.query(
          `UPDATE assets SET
             department = COALESCE(department, $1),
             office = COALESCE(office, $2),
             adresse_ip = COALESCE(adresse_ip, $3),
             updated_at = NOW()
           WHERE id = $4`,
          [simulated.department, simulated.office, simulated.ip_address, asset.id]
        );
      }
    }

    // Retourner les assets mis à jour
    const { rows: updatedRows } = await pool.query(
      `SELECT id, asset_tag, hostname, adresse_ip, department, office, type
       FROM assets
       WHERE type = 'Imprimante' OR type ILIKE '%printer%' OR type ILIKE '%imprimante%'`
    );

    return updatedRows.map(asset => {
      const key = (asset.hostname || asset.asset_tag || '').toLowerCase();
      const simulated = simulatedByHostname.get(key);
      if (simulated) {
        return {
          ...asset,
          adresse_ip: asset.adresse_ip || simulated.ip_address,
          department: asset.department || simulated.department,
          office: asset.office || simulated.office,
        };
      }
      return asset;
    });
  }

  return rows;
}

// ── Crée une relation entre deux équipements ───────────────────────────────────
// Note : appelée uniquement pour des couples déjà filtrés (pas encore en base)
async function createRelation(sourceId, targetId, relationType) {
  console.log(`  [SQL INSERT] source_asset_id=${sourceId}, target_asset_id=${targetId}, relation_type=${relationType}`);

  try {
    const result = await pool.query(
      `INSERT INTO asset_relations (source_asset_id, target_asset_id, relation_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_asset_id, target_asset_id, relation_type) DO NOTHING
       RETURNING id`,
      [sourceId, targetId, relationType]
    );

    console.log(`  [SQL RESULT] rowCount=${result.rowCount}`);
    return result.rowCount > 0;
  } catch (err) {
    console.log(`  [SQL ERROR] message=${err.message}`);
    console.log(`  [SQL ERROR] code=${err.code}`);
    console.log(`  [SQL ERROR] detail=${err.detail}`);
    console.log(`  [SQL ERROR] constraint=${err.constraint}`);
    return false;
  }
}

// ── Détecter PC ↔ imprimante (même sous-réseau / même department) ───────────────
export async function detectPcPrinterRelations() {
  console.log('\n[RelationDetector] ================================');
  console.log('[RelationDetector] DÉBUT DÉTECTION');
  console.log('[RelationDetector] =================================');

  const s = getSettings();
  const isSimulation = s.simulation_mode === true || s.simulation_mode === 'true';

  if (isSimulation) {
    console.log('[RelationDetector] Mode simulation activé');
  }

  const RELATION_TYPE = 'uses_printer';

  // Statistiques pour le rapport final
  const stats = {
    computersFound: 0,
    printersFound: 0,
    relationsTested: 0,
    relationsCreated: 0,
    relationsSkippedExisting: 0,
    relationsIgnored: 0,
    sqlSuccess: 0,
    sqlErrors: 0,
    reasons: {
      noCriteria: 0,
    },
  };

  // Précharger les relations déjà connues (1 seule requête, au lieu de N tentatives d'INSERT)
  const existingRelations = await fetchExistingRelations(RELATION_TYPE);
  console.log(`[RelationDetector] ${existingRelations.size} relation(s) déjà existante(s) préchargée(s)`);

  // Récupérer les ordinateurs
  const computers = await fetchComputers();
  stats.computersFound = computers.length;

  console.log(`\n[RelationDetector] PC TROUVÉS : ${computers.length}`);
  console.log('[RelationDetector] --- 5 premiers PC ---');
  computers.slice(0, 5).forEach(pc => {
    console.log(`  id=${pc.id}, asset_tag=${pc.asset_tag}, type=${pc.type}, hostname=${pc.hostname || 'NULL'}`);
    console.log(`    adresse_ip=${pc.adresse_ip || 'NULL'}, department=${pc.department || 'NULL'}, office=${pc.office || 'NULL'}`);
  });

  // Récupérer les imprimantes
  const printers = await fetchPrinters();
  stats.printersFound = printers.length;

  console.log(`\n[RelationDetector] IMPRIMANTES TROUVÉES : ${printers.length}`);
  console.log('[RelationDetector] --- 5 premières imprimantes ---');
  printers.slice(0, 5).forEach(printer => {
    console.log(`  id=${printer.id}, asset_tag=${printer.asset_tag}, type=${printer.type}`);
    console.log(`    adresse_ip=${printer.adresse_ip || 'NULL'}, department=${printer.department || 'NULL'}, office=${printer.office || 'NULL'}`);
  });

  // Analyser les relations
  console.log(`\n[RelationDetector] ANALYSE DES RELATIONS`);

  for (const pc of computers) {
    for (const printer of printers) {
      stats.relationsTested++;

      const key = relationKey(pc.id, printer.id, RELATION_TYPE);

      // Skip immédiat si la relation existe déjà : pas de calcul de critères, pas d'INSERT
      if (existingRelations.has(key)) {
        stats.relationsSkippedExisting++;
        continue;
      }

      const pcIp = pc.adresse_ip;
      const printerIp = printer.adresse_ip;
      const pcSubnet = getSubnet(pcIp);
      const printerSubnet = getSubnet(printerIp);
      const subnetMatch = sameSubnet(pcIp, printerIp);
      const deptMatch = sameDepartment(pc.department, printer.department);
      const officeMatch = sameOffice(pc.office, printer.office);

      console.log(`\n[RelationDetector] ${pc.asset_tag} -> ${printer.asset_tag}`);
      console.log(`  sameSubnet = ${subnetMatch} (PC: ${pcSubnet}, Printer: ${printerSubnet})`);
      console.log(`  sameDepartment = ${deptMatch} (PC: ${pc.department || 'NULL'}, Printer: ${printer.department || 'NULL'})`);
      console.log(`  sameOffice = ${officeMatch} (PC: ${pc.office || 'NULL'}, Printer: ${printer.office || 'NULL'})`);

      if (subnetMatch || deptMatch || officeMatch) {
        const created = await createRelation(pc.id, printer.id, RELATION_TYPE);
        if (created) {
          console.log(`  [RelationDetector] => Relation créée`);
          stats.relationsCreated++;
          stats.sqlSuccess++;
          existingRelations.add(key); // évite un doublon si le même couple revient dans cette passe
        } else {
          console.log(`  [RelationDetector] => Erreur ou conflit inattendu à l'insertion`);
        }
      } else {
        console.log(`  [RelationDetector] => Relation refusée - aucun critère satisfait`);
        stats.relationsIgnored++;
        stats.reasons.noCriteria++;
      }
    }
  }

  // Rapport final
  console.log(`\n[RelationDetector] ========== RELATION REPORT ==========`);
  console.log(`[RelationDetector] PC trouvés : ${stats.computersFound}`);
  console.log(`[RelationDetector] Imprimantes trouvées : ${stats.printersFound}`);
  console.log(`[RelationDetector] Couples testés : ${stats.relationsTested}`);
  console.log(`[RelationDetector] Relations créées : ${stats.relationsCreated}`);
  console.log(`[RelationDetector] Relations déjà existantes (skip) : ${stats.relationsSkippedExisting}`);
  console.log(`[RelationDetector] Relations refusées (aucun critère) : ${stats.relationsIgnored}`);
  console.log(`[RelationDetector] Erreurs SQL : ${stats.sqlErrors}`);
  console.log(`[RelationDetector] =================================`);
  console.log('[RelationDetector] FIN DÉTECTION');
  console.log('[RelationDetector] =================================\n');

  return {
    computersFound: stats.computersFound,
    printersFound: stats.printersFound,
    relationsTested: stats.relationsTested,
    relationsCreated: stats.relationsCreated,
    relationsExisting: stats.relationsSkippedExisting,
    relationsIgnored: stats.relationsIgnored,
  };
}

// ── Récupérer la carte réseau complète d'un utilisateur ────────────────────────
export async function getUserNetworkMap(userId) {
  // 1. Équipements affectés directement à l'utilisateur
  const { rows: ownedAssets } = await pool.query(
    `SELECT * FROM assets WHERE assigned_to = $1`,
    [userId]
  );

  if (ownedAssets.length === 0) {
    return { user_id: userId, assets: [], printers: [], tickets: [] };
  }

  const assetIds = ownedAssets.map((a) => a.id);

  // 2. Imprimantes liées à ces équipements
  const { rows: relatedPrinters } = await pool.query(
    `SELECT DISTINCT a.* FROM asset_relations r
     JOIN assets a ON a.id = r.target_asset_id
     WHERE r.source_asset_id = ANY($1) AND r.relation_type = 'uses_printer'`,
    [assetIds]
  );

  // 3. Tickets liés à ces équipements OU créés par l'utilisateur
  const { rows: tickets } = await pool.query(
    `SELECT t.id, t.title, t.status, t.priority, t.category, t.created_at, t.asset_id,
            a.asset_tag
     FROM tickets t
     LEFT JOIN assets a ON t.asset_id = a.id
     WHERE t.asset_id = ANY($1) OR t.created_by = $2
     ORDER BY t.created_at DESC
     LIMIT 20`,
    [assetIds, userId]
  );

  return {
    user_id: userId,
    assets: ownedAssets,
    printers: relatedPrinters,
    tickets,
  };
}

// ── Profil relationnel complet d'un équipement (pour Digital Twin) ─────────────
export async function getAssetRelations(assetId) {
  const { rows: outgoing } = await pool.query(
    `SELECT r.relation_type, a.id, a.asset_tag, a.type, a.brand, a.model
     FROM asset_relations r
     JOIN assets a ON a.id = r.target_asset_id
     WHERE r.source_asset_id = $1`,
    [assetId]
  );

  const { rows: incoming } = await pool.query(
    `SELECT r.relation_type, a.id, a.asset_tag, a.type, a.brand, a.model
     FROM asset_relations r
     JOIN assets a ON a.id = r.source_asset_id
     WHERE r.target_asset_id = $1`,
    [assetId]
  );

  return { outgoing, incoming };
}

export default { detectPcPrinterRelations, getUserNetworkMap, getAssetRelations };