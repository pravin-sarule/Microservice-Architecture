// const pool = require('../config/db');
// const { v4: uuidv4 } = require('uuid');

// function isValidUUID(str) {
//   const uuidRegex =
//     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//   return uuidRegex.test(str);
// }

// const FolderChat = {
//   async saveFolderChat(
//     userId,
//     folderName,
//     question,
//     answer,
//     sessionId,
//     summarizedFileIds = []
//   ) {
//     const id = uuidv4();
//     const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

//     const res = await pool.query(
//       `
//       INSERT INTO folder_chats
//         (id, user_id, folder_name, question, answer, summarized_file_ids, session_id, created_at)
//       VALUES
//         ($1::uuid, $2, $3, $4, $5, $6::uuid[], $7::uuid, NOW())
//       RETURNING id, session_id
//       `,
//       [
//         id,
//         userId,
//         folderName,
//         question,
//         answer,
//         summarizedFileIds,
//         currentSessionId,
//       ]
//     );

//     return res.rows[0];
//   },

//   async getFolderChatHistory(userId, folderName, sessionId = null) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
//       FROM folder_chats
//       WHERE user_id = $1 AND folder_name = $2
//     `;
//     const params = [userId, folderName];

//     if (sessionId && isValidUUID(sessionId)) {
//       query += ` AND session_id = $3::uuid`;
//       params.push(sessionId);
//     }

//     query += ` ORDER BY created_at ASC`;

//     const res = await pool.query(query, params);
//     return res.rows;
//   },

//   async getFolderChatHistoryByUserId(userId) {
//     const query = `
//       SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
//       FROM folder_chats
//       WHERE user_id = $1
//       ORDER BY created_at ASC
//     `;

//     const res = await pool.query(query, [userId]);
//     return res.rows;
//   },

//   async findAll(options = {}) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
//       FROM folder_chats
//     `;
//     const params = [];
//     const whereClauses = [];
//     let paramIndex = 1;

//     if (options.where) {
//       if (options.where.user_id) {
//         whereClauses.push(`user_id = $${paramIndex++}`);
//         params.push(options.where.user_id);
//       }
//       if (options.where.folder_name) {
//         whereClauses.push(`folder_name = $${paramIndex++}`);
//         params.push(options.where.folder_name);
//       }
//       if (options.where.session_id) {
//         whereClauses.push(`session_id = $${paramIndex++}::uuid`);
//         params.push(options.where.session_id);
//       }
//     }

//     if (whereClauses.length > 0) {
//       query += ` WHERE ${whereClauses.join(' AND ')}`;
//     }

//     if (options.order && Array.isArray(options.order) && options.order.length > 0) {
//       const orderByClauses = options.order.map(o => {
//         const [field, direction] = o;
//         return `${field} ${direction.toUpperCase()}`;
//       });
//       query += ` ORDER BY ${orderByClauses.join(', ')}`;
//     } else {
//       query += ` ORDER BY created_at ASC`; // Default order
//     }

//     const res = await pool.query(query, params);
//     return res.rows;
//   },
// };



// module.exports = FolderChat;



// const pool = require('../config/db');
// const { v4: uuidv4 } = require('uuid');

// function isValidUUID(str) {
//   const uuidRegex =
//     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//   return uuidRegex.test(str);
// }

// const FolderChat = {
//   // Save a folder chat entry
//   async saveFolderChat(
//     userId,
//     folderName,
//     question,
//     answer,
//     sessionId = null,
//     summarizedFileIds = [],
//     usedChunkIds = [],
//     usedSecretPrompt = false,
//     promptLabel = null,
//     fileId = null,
//     chatHistory = []
//   ) {
//     const id = uuidv4();
//     const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

//     const res = await pool.query(
//       `
//       INSERT INTO folder_chats
//         (id, user_id, folder_name, question, answer, session_id, summarized_file_ids,
//          file_id, used_chunk_ids, used_secret_prompt, prompt_label, chat_history, created_at)
//       VALUES
//         ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::uuid[], $8::bigint, $9::uuid[], $10, $11, $12::jsonb, NOW())
//       RETURNING id, session_id
//       `,
//       [
//         id,
//         userId,
//         folderName,
//         question,
//         answer,
//         currentSessionId,
//         summarizedFileIds,
//         fileId,
//         usedChunkIds,
//         usedSecretPrompt,
//         promptLabel,
//         JSON.stringify(chatHistory),
//       ]
//     );

//     return res.rows[0];
//   },

//   // Get chat history for a user + folder (optionally session)
//   async getFolderChatHistory(userId, folderName, sessionId = null) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//       WHERE user_id = $1 AND folder_name = $2
//     `;
//     const params = [userId, folderName];

//     if (sessionId && isValidUUID(sessionId)) {
//       query += ` AND session_id = $3::uuid`;
//       params.push(sessionId);
//     }

//     query += ` ORDER BY created_at ASC`;

//     const res = await pool.query(query, params);
//     return res.rows;
//   },

//   // Get all folder chats for a user
//   async getFolderChatHistoryByUserId(userId) {
//     const query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//       WHERE user_id = $1
//       ORDER BY created_at ASC
//     `;
//     const res = await pool.query(query, [userId]);
//     return res.rows;
//   },

//   // Find all folder chats with optional filters
//   async findAll(options = {}) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//     `;
//     const params = [];
//     const whereClauses = [];
//     let paramIndex = 1;

//     if (options.where) {
//       if (options.where.user_id) {
//         whereClauses.push(`user_id = $${paramIndex++}`);
//         params.push(options.where.user_id);
//       }
//       if (options.where.folder_name) {
//         whereClauses.push(`folder_name = $${paramIndex++}`);
//         params.push(options.where.folder_name);
//       }
//       if (options.where.session_id) {
//         whereClauses.push(`session_id = $${paramIndex++}::uuid`);
//         params.push(options.where.session_id);
//       }
//     }

//     if (whereClauses.length > 0) {
//       query += ` WHERE ${whereClauses.join(' AND ')}`;
//     }

//     if (options.order && Array.isArray(options.order) && options.order.length > 0) {
//       const orderByClauses = options.order.map(o => {
//         const [field, direction] = o;
//         return `${field} ${direction.toUpperCase()}`;
//       });
//       query += ` ORDER BY ${orderByClauses.join(', ')}`;
//     } else {
//       query += ` ORDER BY created_at ASC`;
//     }

//     const res = await pool.query(query, params);
//     return res.rows;
//   },
// };

// module.exports = FolderChat;



// const pool = require('../config/db');
// const { v4: uuidv4 } = require('uuid');

// function isValidUUID(str) {
//   const uuidRegex =
//     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//   return uuidRegex.test(str);
// }

// const FolderChat = {
//   // Save a folder chat entry
//   async saveFolderChat(
//     userId,
//     folderName,
//     question,
//     answer,
//     sessionId = null,
//     summarizedFileIds = [],
//     usedChunkIds = [],
//     usedSecretPrompt = false,
//     promptLabel = null,
//     fileId = null,
//     chatHistory = []
//   ) {
//     const id = uuidv4();
//     const currentSessionId = isValidUUID(sessionId) ? sessionId : uuidv4();

//     const res = await pool.query(
//       `
//       INSERT INTO folder_chats
//         (id, user_id, folder_name, question, answer, session_id, summarized_file_ids,
//          file_id, used_chunk_ids, used_secret_prompt, prompt_label, chat_history, created_at)
//       VALUES
//         ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::uuid[], $8::bigint, $9::bigint[], $10, $11, $12::jsonb, NOW())
//       RETURNING id, session_id
//       `,
//       [
//         id,
//         userId,
//         folderName,
//         question,
//         answer,
//         currentSessionId,    // session_id -> uuid
//         summarizedFileIds,   // uuid[]
//         fileId,              // bigint
//         usedChunkIds,        // bigint[]
//         usedSecretPrompt,    // text
//         promptLabel,         // text
//         JSON.stringify(chatHistory), // jsonb
//       ]
//     );

//     return res.rows[0];
//   },

//   // Get chat history for a user + folder (optionally session)
//   async getFolderChatHistory(userId, folderName, sessionId = null) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//       WHERE user_id = $1 AND folder_name = $2
//     `;
//     const params = [userId, folderName];

//     if (sessionId && isValidUUID(sessionId)) {
//       query += ` AND session_id = $3::uuid`;
//       params.push(sessionId);
//     }

//     query += ` ORDER BY created_at ASC`;

//     const res = await pool.query(query, params);
//     return res.rows;
//   },

//   // Get all folder chats for a user
//   async getFolderChatHistoryByUserId(userId) {
//     const query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//       WHERE user_id = $1
//       ORDER BY created_at ASC
//     `;
//     const res = await pool.query(query, [userId]);
//     return res.rows;
//   },

//   // Find all folder chats with optional filters
//   async findAll(options = {}) {
//     let query = `
//       SELECT id, user_id, folder_name, question, answer, session_id,
//              summarized_file_ids, file_id, used_chunk_ids, used_secret_prompt,
//              prompt_label, chat_history, created_at
//       FROM folder_chats
//     `;
//     const params = [];
//     const whereClauses = [];
//     let paramIndex = 1;

//     if (options.where) {
//       if (options.where.user_id) {
//         whereClauses.push(`user_id = $${paramIndex++}`);
//         params.push(options.where.user_id);
//       }
//       if (options.where.folder_name) {
//         whereClauses.push(`folder_name = $${paramIndex++}`);
//         params.push(options.where.folder_name);
//       }
//       if (options.where.session_id) {
//         whereClauses.push(`session_id = $${paramIndex++}::uuid`);
//         params.push(options.where.session_id);
//       }
//     }

//     if (whereClauses.length > 0) {
//       query += ` WHERE ${whereClauses.join(' AND ')}`;
//     }

//     if (options.order && Array.isArray(options.order) && options.order.length > 0) {
//       const orderByClauses = options.order.map(o => {
//         const [field, direction] = o;
//         return `${field} ${direction.toUpperCase()}`;
//       });
//       query += ` ORDER BY ${orderByClauses.join(', ')}`;
//     } else {
//       query += ` ORDER BY created_at ASC`;
//     }

//     const res = await pool.query(query, params);
//     return res.rows;
//   },
// };

// module.exports = FolderChat;




const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const FolderChat = {
  // Save a folder chat entry
  async saveFolderChat(
    userId,
    folderName,
    question,
    answer,
    sessionId = null,
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

  async findAll(options = {}) {
    let query = `
      SELECT id, user_id, folder_name, question, answer, session_id, summarized_file_ids, created_at
      FROM folder_chats
    `;
    const params = [];
    const whereClauses = [];
    let paramIndex = 1;

    if (options.where) {
      if (options.where.user_id) {
        whereClauses.push(`user_id = $${paramIndex++}`);
        params.push(options.where.user_id);
      }
      if (options.where.folder_name) {
        whereClauses.push(`folder_name = $${paramIndex++}`);
        params.push(options.where.folder_name);
      }
      if (options.where.session_id) {
        whereClauses.push(`session_id = $${paramIndex++}::uuid`);
        params.push(options.where.session_id);
      }
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (options.order && Array.isArray(options.order) && options.order.length > 0) {
      const orderByClauses = options.order.map(o => {
        const [field, direction] = o;
        return `${field} ${direction.toUpperCase()}`;
      });
      query += ` ORDER BY ${orderByClauses.join(', ')}`;
    } else {
      query += ` ORDER BY created_at ASC`;
    }

    const res = await pool.query(query, params);
    return res.rows;
  },
};

module.exports = FolderChat;