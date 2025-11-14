

//
const db = require('../config/db');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { askLLM, getAvailableProviders, resolveProviderName } = require('../services/aiService');
const { askLLM: askFolderLLM } = require('../services/folderAiService'); // Import askLLM from folderAiService
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File'); // Import File model
const FolderChat = require('../models/FolderChat'); // Import FolderChat model

const MAX_STORED_HISTORY = 20;

function simplifyFolderChatHistory(chats = []) {
  if (!Array.isArray(chats)) return [];
  return chats
    .map((chat) => ({
      id: chat.id,
      question: chat.question,
      answer: chat.answer,
      created_at: chat.created_at,
    }))
    .filter((entry) => typeof entry.question === 'string' && typeof entry.answer === 'string')
    .slice(-MAX_STORED_HISTORY);
}

let secretClient;

// 🔐 Setup Google Secret Manager Client
function setupGCPClientFromBase64() {
  const base64Key = process.env.GCS_KEY_BASE64;
  if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

  const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
  const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
  fs.writeFileSync(tempFilePath, keyJson);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

  secretClient = new SecretManagerServiceClient();
}

if (!secretClient) {
  setupGCPClientFromBase64();
}

const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
if (!GCLOUD_PROJECT_ID) throw new Error('❌ GCLOUD_PROJECT_ID not set in env');

/**
 * 🧩 Fetch a single secret with its LLM model name
 * @route GET /api/secrets/:id
 */
const fetchSecretValueFromGCP = async (req, res) => {
  const { id } = req.params;

  try {
    console.log('📦 Fetching secret config from DB for ID:', id);

    const query = `
      SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name, cm.method_name AS chunking_method
      FROM secret_manager s
      LEFT JOIN chunking_methods cm ON s.chunking_method_id = cm.id
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;

    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '❌ Secret config not found in DB' });
    }

    const { secret_manager_id, version, llm_id, llm_name, chunking_method } = result.rows[0];
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
    console.log('🔐 Fetching from GCP Secret Manager:', secretName);

    const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
    const secretValue = accessResponse.payload.data.toString('utf8');

    res.status(200).json({
      secretManagerId: secret_manager_id,
      version,
      llm_id,
      llm_name,
      chunking_method, // Include chunking_method
      value: secretValue,
    });
  } catch (err) {
    console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

/**
 * 🧩 Create secret with optional LLM and chunking method mapping
 * @route POST /api/secrets/create
 */
const createSecretInGCP = async (req, res) => {
  const {
    name,
    description,
    secret_manager_id,
    secret_value,
    llm_id,
    chunking_method, // NEW: Add chunking_method
    version = '1',
    created_by = 1,
    template_type = 'system',
    status = 'active',
    usage_count = 0,
    success_rate = 0,
    avg_processing_time = 0,
    template_metadata = {},
  } = req.body;

  try {
    const parent = `projects/${GCLOUD_PROJECT_ID}`;
    const secretName = `${parent}/secrets/${secret_manager_id}`;

    // 🔍 Check if secret exists
    const [secrets] = await secretClient.listSecrets({ parent });
    const exists = secrets.find((s) => s.name === secretName);

    if (!exists) {
      console.log(`🆕 Creating new secret: ${secret_manager_id}`);
      await secretClient.createSecret({
        parent,
        secretId: secret_manager_id,
        secret: { replication: { automatic: {} } },
      });
    } else {
      console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
    }

    // ➕ Add secret version
    const [versionResponse] = await secretClient.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(secret_value, 'utf8') },
    });
    const versionId = versionResponse.name.split('/').pop();

    // 💾 Insert into DB (with llm_id)
    const insertQuery = `
      INSERT INTO secret_manager (
        id, name, description, template_type, status,
        usage_count, success_rate, avg_processing_time,
        created_by, updated_by, created_at, updated_at,
        activated_at, last_used_at, template_metadata,
        secret_manager_id, version, llm_id, chunking_method
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $8, now(), now(),
        now(), NULL, $9::jsonb,
        $10, $11, $12, $13
      )
      RETURNING *;
    `;

    const result = await db.query(insertQuery, [
      name,
      description,
      template_type,
      status,
      usage_count,
      success_rate,
      avg_processing_time,
      created_by,
      JSON.stringify(template_metadata),
      secret_manager_id,
      versionId,
      llm_id || null,
      chunking_method || null, // NEW: Add chunking_method
    ]);

    res.status(201).json({
      message: '✅ Secret created and version added to GCP',
      gcpSecret: secret_manager_id,
      gcpVersion: versionId,
      dbRecord: result.rows[0],
    });
  } catch (error) {
    console.error('🚨 Error creating secret in GCP:', error.message);
    res.status(500).json({ error: 'Failed to create secret: ' + error.message });
  }
};

/**
 * 🧩 Get all secrets with their LLM names
 * @route GET /api/secrets
 */
const getAllSecrets = async (req, res) => {
  const includeValues = req.query.fetch === 'true';

  try {
    const query = `
      SELECT 
        s.*, 
        l.name AS llm_name
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      ORDER BY s.created_at DESC
    `;

    const result = await db.query(query);
    const rows = result.rows;

    if (!includeValues) {
      return res.status(200).json(rows);
    }

    const enriched = await Promise.all(
      rows.map(async (row) => {
        try {
          const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
          const [accessResponse] = await secretClient.accessSecretVersion({ name });
          const value = accessResponse.payload.data.toString('utf8');
          return { ...row, value };
        } catch (err) {
          return { ...row, value: '[ERROR: Cannot fetch]' };
        }
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error('🚨 Error fetching secrets:', error.message);
    res.status(500).json({ error: 'Failed to fetch secrets: ' + error.message });
  }
};



// -----------------------------------------------------------
const triggerSecretLLM = async (req, res) => {
  const { secretId, fileId, additionalInput = "", sessionId, llm_name: requestLlmName } = req.body;

  console.log(`[triggerSecretLLM] Request body:`, {
    secretId,
    fileId,
    sessionId,
    llm_name: requestLlmName,
    additionalInput: additionalInput ? additionalInput.substring(0, 50) + '...' : '(empty)',
  });

  // -------------------------------
  // 1️⃣ Input Validation
  // -------------------------------
  if (!secretId) return res.status(400).json({ error: '❌ secretId is required.' });
  if (!fileId) return res.status(400).json({ error: '❌ fileId is required.' });

  const userId = req.user?.id || req.userId;
  if (!userId) return res.status(401).json({ error: '❌ User authentication required.' });

  const finalSessionId = sessionId || uuidv4();

  try {
    console.log(`[triggerSecretLLM] Starting process for secretId: ${secretId}, fileId: ${fileId}`);

    // -------------------------------
    // 2️⃣ Fetch secret configuration from DB
    // -------------------------------
    const query = `
      SELECT
        s.id,
        s.name,
        s.secret_manager_id,
        s.version,
        s.llm_id,
        l.name AS llm_name,
        cm.method_name AS chunking_method
      FROM secret_manager s
      LEFT JOIN chunking_methods cm ON s.chunking_method_id = cm.id
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;
    const result = await db.query(query, [secretId]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: '❌ Secret configuration not found in DB.' });

    const {
      name: secretName,
      secret_manager_id,
      version,
      llm_name: dbLlmName,
      chunking_method: dbChunkingMethod,
    } = result.rows[0];

    console.log(
      `[triggerSecretLLM] Found secret: ${secretName}, LLM from DB: ${dbLlmName || 'none'}, Chunking Method from DB: ${dbChunkingMethod || 'none'}`
    );

    // -------------------------------
    // 3️⃣ Resolve provider name dynamically
    // -------------------------------
    let provider = resolveProviderName(requestLlmName || dbLlmName);
    console.log(`[triggerSecretLLM] Resolved LLM provider: ${provider}`);
    const availableProviders = getAvailableProviders();
    if (!availableProviders[provider] || !availableProviders[provider].available) {
      console.warn(`[triggerSecretLLM] Provider '${provider}' unavailable — falling back to gemini`);
      provider = 'gemini';
    }

    // -------------------------------
    // 4️⃣ Fetch secret value from GCP Secret Manager
    // -------------------------------
    const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
    console.log(`[triggerSecretLLM] Fetching secret from GCP: ${gcpSecretName}`);

    const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
    const secretValue = accessResponse.payload.data.toString('utf8');
    if (!secretValue?.trim()) return res.status(500).json({ error: '❌ Secret value is empty in GCP.' });

    console.log(`[triggerSecretLLM] Secret value length: ${secretValue.length} characters`);

    // -------------------------------
    // 5️⃣ Fetch document content from DB
    // -------------------------------
    const FileChunkModel = require('../models/FileChunk');
    const allChunks = await FileChunkModel.getChunksByFileId(fileId);
    if (!allChunks?.length)
      return res.status(404).json({ error: '❌ No document content found for this file.' });

    const documentContent = allChunks.map((c) => c.content).join('\n\n');
    console.log(`[triggerSecretLLM] Document content length: ${documentContent.length} characters`);

    // -------------------------------
    // 6️⃣ Construct final prompt
    // -------------------------------
    let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
    finalPrompt += `${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;
    if (additionalInput?.trim().length > 0)
      finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additionalInput.trim()}`;

    console.log(`[triggerSecretLLM] Final prompt length: ${finalPrompt.length}`);

    // -------------------------------
    // 7️⃣ Trigger the LLM
    // -------------------------------
    console.log(`[triggerSecretLLM] Calling askLLM with provider: ${provider}...`);
    const llmResponse = await askLLM(provider, finalPrompt, '');
    if (!llmResponse?.trim()) throw new Error(`Empty response received from ${provider}`);
    console.log(`[triggerSecretLLM] ✅ LLM response received (${llmResponse.length} characters)`);

    // -------------------------------
    // 8️⃣ ✅ Link secret_id to the processing job
    // -------------------------------
    try {
      const linkedJob = await ProcessingJobModel.linkSecretToJob(fileId, secretId);
      if (linkedJob) {
        console.log(`[triggerSecretLLM] ✅ Linked secret ${secretId} to processing job for file ${fileId}`);
      } else {
        console.warn(`[triggerSecretLLM] ⚠️ No existing processing job found to link for file ${fileId}`);
      }
    } catch (linkErr) {
      console.error(`[triggerSecretLLM] ⚠️ Failed to link secret_id to job: ${linkErr.message}`);
    }

    // -------------------------------
    // 9️⃣ Store chat record in file_chats
    // -------------------------------
    console.log(`[triggerSecretLLM] Storing chat in database...`);
    const chunkIds = allChunks.map((c) => c.id);

    const insertChatQuery = `
      INSERT INTO file_chats (
        file_id,
        session_id,
        user_id,
        question,
        answer,
        used_secret_prompt,
        prompt_label,
        secret_id,
        used_chunk_ids,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::int[],NOW())
      RETURNING id, created_at
    `;
    const chatResult = await db.query(insertChatQuery, [
      fileId,
      finalSessionId,
      userId,
      secretName,
      llmResponse,
      true,
      secretName,
      secretId,
      chunkIds,
    ]);

    const messageId = chatResult.rows[0].id;
    const createdAt = chatResult.rows[0].created_at;

    // -------------------------------
    // 🔟 Return full chat history
    // -------------------------------
    const historyQuery = `
      SELECT 
        id, file_id, session_id, question, answer, used_secret_prompt,
        prompt_label, secret_id, used_chunk_ids, created_at as timestamp
      FROM file_chats
      WHERE file_id = $1 AND session_id = $2 AND user_id = $3
      ORDER BY created_at ASC;
    `;
    const historyResult = await db.query(historyQuery, [fileId, finalSessionId, userId]);

    const history = historyResult.rows.map((row) => ({
      id: row.id,
      file_id: row.file_id,
      session_id: row.session_id,
      question: row.question,
      answer: row.answer,
      used_secret_prompt: row.used_secret_prompt,
      prompt_label: row.prompt_label,
      secret_id: row.secret_id,
      used_chunk_ids: typeof row.used_chunk_ids === 'string' ? JSON.parse(row.used_chunk_ids) : row.used_chunk_ids,
      timestamp: row.timestamp,
      display_text_left_panel: row.used_secret_prompt ? `Analysis: ${row.prompt_label}` : row.question,
    }));

    console.log(`[triggerSecretLLM] ✅ Chat and job linked successfully.`);

    return res.status(200).json({
      success: true,
      answer: llmResponse,
      response: llmResponse,
      message_id: messageId,
      session_id: finalSessionId,
      secretManagerId: secret_manager_id,
      llmProvider: provider,
      used_chunk_ids: chunkIds,
      history,
      timestamp: createdAt,
      chunkingMethod: dbChunkingMethod,
    });

  } catch (err) {
    console.error('🚨 Error in triggerSecretLLM:', err);
    res.status(500).json({
      error: `Internal Server Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

/**
 * 🧩 Trigger LLM with a secret-based prompt for a folder.
 * @route POST /api/secrets/trigger-llm-folder
 */
const triggerAskLlmForFolder = async (req, res) => {
  const { secretId, folderName, additionalInput = "", sessionId, llm_name: requestLlmName } = req.body;

  console.log(`[triggerAskLlmForFolder] Request body:`, {
    secretId,
    folderName,
    sessionId,
    llm_name: requestLlmName,
    additionalInput: additionalInput ? additionalInput.substring(0, 50) + '...' : '(empty)',
  });

  // -------------------------------
  // 1️⃣ Input Validation
  // -------------------------------
  if (!secretId) return res.status(400).json({ error: '❌ secretId is required.' });
  if (!folderName) return res.status(400).json({ error: '❌ folderName is required.' });

  const userId = req.user?.id || req.userId;
  if (!userId) return res.status(401).json({ error: '❌ User authentication required.' });

  const finalSessionId = sessionId || uuidv4();

  try {
    console.log(`[triggerAskLlmForFolder] Starting process for secretId: ${secretId}, folderName: ${folderName}`);

    // -------------------------------
    // 2️⃣ Fetch secret configuration from DB
    // -------------------------------
    const query = `
      SELECT
        s.id,
        s.name,
        s.secret_manager_id,
        s.version,
        s.llm_id,
        l.name AS llm_name,
        cm.method_name AS chunking_method
      FROM secret_manager s
      LEFT JOIN chunking_methods cm ON s.chunking_method_id = cm.id
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;
    const result = await db.query(query, [secretId]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: '❌ Secret configuration not found in DB.' });

    const {
      name: secretName,
      secret_manager_id,
      version,
      llm_name: dbLlmName,
      chunking_method: dbChunkingMethod,
    } = result.rows[0];

    console.log(
      `[triggerAskLlmForFolder] Found secret: ${secretName}, LLM from DB: ${dbLlmName || 'none'}, Chunking Method from DB: ${dbChunkingMethod || 'none'}`
    );

    // -------------------------------
    // 3️⃣ Resolve provider name dynamically
    // -------------------------------
    let provider = resolveProviderName(requestLlmName || dbLlmName);
    console.log(`[triggerAskLlmForFolder] Resolved LLM provider: ${provider}`);
    const availableProviders = getAvailableProviders();
    if (!availableProviders[provider] || !availableProviders[provider].available) {
      console.warn(`[triggerAskLlmForFolder] Provider '${provider}' unavailable — falling back to gemini`);
      provider = 'gemini';
    }

    // -------------------------------
    // 4️⃣ Fetch secret value from GCP Secret Manager
    // -------------------------------
    const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
    console.log(`[triggerAskLlmForFolder] Fetching secret from GCP: ${gcpSecretName}`);

    const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
    const secretValue = accessResponse.payload.data.toString('utf8');
    if (!secretValue?.trim()) return res.status(500).json({ error: '❌ Secret value is empty in GCP.' });

    console.log(`[triggerAskLlmForFolder] Secret value length: ${secretValue.length} characters`);

    // -------------------------------
    // 5️⃣ Fetch all processed files in folder
    // -------------------------------
    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");

    if (processedFiles.length === 0) {
      return res.status(404).json({ error: "No processed documents found in this folder." });
    }

    console.log(`[triggerAskLlmForFolder] Found ${processedFiles.length} processed files in folder "${folderName}"`);

    // -------------------------------
    // 6️⃣ Collect all chunks across all files
    // -------------------------------
    let allChunks = [];
    const FileChunk = require('../models/FileChunk'); // Dynamically require FileChunk
    for (const file of processedFiles) {
      const chunks = await FileChunk.getChunksByFileId(file.id);
      allChunks.push(
        ...chunks.map((chunk) => ({
          ...chunk,
          file_id: file.id,
          filename: file.originalname,
        }))
      );
    }

    if (allChunks.length === 0) {
      return res.status(400).json({ error: "No content found in folder documents." });
    }

    const documentContent = allChunks.map((c) => `📄 [${c.filename}]\n${c.content}`).join('\n\n');
    console.log(`[triggerAskLlmForFolder] Combined document content length: ${documentContent.length} characters`);

    // -------------------------------
    // 7️⃣ Construct final prompt
    // -------------------------------
    let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
    finalPrompt += `${secretValue}\n\n=== DOCUMENTS TO ANALYZE (FOLDER: "${folderName}") ===\n${documentContent}`;
    if (additionalInput?.trim().length > 0)
      finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additionalInput.trim()}`;

    console.log(`[triggerAskLlmForFolder] Final prompt length: ${finalPrompt.length}`);

    // -------------------------------
    // 8️⃣ Trigger the LLM via askFolderLLM
    // -------------------------------
    console.log(`[triggerAskLlmForFolder] Calling askFolderLLM with provider: ${provider}...`);
    const llmResponse = await askFolderLLM(provider, finalPrompt, ''); // Use askFolderLLM
    if (!llmResponse?.trim()) throw new Error(`Empty response received from ${provider}`);
    console.log(`[triggerAskLlmForFolder] ✅ LLM response received (${llmResponse.length} characters)`);

    // -------------------------------
    // 9️⃣ Store chat record in folder_chats
    // -------------------------------
    console.log(`[triggerAskLlmForFolder] Storing chat in database...`);
    const summarizedFileIds = processedFiles.map((f) => f.id);

    const existingHistory = await FolderChat.getFolderChatHistory(userId, folderName, finalSessionId);
    const historyForStorage = simplifyFolderChatHistory(existingHistory);
    if (historyForStorage.length > 0) {
      const lastTurn = historyForStorage[historyForStorage.length - 1];
      console.log(
        `[triggerAskLlmForFolder] Using ${historyForStorage.length} prior turn(s) for context. Most recent: Q="${(lastTurn.question || '').slice(0, 120)}", A="${(lastTurn.answer || '').slice(0, 120)}"`
      );
    } else {
      console.log('[triggerAskLlmForFolder] No prior context for this session.');
    }

    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      secretName, // Store the secret/prompt name as the question
      llmResponse,
      finalSessionId,
      summarizedFileIds,
      allChunks.map((c) => c.id), // usedChunkIds
      true, // used_secret_prompt = true
      secretName, // prompt_label
      secretId,
      historyForStorage
    );

    const messageId = savedChat.id;
    const createdAt = savedChat.created_at;

    console.log(`[triggerAskLlmForFolder] ✅ Chat stored in DB with ID: ${messageId}`);

    // -------------------------------
    // 🔟 Return full chat history for this session
    // -------------------------------
    const historyRows = await FolderChat.getFolderChatHistory(userId, folderName, finalSessionId);

    const history = historyRows.map((row) => ({
      id: row.id,
      folder_name: row.folder_name,
      session_id: row.session_id,
      question: row.question,
      answer: row.answer,
      used_secret_prompt: row.used_secret_prompt,
      prompt_label: row.prompt_label,
      secret_id: row.secret_id,
      summarized_file_ids: row.summarized_file_ids,
      timestamp: row.created_at,
      chat_history: row.chat_history || [],
      display_text_left_panel: row.used_secret_prompt ? `Analysis: ${row.prompt_label}` : row.question,
    }));

    console.log(`[triggerAskLlmForFolder] ✅ Chat and job linked successfully.`);

    return res.status(200).json({
      success: true,
      answer: llmResponse,
      response: llmResponse,
      message_id: messageId,
      session_id: finalSessionId,
      secretManagerId: secret_manager_id,
      llmProvider: provider,
      files_queried: processedFiles.map(f => f.originalname),
      history,
      timestamp: createdAt,
      chunkingMethod: dbChunkingMethod,
    });

  } catch (err) {
    console.error('🚨 Error in triggerAskLlmForFolder:', err);
    res.status(500).json({
      error: `Internal Server Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};


// Helper
const getSecretDetailsById = async (secretId) => {
  try {
    const query = `
      SELECT
        s.id,
        s.name,
        s.secret_manager_id,
        s.version,
        s.llm_id,
        l.name AS llm_name,
        cm.method_name AS chunking_method
      FROM secret_manager s
      LEFT JOIN chunking_methods cm ON s.chunking_method_id = cm.id
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;
    const result = await db.query(query, [secretId]);
    return result.rows[0];
  } catch (error) {
    console.error(`🚨 Error in getSecretDetailsById for secret ${secretId}:`, error.message);
    throw error;
  }
};


module.exports = {
  getAllSecrets,
  fetchSecretValueFromGCP,
  createSecretInGCP,
  triggerSecretLLM,
  triggerAskLlmForFolder, // Export the new function
  getSecretDetailsById,
};


// const pool//