import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const popplerExe = 'C:\\Users\\HP\\Downloads\\poppler-26.02.0\\Library\\bin\\pdftoppm.exe';
const pdfFile = 'C:\\Users\\HP\\Downloads\\itsm-platform\\backend\\storage\\pdfs\\1784025241230_scan1.pdf';
const outputDir = 'C:\\Users\\HP\\Downloads\\itsm-platform\\backend\\storage\\pdfs\\temp_ocr';
const outputPrefix = 'page';

console.log('═══════════════════════════════════════════════════════════');
console.log('TEST POPPLER DIRECT');
console.log('═══════════════════════════════════════════════════════════');
console.log('PDF:', pdfFile);
console.log('Poppler:', popplerExe);
console.log('Output dir:', outputDir);
console.log('Output prefix:', outputPrefix);
console.log('═══════════════════════════════════════════════════════════\n');

try {
  // Créer le dossier de sortie
  const { mkdir } = await import('fs/promises');
  await mkdir(outputDir, { recursive: true });
  console.log('✅ Dossier créé:', outputDir);
  
  // Construire la commande EXACTEMENT comme pdf2pic le ferait
  // pdf2pic utilise: pdftoppm -png -r 300 input.pdf output_prefix
  const command = `"${popplerExe}" -png -r 300 "${pdfFile}" "${outputDir}\\${outputPrefix}"`;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('COMMANDE EXÉCUTÉE:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(command);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Exécution en cours...');
  const startTime = Date.now();
  
  const { stdout, stderr } = await execAsync(command, {
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
    cwd: 'C:\\Users\\HP\\Downloads\\itsm-platform\\backend'
  });
  
  const duration = Date.now() - startTime;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('RÉSULTAT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Succès en ${duration}ms`);
  console.log('\nSTDOUT:');
  console.log(stdout || '(vide)');
  console.log('\nSTDERR:');
  console.log(stderr || '(vide)');
  
  // Lister les fichiers créés
  const { readdir } = await import('fs/promises');
  const files = await readdir(outputDir);
  console.log(`\n✅ ${files.length} fichier(s) créé(s):`);
  files.forEach(f => console.log('  -', f));
  
} catch (err) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ERREUR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Message:', err.message);
  console.log('Code:', err.code);
  console.log('\nSTDOUT:');
  console.log(err.stdout || '(vide)');
  console.log('\nSTDERR:');
  console.log(err.stderr || '(vide)');
  console.log('\nStack:');
  console.log(err.stack);
}