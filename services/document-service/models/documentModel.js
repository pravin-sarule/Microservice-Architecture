const pool = require('../config/db');

const DocumentModel = {
  async saveFileMetadata(userId, originalname, gcs_path, folder_path, mimetype, size, status = 'uploaded') {
    const res = await pool.query(`
      INSERT INTO user_files (user_id, originalname, gcs_path, folder_path, mimetype, size, status, processing_progress)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00)
      RETURNING id
    `, [userId, originalname, gcs_path, folder_path, mimetype, size, status]);
    return res.rows[0].id;
  },

  async updateFileFullTextContent(fileId, fullTextContent) {
    await pool.query(`
      UPDATE user_files
      SET full_text_content = $1, updated_at = NOW()
      WHERE id = $2::uuid
    `, [fullTextContent, fileId]);
  },

  async updateFileStatus(fileId, status, progress = null) {
    let query = `UPDATE user_files SET status = $1, updated_at = NOW()`;
    const params = [status, fileId];
    if (progress !== null) {
      query += `, processing_progress = $2`;
      params.splice(1, 0, progress); // Insert progress at the second position
    }
    query += ` WHERE id = $${params.length}::uuid`;
    await pool.query(query, params);
  },

  async updateFileProcessedAt(fileId) {
    await pool.query(`
      UPDATE user_files
      SET processed_at = NOW(), status = 'processed', processing_progress = 100.00
      WHERE id = $1::uuid
    `, [fileId]);
  },

  async getFileById(fileId) {
    console.log(`[DocumentModel.getFileById] Attempting to retrieve file with ID: ${fileId}`);
    const res = await pool.query(`SELECT * FROM user_files WHERE id = $1::uuid`, [fileId]);
    if (res.rows[0]) {
      console.log(`[DocumentModel.getFileById] Found file with ID: ${fileId}, status: ${res.rows[0].status}`);
    } else {
      console.warn(`[DocumentModel.getFileById] No file found with ID: ${fileId}`);
    }
    return res.rows[0];
  },

  async updateFileSummary(fileId, summary) {
    await pool.query(`
      UPDATE user_files
      SET summary = $1, updated_at = NOW()
      WHERE id = $2::uuid
    `, [summary, fileId]);
  },

  async saveEditedVersions(documentId, docxUrl, pdfUrl) {
    await pool.query(`
      UPDATE user_files
      SET edited_docx_path = $1, edited_pdf_path = $2
      WHERE id = $3::uuid
    `, [docxUrl, pdfUrl, documentId]);
  },

  async countDocumentsByUserId(userId) {
    const res = await pool.query(`
      SELECT COUNT(*) FROM user_files
      WHERE user_id = $1 AND is_folder = FALSE
    `, [userId]);
    return parseInt(res.rows[0].count, 10);
  },

  async getFileChunks(fileId) {
    const res = await pool.query(`
      SELECT id, chunk_index, content, token_count FROM file_chunks
      WHERE file_id = $1
      ORDER BY chunk_index ASC
    `, [fileId]);
    return res.rows;
  },

  async getChunkVectors(chunkIds) {
    const res = await pool.query(`
      SELECT id, chunk_id, embedding FROM chunk_vectors
      WHERE chunk_id = ANY($1::int[])
    `, [chunkIds]);
    return res.rows;
  }, // Added comma
  async getFilesByUserIdAndFolderPath(userId, folderPath) {
    const res = await pool.query(`
      SELECT * FROM user_files
      WHERE user_id = $1 AND folder_path = $2
      ORDER BY created_at DESC
    `, [userId, folderPath]);
    return res.rows;
  },

  async getFilesByUserId(userId) {
    const res = await pool.query(`
      SELECT * FROM user_files
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    return res.rows;
  }
};
module.exports = DocumentModel;
