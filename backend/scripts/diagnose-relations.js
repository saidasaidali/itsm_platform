// Script de diagnostic pour vérifier les assets et relations
import pool from '../src/db.js';

async function diagnose() {
  console.log('=== Diagnostic des Assets et Relations ===\n');
  
  // Vérifier les assets
  const assetsResult = await pool.query(
    `SELECT id, asset_tag, type, adresse_ip, department, office FROM assets`
  );
  console.log(`Total assets: ${assetsResult.rowCount}`);
  
  const computers = assetsResult.rows.filter(a => a.type === 'Ordinateur');
  const printers = assetsResult.rows.filter(a => a.type === 'Imprimante');
  
  console.log(`\nOrdinateurs: ${computers.length}`);
  computers.slice(0, 3).forEach(c => {
    console.log(`  ${c.asset_tag}: IP=${c.adresse_ip || 'NULL'}, Dept=${c.department || 'NULL'}, Office=${c.office || 'NULL'}`);
  });
  
  console.log(`\nImprimantes: ${printers.length}`);
  printers.slice(0, 3).forEach(p => {
    console.log(`  ${p.asset_tag}: IP=${p.adresse_ip || 'NULL'}, Dept=${p.department || 'NULL'}, Office=${p.office || 'NULL'}`);
  });
  
  // Vérifier les relations
  const relationsResult = await pool.query('SELECT COUNT(*) FROM asset_relations');
  console.log(`\nRelations existantes: ${relationsResult.rows[0].count}`);
  
// Vérifier la contrainte UNIQUE
  const constraintResult = await pool.query(
    `SELECT conname FROM pg_constraint WHERE conname = 'asset_relations_source_asset_id_target_asset_id_relation_ty_key'`
  );
  console.log(`Contrainte UNIQUE existe: ${constraintResult.rowCount > 0}`);
  
  // Vérifier les relations existantes
  const relationsSample = await pool.query(
    `SELECT source_asset_id, target_asset_id, relation_type FROM asset_relations LIMIT 5`
  );
  console.log(`\nExemples de relations: ${relationsSample.rowCount}`);
  relationsSample.rows.forEach(r => {
    console.log(`  source=${r.source_asset_id}, target=${r.target_asset_id}, type=${r.relation_type}`);
  });
  
  await pool.end();
}

diagnose().catch(console.error);