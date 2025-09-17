const pool = require('../config/db');

const ChunkVector = {
  async saveChunkVector(chunkId, embedding, fileId) {
    // Convert the embedding array to a PostgreSQL array literal string
    const embeddingPgVector = `[${embedding.join(',')}]`; // Format as '[val1,val2,...]'
    const res = await pool.query(`
      INSERT INTO chunk_vectors (chunk_id, embedding, file_id)
      VALUES ($1, $2::vector, $3::uuid)
      RETURNING id
    `, [chunkId, embeddingPgVector, fileId]);
    return res.rows[0].id;
  },

  async saveMultipleChunkVectors(vectorsData) {
    if (!vectorsData || vectorsData.length === 0) {
      return [];
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    vectorsData.forEach(vector => {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}::vector, $${paramIndex + 2}::uuid)`);
      values.push(
        vector.chunk_id,
        `[${vector.embedding.join(',')}]`, // Format as '[val1,val2,...]'
        vector.file_id
      );
      paramIndex += 3;
    });

    const query = `
      INSERT INTO chunk_vectors (chunk_id, embedding, file_id)
      VALUES ${placeholders.join(', ')}
      RETURNING id, chunk_id;
    `;

    const res = await pool.query(query, values);
    return res.rows;
  },

  async getVectorsByChunkIds(chunkIds) {
    const res = await pool.query(`
      SELECT id, chunk_id, embedding FROM chunk_vectors
      WHERE chunk_id = ANY($1::int[])
    `, [chunkIds]);
    return res.rows;
  },

  async findNearestChunks(embedding, limit = 5, fileId = null) {
    let query = `
      SELECT
        cv.chunk_id,
        cv.embedding,
        fc.content,
        fc.file_id,
        (cv.embedding <=> $1::vector) AS distance
      FROM chunk_vectors cv
      JOIN file_chunks fc ON cv.chunk_id = fc.id
    `;
    const params = [`[${embedding.join(',')}]`, limit]; // Format as '[val1,val2,...]' and cast to vector

    if (fileId) {
      query += ` WHERE fc.file_id = $3::uuid`;
      params.push(fileId);
    }

    query += `
      ORDER BY distance ASC
      LIMIT $2
    `;

    const res = await pool.query(query, params);
    return res.rows;
  }
};

module.exports = ChunkVector;