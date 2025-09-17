
// const pool = require('../config/db');
// const { v4: uuidv4 } = require('uuid');

// const FileChat = {
//   /**
//    * Save a new chat entry for a document.
//    * - Stores the prompt label instead of actual prompt if usedSecretPrompt is true.
//    * 
//    * @param {uuid} fileId 
//    * @param {uuid} userId 
//    * @param {string} question - actual question or prompt label
//    * @param {string} answer 
//    * @param {uuid|null} sessionId 
//    * @param {int[]} usedChunkIds 
//    * @param {boolean} usedSecretPrompt 
//    * @param {string|null} promptLabel 
//    * @returns {object} - { id, session_id }
//    */
//   async saveChat(
//     fileId,
//     userId,
//     question,
//     answer,
//     sessionId,
//     usedChunkIds = [],
//     usedSecretPrompt = false,
//     promptLabel = null
//   ) {
//     const currentSessionId = sessionId || uuidv4(); // If no session ID, generate one

//     const res = await pool.query(
//       `
//       INSERT INTO file_chats
//         (file_id, user_id, question, answer, session_id, used_chunk_ids, used_secret_prompt, prompt_label, created_at)
//       VALUES
//         ($1::uuid, $2, $3, $4, $5, $6::int[], $7, $8, NOW())
//       RETURNING id, session_id
//       `,
//       [
//         fileId,
//         userId,
//         question,
//         answer,
//         currentSessionId,
//         usedChunkIds,
//         usedSecretPrompt,
//         promptLabel
//       ]
//     );

//     return res.rows[0];
//   },

//   /**
//    * Fetch chat history for a given file (optionally filtered by session)
//    * @param {uuid} fileId 
//    * @param {uuid|null} sessionId 
//    * @returns {array} rows
//    */
//   async getChatHistory(fileId, sessionId = null) {
//     let query = `
//       SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
//              used_secret_prompt, prompt_label, created_at
//       FROM file_chats
//       WHERE file_id = $1::uuid
//     `;
//     const params = [fileId];

//     if (sessionId) {
//       query += ` AND session_id = $2`;
//       params.push(sessionId);
//     }

//     query += ` ORDER BY created_at ASC`;

//     const res = await pool.query(query, params);
//     return res.rows;
//   },

//   /**
//    * Fetch chat history for a specific user
//    * @param {uuid} userId 
//    * @returns {array} rows
//    */
//   async getChatHistoryByUserId(userId) {
//     const query = `
//       SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
//              used_secret_prompt, prompt_label, created_at
//       FROM file_chats
//       WHERE user_id = $1
//       ORDER BY created_at ASC
//     `;

//     const res = await pool.query(query, [userId]);
//     return res.rows;
//   }
// };

// module.exports = FileChat;


const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const FileChat = {
  /**
   * Save a new chat entry for a document.
   * - Stores the prompt label instead of actual prompt if usedSecretPrompt is true.
   *
   * @param {uuid} fileId
   * @param {uuid} userId
   * @param {string} question - actual question or prompt label
   * @param {string} answer
   * @param {uuid|null} sessionId
   * @param {int[]} usedChunkIds
   * @param {boolean} usedSecretPrompt
   * @param {string|null} promptLabel
   * @returns {object} - { id, session_id }
   */
  async saveChat(
    fileId,
    userId,
    question,
    answer,
    sessionId,
    usedChunkIds = [],
    usedSecretPrompt = false,
    promptLabel = null
  ) {
    // ✅ Ensure we always store a valid UUID
    const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

    const res = await pool.query(
      `
      INSERT INTO file_chats
        (file_id, user_id, question, answer, session_id, used_chunk_ids, used_secret_prompt, prompt_label, created_at)
      VALUES
        ($1::uuid, $2, $3, $4, $5::uuid, $6::int[], $7, $8, NOW())
      RETURNING id, session_id
      `,
      [
        fileId,
        userId,
        question,
        answer,
        currentSessionId,
        usedChunkIds,
        usedSecretPrompt,
        promptLabel,
      ]
    );

    return res.rows[0];
  },

  /**
   * Fetch chat history for a given file (optionally filtered by session)
   * @param {uuid} fileId
   * @param {uuid|null} sessionId
   * @returns {array} rows
   */
  async getChatHistory(fileId, sessionId = null) {
    let query = `
      SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
             used_secret_prompt, prompt_label, created_at
      FROM file_chats
      WHERE file_id = $1::uuid
    `;
    const params = [fileId];

    if (sessionId && isValidUUID(sessionId)) {
      query += ` AND session_id = $2::uuid`;
      params.push(sessionId);
    }

    query += ` ORDER BY created_at ASC`;

    const res = await pool.query(query, params);
    return res.rows;
  },

  /**
   * Fetch chat history for a specific user
   * @param {uuid} userId
   * @returns {array} rows
   */
  async getChatHistoryByUserId(userId) {
    const query = `
      SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
             used_secret_prompt, prompt_label, created_at
      FROM file_chats
      WHERE user_id = $1
      ORDER BY created_at ASC
    `;

    const res = await pool.query(query, [userId]);
    return res.rows;
  },
};

module.exports = FileChat;
