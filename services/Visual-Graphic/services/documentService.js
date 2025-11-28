/**
 * Document Service Integration
 * Handles communication with the Document Service API to fetch document data
 */
const axios = require('axios');

// Get document service URL from environment
const DOCUMENT_SERVICE_URL = process.env.DOCUMENT_SERVICE_URL || 'http://localhost:8080';

class DocumentService {
  /**
   * Fetch complete file data from Document Service
   * 
   * This method retrieves:
   * - File metadata (name, size, status, etc.)
   * - All document chunks (text segments)
   * - Chat history associated with the file
   * - Folder chat history (if file is in a folder)
   * - Processing job status
   * 
   * @param {string} fileId - UUID of the file to fetch
   * @param {string} authToken - JWT token for authentication (format: "Bearer <token>")
   * @returns {Promise<Object>} Complete file data
   * @throws {Error} If file not found or access denied
   */
  static async getFileComplete(fileId, authToken) {
    try {
      console.log(`[DocumentService] Fetching file ${fileId} from ${DOCUMENT_SERVICE_URL}`);
      
      const response = await axios.get(
        `${DOCUMENT_SERVICE_URL}/api/files/file/${fileId}/complete`,
        {
          headers: {
            'Authorization': authToken,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      console.log(`[DocumentService] Response status: ${response.status}`);
      
      if (response.status === 200 && response.data.success) {
        console.log(`[DocumentService] Successfully fetched document data`);
        return response.data;
      } else {
        throw new Error('Document not found or access denied');
      }
      
    } catch (error) {
      if (error.response) {
        // Handle HTTP error responses
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          const errorMsg = errorData?.error || 'Document not found';
          console.log(`[DocumentService] 404 Error: ${errorMsg}`);
          throw new Error(`Document not found: ${errorMsg}`);
        }
        
        if (status === 403) {
          const errorMsg = errorData?.error || 'Access denied';
          console.log(`[DocumentService] 403 Error: ${errorMsg}`);
          throw new Error(`Access denied to document: ${errorMsg}`);
        }
        
        console.log(`[DocumentService] ${status} Error: ${errorData?.error || error.message}`);
        throw new Error(`Failed to fetch document (Status ${status}): ${errorData?.error || error.message}`);
      } else if (error.code === 'ECONNREFUSED') {
        const errorMsg = `Failed to connect to document service at ${DOCUMENT_SERVICE_URL}`;
        console.log(`[DocumentService] Connection Error: ${errorMsg}`);
        throw new Error(errorMsg);
      } else if (error.code === 'ETIMEDOUT') {
        const errorMsg = 'Request to document service timed out';
        console.log(`[DocumentService] Timeout: ${errorMsg}`);
        throw new Error(errorMsg);
      } else {
        console.log(`[DocumentService] Request Exception: ${error.message}`);
        throw new Error(`Error fetching document: ${error.message}`);
      }
    }
  }
  
  /**
   * Fetch complete data for multiple files from Document Service
   * 
   * @param {string[]} fileIds - List of file UUIDs to fetch
   * @param {string} authToken - JWT token for authentication
   * @returns {Promise<Array>} List of successfully fetched document data
   */
  static async getMultipleFilesComplete(fileIds, authToken) {
    const validDocuments = [];
    
    // Fetch each document (can be parallelized with Promise.all if needed)
    for (const fileId of fileIds) {
      try {
        const documentData = await DocumentService.getFileComplete(fileId, authToken);
        if (documentData && documentData.success) {
          validDocuments.push(documentData);
        }
      } catch (error) {
        // Log error but continue with other documents
        console.error(`❌ Error fetching document ${fileId}: ${error.message}`);
        continue;
      }
    }
    
    return validDocuments;
  }
}

module.exports = DocumentService;



