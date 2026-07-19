import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const popplerPath = 'C:\\Users\\HP\\Downloads\\poppler-26.02.0\\Library\\bin\\pdftoppm.exe';
const pdfFile = 'C:\\Users\\HP\\Downloads\\itsm-platform\\backend\\storage\\pdfs\\1784025241230_scan1.pdf';
const outputDir = 'C:\\Users\\HP\\Downloads\\itsm-platform\\backend\\storage\\pdfs\\temp_test_poppler';

console.log('Test direct de Poppler');
console.log('PDF:', pdfFile);
console.log('Poppler:', popplerPath);

try {
  // Créer le dossier de sortie
  const { mkdir } = await import('fs/promises');
  await mkdir(outputDir, { recursive: true });
  
  console.log('Exécution de pdftoppm...');
  const command = `"${popplerPath}" -png -r 300 "${pdfFile}" "${outputDir}\\page"`;
  
  console.log('Commande:', command);
  
  const { stdout, stderr } = await execAsync(command, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024
  });
  
  console.log('✅ Poppler a terminé avec succès');
  console.log('Sortie:', stdout);
  if (stderr) console.log('Stderr:', stderr);
  
  // Lister les fichiers créés
  const { readdir } = await import('fs');
  const files = await readdir(outputDir);
  console.log(`✅ ${files.length} fichier(s) créé(s):`, files);
  
} catch (err) {
  console.error('❌ Erreur Poppler:');
  console.error('Message:', err.message);
  console.error('Code:', err.code);
  if (err.stdout) console.error('Stdout:', err.stdout);
  if (err.stderr) console.error('Stderr:', err.stderr);
  console.error('Stack:', err.stack);
}