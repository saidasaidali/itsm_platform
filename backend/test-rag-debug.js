// Script d'audit DEBUG complet du pipeline RAG
// Affiche TOUTES les étapes avec preuves complètes
import ragService from './src/services/ragService.js';
import { searchKnowledgeBase } from './src/services/knowledgeBaseSearch.js';

// Question de test
const TEST_QUESTION = "Comment configurer le VPN ?";

console.log('\n' + '═'.repeat(80));
console.log('AUDIT DEBUG COMPLET DU PIPELINE RAG');
console.log('═'.repeat(80));
console.log(`Question: "${TEST_QUESTION}"\n`);

// Étape 1: Récupérer les chunks PDF
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 1: DOCUMENTS INTERNES RÉCUPÉRÉS');
console.log('═'.repeat(80));

const chunks = await ragService.searchDocumentChunks(TEST_QUESTION, 3);
console.log(`Nombre de documents trouvés: ${chunks.length}\n`);

if (chunks.length > 0) {
  chunks.forEach((chunk, idx) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`DOCUMENT ${idx + 1}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`ID: ${chunk.id}`);
    console.log(`Document ID: ${chunk.document_id}`);
    console.log(`Nom du fichier: ${chunk.original_filename || 'N/A'}`);
    console.log(`Score de similarité: ${chunk.similarity?.toFixed(4) || 'N/A'}`);
    console.log(`Index: ${chunk.chunk_index || 'N/A'}`);
    console.log(`\nContenu (${chunk.content?.length || 0} caractères):`);
    console.log(`${'─'.repeat(80)}`);
    console.log(chunk.content || 'VIDE');
    console.log(`${'─'.repeat(80)}`);
  });
} else {
  console.log('  ⚠️  AUCUN DOCUMENT TROUVÉ\n');
}

// Étape 2: Récupérer les articles KB
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 2: ARTICLES BASE DE CONNAISSANCES');
console.log('═'.repeat(80));

const kbArticles = await searchKnowledgeBase(TEST_QUESTION, { language: 'fr', limit: 5 });
console.log(`Nombre d'articles KB trouvés: ${kbArticles.length}\n`);

if (kbArticles.length > 0) {
  kbArticles.forEach((article, idx) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`ARTICLE KB ${idx + 1}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`ID: ${article.id}`);
    console.log(`Titre: ${article.title}`);
    console.log(`Résumé: ${article.summary || 'N/A'}`);
    console.log(`Contenu: ${article.content?.substring(0, 300) || 'N/A'}...`);
    console.log(`Score: ${article.rank?.toFixed(4) || 'N/A'}`);
  });
} else {
  console.log('  ⚠️  AUCUN ARTICLE KB TROUVÉ\ n');
}

// Étape 3: Construire le prompt
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 3: PROMPT COMPLET ENVOYÉ À OLLAMA');
console.log('═'.repeat(80));

const prompt = ragService.buildRagPrompt({
  userMessage: TEST_QUESTION,
  kbArticles,
  documentChunks: chunks,
  learnedCases: [],
  conversationHistory: [],
  platformInfo: `
    - Pour créer un ticket : clique sur "Tickets" → "Nouveau ticket"
    - Pour consulter tes tickets : clique sur "Tickets" → "Mes tickets"
    - Pour voir tes équipements : clique sur "Équipements"
    - Pour accéder à la base de connaissances : clique sur "Base de connaissances"
  `,
  analysis: {
    intent: 'kb_search',
    sentiment: { sentiment: 'neutre', score: 0 },
    ticketClassification: { category: 'Autre', priority: 'Normale' },
  },
});

console.log(`\nLongueur: ${prompt.length} caractères`);
console.log(`Mots: ${prompt.split(/\s+/).length}`);
console.log(`Tokens estimés: ${Math.ceil(prompt.split(/\s+/).length * 1.3)}`);
console.log(`\n${'═'.repeat(80)}`);
console.log('PROMPT COMPLET:');
console.log('═'.repeat(80));
console.log(prompt);
console.log('═'.repeat(80));

// Étape 4: Vérifications
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 4: VÉRIFICATIONS');
console.log('═'.repeat(80));

const checks = {
  'Question dans le prompt': prompt.includes(TEST_QUESTION),
  'Documents présents': chunks.length > 0 && prompt.includes('Document 1'),
  'Articles KB présents': kbArticles.length > 0 && prompt.includes('Article 1'),
  'Pas de "PDF"': !prompt.toLowerCase().includes('pdf'),
  'Pas de "chunk"': !prompt.toLowerCase().includes('chunk'),
  'Pas de "embedding"': !prompt.toLowerCase().includes('embedding'),
  'Interdiction connaissances générales': prompt.includes('INTERDITES'),
  'Instruction "UNIQUEMENT"': prompt.includes('UNIQUEMENT'),
  'Question APRÈS contexte': prompt.indexOf('QUESTION DE L\'UTILISATEUR') > prompt.indexOf('Documents de référence'),
};

Object.entries(checks).forEach(([check, result]) => {
  console.log(`  ${result ? '✓' : '✗'} ${check}: ${result ? 'OUI' : 'NON'}`);
});

// Étape 5: Appel à Ollama
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 5: APPEL À OLLAMA');
console.log('═'.repeat(80));
console.log('Modèle: llama3.2');
console.log('Temperature: 0.3');
console.log('Max tokens: 512');
console.log('\nEnvoi du prompt...\n');

const llmResponse = await ragService.callOllama(prompt);

console.log('═'.repeat(80));
console.log('RÉPONSE BRUTE D\'OLLAMA:');
console.log('═'.repeat(80));
console.log(llmResponse || 'ERREUR: Aucune réponse');
console.log('═'.repeat(80));

// Étape 6: Analyse
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 6: ANALYSE DE LA RÉPONSE');
console.log('═'.repeat(80));

const issues = [];

if (llmResponse) {
  // Vérifier si la réponse contient des références techniques
  const technicalTerms = ['pdf', 'chunk', 'embedding', 'vectoriel', 'document pdf', 'fichier'];
  technicalTerms.forEach(term => {
    if (llmResponse.toLowerCase().includes(term)) {
      issues.push(`La réponse contient le terme technique: "${term}"`);
    }
  });

  // Vérifier si la réponse est générique (connaissances générales)
  const genericPhrases = [
    'vérifiez votre connexion internet',
    'ouvrez le client vpn',
    'entrez vos identifiants',
    'lancez le client',
    'installez le client',
    'téléchargez',
    'cliquez sur démarrer'
  ];
  
  const isGeneric = genericPhrases.some(phrase => 
    llmResponse.toLowerCase().includes(phrase)
  );
  
  if (isGeneric) {
    issues.push('❌ PROBLÈME MAJEUR: La réponse utilise des connaissances générales du modèle');
    issues.push('   → Le modèle ignore le contexte fourni');
    issues.push('   → Cause possible: Les documents ne contiennent pas l\'information demandée');
    issues.push('   → Cause possible: Le prompt n\'est pas suffisamment contraignant');
  }

  // Vérifier si la réponse cite les sources
  if (!llmResponse.includes('base de connaissances') && !llmResponse.includes('contexte')) {
    issues.push('La réponse ne mentionne pas la base de connaissances');
  }

  // Vérifier si la réponse indique ne pas avoir l'information
  if (llmResponse.includes('je n\'ai pas') || llmResponse.includes('pas d\'information')) {
    console.log('  ✓ Le modèle indique ne pas avoir l\'information (comportement correct)');
  }
}

if (issues.length > 0) {
  console.log('\n  ⚠️  PROBLÈMES DÉTECTÉS:');
  issues.forEach(issue => console.log(`    • ${issue}`));
} else {
  console.log('\n  ✓ Aucun problème majeur détecté');
}

// Étape 7: Recommandations
console.log('\n' + '═'.repeat(80));
console.log('ÉTAPE 7: RECOMMANDATIONS');
console.log('═'.repeat(80));

if (chunks.length === 0 && kbArticles.length === 0) {
  console.log('  ❌ PROBLÈME: Aucun contexte disponible');
  console.log('  SOLUTION: Indexer des documents contenant la procédure VPN');
} else if (chunks.length > 0 || kbArticles.length > 0) {
  console.log('  ✓ Contexte disponible');
  
  // Vérifier la pertinence du contenu
  const hasVPNInfo = [...chunks, ...kbArticles].some(doc => 
    doc.content?.toLowerCase().includes('vpn') || 
    doc.content?.toLowerCase().includes('configuration') ||
    doc.summary?.toLowerCase().includes('vpn')
  );
  
  if (!hasVPNInfo) {
    console.log('  ❌ PROBLÈME: Les documents récupérés ne contiennent pas d\'information sur le VPN');
    console.log('  SOLUTION: Indexer un document contenant explicitement la procédure de configuration VPN');
    console.log('  Exemple de contenu attendu:');
    console.log('    "Pour configurer le VPN:');
    console.log('    1. Ouvrez Paramètres');
    console.log('    2. Allez dans Réseau');
    console.log('    3. Cliquez sur VPN');
    console.log('    4. Entrez vos identifiants..."');
  }
}

console.log('\n' + '═'.repeat(80));
console.log('FIN DE L\'AUDIT');
console.log('═'.repeat(80));