// Script de correction des assets existants
import pool from '../src/db.js';

async function fixAssets() {
  console.log('=== Correction des assets existants ===\n');
  
  // 1. Corriger les types des imprimantes
  const result1 = await pool.query(
    `UPDATE assets 
     SET type = 'Imprimante' 
     WHERE (hostname ILIKE '%IMP%' OR asset_tag ILIKE '%IMP%') 
       AND type = 'Ordinateur'
     RETURNING id, asset_tag, type`
  );
  console.log(`Types Imprimante corrigés: ${result1.rowCount}`);
  result1.rows.forEach(r => console.log(`  ${r.asset_tag} → ${r.type}`));
  
  // 2. Corriger les asset_tag avec doublon 'PC-PC-'
  const result2 = await pool.query(
    `UPDATE assets 
     SET asset_tag = REPLACE(asset_tag, 'PC-PC-', 'PC-') 
     WHERE asset_tag LIKE 'PC-PC-%'
     RETURNING id, asset_tag`
  );
  console.log(`\nAsset tags corrigés: ${result2.rowCount}`);
  result2.rows.forEach(r => console.log(`  ${r.asset_tag}`));
  
  // 3. Corriger les department et office
  const result3 = await pool.query(
    `UPDATE assets 
     SET department = CASE 
       WHEN hostname ILIKE '%IMP%' OR hostname ILIKE '%USER%' THEN 'Finance'
       WHEN hostname ILIKE '%TECH%' THEN 'Informatique'
       WHEN hostname ILIKE '%SRV%' THEN 'Datacenter'
       WHEN hostname ILIKE '%DEV%' THEN 'Développement'
       ELSE department
     END,
     office = CASE 
       WHEN hostname ILIKE '%IMP%' OR hostname ILIKE '%USER%' THEN 'Bureau A'
       WHEN hostname ILIKE '%TECH%' THEN 'Bureau IT'
       WHEN hostname ILIKE '%SRV%' THEN 'Salle Serveurs'
       WHEN hostname ILIKE '%DEV%' THEN 'Bureau C'
       ELSE office
     END
     WHERE (hostname ILIKE '%IMP%' OR hostname ILIKE '%USER%' OR hostname ILIKE '%TECH%' 
            OR hostname ILIKE '%SRV%' OR hostname ILIKE '%DEV%')
       AND (department IS NULL OR office IS NULL)
     RETURNING id, asset_tag, department, office`
  );
  console.log(`\nDepartment/Office corrigés: ${result3.rowCount}`);
  result3.rows.forEach(r => console.log(`  ${r.asset_tag} → dept=${r.department}, office=${r.office}`));
  
  // 4. Corriger les adresse_ip des imprimantes
  const result4 = await pool.query(
    `UPDATE assets 
     SET adresse_ip = CASE 
       WHEN hostname ILIKE '%IMP-001%' OR asset_tag ILIKE '%IMP-001%' THEN '192.168.25.50'
       WHEN hostname ILIKE '%IMP-002%' OR asset_tag ILIKE '%IMP-002%' THEN '192.168.25.51'
       WHEN hostname ILIKE '%IMP-003%' OR asset_tag ILIKE '%IMP-003%' THEN '192.168.25.52'
       WHEN hostname ILIKE '%IMP-004%' OR asset_tag ILIKE '%IMP-004%' THEN '192.168.25.53'
       WHEN hostname ILIKE '%IMP-005%' OR asset_tag ILIKE '%IMP-005%' THEN '192.168.25.54'
       ELSE adresse_ip
     END
     WHERE (hostname ILIKE '%IMP%' OR asset_tag ILIKE '%IMP%')
       AND adresse_ip IS NULL
     RETURNING id, asset_tag, adresse_ip`
  );
  console.log(`\nAdresse IP corrigées: ${result4.rowCount}`);
  result4.rows.forEach(r => console.log(`  ${r.asset_tag} → ${r.adresse_ip}`));
  
  // 5. Vérifier le résultat
  const check = await pool.query(
    `SELECT type, COUNT(*) as count 
     FROM assets 
     GROUP BY type 
     ORDER BY type`
  );
  console.log('\n=== Répartition des types ===');
  check.rows.forEach(r => console.log(`  ${r.type}: ${r.count}`));
  
  const check2 = await pool.query(
    `SELECT COUNT(*) as count 
     FROM assets 
     WHERE type = 'Imprimante' AND department IS NOT NULL AND office IS NOT NULL`
  );
  console.log(`\nImprimantes avec dept/office: ${check2.rows[0].count}`);
  
  await pool.end();
}

fixAssets().catch(console.error);