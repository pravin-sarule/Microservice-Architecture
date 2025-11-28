const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function isValidUUID(str) {
  if (!str) return false;
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
   * Save a new chat entry (with or without a document).
   * @param {string|null} fileId - Can be null for pre-upload conversations
   * @param {string} userId
   * @param {string} question
   * @param {string} answer
   * @param {string|null} sessionId
   * @param {number[]} usedChunkIds
   * @param {boolean} usedSecretPrompt
   * @param {string|null} promptLabel
   * @param {string|null} secretId
   * @param {array} chatHistory
   * @returns {object} { id, session_id, created_at, chat_history }
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
    secretId = null,
    chatHistory = []
  ) {
    try {
      // Generate or validate session ID
      const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();
      
      // Validate and normalize file_id (can be null for pre-upload chats)
      const normalizedFileId = fileId && isValidUUID(fileId) ? fileId : null;
      
      // Validate and normalize secret_id (can be null)
      const normalizedSecretId = secretId && isValidUUID(secretId) ? secretId : null;

      // Ensure usedChunkIds is always an array of integers
      const chunkIdsArray = Array.isArray(usedChunkIds) 
        ? usedChunkIds.filter(id => Number.isInteger(id)) 
        : [];

      // Normalize existing history
      const existingHistory = normalizeHistory(chatHistory);

      // Insert the new chat
      const res = await pool.query(
        `
        INSERT INTO file_chats
          (file_id, user_id, question, answer, session_id, used_chunk_ids, 
           used_secret_prompt, prompt_label, secret_id, chat_history, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id, session_id, created_at
        `,
        [
          normalizedFileId,
          userId,
          question,
          answer,
          currentSessionId,
          chunkIdsArray,
          usedSecretPrompt,
          promptLabel,
          normalizedSecretId,
          JSON.stringify(existingHistory),
        ]
      );

      const insertedChat = res.rows[0];

      // Update chat_history to include the newly inserted chat
      const updatedHistory = [
        ...existingHistory,
        {
          id: insertedChat.id,
          question,
          answer,
          created_at: insertedChat.created_at,
        },
      ].slice(-MAX_HISTORY_LENGTH);

      await pool.query(
        `UPDATE file_chats SET chat_history = $1 WHERE id = $2`,
        [JSON.stringify(updatedHistory), insertedChat.id]
      );

      console.log(
        `✅ [FileChat] Saved chat ID: ${insertedChat.id} | Session: ${currentSessionId} | File: ${normalizedFileId || 'none (pre-upload)'}`
      );

      return { 
        ...insertedChat, 
        chat_history: updatedHistory,
        file_id: normalizedFileId 
      };
    } catch (error) {
      console.error('❌ [FileChat.saveChat] Error:', error);
      throw new Error(`Failed to save chat: ${error.message}`);
    }
  },

  /**
   * Fetch chat history for a given file (optionally filtered by session).
   * @param {string} fileId
   * @param {string|null} sessionId
   * @returns {array} rows
   */
  async getChatHistory(fileId, sessionId = null) {
    try {
      if (!fileId || !isValidUUID(fileId)) {
        console.warn('⚠️ [FileChat.getChatHistory] Invalid fileId provided');
        return [];
      }

      let query = `
        SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
               used_secret_prompt, prompt_label, secret_id, chat_history, created_at
        FROM file_chats
        WHERE file_id = $1
      `;
      const params = [fileId];

      if (sessionId && isValidUUID(sessionId)) {
        query += ` AND session_id = $2`;
        params.push(sessionId);
      }

      query += ` ORDER BY created_at ASC`;

      const res = await pool.query(query, params);
      
      console.log(
        `✅ [FileChat.getChatHistory] Retrieved ${res.rows.length} chat(s) for file: ${fileId}${sessionId ? ` in session: ${sessionId}` : ''}`
      );
      
      return res.rows;
    } catch (error) {
      console.error('❌ [FileChat.getChatHistory] Error:', error);
      throw new Error(`Failed to get chat history: ${error.message}`);
    }
  },

  /**
   * Fetch full chat history for a session, regardless of file association.
   * This includes pre-upload chats (where file_id is NULL).
   * @param {string} userId
   * @param {string} sessionId
   * @returns {array} rows
   */
  async getChatHistoryBySession(userId, sessionId) {
    try {
      if (!userId) {
        console.warn('⚠️ [FileChat.getChatHistoryBySession] Missing userId');
        return [];
      }

      if (!sessionId || !isValidUUID(sessionId)) {
        console.warn('⚠️ [FileChat.getChatHistoryBySession] Invalid sessionId');
        return [];
      }

      const res = await pool.query(
        `
          SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
                 used_secret_prompt, prompt_label, secret_id, chat_history, created_at
          FROM file_chats
          WHERE user_id = $1 AND session_id = $2
          ORDER BY created_at ASC
        `,
        [userId, sessionId]
      );

      console.log(
        `✅ [FileChat.getChatHistoryBySession] Retrieved ${res.rows.length} chat(s) for session: ${sessionId}`
      );

      return res.rows;
    } catch (error) {
      console.error('❌ [FileChat.getChatHistoryBySession] Error:', error);
      throw new Error(`Failed to get chat history by session: ${error.message}`);
    }
  },

  /**
   * Fetch all chat history for a specific user.
   * @param {string} userId
   * @returns {array} rows
   */
  async getChatHistoryByUserId(userId) {
    try {
      if (!userId) {
        console.warn('⚠️ [FileChat.getChatHistoryByUserId] Missing userId');
        return [];
      }

      const query = `
        SELECT id, file_id, user_id, question, answer, session_id, used_chunk_ids,
               used_secret_prompt, prompt_label, secret_id, chat_history, created_at
        FROM file_chats
        WHERE user_id = $1
        ORDER BY created_at ASC
      `;

      const res = await pool.query(query, [userId]);
      
      console.log(
        `✅ [FileChat.getChatHistoryByUserId] Retrieved ${res.rows.length} chat(s) for user: ${userId}`
      );
      
      return res.rows;
    } catch (error) {
      console.error('❌ [FileChat.getChatHistoryByUserId] Error:', error);
      throw new Error(`Failed to get user chat history: ${error.message}`);
    }
  },
};

module.exports = FileChat;

