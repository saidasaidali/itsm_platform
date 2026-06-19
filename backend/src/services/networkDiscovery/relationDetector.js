// backend/src/services/networkDiscovery/relationDetector.js
// Détecte automatiquement les relations entre équipements et utilisateurs
import pool from '../../db.js';

// ── Détecter PC ↔ imprimante (même sous-réseau / même department) ──
export async function detectPcPrinterRelations() {
  const { rows: computers } = await pool.query(
    `SELECT id, asset_tag, adresse_ip, department, office
     FROM assets WHERE type = 'Ordinateur' AND adresse_ip IS NOT NULL`
  );
  const { rows: printers } = await pool.query(
    `SELECT id, asset_tag, adresse_ip, department, office
     FROM assets WHERE type = 'Imprimante' AND adresse_ip IS NOT NULL`
  );

  let created = 0;

  for (const pc of computers) {
    for (const printer of printers) {
      // Critère de proximité : même sous-réseau (3 premiers octets de l'IP) OU même bureau/département
      const sameSubnet = pc.adresse_ip && printer.adresse_ip &&
        pc.adresse_ip.split('.').slice(0, 3).join('.') === printer.adresse_ip.split('.').slice(0, 3).join('.');
      const sameLocation = (pc.department && pc.department === printer.department) ||
                            (pc.office && pc.office === printer.office);

      if (sameSubnet || sameLocation) {
        try {
          await pool.query(
            `INSERT INTO asset_relations (source_asset_id, target_asset_id, relation_type)
             VALUES ($1, $2, 'uses_printer')
             ON CONFLICT (source_asset_id, target_asset_id, relation_type) DO NOTHING`,
            [pc.id, printer.id]
          );
          created++;
        } catch (err) {
          // Ignorer les conflits silencieusement
        }
      }
    }
  }

  return created;
}

// ── Récupérer la carte réseau complète d'un utilisateur ────────
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

// ── Profil relationnel complet d'un équipement (pour Digital Twin) ──
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