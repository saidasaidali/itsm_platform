// backend/src/services/knowledgeProviders/pdfProvider.js
// Provider for indexed PDF documents (vector search via pgvector)
import pdfIndexer from '../pdfIndexer.js';

export const pdfProvider = {
  name: 'internal_document',

  /**
   * Recherche vectorielle dans les chunks de documents PDF indexés
   * @param {string} query - Requête utilisateur
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>} Résultats formatés
   */
  async search(query, limit = 5) {
    const result = await pdfIndexer.searchDocumentChunks(query, limit);
    
    if (!result.success || !result.data || result.data.length === 0) {
      return [];
    }

    return result.data.map(chunk => ({
      content: chunk.content || '',
      score: parseFloat(chunk.similarity) || 0,
      source_type: 'internal_document',
      source_id: chunk.document_id,
      title: chunk.original_filename || 'Document interne',
      metadata: {
        chunk_index: chunk.chunk_index,
        category: chunk.category,
        tags: chunk.tags,
      },
    }));
  },

  clearCache() {
    // pdfIndexer n'a pas de cache à vider
  },
};

export default pdfProvider;