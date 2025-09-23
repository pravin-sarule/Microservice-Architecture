const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const FolderChat = {
  async saveFolderChat(
    userId,
    folderName,
    question,
    answer,
    sessionId,
    summarizedFileIds = []
  ) {
    const id = uuidv4();
    const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

    const res = await pool.query(
      `
      INSERT INTO folder_chats
        (id, user_id, folder_name, question, answer, summarized_file_ids, session_id, created_at)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6::uuid[], $7::uuid, NOW())
      RETURNING id, session_id
      `,
      [
        id,
        userId,
        folderName,
        question,
        answer,
        summarizedFileIds,
        currentSessionId,
      ]
    );

    return res.rows[0];
  },

  async getFolderChatHistory(userId, folderName, sessionId = null) {
    let query = `
      SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
      FROM folder_chats
      WHERE user_id = $1 AND folder_name = $2
    `;
    const params = [userId, folderName];

    if (sessionId && isValidUUID(sessionId)) {
      query += ` AND session_id = $3::uuid`;
      params.push(sessionId);
    }

    query += ` ORDER BY created_at ASC`;

    const res = await pool.query(query, params);
    return res.rows;
  },

  async getFolderChatHistoryByUserId(userId) {
    const query = `
      SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
      FROM folder_chats
      WHERE user_id = $1
      ORDER BY created_at ASC
    `;

    const res = await pool.query(query, [userId]);
    return res.rows;
  },
};

module.exports = FolderChat;