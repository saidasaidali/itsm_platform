// backend/src/services/pdfIndexer.js
// Service d'indexation PDF pour le chatbot RAG
// Responsabilités : extraction texte, OCR (secours), chunking, embeddings, stockage

import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import ollama from 'ollama';
import pool from '../db.js';
import { getSettings } from './settingsService.js';

// Conversion PDF → images effectuée directement via Poppler (pdftoppm),
// sans GraphicsMagick ni pdf2pic.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TEMP DEBUG
console.log('[TEMP DEBUG] Module pdfIndexer.js chargé');

// ─── Vérification de Poppler au chargement du module ─────────────────────
const POPPLER_PATH = process.env.POPPLER_PATH;
let popplerAvailable = false;

if (POPPLER_PATH) {
  const pdftoppmPath = path.join(POPPLER_PATH, 'pdftoppm.exe');
  if (existsSync(pdftoppmPath)) {
    console.log(`[pdfIndexer] ✅ Poppler détecté : ${POPPLER_PATH}`);
    popplerAvailable = true;
  } else {
    console.error(`[pdfIndexer] ❌ Poppler introuvable : ${pdftoppmPath}`);
    console.error(`[pdfIndexer] L'OCR sur PDF scannés sera désactivé. Vérifiez POPPLER_PATH dans .env`);
  }
} else {
  console.warn(`[pdfIndexer] ⚠️ POPPLER_PATH non défini dans .env. L'OCR sur PDF scannés nécessite Poppler.`);
  console.warn(`[pdfIndexer] Définissez POPPLER_PATH=C:/Users/HP/Downloads/poppler-26.02.0/Library/bin dans .env`);
}

// Configuration par défaut (peut être surchargée via settings)
const PDF_STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage', 'pdfs');
const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

// ─── Configuration dynamique depuis settings ───────────────────────────────
function getConfig() {
  const s = getSettings();
  return {
    embeddingModel: s.ollama_embedding_model || process.env.OLLAMA_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    ollamaUrl: s.ollama_url || process.env.OLLAMA_URL || 'http://localhost:11434',
    chunkSize: Number(s.pdf_chunk_size || process.env.PDF_CHUNK_SIZE || DEFAULT_CHUNK_SIZE),
    chunkOverlap: Number(s.pdf_chunk_overlap || process.env.PDF_CHUNK_OVERLAP || DEFAULT_CHUNK_OVERLAP),
    ocrEnabled: s.pdf_ocr_enabled !== 'false' && process.env.PDF_OCR_ENABLED !== 'false',
  };
}

// ─── Mettre à jour le statut d'un document ─────────────────────────────────
async function updateDocumentStatus(documentId, status, errorMessage = null) {
  const validStatuses = ['pending', 'processing', 'indexed', 'error'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Statut invalide: ${status}`);
  }

  const sql = `UPDATE pdf_documents 
               SET status = $1::text, 
                   error_message = $2::text,
                   indexed_at = CASE WHEN $1::text = 'indexed' THEN NOW() ELSE indexed_at END,
                   page_count = $3::integer
               WHERE id = $4::integer
               RETURNING *`;
  
  const params = [status, errorMessage, null, documentId];
  
  // TEMP DEBUG - Diagnostic SQL
  console.log('========== SQL DEBUG ==========');
  console.log('Requête:', sql);
  console.log('Paramètres:', params);
  console.log('Types:', params.map(v => ({ value: v, type: typeof v })));
  console.log('===============================');
  
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// ─── Marquer le document comme scanné (OCR utilisé) ─────────────────────────
async function markDocumentAsScanned(documentId, extractedTextPath) {
  await pool.query(
    `UPDATE pdf_documents 
     SET is_scanned = TRUE, 
         extracted_text_path = $1
     WHERE id = $2`,
    [extractedTextPath, documentId]
  );
}

// ─── Extraire le texte d'un PDF ───────────────────────────────────────────
async function extractPdfText(filePath) {
  const startTime = Date.now();
  console.log(`[pdfIndexer] [extractPdfText] Début pour ${filePath}`);
  
  try {
    // Étape 1: Lecture du fichier
    const dataBuffer = await fs.readFile(filePath);
    
    // Étape 2: Extraction du texte avec pdf-parse v1.1.1 (API promesse)
    const data = await pdfParse(dataBuffer);
    
    // Retourner le texte et le nombre de pages
    return {
      text: data.text || '',
      pageCount: data.numpages || 0,
    };
    
  } catch (err) {
    console.error(`[pdfIndexer] Erreur extraction PDF ${filePath}:`, err.message);
    throw err;
  }
}

// ─── OCR Tesseract avec conversion PDF→images via Poppler (pour PDF scannés) ─────────────
async function performOCR(filePath) {
  // Import dynamique de Tesseract.js
  let Tesseract;
  try {
    Tesseract = (await import('tesseract.js')).default;
  } catch (importErr) {
    console.error('[pdfIndexer] tesseract.js non installé - OCR indisponible');
    throw new Error('OCR non disponible: tesseract.js non installé');
  }

  // Vérifier que Poppler est disponible (conversion PDF→images, sans GraphicsMagick)
  if (!popplerAvailable) {
    throw new Error('OCR sur PDF scanné impossible: Poppler non disponible. Vérifiez POPPLER_PATH dans .env');
  }

  // Importer child_process pour appeler pdftoppm (Poppler) directement
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    console.log(`[pdfIndexer] 🚀 Démarrage OCR pour ${filePath}`);
    console.log(`[pdfIndexer] Conversion PDF → images (Poppler pdftoppm) en cours...`);

    // Créer un dossier temporaire pour les images
    const tempDir = path.join(path.dirname(filePath), 'temp_ocr');
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Chemin complet vers pdftoppm fourni par Poppler (aucun GraphicsMagick requis)
      const pdftoppmPath = path.join(POPPLER_PATH, 'pdftoppm.exe');
      console.log(`[pdfIndexer] Utilisation de Poppler: ${pdftoppmPath}`);

      // Préfixe de sortie : pdftoppm génère <prefixe>-1.png, <prefixe>-2.png, ...
      const outputPrefix = path.join(tempDir, 'page');

      // Conversion de toutes les pages en PNG (300 DPI pour une meilleure qualité OCR)
      console.log(`[pdfIndexer] Conversion des pages PDF en images...`);
      await execFileAsync(
        pdftoppmPath,
        ['-png', '-r', '300', filePath, outputPrefix],
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
      );

      // Lister les images générées, triées pour respecter l'ordre des pages
      const files = (await fs.readdir(tempDir))
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .sort();

      const images = files.map((f) => path.join(tempDir, f));
      console.log(`[pdfIndexer] ${images.length} page(s) convertie(s) en images`);

      if (images.length === 0) {
        throw new Error('Aucune image générée par Poppler (pdftoppm)');
      }

      // OCR sur chaque image
      console.log(`[pdfIndexer] Démarrage de l'OCR sur ${images.length} page(s)...`);
      let fullText = '';
      
      for (let i = 0; i < images.length; i++) {
        const imagePath = images[i];
        console.log(`[pdfIndexer] OCR page ${i + 1}/${images.length} en cours...`);
        
        try {
          const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'fra', // Langue française
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  console.log(`[pdfIndexer] OCR page ${i + 1}: ${(m.progress * 100).toFixed(1)}%`);
                }
              }
            }
          );
          
          fullText += text + '\n\n';
          console.log(`[pdfIndexer] ✅ Page ${i + 1}/${images.length} terminée (${text.length} caractères)`);
        } catch (pageErr) {
          console.warn(`[pdfIndexer] ⚠️ Erreur OCR page ${i + 1}: ${pageErr.message}`);
        }
      }

      console.log(`[pdfIndexer] ✅ OCR terminé: ${fullText.length} caractères extraits au total`);

      // Sauvegarder le texte extrait pour cache
      const textPath = filePath.replace('.pdf', '.txt');
      await fs.writeFile(textPath, fullText);
      
      return {
        text: fullText.trim(),
        pageCount: images.length,
        extractedTextPath: path.relative(path.resolve(__dirname, '..', '..'), textPath),
      };

    } finally {
      // Nettoyer les images temporaires
      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        await fs.rmdir(tempDir);
        console.log(`[pdfIndexer] 🧹 Images temporaires nettoyées`);
      } catch (cleanupErr) {
        console.warn(`[pdfIndexer] ⚠️ Erreur nettoyage temporaire: ${cleanupErr.message}`);
      }
    }

  } catch (err) {
    console.error(`[pdfIndexer] ❌ Erreur OCR ${filePath}:`, err.message);
    throw new Error(`OCR échoué: ${err.message}`);
  }
}

// ─── Découper le texte en chunks ──────────────────────────────────────────
function createChunks(text, chunkSize, overlap) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Nettoyer le texte
  const cleanText = text
    .replace(/\s+/g, ' ')  // Normaliser les espaces
    .replace(/\n{3,}/g, '\n\n')  // Réduire les sauts de ligne multiples
    .trim();

  const chunks = [];
  const words = cleanText.split(' ');
  
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length === 0) break;
    
    const chunkText = chunkWords.join(' ');
    if (chunkText.trim().length > 0) {
      chunks.push({
        content: chunkText,
        index: chunks.length,
      });
    }
  }

  return chunks;
}

// ─── Générer l'embedding vectoriel via Ollama ───────────────────────────────
async function generateEmbedding(text) {
  const config = getConfig();
  
  try {
    const response = await ollama.embeddings({
      model: config.embeddingModel,
      prompt: text,
    }, { host: config.ollamaUrl });

    // L'embedding est un tableau de nombres
    if (!response.embedding || !Array.isArray(response.embedding)) {
      throw new Error('Embedding invalide reçu d\'Ollama');
    }

    return response.embedding;
  } catch (err) {
    console.error(`[pdfIndexer] Erreur embedding Ollama:`, err.message);
    throw err;
  }
}

// ─── Sauvegarder les chunks dans PostgreSQL ────────────────────────────────
async function saveChunks(documentId, chunks, documentCategory, documentTags) {
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.content);
    
    // Vérifier la dimension (nomic-embed-text = 768)
    if (embedding.length !== 768) {
      console.warn(`[pdfIndexer] Dimension embedding inattendue: ${embedding.length} (attendu: 768)`);
    }

    await pool.query(
      `INSERT INTO document_chunks 
         (document_id, chunk_index, content, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        documentId,
        chunk.index,
        chunk.content,
        `[${embedding.join(',')}]`,  // Format PostgreSQL vector
        {
          document_category: documentCategory,
          document_tags: documentTags,
        },
      ]
    );
  }
}

// ─── Fonction principale : indexer un document ─────────────────────────────
export async function indexDocument(documentId) {
  console.log(`[pdfIndexer] indexDocument() appelée pour documentId=${documentId}`);
  
  const config = getConfig();
  
  try {
    // 1. Récupérer le document
    console.log(`[pdfIndexer] Récupération du document #${documentId}...`);
    const { rows: docs } = await pool.query(
      'SELECT * FROM pdf_documents WHERE id = $1',
      [documentId]
    );

    if (!docs[0]) {
      console.log(`[pdfIndexer] Document #${documentId} introuvable`);
      return { success: false, message: `Document #${documentId} introuvable` };
    }

    const document = docs[0];
    console.log(`[pdfIndexer] Document #${documentId} trouvé, status=${document.status}`);
    
    // 2. Vérifier le statut
    if (document.status === 'indexed') {
      console.log(`[pdfIndexer] Document #${documentId} déjà indexé, skip`);
      return { success: true, message: 'Document déjà indexé', data: document };
    }

    // 3. Mettre à jour le statut en processing
    console.log(`[pdfIndexer] Mise à jour status → processing pour document #${documentId}...`);
    await updateDocumentStatus(documentId, 'processing');
    console.log(`[pdfIndexer] Status mis à jour → processing pour document #${documentId}`);

    // 4. Construire le chemin absolu du fichier
    const absolutePath = path.resolve(__dirname, '..', '..', document.file_path);
    console.log(`[pdfIndexer] Chemin du fichier: ${absolutePath}`);

    // 5. Extraire le texte du PDF
    console.log(`[pdfIndexer] Extraction du texte du PDF...`);
    let textResult;
    try {
      textResult = await extractPdfText(absolutePath);
      console.log(`[pdfIndexer] Extraction terminée: ${textResult.text.length} caractères, ${textResult.pageCount} pages`);
    } catch (extractErr) {
      console.error(`[pdfIndexer] Échec extraction PDF:`, extractErr.message);
      throw new Error(`Échec extraction PDF: ${extractErr.message}`);
    }

    // 6. Si texte vide, essayer l'OCR (si activé)
    if (!textResult.text || textResult.text.trim().length === 0) {
      if (config.ocrEnabled) {
        console.log(`[pdfIndexer] PDF scanné détecté (pas de texte natif)`);
        console.log(`[pdfIndexer] Démarrage de l'OCR avec conversion PDF → images...`);
        
        try {
          const ocrResult = await performOCR(absolutePath);
          textResult = {
            text: ocrResult.text,
            pageCount: ocrResult.pageCount,
          };
          
          // Marquer comme scanné
          await markDocumentAsScanned(documentId, ocrResult.extractedTextPath);
          console.log(`[pdfIndexer] ✅ OCR terminé: ${textResult.text.length} caractères extraits de ${textResult.pageCount} pages`);
        } catch (ocrErr) {
          console.error(`[pdfIndexer] ❌ OCR échoué: ${ocrErr.message}`);
          throw new Error(`Aucun texte extractible du PDF. L'OCR a échoué: ${ocrErr.message}`);
        }
      } else {
        throw new Error('Aucun texte extractible du PDF. Le PDF est scanné et l\'OCR est désactivé.');
      }
    }

    // 8. Mettre à jour le nombre de pages
    await pool.query(
      'UPDATE pdf_documents SET page_count = $1 WHERE id = $2',
      [textResult.pageCount, documentId]
    );

    // 9. Découper en chunks
    console.log(`[pdfIndexer] Découpage en chunks (taille=${config.chunkSize}, overlap=${config.chunkOverlap})...`);
    const chunks = createChunks(
      textResult.text,
      config.chunkSize,
      config.chunkOverlap
    );

    if (chunks.length === 0) {
      console.error(`[pdfIndexer] Aucun chunk créé`);
      throw new Error('Aucun chunk créé à partir du texte');
    }

    console.log(`[pdfIndexer] ${chunks.length} chunks créés pour le document #${documentId}`);

    // 10. Sauvegarder les chunks avec embeddings
    console.log(`[pdfIndexer] Génération des embeddings et sauvegarde des chunks...`);
    await saveChunks(
      documentId,
      chunks,
      document.category,
      document.tags
    );
    console.log(`[pdfIndexer] Chunks sauvegardés avec succès`);

    // 11. Marquer comme indexé
    console.log(`[pdfIndexer] Mise à jour status → indexed pour document #${documentId}...`);
    const updated = await updateDocumentStatus(documentId, 'indexed');
    console.log(`[pdfIndexer] ✅ Document #${documentId} indexé avec succès`);

    return {
      success: true,
      message: `Document indexé avec succès (${chunks.length} chunks)`,
      data: {
        document: updated,
        chunksCount: chunks.length,
      },
    };

  } catch (err) {
    // Mettre à jour le statut en erreur
    await updateDocumentStatus(documentId, 'error', err.message);
    
    return {
      success: false,
      message: `Erreur indexation: ${err.message}`,
      error: err.message,
    };
  }
}

// ─── Traiter tous les documents en attente ─────────────────────────────────
export async function processPendingDocuments() {
  try {
    // Récupérer les documents en statut 'pending'
    const { rows: pendingDocs } = await pool.query(
      `SELECT id FROM pdf_documents WHERE status = 'pending' ORDER BY created_at ASC`
    );

    console.log(`[pdfIndexer] ${pendingDocs.length} documents en attente d'indexation`);

    const results = [];
    for (const doc of pendingDocs) {
      const result = await indexDocument(doc.id);
      results.push({ id: doc.id, ...result });
    }

    return {
      success: true,
      message: `${results.length} documents traités`,
      data: results,
    };

  } catch (err) {
    console.error('[pdfIndexer] Erreur processPendingDocuments:', err.message);
    return {
      success: false,
      message: `Erreur: ${err.message}`,
      error: err.message,
    };
  }
}

// ─── Recherche dans les chunks (pour utilisation future par chatbotBrain) ─────
export async function searchDocumentChunks(query, limit = 5) {
  const config = getConfig();
  
  try {
    // Générer l'embedding de la requête
    const queryEmbedding = await generateEmbedding(query);

    // Recherche vectorielle avec pgvector
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const { rows } = await pool.query(
      `SELECT 
         dc.id,
         dc.document_id,
         dc.content,
         dc.metadata,
         pd.original_filename,
         pd.category,
         pd.tags,
         1 - (dc.embedding <=> $1::vector) as similarity
       FROM document_chunks dc
       JOIN pdf_documents pd ON pd.id = dc.document_id
       WHERE pd.status = 'indexed'
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, limit]
    );

    return {
      success: true,
      data: rows,
    };

  } catch (err) {
    console.error('[pdfIndexer] Erreur searchDocumentChunks:', err.message);
    return {
      success: false,
      message: `Erreur recherche: ${err.message}`,
      data: [],
    };
  }
}

// ─── Scheduler de secours pour les documents en attente ─────────────────────
let schedulerRunning = false;

/**
 * Exécute un passage du scheduler (avec protection anti-chevauchement)
 */
async function runSchedulerTick() {
  if (schedulerRunning) {
    console.log('[pdfIndexer] ⚠️ Scheduler d\'indexation déjà en cours — exécution ignorée');
    return;
  }

  schedulerRunning = true;
  const startTime = Date.now();
  console.log('[pdfIndexer] ▶️ Traitement des documents PDF en attente');

  try {
    const result = await processPendingDocuments();
    const durationMs = Date.now() - startTime;
    console.log(`[pdfIndexer] ✅ Scheduler terminé en ${durationMs}ms`);
    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[pdfIndexer] ❌ Scheduler échoué après ${durationMs}ms :`, err.message);
  } finally {
    schedulerRunning = false;
  }
}

/**
 * Démarre le scheduler de secours pour traiter les documents restés en 'pending'
 * Premier passage immédiat, puis toutes les 5 minutes
 */
export function startPdfIndexingScheduler() {
  console.log('[pdfIndexer] 🚀 Démarrage du scheduler d\'indexation PDF (toutes les 5 minutes)');

  // Premier passage immédiat au démarrage
  runSchedulerTick().catch((err) => {
    console.error('[pdfIndexer] Erreur lors du premier passage du scheduler :', err.message);
  });

  // Puis toutes les 5 minutes
  setInterval(() => {
    runSchedulerTick().catch((err) => {
      console.error('[pdfIndexer] Erreur lors du tick du scheduler :', err.message);
    });
  }, 5 * 60 * 1000);
}

// ─── Export par défaut ─────────────────────────────────────────────────────
export default {
  indexDocument,
  processPendingDocuments,
  searchDocumentChunks,
  startPdfIndexingScheduler,
};
