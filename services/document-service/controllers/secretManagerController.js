// const db = require('../config/db');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');

// let secretClient;

// function setupGCPClientFromBase64() {
//   const base64Key = process.env.GCS_KEY_BASE64;
//   if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

//   const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
//   const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//   fs.writeFileSync(tempFilePath, keyJson);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//   secretClient = new SecretManagerServiceClient();
// }

// if (!secretClient) {
//   setupGCPClientFromBase64();
// }

// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) {
//   throw new Error('GCLOUD_PROJECT_ID not set in env');
// }

// /**
//  * @description Fetches a secret's value from Google Cloud Secret Manager using its internal ID.
//  * @route GET /api/secrets/:id
//  */
// const fetchSecretValueFromGCP = async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log('📦 Fetching secret config from DB for ID:', id);

//     const result = await db.query(
//       'SELECT secret_manager_id, version FROM secret_manager WHERE id = $1',
//       [id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;

//     console.log('🔐 Fetching from GCP Secret Manager:', secretName);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       version,
//       value: secretValue,
//     });
//   } catch (err) {
//     console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// /**
//  * @description Creates a new secret in Google Cloud Secret Manager and records its metadata in the database.
//  * @route POST /api/secrets/create
//  */
// const createSecretInGCP = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     const [secrets] = await secretClient.listSecrets({ parent });
//     const exists = secrets.find((s) => s.name === secretName);

//     if (!exists) {
//       console.log(`🆕 Creating secret: ${secret_manager_id}`);
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     } else {
//       console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
//     }

//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });

//     const versionId = versionResponse.name.split('/').pop();

//     const result = await db.query(
//       `
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11
//       ) RETURNING *;
//       `,
//       [
//         name,
//         description,
//         template_type,
//         status,
//         usage_count,
//         success_rate,
//         avg_processing_time,
//         created_by,
//         JSON.stringify(template_metadata),
//         secret_manager_id,
//         versionId,
//       ]
//     );

//     res.status(201).json({
//       message: '✅ Secret created and version added to GCP',
//       gcpSecret: secret_manager_id,
//       gcpVersion: versionId,
//       dbRecord: result.rows[0],
//     });
//   } catch (error) {
//     console.error('🚨 Error creating secret in GCP:', error.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + error.message });
//   }
// };

// /**
//  * @description Retrieves all secrets from the database, with an option to fetch their values from Google Cloud Secret Manager.
//  * @route GET /api/secrets
//  */
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const result = await db.query('SELECT * FROM secret_manager ORDER BY created_at DESC');
//     const rows = result.rows;

//     if (!includeValues) {
//       return res.status(200).json(rows);
//     }

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (error) {
//     console.error('Error fetching secrets:', error);
//     res.status(500).json({ error: 'Failed to fetch secrets' });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   fetchSecretValueFromGCP,
//   createSecretInGCP,
// };


// const db = require('../config/db');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { askLLM, getAvailableProviders } = require('../services/aiService');

// let secretClient;

// // 🔐 Setup Google Secret Manager Client
// function setupGCPClientFromBase64() {
//   const base64Key = process.env.GCS_KEY_BASE64;
//   if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

//   const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
//   const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//   fs.writeFileSync(tempFilePath, keyJson);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//   secretClient = new SecretManagerServiceClient();
// }

// if (!secretClient) {
//   setupGCPClientFromBase64();
// }

// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('❌ GCLOUD_PROJECT_ID not set in env');

// /**
//  * 🧩 Fetch a single secret with its LLM model name
//  * @route GET /api/secrets/:id
//  */
// const fetchSecretValueFromGCP = async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log('📦 Fetching secret config from DB for ID:', id);

//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;

//     const result = await db.query(query, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     console.log('🔐 Fetching from GCP Secret Manager:', secretName);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       version,
//       llm_id,
//       llm_name,
//       value: secretValue,
//     });
//   } catch (err) {
//     console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// /**
//  * 🧩 Create secret with optional LLM mapping
//  * @route POST /api/secrets/create
//  */
// const createSecretInGCP = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id, // 👈 new field to link to llm_models
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // 🔍 Check if secret exists
//     const [secrets] = await secretClient.listSecrets({ parent });
//     const exists = secrets.find((s) => s.name === secretName);

//     if (!exists) {
//       console.log(`🆕 Creating new secret: ${secret_manager_id}`);
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     } else {
//       console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
//     }

//     // ➕ Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // 💾 Insert into DB (with llm_id)
//     const insertQuery = `
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       )
//       RETURNING *;
//     `;

//     const result = await db.query(insertQuery, [
//       name,
//       description,
//       template_type,
//       status,
//       usage_count,
//       success_rate,
//       avg_processing_time,
//       created_by,
//       JSON.stringify(template_metadata),
//       secret_manager_id,
//       versionId,
//       llm_id || null, // 👈 safely handle null
//     ]);

//     res.status(201).json({
//       message: '✅ Secret created and version added to GCP',
//       gcpSecret: secret_manager_id,
//       gcpVersion: versionId,
//       dbRecord: result.rows[0],
//     });
//   } catch (error) {
//     console.error('🚨 Error creating secret in GCP:', error.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + error.message });
//   }
// };

// /**
//  * 🧩 Get all secrets with their LLM names
//  * @route GET /api/secrets
//  */
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const query = `
//       SELECT 
//         s.*, 
//         l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `;

//     const result = await db.query(query);
//     const rows = result.rows;

//     if (!includeValues) {
//       return res.status(200).json(rows);
//     }

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (error) {
//     console.error('🚨 Error fetching secrets:', error.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + error.message });
//   }
// };

// /**
//  * 🧩 Trigger LLM with a secret-based prompt
//  * @route POST /api/secrets/trigger-llm
//  */
// // const triggerSecretLLM = async (req, res) => {
// //   const { secretId, prompt } = req.body;

// //   if (!secretId || !prompt) {
// //     return res.status(400).json({ error: '❌ secretId and prompt are required.' });
// //   }

// //   try {
// //     // 1. Fetch secret configuration from DB
// //     const query = `
// //       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
// //       FROM secret_manager s
// //       LEFT JOIN llm_models l ON s.llm_id = l.id
// //       WHERE s.id = $1
// //     `;
// //     const result = await db.query(query, [secretId]);

// //     if (result.rows.length === 0) {
// //       return res.status(404).json({ error: '❌ Secret config not found in DB' });
// //     }

// //     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];

// //     // 2. Access secret value from GCP Secret Manager
// //     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
// //     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
// //     const secretValue = accessResponse.payload.data.toString('utf8');

// //     // 3. Determine LLM provider
// //     let provider = llm_name || 'gemini'; // Default to 'gemini' if no LLM is linked or found

// //     // Check if the prompt contains a specific LLM name (e.g., #openai, #claude-sonnet-4)
// //     const llmTagMatch = prompt.match(/#(\w[\w-]*)/);
// //     if (llmTagMatch && llmTagMatch[1]) {
// //       const taggedProvider = llmTagMatch[1].toLowerCase();
// //       const availableProviders = getAvailableProviders();
// //       if (availableProviders[taggedProvider] && availableProviders[taggedProvider].available) {
// //         provider = taggedProvider;
// //         console.log(`Using LLM provider from prompt tag: ${provider}`);
// //       } else {
// //         console.warn(`Requested LLM provider '${taggedProvider}' from prompt tag is not available or supported. Falling back to default/linked provider: ${provider}`);
// //       }
// //     }

// //     // Remove LLM tag from the prompt before sending to LLM
// //     const cleanedPrompt = prompt.replace(/#(\w[\w-]*)/, '').trim();

// //     console.log(`[triggerSecretLLM] Calling askLLM with:`);
// //     console.log(`  Provider: ${provider}`);
// //     console.log(`  Cleaned Prompt (length ${cleanedPrompt.length}): "${cleanedPrompt.substring(0, 100)}..."`);
// //     console.log(`  Secret Value (length ${secretValue.length}): "${secretValue.substring(0, 100)}..."`);

// //     // 4. Call the unified askLLM function, swapping prompt and secretValue
// //     //    secretValue now acts as the userMessage (instruction), and cleanedPrompt as context (document text)
// //     const llmResponse = await askLLM(provider, secretValue, cleanedPrompt);
// //     console.log(`[triggerSecretLLM] Received LLM response (length ${llmResponse.length}): "${llmResponse.substring(0, 100)}..."`);

// //     res.status(200).json({
// //       secretManagerId: secret_manager_id,
// //       llmProvider: provider,
// //       response: llmResponse,
// //     });
// //   } catch (err) {
// //     console.error('🚨 Error in triggerSecretLLM:', err.message);
// //     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
// //   }
// // };


// const triggerSecretLLM = async (req, res) => {
//   const { secretId, prompt } = req.body;

//   if (!secretId || !prompt) {
//     return res.status(400).json({ error: '❌ secretId and prompt are required.' });
//   }

//   try {
//     // ... (Steps 1 & 2: Fetching secret config and value are correct)
//     // 1. Fetch secret configuration from DB
//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;
//     const result = await db.query(query, [secretId]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];

//     // 2. Access secret value from GCP Secret Manager
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     // 3. Determine LLM provider (Logic remains correct)
//     let provider = llm_name || 'gemini'; // Default to 'gemini' if no LLM is linked or found

//     // Check if the prompt contains a specific LLM name (e.g., #openai, #claude-sonnet-4)
//     const llmTagMatch = prompt.match(/#(\w[\w-]*)/);
//     if (llmTagMatch && llmTagMatch[1]) {
//       const taggedProvider = llmTagMatch[1].toLowerCase();
//       const availableProviders = getAvailableProviders();
//       if (availableProviders[taggedProvider] && availableProviders[taggedProvider].available) {
//         provider = taggedProvider;
//         console.log(`Using LLM provider from prompt tag: ${provider}`);
//       } else {
//         console.warn(`Requested LLM provider '${taggedProvider}' from prompt tag is not available or supported. Falling back to default/linked provider: ${provider}`);
//       }
//     }

//     // Remove LLM tag from the prompt before sending to LLM
//     const cleanedPrompt = prompt.replace(/#(\w[\w-]*)/, '').trim();

//     console.log(`[triggerSecretLLM] Calling askLLM with:`);
//     console.log(`  Provider: ${provider}`);
//     console.log(`  User Prompt (length ${cleanedPrompt.length}): "${cleanedPrompt.substring(0, 100)}..."`);
//     console.log(`  System/Context (length ${secretValue.length}): "${secretValue.substring(0, 100)}..."`);

//     // 4. 💡 CORRECTED CALL: Ensure cleanedPrompt is the USER MESSAGE and secretValue is the CONTEXT.
//     // Assuming askLLM signature is: askLLM(provider, userMessage, context)
//     const llmResponse = await askLLM(provider, cleanedPrompt, secretValue); // <--- THIS IS THE FIX

//     console.log(`[triggerSecretLLM] Received LLM response (length ${llmResponse.length}): "${llmResponse.substring(0, 100)}..."`);

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       llmProvider: provider,
//       response: llmResponse,
//     });
//   } catch (err) {
//     console.error('🚨 Error in triggerSecretLLM:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   fetchSecretValueFromGCP,
//   createSecretInGCP,
//   triggerSecretLLM, // Export the new function
// };


// const db = require('../config/db');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { askLLM, getAvailableProviders } = require('../services/aiService');

// let secretClient;

// // 🔐 Setup Google Secret Manager Client
// function setupGCPClientFromBase64() {
//   const base64Key = process.env.GCS_KEY_BASE64;
//   if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

//   const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
//   const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//   fs.writeFileSync(tempFilePath, keyJson);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//   secretClient = new SecretManagerServiceClient();
// }

// if (!secretClient) {
//   setupGCPClientFromBase64();
// }

// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('❌ GCLOUD_PROJECT_ID not set in env');

// /**
//  * 🧩 Fetch a single secret with its LLM model name
//  * @route GET /api/secrets/:id
//  */
// const fetchSecretValueFromGCP = async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log('📦 Fetching secret config from DB for ID:', id);

//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;

//     const result = await db.query(query, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     console.log('🔐 Fetching from GCP Secret Manager:', secretName);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       version,
//       llm_id,
//       llm_name,
//       value: secretValue,
//     });
//   } catch (err) {
//     console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// /**
//  * 🧩 Create secret with optional LLM mapping
//  * @route POST /api/secrets/create
//  */
// const createSecretInGCP = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id, // 👈 new field to link to llm_models
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // 🔍 Check if secret exists
//     const [secrets] = await secretClient.listSecrets({ parent });
//     const exists = secrets.find((s) => s.name === secretName);

//     if (!exists) {
//       console.log(`🆕 Creating new secret: ${secret_manager_id}`);
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     } else {
//       console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
//     }

//     // ➕ Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // 💾 Insert into DB (with llm_id)
//     const insertQuery = `
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       )
//       RETURNING *;
//     `;

//     const result = await db.query(insertQuery, [
//       name,
//       description,
//       template_type,
//       status,
//       usage_count,
//       success_rate,
//       avg_processing_time,
//       created_by,
//       JSON.stringify(template_metadata),
//       secret_manager_id,
//       versionId,
//       llm_id || null, // 👈 safely handle null
//     ]);

//     res.status(201).json({
//       message: '✅ Secret created and version added to GCP',
//       gcpSecret: secret_manager_id,
//       gcpVersion: versionId,
//       dbRecord: result.rows[0],
//     });
//   } catch (error) {
//     console.error('🚨 Error creating secret in GCP:', error.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + error.message });
//   }
// };

// /**
//  * 🧩 Get all secrets with their LLM names
//  * @route GET /api/secrets
//  */
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const query = `
//       SELECT 
//         s.*, 
//         l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `;

//     const result = await db.query(query);
//     const rows = result.rows;

//     if (!includeValues) {
//       return res.status(200).json(rows);
//     }

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (error) {
//     console.error('🚨 Error fetching secrets:', error.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + error.message });
//   }
// };

// /**
//  * 🧩 Trigger LLM with a secret-based prompt
//  * @route POST /api/secrets/trigger-llm
//  */
// const triggerSecretLLM = async (req, res) => {
//   const { secretId, prompt } = req.body;

//   if (!secretId || !prompt) {
//     return res.status(400).json({ error: '❌ secretId and prompt are required.' });
//   }

//   try {
//     // 1. Fetch secret configuration from DB
//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;
//     const result = await db.query(query, [secretId]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];

//     // 2. Access secret value from GCP Secret Manager
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     // 3. Determine LLM provider
//     let provider = llm_name || 'gemini'; // Default to 'gemini' if no LLM is linked or found

//     // Check if the prompt contains a specific LLM name (e.g., #openai, #claude-sonnet-4)
//     const llmTagMatch = prompt.match(/#(\w[\w-]*)/);
//     if (llmTagMatch && llmTagMatch[1]) {
//       const taggedProvider = llmTagMatch[1].toLowerCase();
//       const availableProviders = getAvailableProviders();
//       if (availableProviders[taggedProvider] && availableProviders[taggedProvider].available) {
//         provider = taggedProvider;
//         console.log(`Using LLM provider from prompt tag: ${provider}`);
//       } else {
//         console.warn(`Requested LLM provider '${taggedProvider}' from prompt tag is not available or supported. Falling back to default/linked provider: ${provider}`);
//       }
//     }

//     // Remove LLM tag from the prompt and trim whitespace
//     const cleanedPrompt = prompt.replace(/#(\w[\w-]*)/, '').trim();

//     // 💡 FIX 1: Ensure the cleaned prompt is not empty after processing (e.g., if only a tag was sent)
//     if (cleanedPrompt.length === 0) {
//         return res.status(400).json({ 
//             error: '❌ User prompt cannot be empty after removing LLM tags.' 
//         });
//     }

//     console.log(`[triggerSecretLLM] Calling askLLM with:`);
//     console.log(`  Provider: ${provider}`);
//     console.log(`  User Message (length ${cleanedPrompt.length}): "${cleanedPrompt.substring(0, 100)}..."`);
//     console.log(`  System/Context (length ${secretValue.length}): "${secretValue.substring(0, 100)}..."`);

//     // 4. 💡 FIX 2: Correct call order: cleanedPrompt (User Message), secretValue (Context/System Instruction)
//     const llmResponse = await askLLM(provider, cleanedPrompt, secretValue); 

//     console.log(`[triggerSecretLLM] Received LLM response (length ${llmResponse.length}): "${llmResponse.substring(0, 100)}..."`);

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       llmProvider: provider,
//       response: llmResponse,
//     });
//   } catch (err) {
//     console.error('🚨 Error in triggerSecretLLM:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   fetchSecretValueFromGCP,
//   createSecretInGCP,
//   triggerSecretLLM, 
// };


// const db = require('../config/db');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { askLLM, getAvailableProviders } = require('../services/aiService');

// let secretClient;

// // 🔐 Setup Google Secret Manager Client
// function setupGCPClientFromBase64() {
//   const base64Key = process.env.GCS_KEY_BASE64;
//   if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

//   const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
//   const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//   fs.writeFileSync(tempFilePath, keyJson);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//   secretClient = new SecretManagerServiceClient();
// }

// if (!secretClient) {
//   setupGCPClientFromBase64();
// }

// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('❌ GCLOUD_PROJECT_ID not set in env');

// /**
//  * 🧩 Fetch a single secret with its LLM model name
//  * @route GET /api/secrets/:id
//  */
// const fetchSecretValueFromGCP = async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log('📦 Fetching secret config from DB for ID:', id);

//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;

//     const result = await db.query(query, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     console.log('🔐 Fetching from GCP Secret Manager:', secretName);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       version,
//       llm_id,
//       llm_name,
//       value: secretValue,
//     });
//   } catch (err) {
//     console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// /**
//  * 🧩 Create secret with optional LLM mapping
//  * @route POST /api/secrets/create
//  */
// const createSecretInGCP = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id,
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // 🔍 Check if secret exists
//     const [secrets] = await secretClient.listSecrets({ parent });
//     const exists = secrets.find((s) => s.name === secretName);

//     if (!exists) {
//       console.log(`🆕 Creating new secret: ${secret_manager_id}`);
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     } else {
//       console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
//     }

//     // ➕ Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // 💾 Insert into DB (with llm_id)
//     const insertQuery = `
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       )
//       RETURNING *;
//     `;

//     const result = await db.query(insertQuery, [
//       name,
//       description,
//       template_type,
//       status,
//       usage_count,
//       success_rate,
//       avg_processing_time,
//       created_by,
//       JSON.stringify(template_metadata),
//       secret_manager_id,
//       versionId,
//       llm_id || null,
//     ]);

//     res.status(201).json({
//       message: '✅ Secret created and version added to GCP',
//       gcpSecret: secret_manager_id,
//       gcpVersion: versionId,
//       dbRecord: result.rows[0],
//     });
//   } catch (error) {
//     console.error('🚨 Error creating secret in GCP:', error.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + error.message });
//   }
// };

// /**
//  * 🧩 Get all secrets with their LLM names
//  * @route GET /api/secrets
//  */
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const query = `
//       SELECT 
//         s.*, 
//         l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `;

//     const result = await db.query(query);
//     const rows = result.rows;

//     if (!includeValues) {
//       return res.status(200).json(rows);
//     }

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (error) {
//     console.error('🚨 Error fetching secrets:', error.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + error.message });
//   }
// };

// /**
//  * 🧩 Trigger LLM with a secret-based prompt
//  * @route POST /api/secrets/trigger-llm
//  */
// // const triggerSecretLLM = async (req, res) => {
// //   const { secretId, fileId, additionalInput = "" } = req.body;

// //   console.log(`[triggerSecretLLM] Request body:`, { 
// //     secretId, 
// //     fileId, 
// //     additionalInput: additionalInput ? additionalInput.substring(0, 50) + '...' : '(empty)' 
// //   });

// //   // Validation
// //   if (!secretId) {
// //     return res.status(400).json({ error: '❌ secretId is required.' });
// //   }

// //   if (!fileId) {
// //     return res.status(400).json({ error: '❌ fileId is required.' });
// //   }

// //   try {
// //     console.log(`[triggerSecretLLM] Starting process for secretId: ${secretId}, fileId: ${fileId}`);

// //     // 1. Fetch secret configuration from DB (including LLM model)
// //     const query = `
// //       SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
// //       FROM secret_manager s
// //       LEFT JOIN llm_models l ON s.llm_id = l.id
// //       WHERE s.id = $1
// //     `;
// //     const result = await db.query(query, [secretId]);

// //     if (result.rows.length === 0) {
// //       return res.status(404).json({ error: '❌ Secret config not found in DB' });
// //     }

// //     const { name: secretName, secret_manager_id, version, llm_id, llm_name } = result.rows[0];
// //     console.log(`[triggerSecretLLM] Found secret: ${secretName}, LLM: ${llm_name || 'none'}`);
    
// //     // 2. Determine which LLM provider to use (from secret's linked model)
// //     let provider = llm_name || 'gemini'; // Default to gemini if no LLM linked
// //     console.log(`[triggerSecretLLM] Using LLM provider: ${provider}`);

// //     // Validate provider is available
// //     const availableProviders = getAvailableProviders();
// //     if (!availableProviders[provider] || !availableProviders[provider].available) {
// //       console.warn(`[triggerSecretLLM] Provider '${provider}' not available, falling back to gemini`);
// //       provider = 'gemini';
// //     }

// //     // 3. Access secret value from GCP Secret Manager (this is the PROMPT/INSTRUCTIONS)
// //     const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
// //     console.log(`[triggerSecretLLM] Fetching secret from GCP: ${gcpSecretName}`);
    
// //     const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
// //     const secretValue = accessResponse.payload.data.toString('utf8');

// //     if (!secretValue || secretValue.trim().length === 0) {
// //       return res.status(500).json({ error: '❌ Secret value is empty.' });
// //     }

// //     console.log(`[triggerSecretLLM] Secret value length: ${secretValue.length} characters`);

// //     // 4. Fetch document content from database
// //     const FileChunkModel = require('../models/FileChunk');
// //     const allChunks = await FileChunkModel.getChunksByFileId(fileId);
    
// //     if (!allChunks || allChunks.length === 0) {
// //       return res.status(404).json({ error: '❌ No document content found for this file.' });
// //     }

// //     const documentContent = allChunks.map((c) => c.content).join('\n\n');
// //     console.log(`[triggerSecretLLM] Document content length: ${documentContent.length} characters`);

// //     // 5. ✅ CONSTRUCT THE FINAL PROMPT
// //     // Secret value = The analysis instructions/prompt template
// //     // Document content = The context/data to analyze
// //     // Additional input = Optional user refinement
    
// //     let finalPrompt = secretValue; // Start with secret instructions
    
// //     // Add document content to analyze
// //     finalPrompt += `\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;
    
// //     // Add user's additional input if provided
// //     if (additionalInput && additionalInput.trim().length > 0) {
// //       finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additionalInput.trim()}`;
// //     }

// //     console.log(`[triggerSecretLLM] Final prompt constructed:`);
// //     console.log(`  - Total length: ${finalPrompt.length} characters`);
// //     console.log(`  - Secret instructions: ${secretValue.length} chars`);
// //     console.log(`  - Document content: ${documentContent.length} chars`);
// //     console.log(`  - Additional input: ${additionalInput ? additionalInput.trim().length : 0} chars`);

// //     // 6. ✅ CALL LLM: Pass the complete prompt as userMessage, empty context
// //     // (Because the secret value IS the prompt/instructions, not system context)
// //     console.log(`[triggerSecretLLM] Calling askLLM with provider: ${provider}`);
// //     const llmResponse = await askLLM(provider, finalPrompt, '');

// //     console.log(`[triggerSecretLLM] Received LLM response: ${llmResponse.length} characters`);

// //     // 7. Return response
// //     res.status(200).json({
// //       secretManagerId: secret_manager_id,
// //       llmProvider: provider,
// //       response: llmResponse,
// //       session_id: req.body.session_id || `session-${Date.now()}`,
// //       used_chunk_ids: allChunks.map(c => c.id), // Return all chunk IDs used
// //     });

// //   } catch (err) {
// //     console.error('🚨 Error in triggerSecretLLM:', err);
// //     console.error('Stack trace:', err.stack);
// //     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
// //   }
// // };


// const db = require('../config/db');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { askLLM, getAvailableProviders, resolveProviderName } = require('../services/aiService');

// let secretClient;

// // 🔐 Setup Google Secret Manager Client
// function setupGCPClientFromBase64() {
//   const base64Key = process.env.GCS_KEY_BASE64;
//   if (!base64Key) throw new Error('❌ GCS_KEY_BASE64 is not set');

//   const keyJson = Buffer.from(base64Key, 'base64').toString('utf8');
//   const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//   fs.writeFileSync(tempFilePath, keyJson);
//   process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//   secretClient = new SecretManagerServiceClient();
// }

// if (!secretClient) {
//   setupGCPClientFromBase64();
// }

// const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('❌ GCLOUD_PROJECT_ID not set in env');

// /**
//  * 🧩 Fetch a single secret with its LLM model name
//  * @route GET /api/secrets/:id
//  */
// const fetchSecretValueFromGCP = async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log('📦 Fetching secret config from DB for ID:', id);

//     const query = `
//       SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;

//     const result = await db.query(query, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret config not found in DB' });
//     }

//     const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     console.log('🔐 Fetching from GCP Secret Manager:', secretName);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     res.status(200).json({
//       secretManagerId: secret_manager_id,
//       version,
//       llm_id,
//       llm_name,
//       value: secretValue,
//     });
//   } catch (err) {
//     console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
//     res.status(500).json({ error: 'Internal Server Error: ' + err.message });
//   }
// };

// /**
//  * 🧩 Create secret with optional LLM mapping
//  * @route POST /api/secrets/create
//  */
// const createSecretInGCP = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id,
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // 🔍 Check if secret exists
//     const [secrets] = await secretClient.listSecrets({ parent });
//     const exists = secrets.find((s) => s.name === secretName);

//     if (!exists) {
//       console.log(`🆕 Creating new secret: ${secret_manager_id}`);
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     } else {
//       console.log(`ℹ️ Secret already exists: ${secret_manager_id}`);
//     }

//     // ➕ Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // 💾 Insert into DB (with llm_id)
//     const insertQuery = `
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       )
//       RETURNING *;
//     `;

//     const result = await db.query(insertQuery, [
//       name,
//       description,
//       template_type,
//       status,
//       usage_count,
//       success_rate,
//       avg_processing_time,
//       created_by,
//       JSON.stringify(template_metadata),
//       secret_manager_id,
//       versionId,
//       llm_id || null,
//     ]);

//     res.status(201).json({
//       message: '✅ Secret created and version added to GCP',
//       gcpSecret: secret_manager_id,
//       gcpVersion: versionId,
//       dbRecord: result.rows[0],
//     });
//   } catch (error) {
//     console.error('🚨 Error creating secret in GCP:', error.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + error.message });
//   }
// };

// /**
//  * 🧩 Get all secrets with their LLM names
//  * @route GET /api/secrets
//  */
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const query = `
//       SELECT 
//         s.*, 
//         l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `;

//     const result = await db.query(query);
//     const rows = result.rows;

//     if (!includeValues) {
//       return res.status(200).json(rows);
//     }

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const name = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (error) {
//     console.error('🚨 Error fetching secrets:', error.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + error.message });
//   }
// };

// /**
//  * 🧩 Trigger LLM with a secret-based prompt
//  * @route POST /api/secrets/trigger-llm
//  */
// const triggerSecretLLM = async (req, res) => {
//   const { secretId, fileId, additionalInput = "" } = req.body;

//   console.log(`[triggerSecretLLM] Request body:`, {
//     secretId,
//     fileId,
//     additionalInput: additionalInput ? additionalInput.substring(0, 50) + '...' : '(empty)'
//   });

//   // -------------------------------
//   // 1️⃣ Input Validation
//   // -------------------------------
//   if (!secretId) return res.status(400).json({ error: '❌ secretId is required.' });
//   if (!fileId) return res.status(400).json({ error: '❌ fileId is required.' });

//   try {
//     console.log(`[triggerSecretLLM] Starting process for secretId: ${secretId}, fileId: ${fileId}`);

//     // -------------------------------
//     // 2️⃣ Fetch secret configuration from DB
//     // -------------------------------
//     const query = `
//       SELECT
//         s.id,
//         s.name,
//         s.secret_manager_id,
//         s.version,
//         s.llm_id,
//         l.name AS llm_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       WHERE s.id = $1
//     `;
//     const result = await db.query(query, [secretId]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: '❌ Secret configuration not found in DB.' });
//     }

//     const { name: secretName, secret_manager_id, version, llm_name } = result.rows[0];
//     console.log(`[triggerSecretLLM] Found secret: ${secretName}, LLM from DB: ${llm_name || 'none'}`);

//     // -------------------------------
//     // 3️⃣ Resolve provider name dynamically
//     // -------------------------------
//     let provider = resolveProviderName(llm_name);
//     console.log(`[triggerSecretLLM] Resolved LLM provider: ${provider}`);

//     // Validate provider availability
//     const availableProviders = getAvailableProviders();
//     if (!availableProviders[provider] || !availableProviders[provider].available) {
//       console.warn(`[triggerSecretLLM] Provider '${provider}' unavailable — falling back to gemini`);
//       provider = 'gemini';
//     }

//     // -------------------------------
//     // 4️⃣ Fetch secret value from GCP Secret Manager
//     // -------------------------------
//     const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     console.log(`[triggerSecretLLM] Fetching secret from GCP: ${gcpSecretName}`);

//     const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
//     const secretValue = accessResponse.payload.data.toString('utf8');

//     if (!secretValue || secretValue.trim().length === 0) {
//       return res.status(500).json({ error: '❌ Secret value is empty in GCP.' });
//     }

//     console.log(`[triggerSecretLLM] Secret value length: ${secretValue.length} characters`);

//     // -------------------------------
//     // 5️⃣ Fetch document content from DB
//     // -------------------------------
//     const FileChunkModel = require('../models/FileChunk');
//     const allChunks = await FileChunkModel.getChunksByFileId(fileId);

//     if (!allChunks || allChunks.length === 0) {
//       return res.status(404).json({ error: '❌ No document content found for this file.' });
//     }

//     const documentContent = allChunks.map((c) => c.content).join('\n\n');
//     console.log(`[triggerSecretLLM] Document content length: ${documentContent.length} characters`);

//     // -------------------------------
//     // 6️⃣ Construct final prompt
//     // -------------------------------
//     let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
//     finalPrompt += `${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;

//     if (additionalInput && additionalInput.trim().length > 0) {
//       finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additionalInput.trim()}`;
//     }

//     console.log(`[triggerSecretLLM] Final prompt constructed:`);
//     console.log(`  - Total length: ${finalPrompt.length}`);
//     console.log(`  - Secret instructions: ${secretValue.length}`);
//     console.log(`  - Document content: ${documentContent.length}`);
//     console.log(`  - Additional input: ${additionalInput ? additionalInput.trim().length : 0}`);

//     // -------------------------------
//     // 7️⃣ Trigger the LLM via askLLM
//     // -------------------------------
//     console.log(`[triggerSecretLLM] Calling askLLM with provider: ${provider}...`);
//     const llmResponse = await askLLM(provider, finalPrompt, '');

//     if (typeof llmResponse !== 'string' || llmResponse.trim().length === 0) {
//       throw new Error(`Invalid or empty response received from ${provider}`);
//     }

//     console.log(`[triggerSecretLLM] ✅ LLM response received (${llmResponse.length} characters)`);

//     // -------------------------------
//     // 8️⃣ Return success response
//     // -------------------------------
//     return res.status(200).json({
//       success: true,
//       secretManagerId: secret_manager_id,
//       llmProvider: provider,
//       response: llmResponse,
//       session_id: req.body.session_id || `session-${Date.now()}`,
//       used_chunk_ids: allChunks.map(c => c.id),
//     });

//   } catch (err) {
//     console.error('🚨 Error in triggerSecretLLM:', err);
//     res.status(500).json({
//       error: `Internal Server Error: ${err.message}`,
//       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//     });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   fetchSecretValueFromGCP,
//   createSecretInGCP,
//   triggerSecretLLM,
// };





const db = require('../config/db');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { askLLM, getAvailableProviders, resolveProviderName } = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');

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
      SELECT s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;

    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '❌ Secret config not found in DB' });
    }

    const { secret_manager_id, version, llm_id, llm_name } = result.rows[0];
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
    console.log('🔐 Fetching from GCP Secret Manager:', secretName);

    const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
    const secretValue = accessResponse.payload.data.toString('utf8');

    res.status(200).json({
      secretManagerId: secret_manager_id,
      version,
      llm_id,
      llm_name,
      value: secretValue,
    });
  } catch (err) {
    console.error('🚨 Error in fetchSecretValueFromGCP:', err.message);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

/**
 * 🧩 Create secret with optional LLM mapping
 * @route POST /api/secrets/create
 */
const createSecretInGCP = async (req, res) => {
  const {
    name,
    description,
    secret_manager_id,
    secret_value,
    llm_id,
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
        secret_manager_id, version, llm_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $8, now(), now(),
        now(), NULL, $9::jsonb,
        $10, $11, $12
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



const triggerSecretLLM = async (req, res) => {
  const { secretId, fileId, additionalInput = "", sessionId, llm_name: requestLlmName } = req.body; // Add requestLlmName

  console.log(`[triggerSecretLLM] Request body:`, {
    secretId,
    fileId,
    sessionId,
    llm_name: requestLlmName, // Log the new field
    additionalInput: additionalInput ? additionalInput.substring(0, 50) + '...' : '(empty)'
  });

  // -------------------------------
  // 1️⃣ Input Validation
  // -------------------------------
  if (!secretId) return res.status(400).json({ error: '❌ secretId is required.' });
  if (!fileId) return res.status(400).json({ error: '❌ fileId is required.' });

  // Get user ID from authenticated request
  const userId = req.user?.id || req.userId;
  if (!userId) {
    return res.status(401).json({ error: '❌ User authentication required.' });
  }

  // Generate or use existing session ID
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
        l.name AS llm_name
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      WHERE s.id = $1
    `;
    const result = await db.query(query, [secretId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '❌ Secret configuration not found in DB.' });
    }

    const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } = result.rows[0]; // Rename llm_name to dbLlmName
    console.log(`[triggerSecretLLM] Found secret: ${secretName}, LLM from DB: ${dbLlmName || 'none'}`);

    // -------------------------------
    // 3️⃣ Resolve provider name dynamically
    // -------------------------------
    // Prioritize llm_name from request body, then from DB, then default
    let provider = resolveProviderName(requestLlmName || dbLlmName);
    console.log(`[triggerSecretLLM] Resolved LLM provider: ${provider} (Source: ${requestLlmName ? 'Request Body' : (dbLlmName ? 'Database' : 'Default')})`);

    // Validate provider availability
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

    if (!secretValue || secretValue.trim().length === 0) {
      return res.status(500).json({ error: '❌ Secret value is empty in GCP.' });
    }

    console.log(`[triggerSecretLLM] Secret value length: ${secretValue.length} characters`);

    // -------------------------------
    // 5️⃣ Fetch document content from DB
    // -------------------------------
    const FileChunkModel = require('../models/FileChunk');
    const allChunks = await FileChunkModel.getChunksByFileId(fileId);

    if (!allChunks || allChunks.length === 0) {
      return res.status(404).json({ error: '❌ No document content found for this file.' });
    }

    const documentContent = allChunks.map((c) => c.content).join('\n\n');
    console.log(`[triggerSecretLLM] Document content length: ${documentContent.length} characters`);

    // -------------------------------
    // 6️⃣ Construct final prompt
    // -------------------------------
    let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
    finalPrompt += `${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;

    if (additionalInput && additionalInput.trim().length > 0) {
      finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additionalInput.trim()}`;
    }

    console.log(`[triggerSecretLLM] Final prompt constructed:`);
    console.log(`  - Total length: ${finalPrompt.length}`);
    console.log(`  - Secret instructions: ${secretValue.length}`);
    console.log(`  - Document content: ${documentContent.length}`);
    console.log(`  - Additional input: ${additionalInput ? additionalInput.trim().length : 0}`);

    // -------------------------------
    // 7️⃣ Trigger the LLM via askLLM
    // -------------------------------
    console.log(`[triggerSecretLLM] Calling askLLM with provider: ${provider}...`);
    const llmResponse = await askLLM(provider, finalPrompt, '');

    if (!llmResponse || llmResponse.trim().length === 0) {
      throw new Error(`Empty response received from ${provider}`);
    }

    console.log(`[triggerSecretLLM] ✅ LLM response received (${llmResponse.length} characters)`);

    // -------------------------------
    // 8️⃣ ✅ STORE CHAT IN DATABASE
    // -------------------------------
    console.log(`[triggerSecretLLM] Storing chat in database...`);
    
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::int[], NOW())
      RETURNING id, created_at
    `;

    const chunkIds = allChunks.map(c => c.id);
    
    const chatResult = await db.query(insertChatQuery, [
      fileId,
      finalSessionId,
      userId,
      secretName,  // ✅ Store the secret/prompt name as the question
      llmResponse,
      true,  // used_secret_prompt = true
      secretName,  // prompt_label
      secretId,
      chunkIds  // Store as PostgreSQL array with explicit cast
    ]);

    const messageId = chatResult.rows[0].id;
    const createdAt = chatResult.rows[0].created_at;

    console.log(`[triggerSecretLLM] ✅ Chat stored in DB with ID: ${messageId}`);

    // -------------------------------
    // 9️⃣ ✅ FETCH COMPLETE CHAT HISTORY FOR THIS SESSION
    // -------------------------------
    const historyQuery = `
      SELECT 
        id,
        file_id,
        session_id,
        question,
        answer,
        used_secret_prompt,
        prompt_label,
        secret_id,
        used_chunk_ids,
        created_at as timestamp
      FROM file_chats
      WHERE file_id = $1 AND session_id = $2 AND user_id = $3
      ORDER BY created_at ASC
    `;

    const historyResult = await db.query(historyQuery, [fileId, finalSessionId, userId]);
    
    const history = historyResult.rows.map(row => ({
      id: row.id,
      file_id: row.file_id,
      session_id: row.session_id,
      question: row.question,
      answer: row.answer,
      used_secret_prompt: row.used_secret_prompt,
      prompt_label: row.prompt_label,
      secret_id: row.secret_id,
      used_chunk_ids: typeof row.used_chunk_ids === 'string'
        ? JSON.parse(row.used_chunk_ids)
        : row.used_chunk_ids,
      timestamp: row.timestamp,
      display_text_left_panel: row.used_secret_prompt
        ? `Analysis: ${row.prompt_label}`
        : row.question
    }));

    console.log(`[triggerSecretLLM] ✅ Fetched ${history.length} messages from chat history`);

    // -------------------------------
    // 🔟 Return success response with history
    // -------------------------------
    return res.status(200).json({
      success: true,
      answer: llmResponse,  // Keep 'answer' for compatibility
      response: llmResponse,  // Keep 'response' for compatibility
      message_id: messageId,
      session_id: finalSessionId,
      secretManagerId: secret_manager_id,
      llmProvider: provider,
      used_chunk_ids: chunkIds,
      history: history,  // ✅ Return complete chat history
      timestamp: createdAt
    });

  } catch (err) {
    console.error('🚨 Error in triggerSecretLLM:', err);
    res.status(500).json({
      error: `Internal Server Error: ${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

module.exports = {
  getAllSecrets,
  fetchSecretValueFromGCP,
  createSecretInGCP,
  triggerSecretLLM,
};