import pdf2pic from 'pdf2pic';

console.log('═══════════════════════════════════════════════════════════');
console.log('ANALYSE DE PDF2PIC v3.2.0');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Vérifier l'import
console.log('1. IMPORT');
console.log('   Type:', typeof pdf2pic);
console.log('   Clés:', Object.keys(pdf2pic));
console.log('   fromPath:', typeof pdf2pic.fromPath);
console.log('   fromBuffer:', typeof pdf2pic.fromBuffer);
console.log('   fromBase64:', typeof pdf2pic.fromBase64);
console.log('');

// 2. Vérifier les options par défaut
console.log('2. OPTIONS PAR DÉFAUT');
const converter = pdf2pic.fromPath('dummy.pdf');
console.log('   Options:', converter.getOptions());
console.log('');

// 3. Tester avec les options du code
console.log('3. OPTIONS UTILISÉES DANS LE CODE');
const converter2 = pdf2pic.fromPath('dummy.pdf', {
  format: 'png',
  quality: 300,
  outdir: 'C:\\temp',
  popplerPath: 'C:\\poppler',
});
console.log('   Options:', converter2.getOptions());
console.log('');

// 4. Vérifier si popplerPath est accepté
console.log('4. VÉRIFICATION DE popplerPath');
console.log('   popplerPath dans options:', 'popplerPath' in converter2.getOptions());
console.log('');

// 5. Vérifier les méthodes disponibles
console.log('5. MÉTHODES DISPONIBLES');
console.log('   bulk:', typeof converter2.bulk);
console.log('   setOptions:', typeof converter2.setOptions);
console.log('   setGMClass:', typeof converter2.setGMClass);
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('CONCLUSION');
console.log('═══════════════════════════════════════════════════════════');
console.log('pdf2pic v3.2.0 utilise GraphicsMagick, pas Poppler.');
console.log('L\'option popplerPath n\'existe PAS dans cette version.');
console.log('Les options valides sont : quality, format, width, height,');
console.log('density, preserveAspectRatio, savePath, saveFilename,');
console.log('compression, units.');