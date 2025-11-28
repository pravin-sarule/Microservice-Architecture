/**
 * Content Processor
 * Extracts and processes document content from Document Service responses
 */

class ContentProcessor {
  /**
   * Extract document content from Document Service response
   * Combines all chunks and chat history into a single text
   * 
   * @param {Object} documentData - Complete document data from Document Service
   * @returns {string} Combined document content
   */
  static extractDocumentContent(documentData) {
    if (!documentData || !documentData.success) {
      return '';
    }
    
    let content = '';
    
    // Add file metadata
    const file = documentData.file || {};
    if (file.originalname) {
      content += `Document: ${file.originalname}\n\n`;
    }
    
    // Add document chunks
    const chunks = documentData.chunks || [];
    if (chunks.length > 0) {
      content += 'Document Content:\n';
      content += '='.repeat(50) + '\n';
      chunks.forEach((chunk, index) => {
        if (chunk.content) {
          content += `\n[Chunk ${index + 1}]\n`;
          content += chunk.content.trim();
          content += '\n';
        }
      });
      content += '='.repeat(50) + '\n\n';
    }
    
    // Add chat history (optional, can include context)
    const chats = documentData.chats || [];
    if (chats.length > 0) {
      content += '\nRelevant Chat History:\n';
      content += '-'.repeat(50) + '\n';
      chats.slice(-5).forEach((chat) => { // Last 5 chats
        if (chat.question) {
          content += `Q: ${chat.question}\n`;
        }
        if (chat.answer) {
          content += `A: ${chat.answer.substring(0, 500)}...\n`; // Truncate long answers
        }
        content += '\n';
      });
      content += '-'.repeat(50) + '\n';
    }
    
    return content.trim();
  }
  
  /**
   * Combine content from multiple documents
   * 
   * @param {Array} documents - Array of document data objects
   * @returns {string} Combined content from all documents
   */
  static combineMultipleDocuments(documents) {
    if (!documents || documents.length === 0) {
      return '';
    }
    
    let combinedContent = `Multiple Documents (${documents.length} total)\n\n`;
    combinedContent += '='.repeat(60) + '\n\n';
    
    documents.forEach((doc, index) => {
      const file = doc.file || {};
      combinedContent += `\n[Document ${index + 1}: ${file.originalname || 'Unknown'}]\n`;
      combinedContent += '-'.repeat(60) + '\n';
      combinedContent += ContentProcessor.extractDocumentContent(doc);
      combinedContent += '\n\n';
    });
    
    return combinedContent.trim();
  }
  
  /**
   * Extract key information for infographic generation
   * Summarizes the document to focus on main points
   * 
   * @param {Object} documentData - Complete document data
   * @returns {string} Summarized key information
   */
  static extractKeyInformation(documentData) {
    const content = ContentProcessor.extractDocumentContent(documentData);
    
    // Extract first few paragraphs and headings
    const lines = content.split('\n');
    const keyLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Include headings, important markers, and first paragraphs
      if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('Document:') ||
        trimmed.startsWith('[') ||
        trimmed.length > 100 // Include substantial paragraphs
      ) {
        keyLines.push(trimmed);
        if (keyLines.length > 50) break; // Limit to first 50 important lines
      }
    }
    
    return keyLines.join('\n');
  }
}

module.exports = ContentProcessor;



