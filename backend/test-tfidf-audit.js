// Audit TF-IDF : compter la fréquence des mots-clés dans la DB
const pool = require('./src/db.js').default;

(async () => {
  const result = await pool.query('SELECT problem_keywords FROM chatbot_learned_cases');
  const rows = result.rows;
  
  let countConfigurer = 0;
  let countVpn = 0;
  let total = rows.length;
  
  for (const row of rows) {
    const keywords = row.problem_keywords || [];
    if (keywords.some(kw => kw.toLowerCase().includes('configurer'))) countConfigurer++;
    if (keywords.some(kw => kw.toLowerCase().includes('vpn'))) countVpn++;
  }
  
  console.log('Total learned_cases:', total);
  console.log('Contiennent configurer:', countConfigurer, '(' + (countConfigurer/total*100).toFixed(1) + '%)');
  console.log('Contiennent vpn:', countVpn, '(' + (countVpn/total*100).toFixed(1) + '%)');
  
  // Poids TF-IDF simple
  const weightConfigurer = Math.log(total / (countConfigurer + 1));
  const weightVpn = Math.log(total / (countVpn + 1));
  console.log('\nPoids TF-IDF:');
  console.log('  configurer:', weightConfigurer.toFixed(3));
  console.log('  vpn:', weightVpn.toFixed(3));
  console.log('  Ratio vpn/configurer:', (weightVpn / weightConfigurer).toFixed(1) + 'x');
  
  await pool.end();
})().catch(err => { console.error(err); process.exit(1); });