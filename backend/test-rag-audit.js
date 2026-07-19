// Script d'audit complet du pipeline RAG
// Ce script analyse le prompt, les chunks, et la réponse d'Ollama
import ragService from './src/services/ragService.js';

// Question de test
const TEST_QUESTION = "Comment créer un ticket ?";

console.log('═'.repeat(80));
console.log('AUDIT COMPLET DU PIPELINE RAG');
console.log('═'.repeat(80));
console.log(`Question: "${TEST_QUESTION}"\n`);

// Étape 1: Récupérer les chunks
console.log('┌─ ÉTAPE 1: RECHERCHE DE CHUNKS ─────────────────────────────────────┐');
const chunks = await ragService.searchDocumentChunks(TEST_QUESTION, 3);
console.log(`Nombre de chunks trouvés: ${chunks.length}\n`);

if (chunks.length > 0) {
  chunks.forEach((chunk, idx) => {
    console.log(`\n[Chunk ${idx + 1}]`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Document ID: ${chunk.document_id}`);
    console.log(`  Nom du fichier: ${chunk.original_filename || 'N/A'}`);
    console.log(`  Score de similarité: ${chunk.similarity?.toFixed(4) || 'N/A'}`);
    console.log(`  Index: ${chunk.chunk_index || 'N/A'}`);
    console.log(`  Contenu (${chunk.content?.length || 0} caractères):`);
    console.log('  ' + '-'.repeat(70));
    console.log(`  ${chunk.content || 'VIDE'}`);
    console.log('  ' + '-'.repeat(70));
  });
} else {
  console.log('  ⚠️  AUCUN CHUNK TROUVÉ\n');
}

// Étape 2: Récupérer les articles KB
console.log('\n┌─ ÉTAPE 2: RECHERCHE DANS LA BASE DE CONNAISSANCES ─────────────────┐');
import { searchKnowledgeBase } from './src/services/knowledgeBaseSearch.js';
const kbArticles = await searchKnowledgeBase(TEST_QUESTION, { language: 'fr', limit: 5 });
console.log(`Nombre d'articles KB trouvés: ${kbArticles.length}\n`);

if (kbArticles.length > 0) {
  kbArticles.forEach((article, idx) => {
    console.log(`\n[Article KB ${idx + 1}]`);
    console.log(`  ID: ${article.id}`);
    console.log(`  Titre: ${article.title}`);
    console.log(`  Résumé: ${article.summary?.substring(0, 100)}...`);
  });
} else {
  console.log('  ⚠️  AUCUN ARTICLE KB TROUVÉ\n');
}

// Étape 3: Construire le prompt
console.log('\n┌─ ÉTAPE 3: CONSTRUCTION DU PROMPT ──────────────────────────────────┐');
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

console.log(`\nLongueur du prompt: ${prompt.length} caractères`);
console.log(`Nombre de mots: ${prompt.split(/\s+/).length}`);
console.log(`Nombre de tokens (estimation): ${Math.ceil(prompt.split(/\s+/).length * 1.3)}`);

console.log('\n┌─ PROMPT COMPLET ───────────────────────────────────────────────────┐');
console.log(prompt);
console.log('└' + '─'.repeat(79) + '┘');

// Étape 4: Vérifications
console.log('\n┌─ ÉTAPE 4: VÉRIFICATIONS DU PROMPT ─────────────────────────────────┐');

const checks = {
  'Contient "PDF"': prompt.toLowerCase().includes('pdf'),
  'Contient "chunk"': prompt.toLowerCase().includes('chunk'),
  'Contient "embedding"': prompt.toLowerCase().includes('embedding'),
  'Contient "vectoriel"': prompt.toLowerCase().includes('vectoriel'),
  'Contient "similarité"': prompt.toLowerCase().includes('similarité'),
  'Contient "connaissances générales"': prompt.toLowerCase().includes('connaissances générales'),
  'Contient "ne dois jamais inventer"': prompt.toLowerCase().includes('ne dois jamais inventer'),
  'Question placée APRÈS le contexte': prompt.indexOf('Question de l\'utilisateur') > prompt.indexOf('Articles de la base'),
  'Contexte mis en valeur': prompt.includes('Contexte') || prompt.includes('Base de connaissances'),
};

Object.entries(checks).forEach(([check, result]) => {
  console.log(`  ${result ? '✓' : '✗'} ${check}: ${result ? 'OUI' : 'NON'}`);
});

// Étape 5: Appel à Ollama
console.log('\n┌─ ÉTAPE 5: APPEL À OLLAMA ──────────────────────────────────────────┐');
const llmResponse = await ragService.callOllama(prompt);

console.log('\n┌─ RÉPONSE BRUTE D\'OLLAMA ───────────────────────────────────────────┐');
console.log(llmResponse || 'ERREUR: Aucune réponse');
console.log('└' + '─'.repeat(79) + '┘');

// Étape 6: Analyse
console.log('\n┌─ ÉTAPE 6: ANALYSE DU COMPORTEMENT ─────────────────────────────────┐');

const issues = [];

// Vérifier si la réponse contient des références techniques
if (llmResponse) {
  const technicalTerms = ['pdf', 'chunk', 'embedding', 'vectoriel', 'document pdf', 'fichier'];
  technicalTerms.forEach(term => {
    if (llmResponse.toLowerCase().includes(term)) {
      issues.push(`La réponse contient le terme technique: "${term}"`);
    }
  });

  // Vérifier si la réponse est générique
  const genericPhrases = [
    'je n\'ai pas d\'information',
    'je ne peux pas',
    'je n\'ai pas accès',
    'mes connaissances',
    'je ne sais pas',
    'je n\'ai pas cette information'
  ];
  
  const isGeneric = genericPhrases.some(phrase => 
    llmResponse.toLowerCase().includes(phrase)
  );
  
  if (isGeneric) {
    issues.push('La réponse est générique et ne utilise pas le contexte fourni');
  }

  // Vérifier si la réponse cite les sources
  if (!llmResponse.includes('base de connaissances') && !llmResponse.includes('contexte')) {
    issues.push('La réponse ne mentionne pas la base de connaissances');
  }
}

if (issues.length > 0) {
  console.log('\n  ⚠️  PROBLÈMES DÉTECTÉS:');
  issues.forEach(issue => console.log(`    • ${issue}`));
} else {
  console.log('\n  ✓ Aucun problème majeur détecté');
}

console.log('\n┌─ ÉTAPE 7: RECOMMANDATIONS ──────────────────────────────────────────┐');

const recommendations = [];

// Analyser le prompt
if (prompt.includes('connaissances générales') || prompt.includes('Tes connaissances')) {
  recommendations.push('PROBLÈME: Le prompt autorise le modèle à utiliser ses connaissances générales');
  recommendations.push('SOLUTION: Supprimer toute référence aux "connaissances générales" du modèle');
}

if (!prompt.includes('UNIQUEMENT') && !prompt.includes('EXCLUSIVEMENT')) {
  recommendations.push('PROBLÈME: Le prompt n\'oblige pas le modèle à utiliser UNIQUEMENT le contexte');
  recommendations.push('SOLUTION: Ajouter "UNIQUEMENT" et "EXCLUSIVEMENT" dans les instructions');
}

if (prompt.indexOf('Question de l\'utilisateur') < prompt.indexOf('Articles de la base')) {
  recommendations.push('PROBLÈME: La question pourrait être placée avant le contexte');
  recommendations.push('SOLUTION: Vérifier l\'ordre du prompt (contexte d\'abord, question après)');
}

if (chunks.length === 0 && kbArticles.length === 0) {
  recommendations.push('PROBLÈME: Aucun contexte trouvé pour cette question');
  recommendations.push('SOLUTION: Vérifier la base de connaissances et les documents indexés');
} else if (chunks.length > 0 || kbArticles.length > 0) {
  recommendations.push('✓ Contexte disponible dans le prompt');
}

if (recommendations.length > 0) {
  recommendations.forEach(rec => console.log(`  ${rec}`));
}

console.log('\n' + '═'.repeat(80));
console.log('FIN DE L\'AUDIT');
console.log('═'.repeat(80));
