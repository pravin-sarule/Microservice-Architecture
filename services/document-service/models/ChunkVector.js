

const pool = require('../config/db');

const ChunkVector = {
  async saveChunkVector(chunkId, embedding, fileId) {
    const embeddingPgVector = `[${embedding.join(',')}]`;
    const res = await pool.query(`
      INSERT INTO chunk_vectors (chunk_id, embedding, file_id)
      VALUES ($1, $2::vector, $3::uuid)
      ON CONFLICT (chunk_id) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            updated_at = NOW()
      RETURNING id, chunk_id
    `, [chunkId, embeddingPgVector, fileId]);
    return res.rows[0].id;
  },

  async saveMultipleChunkVectors(vectorsData) {
    if (!vectorsData || vectorsData.length === 0) return [];

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    vectorsData.forEach(vector => {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}::vector, $${paramIndex + 2}::uuid)`);
      values.push(
        vector.chunk_id,
        `[${vector.embedding.join(',')}]`,
        vector.file_id
      );
      paramIndex += 3;
    });

    const query = `
      INSERT INTO chunk_vectors (chunk_id, embedding, file_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (chunk_id) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            updated_at = NOW()
      RETURNING id, chunk_id;
    `;

    const res = await pool.query(query, values);
    return res.rows;
  },

  async getExistingChunkIds(chunkIds) {
    const ids = Array.isArray(chunkIds) ? chunkIds : [chunkIds];
    const { rows } = await pool.query(
      `
        SELECT chunk_id
        FROM chunk_vectors
        WHERE chunk_id = ANY($1::int[])
      `,
      [ids]
    );
    return rows.map((row) => row.chunk_id);
  },

  async getVectorsByChunkIds(chunkIds) {
    if (!Array.isArray(chunkIds)) chunkIds = [chunkIds]; // Ensure array
    const res = await pool.query(`
      SELECT id, chunk_id, embedding
      FROM chunk_vectors
      WHERE chunk_id = ANY($1::int[])
    `, [chunkIds]);
    return res.rows;
  },

  async findNearestChunks(embedding, limit = 5, fileIds = null) {
    const embeddingPgVector = `[${embedding.join(',')}]`;
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

    const params = [embeddingPgVector, limit]; // $1 = embedding, $2 = limit

    if (fileIds && fileIds.length > 0) {
      if (!Array.isArray(fileIds)) fileIds = [fileIds];
      query += ` WHERE fc.file_id = ANY($3::uuid[])`;
      params.push(fileIds); // $3 = fileIds array
    }

    query += `
      ORDER BY distance ASC
      LIMIT $2
    `;

    const res = await pool.query(query, params);
    return res.rows;
  },

  async findNearestChunksAcrossFiles(embedding, limit = 5, fileIds = null) {
    return this.findNearestChunks(embedding, limit, fileIds);
  }
};

module.exports = ChunkVector;
