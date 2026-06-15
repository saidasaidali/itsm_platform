// scripts/importAssets.js
// Usage : node scripts/importAssets.js fichier.xlsx
import xlsx from 'xlsx'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function importAssets(filePath) {
  const workbook  = xlsx.readFile(filePath)
  const sheet     = workbook.Sheets[workbook.SheetNames[0]]
  const rows      = xlsx.utils.sheet_to_json(sheet)

  console.log(`📋 ${rows.length} lignes trouvées`)
  console.log('Colonnes détectées :', Object.keys(rows[0] || {}))

  let inserted = 0, skipped = 0, errors = 0

  for (const row of rows) {
    try {
      // ── Adapter ces noms de colonnes selon votre Excel ──
      const asset_tag     = row['Tag'] || row['asset_tag'] || row['N° Inventaire'] || row['numero_inventaire'] || null
      const type          = row['Type'] || row['type'] || 'Autre'
      const brand         = row['Marque'] || row['brand'] || 'Inconnu'
      const model         = row['Modèle'] || row['model'] || 'Inconnu'
      const serial_number = row['N° Série'] || row['serial'] || row['numero_serie'] || null
      const location      = row['Emplacement'] || row['location'] || row['Bureau'] || null
      const department    = row['Direction'] || row['Service'] || row['department'] || null
      const status        = row['Statut'] || row['status'] || 'En service'
      const ip            = row['Adresse IP'] || row['ip'] || row['adresse_ip'] || null
      const mac           = row['Adresse MAC'] || row['mac'] || row['adresse_mac'] || null
      const warranty_end  = row['Fin Garantie'] || row['date_fin_garantie'] || null
      const purchase_date = row['Date Achat'] || row['date_acquisition'] || null

      // Nom d'utilisateur assigné
      const assignedUsername = row['Affecté à'] || row['Utilisateur'] || row['assigned_to'] || null

      if (!asset_tag) { skipped++; continue }

      // Trouver l'utilisateur par username
      let assigned_to = null
      if (assignedUsername) {
        const { rows: userRows } = await pool.query(
          `SELECT id FROM users WHERE username ILIKE $1 LIMIT 1`,
          [assignedUsername.trim()]
        )
        if (userRows[0]) assigned_to = userRows[0].id
        else console.warn(`  ⚠️  Utilisateur non trouvé : "${assignedUsername}"`)
      }

      // Convertir date Excel (nombre) en date JS si nécessaire
      const parseDate = (val) => {
        if (!val) return null
        if (typeof val === 'number') {
          // Date Excel sérialisée
          return xlsx.SSF.parse_date_code(val)
            ? new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().split('T')[0]
            : null
        }
        return String(val).trim() || null
      }

      await pool.query(
        `INSERT INTO assets
           (asset_tag, type, brand, model, serial_number, location,
            department, status, assigned_to, adresse_ip, adresse_mac,
            purchase_date, warranty_end, assigned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                 CASE WHEN $9 IS NOT NULL THEN NOW() ELSE NULL END)
         ON CONFLICT (asset_tag) DO UPDATE SET
           type          = EXCLUDED.type,
           brand         = EXCLUDED.brand,
           model         = EXCLUDED.model,
           serial_number = EXCLUDED.serial_number,
           location      = EXCLUDED.location,
           department    = EXCLUDED.department,
           status        = EXCLUDED.status,
           assigned_to   = EXCLUDED.assigned_to,
           adresse_ip    = EXCLUDED.adresse_ip,
           adresse_mac   = EXCLUDED.adresse_mac,
           purchase_date = EXCLUDED.purchase_date,
           warranty_end  = EXCLUDED.warranty_end,
           updated_at    = NOW()`,
        [
          asset_tag, type, brand, model,
          serial_number, location, department,
          status, assigned_to,
          ip, mac,
          parseDate(purchase_date),
          parseDate(warranty_end),
        ]
      );

      inserted++
      console.log(`  ✅ ${asset_tag} — ${brand} ${model}`)
    } catch (err) {
      errors++
      console.error(`  ❌ Erreur ligne :`, row, err.message)
    }
  }

  console.log(`\n📊 Résultat : ${inserted} insérés/mis à jour, ${skipped} ignorés, ${errors} erreurs`)
  await pool.end()
}

importAssets(process.argv[2] || 'assets.xlsx')