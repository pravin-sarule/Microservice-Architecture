


const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const MAX_HISTORY_LENGTH = 20;

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item) =>
        item &&
        typeof item.question === 'string' &&
        typeof item.answer === 'string'
    )
    .map((item) => ({
      id: item.id || null,
      question: item.question,
      answer: item.answer,
      created_at: item.created_at || null,
    }))
    .slice(-MAX_HISTORY_LENGTH);
}

const FileChat = {
  /**
   * Save a new chat entry for a document.
   * @param {string} fileId
   * @param {string} userId
   * @param {string} question
   * @param {string} answer
   * @param {string|null} sessionId
   * @param {number[]} usedChunkIds
   * @param {boolean} usedSecretPrompt
   * @param {string|null} promptLabel
   * @returns {object} { id, session_id }
   */
  async saveChat(
    fileId,
    userId,
    question,
    answer,
    sessionId = null,
    usedChunkIds = [],
    usedSecretPrompt = false,
    promptLabel = null,
    secretId = null, // Add secretId parameter
    chatHistory = []
  ) {
    // Ensure we always store a valid UUID
    const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

    // Ensure usedChunkIds is always an array of integers
    const chunkIdsArray = Array.isArray(usedChunkIds) ? usedChunkIds : [];

    const existingHistory = normalizeHistory(chatHistory);

    const res = await pool.query(
      `
      INSERT INTO file_chats
        (file_id, user_id, question, answer, session_id, used_chunk_ids, used_secret_prompt, prompt_label, secret_id, chat_history, created_at)
      VALUES
        ($1::uuid, $2, $3, $4, $5::uuid, $6::int[], $7, $8, $9::uuid, $10::jsonb, NOW())
      RETURNING id, session_id, created_at
      `,
      [
        fileId,
        userId,
        question,
        answer,
        currentSessionId,
        chunkIdsArray,
        usedSecretPrompt,
        promptLabel,
        secretId, // Pass secretId to the query
        JSON.stringify(existingHistory),
      ]
    );

    const insertedChat = res.rows[0];

    const updatedHistory = [...existingHistory, {
      id: insertedChat.id,
      question,
      answer,
      created_at: insertedChat.created_at,
    }].slice(-MAX_HISTORY_LENGTH);

    await pool.query(
      `UPDATE file_chats SET chat_history = $1::jsonb WHERE id = $2`,
      [JSON.stringify(updatedHistory), insertedChat.id]
    );

    return { ...insertedChat, chat_history: updatedHistory };
  },

  /**
   * Fetch chat history for a given file (optionally filtered by session)
   * @param {string} fileId
   * @param {string|null} sessionId
   * @returns {array} rows
   */
  async getChatHistory(fileId, sessionId = null) {
    let query = `
      SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
             used_secret_prompt, prompt_label, secret_id, chat_history, created_at
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
   * @param {string} userId
   * @returns {array} rows
   */
  async getChatHistoryByUserId(userId) {
    const query = `
      SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
             used_secret_prompt, prompt_label, secret_id, chat_history, created_at
      FROM file_chats
      WHERE user_id = $1
      ORDER BY created_at ASC
    `;

    const res = await pool.query(query, [userId]);
    return res.rows;
  },
};

module.exports = FileChat;
