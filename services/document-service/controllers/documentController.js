// const db = require("../config/db");
// const axios = require("axios"); // Import axios
// const DocumentModel = require("../models/documentModel");
// const File = require("../models/File"); // Import the File model
// const FileChunkModel = require("../models/FileChunk");
// const ChunkVectorModel = require("../models/ChunkVector");
// const ProcessingJobModel = require("../models/ProcessingJob");
// const FileChat = require("../models/FileChat");
// const secretManagerController = require("./secretManagerController"); // NEW: Import secretManagerController
// const { getSecretDetailsById } = require('../controllers/secretManagerController');
// const { validate: isUuid } = require("uuid");
// const { uploadToGCS, getSignedUrl } = require("../services/gcsService");
// const {
//   convertHtmlToDocx,
//   convertHtmlToPdf,
// } = require("../services/conversionService");
// const {
//   askGemini,
//   analyzeWithGemini,
//   getSummaryFromChunks,
//   askLLM,
//   resolveProviderName, // Add resolveProviderName here
// } = require("../services/aiService");
// const { extractText } = require("../utils/textExtractor");
// const {
//   extractTextFromDocument,
//   batchProcessDocument,
//   getOperationStatus,
//   fetchBatchResults,
// } = require("../services/documentAiService");
// const { chunkDocument } = require("../services/chunkingService");
// const {
//   generateEmbedding,
//   generateEmbeddings,
// } = require("../services/embeddingService");
// const { normalizeGcsKey } = require("../utils/gcsKey");
// const TokenUsageService = require("../services/tokenUsageService");
// const { fileInputBucket, fileOutputBucket } = require("../config/gcs");
// const { checkStorageLimit } = require("../utils/storage"); // Import checkStorageLimit
// const { DOCUMENT_UPLOAD_COST_TOKENS } = require("../middleware/checkTokenLimits");

// const { v4: uuidv4 } = require("uuid");

// /**
//  * @description Uploads a document, saves its metadata, and initiates asynchronous processing.
//  * @route POST /api/doc/upload
//  */
// exports.uploadDocument = async (req, res) => {
//   const userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });
//     if (!req.file) return res.status(400).json({ error: "No file uploaded." });

//     const { originalname, mimetype, buffer, size } = req.file;
//     const { secret_id } = req.body; // NEW: Get secret_id from request body

//     // Check storage limits
//     // Fetch user usage and plan
//     const { usage: userUsage, plan: userPlan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

//     // Check storage limits
//     const storageLimitCheck = await checkStorageLimit(userId, size, userPlan);
//     if (!storageLimitCheck.allowed) {
//       return res.status(403).json({ error: storageLimitCheck.message });
//     }

//     // Calculate requested resources for this upload
//     const requestedResources = {
//       tokens: DOCUMENT_UPLOAD_COST_TOKENS,
//       documents: 1,
//       ai_analysis: 1,
//       storage_gb: size / (1024 ** 3), // convert bytes to GB
//     };

//     // Enforce limits
//     const limitCheck = await TokenUsageService.enforceLimits(
//       userId,
//       userUsage,
//       userPlan,
//       requestedResources
//     );

//     if (!limitCheck.allowed) {
//       return res.status(403).json({
//         success: false,
//         message: limitCheck.message,
//         nextRenewalTime: limitCheck.nextRenewalTime,
//         remainingTime: limitCheck.remainingTime,
//       });
//     }

//     const folderPath = `uploads/${userId}`;
//     const { gsUri } = await uploadToGCS(originalname, buffer, folderPath, true, mimetype);

//     const fileId = await DocumentModel.saveFileMetadata(
//       userId,
//       originalname,
//       gsUri,
//       folderPath,
//       mimetype,
//       size,
//       "uploaded"
//     );

//     // Increment usage after successful upload
//     await TokenUsageService.incrementUsage(userId, requestedResources, userPlan);

//     // Asynchronously process the document
//     processDocument(fileId, buffer, mimetype, userId, secret_id); // NEW: Pass secret_id to processDocument

//     res.status(202).json({
//       message: "Document uploaded and processing initiated.",
//       file_id: fileId,
//       gs_uri: gsUri,
//     });
//   } catch (error) {
//     console.error("❌ uploadDocument error:", error);
//     res.status(500).json({ error: "Failed to upload document." });
//   }
// };


// /**
//  * @description Asynchronously processes a document by extracting text, chunking, generating embeddings, and summarizing.
//  * Dynamically fetches chunking method from DB if a secret_id is provided.
//  */
// async function processDocument(fileId, fileBuffer, mimetype, userId, secretId = null) {
//   const jobId = uuidv4();
//   await ProcessingJobModel.createJob({
//     job_id: jobId,
//     file_id: fileId,
//     type: "synchronous",
//     document_ai_operation_name: null,
//     status: "queued",
//     secret_id: secretId, // Pass secretId to the job
//   });

//   await DocumentModel.updateFileStatus(fileId, "processing", 0.0);

//   let chunkingMethod = "recursive"; // Default fallback

//   try {
//     // ✅ Step 1: Determine chunking method dynamically
//     if (secretId) {
//       console.log(`[processDocument] Fetching chunking method for secret ID: ${secretId}`);
//       const secretQuery = `
//         SELECT chunking_method 
//         FROM secret_manager
//         WHERE id = $1
//       `;
//       const result = await db.query(secretQuery, [secretId]);
//       if (result.rows.length > 0 && result.rows[0].chunking_method) {
//         chunkingMethod = result.rows[0].chunking_method;
//         console.log(`[processDocument] Using chunking method from DB: ${chunkingMethod}`);
//       } else {
//         console.warn(`[processDocument] No custom chunking method found for secret ID: ${secretId}. Using default: ${chunkingMethod}`);
//       }
//     } else {
//       console.log(`[processDocument] No secret_id provided. Using default chunking method: ${chunkingMethod}`);
//     }

//     // ✅ Step 2: Check if document is already processed
//     const file = await DocumentModel.getFileById(fileId);
//     if (file.status === "processed") {
//       console.log(`[processDocument] File ${fileId} already processed. Skipping re-processing.`);
//       await ProcessingJobModel.updateJobStatus(jobId, "completed");
//       return;
//     }

//     // ✅ Step 3: Extract text from document (OCR or direct)
//     let extractedTexts = [];
//     const ocrMimeTypes = [
//       "application/pdf", "image/png", "image/jpeg", "image/tiff",
//       "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
//       "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       "text/plain", "text/csv",
//     ];

//     const useOCR = ocrMimeTypes.includes(String(mimetype).toLowerCase());
//     if (useOCR) {
//       console.log(`[processDocument] Using Document AI OCR for file ID ${fileId}`);
//       extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
//     } else {
//       console.log(`[processDocument] Using standard text extraction for file ID ${fileId}`);
//       const text = await extractText(fileBuffer, mimetype);
//       extractedTexts.push({ text });
//     }

//     if (!extractedTexts.length || extractedTexts.every(item => !item.text || item.text.trim() === "")) {
//       throw new Error("No meaningful text extracted from document.");
//     }

//     await DocumentModel.updateFileStatus(fileId, "processing", 25.0);

//     // ✅ Step 4: Chunk document using selected chunking method
//     console.log(`[processDocument] Chunking file ID ${fileId} using method: ${chunkingMethod}`);
//     const chunks = await chunkDocument(extractedTexts, fileId, chunkingMethod);
//     console.log(`[processDocument] Generated ${chunks.length} chunks using ${chunkingMethod} method.`);
//     await DocumentModel.updateFileStatus(fileId, "processing", 50.0);

//     if (!chunks.length) {
//       console.warn(`[processDocument] No chunks generated. Marking as processed.`);
//       await DocumentModel.updateFileProcessedAt(fileId);
//       await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
//       await ProcessingJobModel.updateJobStatus(jobId, "completed");
//       return;
//     }

//     // ✅ Step 5: Generate embeddings
//     console.log(`[processDocument] Generating embeddings for ${chunks.length} chunks...`);
//     const chunkContents = chunks.map(c => c.content);
//     const embeddings = await generateEmbeddings(chunkContents);

//     if (chunks.length !== embeddings.length) {
//       throw new Error("Mismatch between number of chunks and embeddings generated.");
//     }

//     // ✅ Step 6: Save chunks and embeddings
//     const chunksToSave = chunks.map((chunk, i) => ({
//       file_id: fileId,
//       chunk_index: i,
//       content: chunk.content,
//       token_count: chunk.token_count,
//       page_start: chunk.metadata.page_start,
//       page_end: chunk.metadata.page_end,
//       heading: chunk.metadata.heading,
//     }));

//     const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);
//     console.log(`[processDocument] Saved ${savedChunks.length} chunks to database.`);

//     const vectorsToSave = savedChunks.map((savedChunk, i) => ({
//       chunk_id: savedChunk.id,
//       embedding: embeddings[i],
//       file_id: fileId,
//     }));

//     await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);
//     await DocumentModel.updateFileStatus(fileId, "processing", 75.0);

//     // ✅ Step 7: Generate summary
//     try {
//       const fullText = chunks.map(c => c.content).join("\n\n");
//       if (fullText.trim()) {
//         const summary = await getSummaryFromChunks(fullText);
//         await DocumentModel.updateFileSummary(fileId, summary);
//         console.log(`[processDocument] Summary generated for file ID ${fileId}`);
//       }
//     } catch (summaryError) {
//       console.warn(`[processDocument] Summary generation failed: ${summaryError.message}`);
//     }

//     // ✅ Step 8: Finalize status
//     await DocumentModel.updateFileProcessedAt(fileId);
//     await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
//     await ProcessingJobModel.updateJobStatus(jobId, "completed");

//     console.log(`✅ Document ID ${fileId} fully processed using '${chunkingMethod}' method.`);
//   } catch (error) {
//     console.error(`❌ processDocument failed for file ID ${fileId}:`, error);
//     await DocumentModel.updateFileStatus(fileId, "error", 0.0);
//     await ProcessingJobModel.updateJobStatus(jobId, "failed", error.message);
//   }
// }


// exports.analyzeDocument = async (req, res) => {
//   const userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const { file_id } = req.body;
//     if (!file_id)
//       return res.status(400).json({ error: "file_id is required." });

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: "File not found." });
//     if (file.user_id !== userId)
//       return res.status(403).json({ error: "Access denied." });

//     if (file.status !== "processed") {
//       return res.status(400).json({
//         error: "Document is still processing or failed.",
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     const chunks = await FileChunkModel.getChunksByFileId(file_id);
//     const fullText = chunks.map((c) => c.content).join("\n\n");

//     const analysisCost = Math.ceil(fullText.length / 500);

//     const { userUsage, userPlan, requestedResources } = req;

//     // Enforce limits is already handled by middleware. If we reach here, it's allowed.
//     // The middleware also handles refetching usage if renewal occurred.

//     let insights;
//     try {
//       insights = await analyzeWithGemini(fullText);
//       // Increment usage after successful AI analysis
//       await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
//     } catch (aiError) {
//       console.error("❌ Gemini analysis error:", aiError);
//       return res.status(500).json({
//         error: "Failed to get AI analysis.",
//         details: aiError.message,
//       });
//     }

//     return res.json(insights);
//   } catch (error) {
//     console.error("❌ analyzeDocument error:", error);
//     return res.status(500).json({ error: "Failed to analyze document." });
//   }
// };
// exports.getSummary = async (req, res) => {
//   const userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const { file_id, selected_chunk_ids } = req.body;

//     if (!file_id)
//       return res.status(400).json({ error: "file_id is required." });
//     if (!Array.isArray(selected_chunk_ids) || selected_chunk_ids.length === 0) {
//       return res.status(400).json({ error: "No chunks selected for summary." });
//     }

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file || file.user_id !== userId) {
//       return res.status(403).json({ error: "Access denied or file not found." });
//     }

//     if (file.status !== "processed") {
//       return res.status(400).json({
//         error: "Document is still processing or failed.",
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     const fileChunks = await FileChunkModel.getChunksByFileId(file_id);
//     const allowedIds = new Set(fileChunks.map((c) => c.id));
//     const safeChunkIds = selected_chunk_ids.filter((id) => allowedIds.has(id));

//     if (safeChunkIds.length === 0) {
//       return res.status(400).json({ error: "Selected chunks are invalid for this file." });
//     }

//     const selectedChunks = await FileChunkModel.getChunkContentByIds(safeChunkIds);
//     const combinedText = selectedChunks.map((chunk) => chunk.content).join("\n\n");

//     if (!combinedText.trim()) {
//       return res.status(400).json({ error: "Selected chunks contain no readable content." });
//     }

//     const summaryCost = Math.ceil(combinedText.length / 200);

//     const { userUsage, userPlan, requestedResources } = req;

//     // Enforce limits is already handled by middleware. If we reach here, it's allowed.
//     // The middleware also handles refetching usage if renewal occurred.

//     let summary;
//     try {
//       summary = await getSummaryFromChunks(combinedText);
//       // Increment usage after successful summary generation
//       await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
//     } catch (aiError) {
//       console.error("❌ Gemini summary error:", aiError);
//       return res.status(500).json({
//         error: "Failed to generate summary.",
//         details: aiError.message,
//       });
//     }

//     return res.json({ summary, used_chunk_ids: safeChunkIds });
//   } catch (error) {
//     console.error("❌ Error generating summary:", error);
//     return res.status(500).json({ error: "Failed to generate summary." });
//   }
// };


// exports.chatWithDocument = async (req, res) => {
//   let userId = null;

//   try {
//     const {
//       file_id,
//       question,           // For custom queries
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null,
//       secret_id,          // NEW: For secret prompts
//       llm_name,           // NEW: Optional LLM override
//       additional_input = '', // NEW: Additional input for secret prompts
//     } = req.body;

//     userId = req.user.id;

//     // Validation
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//     if (!file_id) {
//       return res.status(400).json({ error: "file_id is required." });
//     }
//     if (!uuidRegex.test(file_id)) {
//       return res.status(400).json({ error: "Invalid file ID format." });
//     }

//     // Generate session ID if not provided
//     const finalSessionId = session_id || `session-${Date.now()}`;

//     console.log(`[chatWithDocument] Processing request: used_secret_prompt=${used_secret_prompt}, secret_id=${secret_id}, llm_name=${llm_name}`);

//     // Check file access
//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: "File not found." });
//     if (String(file.user_id) !== String(userId)) {
//       return res.status(403).json({ error: "Access denied." });
//     }
//     if (file.status !== "processed") {
//       return res.status(400).json({
//         error: "Document is not yet processed.",
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     let answer;
//     let usedChunkIds = [];
//     let storedQuestion;
//     let finalPromptLabel = prompt_label;
//     let provider; // Declare provider here to make it accessible in the final return

//     // ================================
//     // CASE 1: SECRET PROMPT HANDLING
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id) {
//         return res.status(400).json({ error: "secret_id is required for secret prompts." });
//       }

//       console.log(`[chatWithDocument] Handling secret prompt: ${secret_id}`);

//       // Fetch secret configuration from DB
//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1
//       `;
//       const secretResult = await db.query(secretQuery, [secret_id]);

//       if (secretResult.rows.length === 0) {
//         return res.status(404).json({ error: "Secret configuration not found." });
//       }

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } = secretResult.rows[0];
//       finalPromptLabel = secretName;

//       // Resolve LLM provider (prioritize request llm_name, then DB, then default)
//       provider = resolveProviderName(llm_name || dbLlmName || 'gemini'); // Assign to the higher-scoped provider
//       console.log(`[chatWithDocument] Using LLM provider: ${provider}`);

//       // Fetch secret value from GCP Secret Manager
//       const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
//       const secretClient = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
      
//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString('utf8');

//       if (!secretValue?.trim()) {
//         return res.status(500).json({ error: "Secret value is empty." });
//       }

//       // Fetch all document chunks for secret prompts (use full context)
//       const allChunks = await FileChunkModel.getChunksByFileId(file_id);
//       if (!allChunks?.length) {
//         return res.status(404).json({ error: "No document content found." });
//       }
      
//       usedChunkIds = allChunks.map(c => c.id);
//       const documentContent = allChunks.map(c => c.content).join('\n\n');

//       // Construct final prompt
//       let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
//       finalPrompt += `${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;

//       if (additional_input?.trim()) {
//         finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additional_input.trim()}`;
//       }

//       console.log(`[chatWithDocument] Secret prompt length: ${finalPrompt.length}`);
      
//       // Call LLM with selected provider
//       answer = await askLLM(provider, finalPrompt);
      
//       storedQuestion = secretName; // Store secret name as question

//     } 
//     // ================================
//     // CASE 2: CUSTOM QUERY HANDLING
//     // ================================
//     else {
//       if (!question?.trim()) {
//         return res.status(400).json({ error: "question is required for custom queries." });
//       }

//       console.log(`[chatWithDocument] Handling custom query: "${question.substring(0, 50)}..."`);

//       // For custom queries, always use 'gemini' as the provider.
//       provider = 'gemini'; // Assign to the higher-scoped provider
//       console.log(`[chatWithDocument] Custom query using fixed provider: ${provider}`);

//       // Use vector search for relevant context (existing logic)
//       const questionEmbedding = await generateEmbedding(question);
//       const relevantChunks = await ChunkVectorModel.findNearestChunks(questionEmbedding, 5, file_id);
//       const relevantChunkContents = relevantChunks.map(chunk => chunk.content);
//       usedChunkIds = relevantChunks.map(chunk => chunk.chunk_id);

//       if (relevantChunkContents.length === 0) {
//         console.log(`[chatWithDocument] No relevant chunks, using full document`);
//         const allChunks = await FileChunkModel.getChunksByFileId(file_id);
//         const documentFullText = allChunks.map(c => c.content).join("\n\n");
//         answer = await askLLM(provider, question, documentFullText);
//       } else {
//         const context = relevantChunkContents.join("\n\n");
//         console.log(`[chatWithDocument] Using ${relevantChunkContents.length} relevant chunks`);
//         answer = await askLLM(provider, question, context);
//       }

//       storedQuestion = question; // Store actual question
//     }

//     if (!answer?.trim()) {
//       return res.status(500).json({ error: "Empty response from AI." });
//     }

//     console.log(`[chatWithDocument] Answer length: ${answer.length} characters`);

//     // Store chat in database
//     const savedChat = await FileChat.saveChat(
//       file_id,
//       userId,
//       storedQuestion,
//       answer,
//       finalSessionId,
//       usedChunkIds,
//       used_secret_prompt,
//       finalPromptLabel,      // prompt_label
//       used_secret_prompt ? secret_id : null  // secret_id (now passed to saveChat)
//     );

//     console.log(`[chatWithDocument] ✅ Chat saved with ID: ${savedChat.id}`);

//     // Increment usage
//     const { userUsage, userPlan, requestedResources } = req;
//     await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);

//     // Fetch full session history
//     const historyRows = await FileChat.getChatHistory(file_id, finalSessionId);
//     const history = historyRows.map(row => ({
//       id: row.id,
//       file_id: row.file_id,
//       session_id: row.session_id,
//       question: row.question,
//       answer: row.answer,
//       used_secret_prompt: row.used_secret_prompt || false,
//       prompt_label: row.prompt_label || null,
//       secret_id: row.secret_id || null,
//       used_chunk_ids: row.used_chunk_ids || [],
//       confidence: row.confidence || 0.8,
//       timestamp: row.created_at || row.timestamp,
//       display_text_left_panel: row.used_secret_prompt 
//         ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
//         : row.question
//     }));

//     return res.json({
//       success: true,
//       session_id: finalSessionId,
//       message_id: savedChat.id,
//       answer,
//       response: answer,
//       history,
//       used_chunk_ids: usedChunkIds,
//       confidence: used_secret_prompt ? 0.9 : 0.85, // Higher confidence for secret prompts
//       timestamp: savedChat.created_at || new Date().toISOString(),
//       llm_provider: provider, // Include which LLM was used
//       used_secret_prompt: used_secret_prompt
//     });

//   } catch (error) {
//     console.error("❌ Error in chatWithDocument:", error);
//     console.error("Stack trace:", error.stack);
//     return res.status(500).json({ 
//       error: "Failed to get AI answer.", 
//       details: error.message 
//     });
//   }
// };
// /**
//  * @description Saves edited HTML content of a document by converting it to DOCX and PDF, then uploading to GCS.
//  * @route POST /api/doc/save
//  */
// exports.saveEditedDocument = async (req, res) => {
//   try {
//     const { file_id, edited_html } = req.body;
//     if (!file_id || typeof edited_html !== "string") {
//       return res
//         .status(400)
//         .json({ error: "file_id and edited_html are required." });
//     }

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file || file.user_id !== req.user.id) {
//       return res
//         .status(403)
//         .json({ error: "Access denied or file not found." });
//     }

//     const docxBuffer = await convertHtmlToDocx(edited_html);
//     const pdfBuffer = await convertHtmlToPdf(edited_html);

//     const { gsUri: docxUrl } = await uploadToGCS(
//       `edited_${file_id}.docx`,
//       docxBuffer,
//       "edited",
//       false,
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//     );
//     const { gsUri: pdfUrl } = await uploadToGCS(
//       `edited_${file_id}.pdf`,
//       pdfBuffer,
//       "edited",
//       false,
//       "application/pdf"
//     );

//     await DocumentModel.saveEditedVersions(file_id, docxUrl, pdfUrl);

//     return res.json({ docx_download_url: docxUrl, pdf_download_url: pdfUrl });
//   } catch (error) {
//     console.error("❌ saveEditedDocument error:", error);
//     return res.status(500).json({ error: "Failed to save edited document." });
//   }
// };

// /**
//  * @description Generates a signed URL to download a specific format (DOCX or PDF) of an edited document.
//  * @route GET /api/doc/download/:file_id/:format
//  */
// exports.downloadDocument = async (req, res) => {
//   try {
//     const { file_id, format } = req.params;
//     if (!file_id || !format)
//       return res
//         .status(400)
//         .json({ error: "file_id and format are required." });
//     if (!["docx", "pdf"].includes(format))
//       return res
//         .status(400)
//         .json({ error: "Invalid format. Use docx or pdf." });

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: "File not found." });
//     if (file.user_id !== req.user.id)
//       return res.status(403).json({ error: "Access denied" });

//     const targetUrl =
//       format === "docx" ? file.edited_docx_path : file.edited_pdf_path;
//     if (!targetUrl)
//       return res
//         .status(404)
//         .json({ error: "File not found or not yet generated" });

//     const gcsKey = normalizeGcsKey(targetUrl, process.env.GCS_BUCKET);
//     if (!gcsKey)
//       return res.status(500).json({ error: "Invalid GCS path for the file." });

//     const signedUrl = await getSignedUrl(gcsKey);
//     return res.redirect(signedUrl);
//   } catch (error) {
//     console.error("❌ Error generating signed URL:", error);
//     return res
//       .status(500)
//       .json({ error: "Failed to generate signed download link" });
//   }
// };

// /**
//  * @description Retrieves the chat history for a specific document.
//  * @route GET /api/doc/chat-history/:file_id
//  */
// exports.getChatHistory = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // ✅ Fetch all chats for this user (grouped by session)
//     const chats = await FileChat.getChatHistoryByUserId(userId);

//     if (!chats || chats.length === 0) {
//       return res.status(404).json({ error: "No chat history found for this user." });
//     }

//     // ✅ Group chats by session_id for better organization
//     const sessions = chats.reduce((acc, chat) => {
//       if (!acc[chat.session_id]) {
//         acc[chat.session_id] = {
//           session_id: chat.session_id,
//           file_id: chat.file_id,
//           user_id: chat.user_id,
//           messages: []
//         };
//       }

//       acc[chat.session_id].messages.push({
//         id: chat.id,
//         question: chat.question,
//         answer: chat.answer,
//         used_chunk_ids: chat.used_chunk_ids,
//         used_secret_prompt: chat.used_secret_prompt,
//         prompt_label: chat.prompt_label,
//         created_at: chat.created_at
//       });

//       return acc;
//     }, {});

//     return res.json(Object.values(sessions));
//   } catch (error) {
//     console.error("❌ getChatHistory error:", error);
//     return res.status(500).json({ error: "Failed to fetch chat history." });
//   }
// };



// exports.getDocumentProcessingStatus = async (req, res) => {
//   try {
//     const { file_id } = req.params;
//     if (!file_id) {
//       return res.status(400).json({ error: "file_id is required." });
//     }

//     console.log(`[getDocumentProcessingStatus] Received request for file_id: ${file_id}`);

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file || String(file.user_id) !== String(req.user.id)) {
//       return res.status(403).json({ error: "Access denied or file not found." });
//     }

//     const job = await ProcessingJobModel.getJobByFileId(file_id);

//     // If already processed
//     if (file.status === "processed") {
//       const existingChunks = await FileChunkModel.getChunksByFileId(file_id);
//       return res.json({
//         document_id: file.id,
//         status: file.status,
//         processing_progress: file.processing_progress,
//         job_status: job ? job.status : "completed",
//         job_error: job ? job.error_message : null,
//         last_updated: file.updated_at,
//         chunks: existingChunks,
//         summary: file.summary,
//       });
//     }

//     // No job yet
//     if (!job || !job.document_ai_operation_name) {
//       return res.json({
//         document_id: file.id,
//         status: file.status,
//         processing_progress: file.processing_progress,
//         job_status: "not_queued",
//         job_error: null,
//         last_updated: file.updated_at,
//         chunks: [],
//         summary: file.summary,
//       });
//     }

//     console.log(`[getDocumentProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
//     const status = await getOperationStatus(job.document_ai_operation_name);
//     console.log(`[getDocumentProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

//     // If still running
//     if (!status.done) {
//       return res.json({
//         file_id: file.id,
//         status: "batch_processing",
//         processing_progress: file.processing_progress,
//         job_status: "running",
//         job_error: null,
//         last_updated: file.updated_at,
//       });
//     }

//     // If failed
//     if (status.error) {
//       await DocumentModel.updateFileStatus(file_id, "error", 0.0);
//       await ProcessingJobModel.updateJobStatus(job.id, "failed", status.error.message);
//       return res.status(500).json({
//         file_id: file.id,
//         status: "error",
//         processing_progress: 0.0,
//         job_status: "failed",
//         job_error: status.error.message,
//         last_updated: new Date().toISOString(),
//       });
//     }

//     // Fetch processed text
//     const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
//     const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
//     const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
//     console.log(`[getDocumentProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);

//     await DocumentModel.updateFileStatus(file_id, "processing", 75.0);

//     // ✅ Fetch chunking method via secret_manager → chunking_methods
//     let batchChunkingMethod = "recursive";
//     try {
//       const chunkMethodQuery = `
//         SELECT cm.method_name
//         FROM processing_jobs pj
//         LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
//         LEFT JOIN chunking_methods cm ON sm.chunking_method_id = cm.id
//         WHERE pj.file_id = $1
//         ORDER BY pj.created_at DESC
//         LIMIT 1;
//       `;
//       const result = await db.query(chunkMethodQuery, [file_id]);

//       if (result.rows.length > 0) {
//         batchChunkingMethod = result.rows[0].method_name;
//         console.log(`[getDocumentProcessingStatus] ✅ Using chunking method from DB: ${batchChunkingMethod}`);
//       } else {
//         console.log(`[getDocumentProcessingStatus] No secret_id found for file ${file_id}, using default chunking method.`);
//       }
//     } catch (err) {
//       console.error(`[getDocumentProcessingStatus] Error fetching chunking method: ${err.message}`);
//       console.log(`[getDocumentProcessingStatus] Falling back to default chunking method: recursive`);
//     }

//     // ✅ Chunking
//     console.log(`[getDocumentProcessingStatus] Starting chunking for file ID ${file_id} using method: ${batchChunkingMethod}`);
//     const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);

//     // Save chunks and vectors
//     const chunkContents = chunks.map(c => c.content);
//     const embeddings = await generateEmbeddings(chunkContents);

//     const chunksToSave = chunks.map((chunk, i) => ({
//       file_id,
//       chunk_index: i,
//       content: chunk.content,
//       token_count: chunk.token_count,
//       page_start: chunk.metadata.page_start,
//       page_end: chunk.metadata.page_end,
//       heading: chunk.metadata.heading,
//     }));

//     await FileChunkModel.saveMultipleChunks(chunksToSave);

//     const savedChunks = await FileChunkModel.getChunksByFileId(file_id);
//     const vectors = savedChunks.map((chunk, i) => ({
//       chunk_id: chunk.id,
//       embedding: embeddings[i],
//       file_id,
//     }));

//     await ChunkVectorModel.saveMultipleChunkVectors(vectors);

//     await DocumentModel.updateFileStatus(file_id, "processed", 100.0);
//     await ProcessingJobModel.updateJobStatus(job.id, "completed");

//     // Generate summary
//     const fullText = chunks.map(c => c.content).join("\n\n");
//     try {
//       const summary = await getSummaryFromChunks(fullText);
//       await DocumentModel.updateFileSummary(file_id, summary);
//     } catch (err) {
//       console.warn(`[getDocumentProcessingStatus] ⚠️ Summary generation failed: ${err.message}`);
//     }

//     // Return final response
//     const updatedFile = await DocumentModel.getFileById(file_id);
//     const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

//     return res.json({
//       document_id: updatedFile.id,
//       status: updatedFile.status,
//       processing_progress: updatedFile.processing_progress,
//       job_status: "completed",
//       job_error: null,
//       last_updated: updatedFile.updated_at,
//       chunks: finalChunks,
//       summary: updatedFile.summary,
//       chunking_method: batchChunkingMethod,
//     });

//   } catch (error) {
//     console.error("❌ getDocumentProcessingStatus error:", error);
//     return res.status(500).json({
//       error: "Failed to fetch processing status.",
//       details: error.message,
//     });
//   }
// };

// exports.batchUploadDocuments = async (req, res) => {
//   const userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     console.log(`[batchUploadDocuments] Received batch upload request.`);
//     const { secret_id, llm_name, trigger_initial_analysis_with_secret } = req.body; // Destructure trigger_initial_analysis_with_secret
//     console.log(`[batchUploadDocuments] Received secret_id: ${secret_id}, llm_name: ${llm_name}, trigger_initial_analysis_with_secret: ${trigger_initial_analysis_with_secret}`);

//     if (!userId) return res.status(401).json({ error: "Unauthorized" });
//     if (!req.files || req.files.length === 0)
//       return res.status(400).json({ error: "No files uploaded." });

//     // --- Fetch user usage and plan ---
//     let usageAndPlan;
//     try {
//       usageAndPlan = await TokenUsageService.getUserUsageAndPlan(
//         userId,
//         authorizationHeader
//       );
//     } catch (planError) {
//       console.error(`❌ Failed to retrieve user plan for user ${userId}:`, planError.message);
//       return res.status(500).json({
//         success: false,
//         message: "Failed to retrieve user plan. Please ensure the user plan service is accessible.",
//         details: planError.message,
//       });
//     }

//     const { usage: userUsage, plan: userPlan } = usageAndPlan;

//     // --- Calculate requested resources for this batch ---
//     // For simplicity, assume each document uses 1 document slot and a fixed number of tokens (adjust as needed)
//     const requestedResources = {
//       tokens: req.files.length * 100, // Example: each file consumes 100 tokens
//       documents: req.files.length,
//       ai_analysis: req.files.length,
//       storage_gb: req.files.reduce((acc, f) => acc + f.size / (1024 ** 3), 0), // convert bytes to GB
//     };

//     // --- Enforce limits ---
//     const limitCheck = await TokenUsageService.enforceLimits(
//       userId,
//       userUsage,
//       userPlan,
//       requestedResources
//     );

//     if (!limitCheck.allowed) {
//       return res.status(403).json({
//         success: false,
//         message: limitCheck.message,
//         nextRenewalTime: limitCheck.nextRenewalTime,
//         remainingTime: limitCheck.remainingTime,
//       });
//     }

//     const uploadedFiles = [];
//     for (const file of req.files) {
//       try {
//         const originalFilename = file.originalname;
//         const mimeType = file.mimetype;

//         const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
//         const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
//           originalFilename,
//           file.buffer,
//           batchUploadFolder,
//           true,
//           mimeType
//         );

//         const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
//         const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;

//         // Start DocAI Batch Operation
//         const operationName = await batchProcessDocument(
//           [gcsInputUri],
//           gcsOutputUriPrefix,
//           mimeType
//         );

//         // Save file metadata
//         const fileId = await DocumentModel.saveFileMetadata(
//           userId,
//           originalFilename,
//           gcsInputUri,
//           folderPath,
//           mimeType,
//           file.size,
//           "batch_queued"
//         );

//         // Create job entry
//         const jobId = uuidv4();
//         await ProcessingJobModel.createJob({
//           job_id: jobId,
//           file_id: fileId,
//           type: "batch",
//           gcs_input_uri: gcsInputUri,
//           gcs_output_uri_prefix: gcsOutputUriPrefix,
//           document_ai_operation_name: operationName,
//           status: "queued",
//           secret_id: secret_id || null, // Pass secret_id from request body
//         });

//         await DocumentModel.updateFileStatus(fileId, "batch_processing", 0.0);

//         uploadedFiles.push({
//           file_id: fileId,
//           job_id: jobId,
//           filename: originalFilename,
//           operation_name: operationName,
//           gcs_input_uri: gcsInputUri,
//           gcs_output_uri_prefix: gcsOutputUriPrefix,
//         });
//       } catch (innerError) {
//         console.error(`❌ Error processing ${file.originalname}:`, innerError);
//         uploadedFiles.push({
//           filename: file.originalname,
//           error: innerError.message,
//         });
//       }
//     }

//     // --- Increment usage after successful upload(s) ---
//     try {
//       await TokenUsageService.incrementUsage(
//         userId,
//         requestedResources,
//         userPlan
//       );
//     } catch (usageError) {
//       console.error(`❌ Error incrementing token usage for user ${userId}:`, usageError);
//     }

//     return res.status(202).json({
//       success: true,
//       message: "Batch document upload successful; processing initiated.",
//       uploaded_files: uploadedFiles,
//     });
//   } catch (error) {
//     console.error("❌ Batch Upload Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to initiate batch processing",
//       details: error.message,
//     });
//   }
// };

// /**
//  * @description Retrieves the total storage utilization for the authenticated user.
//  * @route GET /api/doc/user-storage-utilization
//  */
// exports.getUserStorageUtilization = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     if (!userId) {
//       return res.status(401).json({ message: 'Unauthorized' });
//     }

//     const totalStorageUsedBytes = await File.getTotalStorageUsed(userId);
//     const totalStorageUsedGB = (totalStorageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);

//     res.status(200).json({
//       storage: {
//         used_bytes: totalStorageUsedBytes,
//         used_gb: totalStorageUsedGB,
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error fetching user storage utilization:', error);
//     res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };

// /**
//  * @description Retrieves user's current usage and plan details from the Document Service.
//  * This endpoint is intended to be called by the Payment Service.
//  * @route GET /api/doc/user-usage-and-plan/:userId
//  */
// exports.getUserUsageAndPlan = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const authorizationHeader = req.headers.authorization; // Pass through auth header

//     if (!userId) {
//       return res.status(400).json({ error: "User ID is required." });
//     }

//     // Call the TokenUsageService to get the combined usage and plan data
//     const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

//     return res.status(200).json({
//       success: true,
//       data: {
//         usage,
//         plan,
//         timeLeft
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error fetching user usage and plan:', error);
//     res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };

// // Export processDocument for use in other modules (e.g., documentRoutes)
// exports.processDocument = processDocument;





const db = require("../config/db");
const axios = require("axios"); // Import axios
const DocumentModel = require("../models/documentModel");
const File = require("../models/File"); // Import the File model
const FileChunkModel = require("../models/FileChunk");
const ChunkVectorModel = require("../models/ChunkVector");
const ProcessingJobModel = require("../models/ProcessingJob");
const FileChat = require("../models/FileChat");
const secretManagerController = require("./secretManagerController"); // NEW: Import secretManagerController
const { getSecretDetailsById } = require('../controllers/secretManagerController');
const { validate: isUuid } = require("uuid");
const { uploadToGCS, getSignedUrl } = require("../services/gcsService");
const {
 convertHtmlToDocx,
 convertHtmlToPdf,
} = require("../services/conversionService");
const {
 askGemini,
 analyzeWithGemini,
 getSummaryFromChunks,
 askLLM,
 resolveProviderName, // Add resolveProviderName here
} = require("../services/aiService");
const { extractText } = require("../utils/textExtractor");
const {
 extractTextFromDocument,
 batchProcessDocument,
 getOperationStatus,
 fetchBatchResults,
} = require("../services/documentAiService");
const { chunkDocument } = require("../services/chunkingService");
const {
 generateEmbedding,
 generateEmbeddings,
} = require("../services/embeddingService");
const { normalizeGcsKey } = require("../utils/gcsKey");
const TokenUsageService = require("../services/tokenUsageService");
const { fileInputBucket, fileOutputBucket } = require("../config/gcs");
const { checkStorageLimit } = require("../utils/storage"); // Import checkStorageLimit
const { DOCUMENT_UPLOAD_COST_TOKENS } = require("../middleware/checkTokenLimits");

const { v4: uuidv4 } = require("uuid");

/**
 * @description Uploads a document, saves its metadata, and initiates asynchronous processing.
 * @route POST /api/doc/upload
 */
exports.uploadDocument = async (req, res) => {
 const userId = req.user.id;
 const authorizationHeader = req.headers.authorization;

 try {
 if (!userId) return res.status(401).json({ error: "Unauthorized" });
 if (!req.file) return res.status(400).json({ error: "No file uploaded." });

 const { originalname, mimetype, buffer, size } = req.file;
 const { secret_id } = req.body; // NEW: Get secret_id from request body

 // Check storage limits
 // Fetch user usage and plan
 const { usage: userUsage, plan: userPlan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

 // Check storage limits
 const storageLimitCheck = await checkStorageLimit(userId, size, userPlan);
 if (!storageLimitCheck.allowed) {
 return res.status(403).json({ error: storageLimitCheck.message });
 }

 // Calculate requested resources for this upload
 const requestedResources = {
 tokens: DOCUMENT_UPLOAD_COST_TOKENS,
 documents: 1,
 ai_analysis: 1,
 storage_gb: size / (1024 ** 3), // convert bytes to GB
 };

 // Enforce limits
 const limitCheck = await TokenUsageService.enforceLimits(
 userId,
 userUsage,
 userPlan,
 requestedResources
 );

 if (!limitCheck.allowed) {
 return res.status(403).json({
 success: false,
 message: limitCheck.message,
 nextRenewalTime: limitCheck.nextRenewalTime,
 remainingTime: limitCheck.remainingTime,
 });
 }

 const folderPath = `uploads/${userId}`;
 const { gsUri } = await uploadToGCS(originalname, buffer, folderPath, true, mimetype);

 const fileId = await DocumentModel.saveFileMetadata(
 userId,
 originalname,
 gsUri,
 folderPath,
 mimetype,
 size,
 "uploaded"
 );

 // Increment usage after successful upload
 await TokenUsageService.incrementUsage(userId, requestedResources, userPlan);

 // Asynchronously process the document
 processDocument(fileId, buffer, mimetype, userId, secret_id); // NEW: Pass secret_id to processDocument

 res.status(202).json({
 message: "Document uploaded and processing initiated.",
 file_id: fileId,
 gs_uri: gsUri,
 });
 } catch (error) {
 console.error("❌ uploadDocument error:", error);
 res.status(500).json({ error: "Failed to upload document." });
 }
};


/**
 * @description Asynchronously processes a document by extracting text, chunking, generating embeddings, and summarizing.
 * Dynamically fetches chunking method from DB if a secret_id is provided.
 */
// async function processDocument(fileId, fileBuffer, mimetype, userId, secretId = null) {
// const jobId = uuidv4();
// await ProcessingJobModel.createJob({
// job_id: jobId,
// file_id: fileId,
// type: "synchronous",
// document_ai_operation_name: null,
// status: "queued",
// secret_id: secretId, // Pass secretId to the job
// });

// await DocumentModel.updateFileStatus(fileId, "processing", 0.0);

// let chunkingMethod = "recursive"; // Default fallback

// try {
// // ✅ Step 1: Determine chunking method dynamically
// if (secretId) {
// console.log(`[processDocument] Fetching chunking method for secret ID: ${secretId}`);
// const secretQuery = `
// SELECT chunking_method
// FROM secret_manager
// WHERE id = $1
// `;
// const result = await db.query(secretQuery, [secretId]);
// if (result.rows.length > 0 && result.rows[0].chunking_method) {
// chunkingMethod = result.rows[0].chunking_method;
// console.log(`[processDocument] Using chunking method from DB: ${chunkingMethod}`);
// } else {
// console.warn(`[processDocument] No custom chunking method found for secret ID: ${secretId}. Using default: ${chunkingMethod}`);
// }
// } else {
// console.log(`[processDocument] No secret_id provided. Using default chunking method: ${chunkingMethod}`);
// }

// // ✅ Step 2: Check if document is already processed
// const file = await DocumentModel.getFileById(fileId);
// if (file.status === "processed") {
// console.log(`[processDocument] File ${fileId} already processed. Skipping re-processing.`);
// await ProcessingJobModel.updateJobStatus(jobId, "completed");
// return;
// }

// // ✅ Step 3: Extract text from document (OCR or direct)
// let extractedTexts = [];
// const ocrMimeTypes = [
// "application/pdf", "image/png", "image/jpeg", "image/tiff",
// "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
// "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
// "text/plain", "text/csv",
// ];

// const useOCR = ocrMimeTypes.includes(String(mimetype).toLowerCase());
// if (useOCR) {
// console.log(`[processDocument] Using Document AI OCR for file ID ${fileId}`);
// extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
// } else {
// console.log(`[processDocument] Using standard text extraction for file ID ${fileId}`);
// const text = await extractText(fileBuffer, mimetype);
// extractedTexts.push({ text });
// }

// if (!extractedTexts.length || extractedTexts.every(item => !item.text || item.text.trim() === "")) {
// throw new Error("No meaningful text extracted from document.");
// }

// await DocumentModel.updateFileStatus(fileId, "processing", 25.0);

// // ✅ Step 4: Chunk document using selected chunking method
// console.log(`[processDocument] Chunking file ID ${fileId} using method: ${chunkingMethod}`);
// const chunks = await chunkDocument(extractedTexts, fileId, chunkingMethod);
// console.log(`[processDocument] Generated ${chunks.length} chunks using ${chunkingMethod} method.`);
// await DocumentModel.updateFileStatus(fileId, "processing", 50.0);

// if (!chunks.length) {
// console.warn(`[processDocument] No chunks generated. Marking as processed.`);
// await DocumentModel.updateFileProcessedAt(fileId);
// await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
// await ProcessingJobModel.updateJobStatus(jobId, "completed");
// return;
// }

// // ✅ Step 5: Generate embeddings
// console.log(`[processDocument] Generating embeddings for ${chunks.length} chunks...`);
// const chunkContents = chunks.map(c => c.content);
// const embeddings = await generateEmbeddings(chunkContents);

// if (chunks.length !== embeddings.length) {
// throw new Error("Mismatch between number of chunks and embeddings generated.");
// }

// // ✅ Step 6: Save chunks and embeddings
// const chunksToSave = chunks.map((chunk, i) => ({
// file_id: fileId,
// chunk_index: i,
// content: chunk.content,
// token_count: chunk.token_count,
// page_start: chunk.metadata.page_start,
// page_end: chunk.metadata.page_end,
// heading: chunk.metadata.heading,
// }));

// const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);
// console.log(`[processDocument] Saved ${savedChunks.length} chunks to database.`);

// const vectorsToSave = savedChunks.map((savedChunk, i) => ({
// chunk_id: savedChunk.id,
// embedding: embeddings[i],
// file_id: fileId,
// }));

// await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);
// await DocumentModel.updateFileStatus(fileId, "processing", 75.0);

// // ✅ Step 7: Generate summary
// try {
// const fullText = chunks.map(c => c.content).join("\n\n");
// if (fullText.trim()) {
// const summary = await getSummaryFromChunks(fullText);
// await DocumentModel.updateFileSummary(fileId, summary);
// console.log(`[processDocument] Summary generated for file ID ${fileId}`);
// }
// } catch (summaryError) {
// console.warn(`[processDocument] Summary generation failed: ${summaryError.message}`);
// }

// // ✅ Step 8: Finalize status
// await DocumentModel.updateFileProcessedAt(fileId);
// await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
// await ProcessingJobModel.updateJobStatus(jobId, "completed");

// console.log(`✅ Document ID ${fileId} fully processed using '${chunkingMethod}' method.`);
// } catch (error) {
// console.error(`❌ processDocument failed for file ID ${fileId}:`, error);
// await DocumentModel.updateFileStatus(fileId, "error", 0.0);
// await ProcessingJobModel.updateJobStatus(jobId, "failed", error.message);
// }
// }

// Add this helper function at the top of your controller
// const updateProcessingProgress = async (fileId, status, progress, currentOperation) => {
//  await DocumentModel.updateFileStatus(fileId, status, progress);
//  await DocumentModel.updateCurrentOperation(fileId, currentOperation);
//  console.log(`[Progress] File ${fileId}: ${currentOperation} - ${progress}%`);
// };

// /**
//  * @description Asynchronously processes a document with granular real-time progress tracking
//  */
// async function processDocument(fileId, fileBuffer, mimetype, userId, secretId = null) {
//  const jobId = uuidv4();
 
//  try {
//  // Initialize job
//  await ProcessingJobModel.createJob({
//  job_id: jobId,
//  file_id: fileId,
//  type: "synchronous",
//  document_ai_operation_name: null,
//  status: "queued",
//  secret_id: secretId,
//  });

//  // Step 1: Starting (5%)
//  await updateProcessingProgress(fileId, "processing", 5.0, "Initializing document processing");

//  let chunkingMethod = "recursive";

//  // Step 2: Fetch chunking method (10%)
//  if (secretId) {
//  await updateProcessingProgress(fileId, "processing", 10.0, "Fetching processing configuration");
//  console.log(`[processDocument] Fetching chunking method for secret ID: ${secretId}`);
//  const secretQuery = `
//  SELECT chunking_method
//  FROM secret_manager
//  WHERE id = $1
//  `;
//  const result = await db.query(secretQuery, [secretId]);
//  if (result.rows.length > 0 && result.rows[0].chunking_method) {
//  chunkingMethod = result.rows[0].chunking_method;
//  console.log(`[processDocument] Using chunking method from DB: ${chunkingMethod}`);
//  }
//  } else {
//  await updateProcessingProgress(fileId, "processing", 10.0, "Using default configuration");
//  }

//  // Step 3: Check if already processed (15%)
//  await updateProcessingProgress(fileId, "processing", 15.0, "Checking document status");
//  const file = await DocumentModel.getFileById(fileId);
//  if (file.status === "processed") {
//  console.log(`[processDocument] File ${fileId} already processed. Skipping.`);
//  await ProcessingJobModel.updateJobStatus(jobId, "completed");
//  await updateProcessingProgress(fileId, "processed", 100.0, "Already processed");
//  return;
//  }

//  // Step 4: Text Extraction (15% - 40%)
//  await updateProcessingProgress(fileId, "processing", 20.0, "Extracting text from document");
 
//  let extractedTexts = [];
//  const ocrMimeTypes = [
//  "application/pdf", "image/png", "image/jpeg", "image/tiff",
//  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
//  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//  "text/plain", "text/csv",
//  ];

//  const useOCR = ocrMimeTypes.includes(String(mimetype).toLowerCase());
 
//  if (useOCR) {
//  console.log(`[processDocument] Using Document AI OCR for file ID ${fileId}`);
//  await updateProcessingProgress(fileId, "processing", 25.0, "Processing with OCR (this may take a moment)");
//  extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
//  await updateProcessingProgress(fileId, "processing", 40.0, "Text extraction completed");
//  } else {
//  console.log(`[processDocument] Using standard text extraction for file ID ${fileId}`);
//  await updateProcessingProgress(fileId, "processing", 30.0, "Extracting text content");
//  const text = await extractText(fileBuffer, mimetype);
//  extractedTexts.push({ text });
//  await updateProcessingProgress(fileId, "processing", 40.0, "Text extraction completed");
//  }

//  if (!extractedTexts.length || extractedTexts.every(item => !item.text || item.text.trim() === "")) {
//  throw new Error("No meaningful text extracted from document.");
//  }

//  // Step 5: Chunking (40% - 55%)
//  await updateProcessingProgress(fileId, "processing", 45.0, `Chunking document using ${chunkingMethod} method`);
//  console.log(`[processDocument] Chunking file ID ${fileId} using method: ${chunkingMethod}`);
//  const chunks = await chunkDocument(extractedTexts, fileId, chunkingMethod);
//  console.log(`[processDocument] Generated ${chunks.length} chunks using ${chunkingMethod} method.`);
//  await updateProcessingProgress(fileId, "processing", 55.0, `Created ${chunks.length} chunks`);

//  if (!chunks.length) {
//  console.warn(`[processDocument] No chunks generated. Marking as processed.`);
//  await DocumentModel.updateFileProcessedAt(fileId);
//  await updateProcessingProgress(fileId, "processed", 100.0, "Processing completed (no content to chunk)");
//  await ProcessingJobModel.updateJobStatus(jobId, "completed");
//  return;
//  }

//  // Step 6: Generate Embeddings (55% - 75%)
//  await updateProcessingProgress(fileId, "processing", 60.0, `Generating embeddings for ${chunks.length} chunks`);
//  console.log(`[processDocument] Generating embeddings for ${chunks.length} chunks...`);
//  const chunkContents = chunks.map(c => c.content);
//  const embeddings = await generateEmbeddings(chunkContents);
//  await updateProcessingProgress(fileId, "processing", 75.0, "Embeddings generated successfully");

//  if (chunks.length !== embeddings.length) {
//  throw new Error("Mismatch between number of chunks and embeddings generated.");
//  }

//  // Step 7: Save to Database (75% - 85%)
//  await updateProcessingProgress(fileId, "processing", 78.0, "Saving chunks to database");
//  const chunksToSave = chunks.map((chunk, i) => ({
//  file_id: fileId,
//  chunk_index: i,
//  content: chunk.content,
//  token_count: chunk.token_count,
//  page_start: chunk.metadata.page_start,
//  page_end: chunk.metadata.page_end,
//  heading: chunk.metadata.heading,
//  }));

//  const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);
//  console.log(`[processDocument] Saved ${savedChunks.length} chunks to database.`);
//  await updateProcessingProgress(fileId, "processing", 82.0, "Chunks saved successfully");

//  await updateProcessingProgress(fileId, "processing", 84.0, "Storing vector embeddings");
//  const vectorsToSave = savedChunks.map((savedChunk, i) => ({
//  chunk_id: savedChunk.id,
//  embedding: embeddings[i],
//  file_id: fileId,
//  }));

//  await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);
//  await updateProcessingProgress(fileId, "processing", 85.0, "Vector embeddings stored");

//  // Step 8: Generate Summary (85% - 95%)
//  await updateProcessingProgress(fileId, "processing", 88.0, "Generating document summary");
//  try {
//  const fullText = chunks.map(c => c.content).join("\n\n");
//  if (fullText.trim()) {
//  const summary = await getSummaryFromChunks(fullText);
//  await DocumentModel.updateFileSummary(fileId, summary);
//  await updateProcessingProgress(fileId, "processing", 95.0, "Summary generated successfully");
//  console.log(`[processDocument] Summary generated for file ID ${fileId}`);
//  }
//  } catch (summaryError) {
//  console.warn(`[processDocument] Summary generation failed: ${summaryError.message}`);
//  await updateProcessingProgress(fileId, "processing", 95.0, "Summary generation skipped");
//  }

//  // Step 9: Finalization (95% - 100%)
//  await updateProcessingProgress(fileId, "processing", 98.0, "Finalizing document processing");
//  await DocumentModel.updateFileProcessedAt(fileId);
//  await updateProcessingProgress(fileId, "processed", 100.0, "Document processing completed");
//  await ProcessingJobModel.updateJobStatus(jobId, "completed");

//  console.log(`✅ Document ID ${fileId} fully processed using '${chunkingMethod}' method.`);
//  } catch (error) {
//  console.error(`❌ processDocument failed for file ID ${fileId}:`, error);
//  await updateProcessingProgress(fileId, "error", 0.0, `Error: ${error.message}`);
//  await ProcessingJobModel.updateJobStatus(jobId, "failed", error.message);
//  }
// }

const updateProcessingProgress = async (
 fileId,
 status,
 progress,
 currentOperation
) => {
 await DocumentModel.updateFileStatus(fileId, status, progress);
 await DocumentModel.updateCurrentOperation(fileId, currentOperation);
 console.log(`[Progress] File ${fileId}: ${currentOperation} - ${progress}%`);
};

/**
 * @description Asynchronously processes a document with granular real-time progress tracking
 */
async function processDocument(
 fileId,
 fileBuffer,
 mimetype,
 userId,
 secretId = null
) {
 const jobId = uuidv4();

 try {
 // Step 1: Initialize job (0-2%)
 await updateProcessingProgress(
 fileId,
 "processing",
 0.0,
 "Starting document processing"
 );

 await ProcessingJobModel.createJob({
 job_id: jobId,
 file_id: fileId,
 type: "synchronous",
 document_ai_operation_name: null,
 status: "queued",
 secret_id: secretId,
 });

 await updateProcessingProgress(
 fileId,
 "processing",
 2.0,
 "Processing job created"
 );

 // Step 2: Initialize processing (2-5%)
 await updateProcessingProgress(
 fileId,
 "processing",
 3.0,
 "Initializing document processor"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 5.0,
 "Initialization complete"
 );

 let chunkingMethod = "recursive";

 // Step 3: Fetch chunking method (5-12%)
 if (secretId) {
 await updateProcessingProgress(
 fileId,
 "processing",
 7.0,
 "Fetching processing configuration from database"
 );

 console.log(
 `[processDocument] Fetching chunking method for secret ID: ${secretId}`
 );

 const secretQuery = `
 SELECT chunking_method
 FROM secret_manager
 WHERE id = $1
 `;
 const result = await db.query(secretQuery, [secretId]);

 if (result.rows.length > 0 && result.rows[0].chunking_method) {
 chunkingMethod = result.rows[0].chunking_method;
 console.log(
 `[processDocument] Using chunking method from DB: ${chunkingMethod}`
 );
 await updateProcessingProgress(
 fileId,
 "processing",
 10.0,
 `Configuration loaded: ${chunkingMethod} chunking`
 );
 }
 } else {
 await updateProcessingProgress(
 fileId,
 "processing",
 10.0,
 "Using default configuration (recursive chunking)"
 );
 }

 await updateProcessingProgress(
 fileId,
 "processing",
 12.0,
 "Configuration ready"
 );

 // Step 4: Check if already processed (12-15%)
 await updateProcessingProgress(
 fileId,
 "processing",
 13.0,
 "Checking document processing status"
 );

 const file = await DocumentModel.getFileById(fileId);

 if (file.status === "processed") {
 console.log(
 `[processDocument] File ${fileId} already processed. Skipping.`
 );
 await ProcessingJobModel.updateJobStatus(jobId, "completed");
 await updateProcessingProgress(
 fileId,
 "processed",
 100.0,
 "Already processed"
 );
 return;
 }

 await updateProcessingProgress(
 fileId,
 "processing",
 15.0,
 "Document ready for processing"
 );

 // Step 5: Prepare for text extraction (15-18%)
 await updateProcessingProgress(
 fileId,
 "processing",
 16.0,
 "Analyzing document format"
 );

 let extractedTexts = [];
 const ocrMimeTypes = [
 "application/pdf",
 "image/png",
 "image/jpeg",
 "image/tiff",
 "application/msword",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/vnd.ms-powerpoint",
 "application/vnd.openxmlformats-officedocument.presentationml.presentation",
 "application/vnd.ms-excel",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
 "text/plain",
 "text/csv",
 ];

 const useOCR = ocrMimeTypes.includes(String(mimetype).toLowerCase());

 await updateProcessingProgress(
 fileId,
 "processing",
 18.0,
 useOCR ? "Document requires OCR processing" : "Document is text-extractable"
 );

 // Step 6: Text Extraction (18-42%)
 if (useOCR) {
 console.log(
 `[processDocument] Using Document AI OCR for file ID ${fileId}`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 20.0,
 "Preparing document for OCR"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 22.0,
 "Sending document to OCR engine"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 25.0,
 "OCR processing started (this may take a moment)"
 );

 extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);

 await updateProcessingProgress(
 fileId,
 "processing",
 38.0,
 "OCR processing completed"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 42.0,
 "Text extraction successful"
 );
 } else {
 console.log(
 `[processDocument] Using standard text extraction for file ID ${fileId}`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 22.0,
 "Starting text extraction"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 28.0,
 "Extracting text content from document"
 );

 const text = await extractText(fileBuffer, mimetype);
 extractedTexts.push({ text });

 await updateProcessingProgress(
 fileId,
 "processing",
 38.0,
 "Text extracted successfully"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 42.0,
 "Text extraction completed"
 );
 }

 // Step 7: Validate extracted text (42-45%)
 await updateProcessingProgress(
 fileId,
 "processing",
 43.0,
 "Validating extracted text"
 );

 if (
 !extractedTexts.length ||
 extractedTexts.every((item) => !item.text || item.text.trim() === "")
 ) {
 throw new Error("No meaningful text extracted from document.");
 }

 await updateProcessingProgress(
 fileId,
 "processing",
 45.0,
 "Text validation completed"
 );

 // Step 8: Prepare for chunking (45-48%)
 await updateProcessingProgress(
 fileId,
 "processing",
 46.0,
 `Preparing to chunk document using ${chunkingMethod} method`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 48.0,
 "Analyzing document structure for optimal chunking"
 );

 // Step 9: Chunking (48-58%)
 console.log(
 `[processDocument] Chunking file ID ${fileId} using method: ${chunkingMethod}`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 50.0,
 `Chunking document with ${chunkingMethod} strategy`
 );

 const chunks = await chunkDocument(extractedTexts, fileId, chunkingMethod);

 console.log(
 `[processDocument] Generated ${chunks.length} chunks using ${chunkingMethod} method.`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 56.0,
 `Generated ${chunks.length} chunks`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 58.0,
 `Chunking completed with ${chunks.length} segments`
 );

 if (!chunks.length) {
 console.warn(
 `[processDocument] No chunks generated. Marking as processed.`
 );
 await DocumentModel.updateFileProcessedAt(fileId);
 await updateProcessingProgress(
 fileId,
 "processed",
 100.0,
 "Processing completed (no content to chunk)"
 );
 await ProcessingJobModel.updateJobStatus(jobId, "completed");
 return;
 }

 // Step 10: Prepare embeddings (58-62%)
 await updateProcessingProgress(
 fileId,
 "processing",
 59.0,
 "Preparing chunks for embedding generation"
 );

 const chunkContents = chunks.map((c) => c.content);

 await updateProcessingProgress(
 fileId,
 "processing",
 62.0,
 `Ready to generate embeddings for ${chunks.length} chunks`
 );

 // Step 11: Generate Embeddings (62-76%)
 console.log(
 `[processDocument] Generating embeddings for ${chunks.length} chunks...`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 64.0,
 "Connecting to embedding service"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 66.0,
 `Processing embeddings for ${chunks.length} chunks`
 );

 const embeddings = await generateEmbeddings(chunkContents);

 await updateProcessingProgress(
 fileId,
 "processing",
 74.0,
 "All embeddings generated successfully"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 76.0,
 "Validating embeddings"
 );

 if (chunks.length !== embeddings.length) {
 throw new Error(
 "Mismatch between number of chunks and embeddings generated."
 );
 }

 // Step 12: Prepare database save (76-78%)
 await updateProcessingProgress(
 fileId,
 "processing",
 77.0,
 "Preparing data for database storage"
 );

 const chunksToSave = chunks.map((chunk, i) => ({
 file_id: fileId,
 chunk_index: i,
 content: chunk.content,
 token_count: chunk.token_count,
 page_start: chunk.metadata.page_start,
 page_end: chunk.metadata.page_end,
 heading: chunk.metadata.heading,
 }));

 await updateProcessingProgress(
 fileId,
 "processing",
 78.0,
 "Data prepared for storage"
 );

 // Step 13: Save chunks to database (78-82%)
 await updateProcessingProgress(
 fileId,
 "processing",
 79.0,
 "Saving chunks to database"
 );

 const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);

 console.log(
 `[processDocument] Saved ${savedChunks.length} chunks to database.`
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 82.0,
 `${savedChunks.length} chunks saved successfully`
 );

 // Step 14: Prepare vectors (82-84%)
 await updateProcessingProgress(
 fileId,
 "processing",
 83.0,
 "Preparing vector embeddings for storage"
 );

 const vectorsToSave = savedChunks.map((savedChunk, i) => ({
 chunk_id: savedChunk.id,
 embedding: embeddings[i],
 file_id: fileId,
 }));

 await updateProcessingProgress(
 fileId,
 "processing",
 84.0,
 "Vector data prepared"
 );

 // Step 15: Save vectors (84-88%)
 await updateProcessingProgress(
 fileId,
 "processing",
 85.0,
 "Storing vector embeddings in database"
 );

 await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);

 await updateProcessingProgress(
 fileId,
 "processing",
 88.0,
 "Vector embeddings stored successfully"
 );

 // Step 16: Prepare for summary (88-90%)
 await updateProcessingProgress(
 fileId,
 "processing",
 89.0,
 "Preparing document content for summarization"
 );

 const fullText = chunks.map((c) => c.content).join("\n\n");

 await updateProcessingProgress(
 fileId,
 "processing",
 90.0,
 "Ready to generate summary"
 );

 // Step 17: Generate Summary (90-95%)
 try {
 if (fullText.trim()) {
 await updateProcessingProgress(
 fileId,
 "processing",
 91.0,
 "Connecting to AI summarization service"
 );

 await updateProcessingProgress(
 fileId,
 "processing",
 92.0,
 "Generating AI-powered document summary"
 );

 const summary = await getSummaryFromChunks(fullText);

 await updateProcessingProgress(
 fileId,
 "processing",
 94.0,
 "Saving document summary"
 );

 await DocumentModel.updateFileSummary(fileId, summary);

 await updateProcessingProgress(
 fileId,
 "processing",
 95.0,
 "Summary generated and saved successfully"
 );

 console.log(
 `[processDocument] Summary generated for file ID ${fileId}`
 );
 }
 } catch (summaryError) {
 console.warn(
 `[processDocument] Summary generation failed: ${summaryError.message}`
 );
 await updateProcessingProgress(
 fileId,
 "processing",
 95.0,
 "Summary generation skipped (non-critical error)"
 );
 }

 // Step 18: Finalization (95-100%)
 await updateProcessingProgress(
 fileId,
 "processing",
 96.0,
 "Updating document metadata"
 );

 await DocumentModel.updateFileProcessedAt(fileId);

 await updateProcessingProgress(
 fileId,
 "processing",
 98.0,
 "Finalizing document processing"
 );

 await updateProcessingProgress(
 fileId,
 "processed",
 100.0,
 "Document processing completed successfully"
 );

 await ProcessingJobModel.updateJobStatus(jobId, "completed");

 console.log(
 `✅ Document ID ${fileId} fully processed using '${chunkingMethod}' method.`
 );
 } catch (error) {
 console.error(`❌ processDocument failed for file ID ${fileId}:`, error);
 await updateProcessingProgress(
 fileId,
 "error",
 0.0,
 `Processing failed: ${error.message}`
 );
 await ProcessingJobModel.updateJobStatus(jobId, "failed", error.message);
 }
}

exports.analyzeDocument = async (req, res) => {
 const userId = req.user.id;
 const authorizationHeader = req.headers.authorization;

 try {
 const { file_id } = req.body;
 if (!file_id)
 return res.status(400).json({ error: "file_id is required." });

 const file = await DocumentModel.getFileById(file_id);
 if (!file) return res.status(404).json({ error: "File not found." });
 if (file.user_id !== userId)
 return res.status(403).json({ error: "Access denied." });

 if (file.status !== "processed") {
 return res.status(400).json({
 error: "Document is still processing or failed.",
 status: file.status,
 progress: file.processing_progress,
 });
 }

 const chunks = await FileChunkModel.getChunksByFileId(file_id);
 const fullText = chunks.map((c) => c.content).join("\n\n");

 const analysisCost = Math.ceil(fullText.length / 500);

 const { userUsage, userPlan, requestedResources } = req;

 // Enforce limits is already handled by middleware. If we reach here, it's allowed.
 // The middleware also handles refetching usage if renewal occurred.

 let insights;
 try {
 insights = await analyzeWithGemini(fullText);
 // Increment usage after successful AI analysis
 await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
 } catch (aiError) {
 console.error("❌ Gemini analysis error:", aiError);
 return res.status(500).json({
 error: "Failed to get AI analysis.",
 details: aiError.message,
 });
 }

 return res.json(insights);
 } catch (error) {
 console.error("❌ analyzeDocument error:", error);
 return res.status(500).json({ error: "Failed to analyze document." });
 }
};
exports.getSummary = async (req, res) => {
 const userId = req.user.id;
 const authorizationHeader = req.headers.authorization;

 try {
 const { file_id, selected_chunk_ids } = req.body;

 if (!file_id)
 return res.status(400).json({ error: "file_id is required." });
 if (!Array.isArray(selected_chunk_ids) || selected_chunk_ids.length === 0) {
 return res.status(400).json({ error: "No chunks selected for summary." });
 }

 const file = await DocumentModel.getFileById(file_id);
 if (!file || file.user_id !== userId) {
 return res.status(403).json({ error: "Access denied or file not found." });
 }

 if (file.status !== "processed") {
 return res.status(400).json({
 error: "Document is still processing or failed.",
 status: file.status,
 progress: file.processing_progress,
 });
 }

 const fileChunks = await FileChunkModel.getChunksByFileId(file_id);
 const allowedIds = new Set(fileChunks.map((c) => c.id));
 const safeChunkIds = selected_chunk_ids.filter((id) => allowedIds.has(id));

 if (safeChunkIds.length === 0) {
 return res.status(400).json({ error: "Selected chunks are invalid for this file." });
 }

 const selectedChunks = await FileChunkModel.getChunkContentByIds(safeChunkIds);
 const combinedText = selectedChunks.map((chunk) => chunk.content).join("\n\n");

 if (!combinedText.trim()) {
 return res.status(400).json({ error: "Selected chunks contain no readable content." });
 }

 const summaryCost = Math.ceil(combinedText.length / 200);

 const { userUsage, userPlan, requestedResources } = req;

 // Enforce limits is already handled by middleware. If we reach here, it's allowed.
 // The middleware also handles refetching usage if renewal occurred.

 let summary;
 try {
 summary = await getSummaryFromChunks(combinedText);
 // Increment usage after successful summary generation
 await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
 } catch (aiError) {
 console.error("❌ Gemini summary error:", aiError);
 return res.status(500).json({
 error: "Failed to generate summary.",
 details: aiError.message,
 });
 }

 return res.json({ summary, used_chunk_ids: safeChunkIds });
 } catch (error) {
 console.error("❌ Error generating summary:", error);
 return res.status(500).json({ error: "Failed to generate summary." });
 }
};


exports.chatWithDocument = async (req, res) => {
 let userId = null;

 try {
 const {
 file_id,
 question, // For custom queries
 used_secret_prompt = false,
 prompt_label = null,
 session_id = null,
 secret_id, // NEW: For secret prompts
 llm_name, // NEW: Optional LLM override
 additional_input = '', // NEW: Additional input for secret prompts
 } = req.body;

 userId = req.user.id;

 // Validation
 const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if (!file_id) {
 return res.status(400).json({ error: "file_id is required." });
 }
 if (!uuidRegex.test(file_id)) {
 return res.status(400).json({ error: "Invalid file ID format." });
 }

 // Generate session ID if not provided
 const finalSessionId = session_id || `session-${Date.now()}`;

 console.log(`[chatWithDocument] Processing request: used_secret_prompt=${used_secret_prompt}, secret_id=${secret_id}, llm_name=${llm_name}`);

 // Check file access
 const file = await DocumentModel.getFileById(file_id);
 if (!file) return res.status(404).json({ error: "File not found." });
 if (String(file.user_id) !== String(userId)) {
 return res.status(403).json({ error: "Access denied." });
 }
 if (file.status !== "processed") {
 return res.status(400).json({
 error: "Document is not yet processed.",
 status: file.status,
 progress: file.processing_progress,
 });
 }

 let answer;
 let usedChunkIds = [];
 let storedQuestion;
 let finalPromptLabel = prompt_label;
 let provider; // Declare provider here to make it accessible in the final return

 // ================================
 // CASE 1: SECRET PROMPT HANDLING
 // ================================
 if (used_secret_prompt) {
 if (!secret_id) {
 return res.status(400).json({ error: "secret_id is required for secret prompts." });
 }

 console.log(`[chatWithDocument] Handling secret prompt: ${secret_id}`);

 // Fetch secret configuration from DB
 const secretQuery = `
 SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
 FROM secret_manager s
 LEFT JOIN llm_models l ON s.llm_id = l.id
 WHERE s.id = $1
 `;
 const secretResult = await db.query(secretQuery, [secret_id]);

 if (secretResult.rows.length === 0) {
 return res.status(404).json({ error: "Secret configuration not found." });
 }

 const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } = secretResult.rows[0];
 finalPromptLabel = secretName;

 // Resolve LLM provider (prioritize request llm_name, then DB, then default)
 provider = resolveProviderName(llm_name || dbLlmName || 'gemini'); // Assign to the higher-scoped provider
 console.log(`[chatWithDocument] Using LLM provider: ${provider}`);

 // Fetch secret value from GCP Secret Manager
 const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
 const secretClient = new SecretManagerServiceClient();
 const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
 
 const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
 const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
 const secretValue = accessResponse.payload.data.toString('utf8');

 if (!secretValue?.trim()) {
 return res.status(500).json({ error: "Secret value is empty." });
 }

 // Fetch all document chunks for secret prompts (use full context)
 const allChunks = await FileChunkModel.getChunksByFileId(file_id);
 if (!allChunks?.length) {
 return res.status(404).json({ error: "No document content found." });
 }
 
 usedChunkIds = allChunks.map(c => c.id);
 const documentContent = allChunks.map(c => c.content).join('\n\n');

 // Construct final prompt
 let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
 finalPrompt += `${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${documentContent}`;

 if (additional_input?.trim()) {
 finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${additional_input.trim()}`;
 }

 console.log(`[chatWithDocument] Secret prompt length: ${finalPrompt.length}`);
 
 // Call LLM with selected provider
 answer = await askLLM(provider, finalPrompt);
 
 storedQuestion = secretName; // Store secret name as question

 }
 // ================================
 // CASE 2: CUSTOM QUERY HANDLING
 // ================================
 else {
 if (!question?.trim()) {
 return res.status(400).json({ error: "question is required for custom queries." });
 }

 console.log(`[chatWithDocument] Handling custom query: "${question.substring(0, 50)}..."`);

 // For custom queries, always use 'gemini' as the provider.
 provider = 'gemini'; // Assign to the higher-scoped provider
 console.log(`[chatWithDocument] Custom query using fixed provider: ${provider}`);

 // Use vector search for relevant context (existing logic)
 const questionEmbedding = await generateEmbedding(question);
 const relevantChunks = await ChunkVectorModel.findNearestChunks(questionEmbedding, 5, file_id);
 const relevantChunkContents = relevantChunks.map(chunk => chunk.content);
 usedChunkIds = relevantChunks.map(chunk => chunk.chunk_id);

 if (relevantChunkContents.length === 0) {
 console.log(`[chatWithDocument] No relevant chunks, using full document`);
 const allChunks = await FileChunkModel.getChunksByFileId(file_id);
 const documentFullText = allChunks.map(c => c.content).join("\n\n");
 answer = await askLLM(provider, question, documentFullText);
 } else {
 const context = relevantChunkContents.join("\n\n");
 console.log(`[chatWithDocument] Using ${relevantChunkContents.length} relevant chunks`);
 answer = await askLLM(provider, question, context);
 }

 storedQuestion = question; // Store actual question
 }

 if (!answer?.trim()) {
 return res.status(500).json({ error: "Empty response from AI." });
 }

 console.log(`[chatWithDocument] Answer length: ${answer.length} characters`);

 // Store chat in database
 const savedChat = await FileChat.saveChat(
 file_id,
 userId,
 storedQuestion,
 answer,
 finalSessionId,
 usedChunkIds,
 used_secret_prompt,
 finalPromptLabel, // prompt_label
 used_secret_prompt ? secret_id : null // secret_id (now passed to saveChat)
 );

 console.log(`[chatWithDocument] ✅ Chat saved with ID: ${savedChat.id}`);

 // Increment usage
 const { userUsage, userPlan, requestedResources } = req;
 await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);

 // Fetch full session history
 const historyRows = await FileChat.getChatHistory(file_id, finalSessionId);
 const history = historyRows.map(row => ({
 id: row.id,
 file_id: row.file_id,
 session_id: row.session_id,
 question: row.question,
 answer: row.answer,
 used_secret_prompt: row.used_secret_prompt || false,
 prompt_label: row.prompt_label || null,
 secret_id: row.secret_id || null,
 used_chunk_ids: row.used_chunk_ids || [],
 confidence: row.confidence || 0.8,
 timestamp: row.created_at || row.timestamp,
 display_text_left_panel: row.used_secret_prompt
 ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
 : row.question
 }));

 return res.json({
 success: true,
 session_id: finalSessionId,
 message_id: savedChat.id,
 answer,
 response: answer,
 history,
 used_chunk_ids: usedChunkIds,
 confidence: used_secret_prompt ? 0.9 : 0.85, // Higher confidence for secret prompts
 timestamp: savedChat.created_at || new Date().toISOString(),
 llm_provider: provider, // Include which LLM was used
 used_secret_prompt: used_secret_prompt
 });

 } catch (error) {
 console.error("❌ Error in chatWithDocument:", error);
 console.error("Stack trace:", error.stack);
 return res.status(500).json({
 error: "Failed to get AI answer.",
 details: error.message
 });
 }
};
/**
 * @description Saves edited HTML content of a document by converting it to DOCX and PDF, then uploading to GCS.
 * @route POST /api/doc/save
 */
exports.saveEditedDocument = async (req, res) => {
 try {
 const { file_id, edited_html } = req.body;
 if (!file_id || typeof edited_html !== "string") {
 return res
 .status(400)
 .json({ error: "file_id and edited_html are required." });
 }

 const file = await DocumentModel.getFileById(file_id);
 if (!file || file.user_id !== req.user.id) {
 return res
 .status(403)
 .json({ error: "Access denied or file not found." });
 }

 const docxBuffer = await convertHtmlToDocx(edited_html);
 const pdfBuffer = await convertHtmlToPdf(edited_html);

 const { gsUri: docxUrl } = await uploadToGCS(
 `edited_${file_id}.docx`,
 docxBuffer,
 "edited",
 false,
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 );
 const { gsUri: pdfUrl } = await uploadToGCS(
 `edited_${file_id}.pdf`,
 pdfBuffer,
 "edited",
 false,
 "application/pdf"
 );

 await DocumentModel.saveEditedVersions(file_id, docxUrl, pdfUrl);

 return res.json({ docx_download_url: docxUrl, pdf_download_url: pdfUrl });
 } catch (error) {
 console.error("❌ saveEditedDocument error:", error);
 return res.status(500).json({ error: "Failed to save edited document." });
 }
};

/**
 * @description Generates a signed URL to download a specific format (DOCX or PDF) of an edited document.
 * @route GET /api/doc/download/:file_id/:format
 */
exports.downloadDocument = async (req, res) => {
 try {
 const { file_id, format } = req.params;
 if (!file_id || !format)
 return res
 .status(400)
 .json({ error: "file_id and format are required." });
 if (!["docx", "pdf"].includes(format))
 return res
 .status(400)
 .json({ error: "Invalid format. Use docx or pdf." });

 const file = await DocumentModel.getFileById(file_id);
 if (!file) return res.status(404).json({ error: "File not found." });
 if (file.user_id !== req.user.id)
 return res.status(403).json({ error: "Access denied" });

 const targetUrl =
 format === "docx" ? file.edited_docx_path : file.edited_pdf_path;
 if (!targetUrl)
 return res
 .status(404)
 .json({ error: "File not found or not yet generated" });

 const gcsKey = normalizeGcsKey(targetUrl, process.env.GCS_BUCKET);
 if (!gcsKey)
 return res.status(500).json({ error: "Invalid GCS path for the file." });

 const signedUrl = await getSignedUrl(gcsKey);
 return res.redirect(signedUrl);
 } catch (error) {
 console.error("❌ Error generating signed URL:", error);
 return res
 .status(500)
 .json({ error: "Failed to generate signed download link" });
 }
};

/**
 * @description Retrieves the chat history for a specific document.
 * @route GET /api/doc/chat-history/:file_id
 */
exports.getChatHistory = async (req, res) => {
 try {
 const userId = req.user.id;

 // ✅ Fetch all chats for this user (grouped by session)
 const chats = await FileChat.getChatHistoryByUserId(userId);

 if (!chats || chats.length === 0) {
 return res.status(404).json({ error: "No chat history found for this user." });
 }

 // ✅ Group chats by session_id for better organization
 const sessions = chats.reduce((acc, chat) => {
 if (!acc[chat.session_id]) {
 acc[chat.session_id] = {
 session_id: chat.session_id,
 file_id: chat.file_id,
 user_id: chat.user_id,
 messages: []
 };
 }

 acc[chat.session_id].messages.push({
 id: chat.id,
 question: chat.question,
 answer: chat.answer,
 used_chunk_ids: chat.used_chunk_ids,
 used_secret_prompt: chat.used_secret_prompt,
 prompt_label: chat.prompt_label,
 created_at: chat.created_at
 });

 return acc;
 }, {});

 return res.json(Object.values(sessions));
 } catch (error) {
 console.error("❌ getChatHistory error:", error);
 return res.status(500).json({ error: "Failed to fetch chat history." });
 }
};



// exports.getDocumentProcessingStatus = async (req, res) => {
// try {
// const { file_id } = req.params;
// if (!file_id) {
// return res.status(400).json({ error: "file_id is required." });
// }

// console.log(`[getDocumentProcessingStatus] Received request for file_id: ${file_id}`);

// const file = await DocumentModel.getFileById(file_id);
// if (!file || String(file.user_id) !== String(req.user.id)) {
// return res.status(403).json({ error: "Access denied or file not found." });
// }

// const job = await ProcessingJobModel.getJobByFileId(file_id);

// // If already processed
// if (file.status === "processed") {
// const existingChunks = await FileChunkModel.getChunksByFileId(file_id);
// return res.json({
// document_id: file.id,
// status: file.status,
// processing_progress: file.processing_progress,
// job_status: job ? job.status : "completed",
// job_error: job ? job.error_message : null,
// last_updated: file.updated_at,
// chunks: existingChunks,
// summary: file.summary,
// });
// }

// // No job yet
// if (!job || !job.document_ai_operation_name) {
// return res.json({
// document_id: file.id,
// status: file.status,
// processing_progress: file.processing_progress,
// job_status: "not_queued",
// job_error: null,
// last_updated: file.updated_at,
// chunks: [],
// summary: file.summary,
// });
// }

// console.log(`[getDocumentProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
// const status = await getOperationStatus(job.document_ai_operation_name);
// console.log(`[getDocumentProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

// // If still running
// if (!status.done) {
// return res.json({
// file_id: file.id,
// status: "batch_processing",
// processing_progress: file.processing_progress,
// job_status: "running",
// job_error: null,
// last_updated: file.updated_at,
// });
// }

// // If failed
// if (status.error) {
// await DocumentModel.updateFileStatus(file_id, "error", 0.0);
// await ProcessingJobModel.updateJobStatus(job.id, "failed", status.error.message);
// return res.status(500).json({
// file_id: file.id,
// status: "error",
// processing_progress: 0.0,
// job_status: "failed",
// job_error: status.error.message,
// last_updated: new Date().toISOString(),
// });
// }

// // Fetch processed text
// const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
// const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
// const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
// console.log(`[getDocumentProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);

// await DocumentModel.updateFileStatus(file_id, "processing", 75.0);

// // ✅ Fetch chunking method via secret_manager → chunking_methods
// let batchChunkingMethod = "recursive";
// try {
// const chunkMethodQuery = `
// SELECT cm.method_name
// FROM processing_jobs pj
// LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
// LEFT JOIN chunking_methods cm ON sm.chunking_method_id = cm.id
// WHERE pj.file_id = $1
// ORDER BY pj.created_at DESC
// LIMIT 1;
// `;
// const result = await db.query(chunkMethodQuery, [file_id]);

// if (result.rows.length > 0) {
// batchChunkingMethod = result.rows[0].method_name;
// console.log(`[getDocumentProcessingStatus] ✅ Using chunking method from DB: ${batchChunkingMethod}`);
// } else {
// console.log(`[getDocumentProcessingStatus] No secret_id found for file ${file_id}, using default chunking method.`);
// }
// } catch (err) {
// console.error(`[getDocumentProcessingStatus] Error fetching chunking method: ${err.message}`);
// console.log(`[getDocumentProcessingStatus] Falling back to default chunking method: recursive`);
// }

// // ✅ Chunking
// console.log(`[getDocumentProcessingStatus] Starting chunking for file ID ${file_id} using method: ${batchChunkingMethod}`);
// const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);

// // Save chunks and vectors
// const chunkContents = chunks.map(c => c.content);
// const embeddings = await generateEmbeddings(chunkContents);

// const chunksToSave = chunks.map((chunk, i) => ({
// file_id,
// chunk_index: i,
// content: chunk.content,
// token_count: chunk.token_count,
// page_start: chunk.metadata.page_start,
// page_end: chunk.metadata.page_end,
// heading: chunk.metadata.heading,
// }));

// await FileChunkModel.saveMultipleChunks(chunksToSave);

// const savedChunks = await FileChunkModel.getChunksByFileId(file_id);
// const vectors = savedChunks.map((chunk, i) => ({
// chunk_id: chunk.id,
// embedding: embeddings[i],
// file_id,
// }));

// await ChunkVectorModel.saveMultipleChunkVectors(vectors);

// await DocumentModel.updateFileStatus(file_id, "processed", 100.0);
// await ProcessingJobModel.updateJobStatus(job.id, "completed");

// // Generate summary
// const fullText = chunks.map(c => c.content).join("\n\n");
// try {
// const summary = await getSummaryFromChunks(fullText);
// await DocumentModel.updateFileSummary(file_id, summary);
// } catch (err) {
// console.warn(`[getDocumentProcessingStatus] ⚠️ Summary generation failed: ${err.message}`);
// }

// // Return final response
// const updatedFile = await DocumentModel.getFileById(file_id);
// const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

// return res.json({
// document_id: updatedFile.id,
// status: updatedFile.status,
// processing_progress: updatedFile.processing_progress,
// job_status: "completed",
// job_error: null,
// last_updated: updatedFile.updated_at,
// chunks: finalChunks,
// summary: updatedFile.summary,
// chunking_method: batchChunkingMethod,
// });

// } catch (error) {
// console.error("❌ getDocumentProcessingStatus error:", error);
// return res.status(500).json({
// error: "Failed to fetch processing status.",
// details: error.message,
// });
// }
// };

// exports.getDocumentProcessingStatus = async (req, res) => {
//  try {
//  const { file_id } = req.params;
//  if (!file_id) {
//  return res.status(400).json({ error: "file_id is required." });
//  }

//  console.log(`[getDocumentProcessingStatus] Checking status for file_id: ${file_id}`);

//  const file = await DocumentModel.getFileById(file_id);
//  if (!file || String(file.user_id) !== String(req.user.id)) {
//  return res.status(403).json({ error: "Access denied or file not found." });
//  }

//  const job = await ProcessingJobModel.getJobByFileId(file_id);

//  // Prepare base response
//  const baseResponse = {
//  document_id: file.id,
//  filename: file.filename,
//  status: file.status,
//  processing_progress: parseFloat(file.processing_progress) || 0,
//  current_operation: file.current_operation || "Pending",
//  job_status: job ? job.status : "unknown",
//  job_error: job ? job.error_message : null,
//  last_updated: file.updated_at,
//  file_size: file.file_size,
//  mime_type: file.mime_type,
//  };

//  // Case 1: Document is fully processed
//  if (file.status === "processed") {
//  const chunks = await FileChunkModel.getChunksByFileId(file_id);
//  return res.json({
//  ...baseResponse,
//  processing_progress: 100,
//  current_operation: "Completed",
//  chunks: chunks,
//  chunk_count: chunks.length,
//  summary: file.summary,
//  processed_at: file.processed_at,
//  });
//  }

//  // Case 2: Document processing failed
//  if (file.status === "error") {
//  return res.json({
//  ...baseResponse,
//  processing_progress: 0,
//  current_operation: "Failed",
//  error_details: job ? job.error_message : "Unknown error occurred",
//  });
//  }

//  // Case 3: Synchronous processing in progress
//  if (file.status === "processing") {
//  return res.json({
//  ...baseResponse,
//  message: "Document is being processed. Progress updates in real-time.",
//  });
//  }

//  // Case 4: Batch processing
//  if (file.status === "batch_processing" || file.status === "batch_queued") {
//  if (!job || !job.document_ai_operation_name) {
//  return res.json({
//  ...baseResponse,
//  current_operation: "Queued for batch processing",
//  message: "Document is queued for batch processing.",
//  });
//  }

//  console.log(`[getDocumentProcessingStatus] Checking Document AI batch operation: ${job.document_ai_operation_name}`);
//  const operationStatus = await getOperationStatus(job.document_ai_operation_name);

//  // Batch still running
//  if (!operationStatus.done) {
//  return res.json({
//  ...baseResponse,
//  processing_progress: Math.min(file.processing_progress || 30, 50),
//  current_operation: "Batch OCR processing in progress",
//  message: "Document AI is processing your document. This may take several minutes.",
//  });
//  }

//  // Batch failed
//  if (operationStatus.error) {
//  await DocumentModel.updateFileStatus(file_id, "error", 0.0);
//  await ProcessingJobModel.updateJobStatus(job.job_id, "failed", operationStatus.error.message);
//  return res.json({
//  ...baseResponse,
//  status: "error",
//  processing_progress: 0,
//  current_operation: "Batch processing failed",
//  job_status: "failed",
//  job_error: operationStatus.error.message,
//  });
//  }

//  // Batch completed - now process the results
//  await updateProcessingProgress(file_id, "processing", 55.0, "Batch OCR completed, processing results");

//  const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
//  const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
//  const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
 
//  await updateProcessingProgress(file_id, "processing", 60.0, "Chunking batch results");

//  // Fetch chunking method
//  let batchChunkingMethod = "recursive";
//  try {
//  const chunkMethodQuery = `
//  SELECT chunking_method
//  FROM processing_jobs pj
//  LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
//  WHERE pj.file_id = $1
//  ORDER BY pj.created_at DESC
//  LIMIT 1;
//  `;
//  const result = await db.query(chunkMethodQuery, [file_id]);
//  if (result.rows.length > 0 && result.rows[0].chunking_method) {
//  batchChunkingMethod = result.rows[0].chunking_method;
//  }
//  } catch (err) {
//  console.error(`Error fetching chunking method: ${err.message}`);
//  }

//  await updateProcessingProgress(file_id, "processing", 65.0, `Chunking with ${batchChunkingMethod} method`);
//  const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);

//  await updateProcessingProgress(file_id, "processing", 70.0, "Generating embeddings");
//  const chunkContents = chunks.map(c => c.content);
//  const embeddings = await generateEmbeddings(chunkContents);

//  await updateProcessingProgress(file_id, "processing", 80.0, "Saving chunks and embeddings");
//  const chunksToSave = chunks.map((chunk, i) => ({
//  file_id,
//  chunk_index: i,
//  content: chunk.content,
//  token_count: chunk.token_count,
//  page_start: chunk.metadata.page_start,
//  page_end: chunk.metadata.page_end,
//  heading: chunk.metadata.heading,
//  }));

//  await FileChunkModel.saveMultipleChunks(chunksToSave);
//  const savedChunks = await FileChunkModel.getChunksByFileId(file_id);
 
//  const vectors = savedChunks.map((chunk, i) => ({
//  chunk_id: chunk.id,
//  embedding: embeddings[i],
//  file_id,
//  }));

//  await ChunkVectorModel.saveMultipleChunkVectors(vectors);

//  await updateProcessingProgress(file_id, "processing", 90.0, "Generating summary");
//  const fullText = chunks.map(c => c.content).join("\n\n");
//  try {
//  const summary = await getSummaryFromChunks(fullText);
//  await DocumentModel.updateFileSummary(file_id, summary);
//  } catch (err) {
//  console.warn(`Summary generation failed: ${err.message}`);
//  }

//  await DocumentModel.updateFileProcessedAt(file_id);
//  await updateProcessingProgress(file_id, "processed", 100.0, "Processing completed");
//  await ProcessingJobModel.updateJobStatus(job.job_id, "completed");

//  const updatedFile = await DocumentModel.getFileById(file_id);
//  const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

//  return res.json({
//  document_id: updatedFile.id,
//  filename: updatedFile.filename,
//  status: "processed",
//  processing_progress: 100,
//  current_operation: "Completed",
//  job_status: "completed",
//  chunks: finalChunks,
//  chunk_count: finalChunks.length,
//  summary: updatedFile.summary,
//  chunking_method: batchChunkingMethod,
//  processed_at: updatedFile.processed_at,
//  });
//  }

//  // Case 5: Just uploaded, not yet started
//  return res.json({
//  ...baseResponse,
//  current_operation: "Queued",
//  message: "Document uploaded successfully. Processing will begin shortly.",
//  });

//  } catch (error) {
//  console.error("❌ getDocumentProcessingStatus error:", error);
//  return res.status(500).json({
//  error: "Failed to fetch processing status.",
//  details: error.message,
//  });
//  }
// };




// exports.getDocumentProcessingStatus = async (req, res) => {
//  try {
//  const { file_id } = req.params;
//  if (!file_id) {
//  return res.status(400).json({ error: "file_id is required." });
//  }

//  console.log(
//  `[getDocumentProcessingStatus] Checking status for file_id: ${file_id}`
//  );

//  const file = await DocumentModel.getFileById(file_id);
//  if (!file || String(file.user_id) !== String(req.user.id)) {
//  return res
//  .status(403)
//  .json({ error: "Access denied or file not found." });
//  }

//  const job = await ProcessingJobModel.getJobByFileId(file_id);

//  // Prepare base response
//  const baseResponse = {
//  document_id: file.id,
//  filename: file.filename,
//  status: file.status,
//  processing_progress: parseFloat(file.processing_progress) || 0,
//  current_operation: file.current_operation || "Pending",
//  job_status: job ? job.status : "unknown",
//  job_error: job ? job.error_message : null,
//  last_updated: file.updated_at,
//  file_size: file.file_size,
//  mime_type: file.mime_type,
//  };

//  // Case 1: Document is fully processed
//  if (file.status === "processed") {
//  const chunks = await FileChunkModel.getChunksByFileId(file_id);
//  return res.json({
//  ...baseResponse,
//  processing_progress: 100,
//  current_operation: "Completed",
//  chunks: chunks,
//  chunk_count: chunks.length,
//  summary: file.summary,
//  processed_at: file.processed_at,
//  });
//  }

//  // Case 2: Document processing failed
//  if (file.status === "error") {
//  return res.json({
//  ...baseResponse,
//  processing_progress: 0,
//  current_operation: "Failed",
//  error_details: job ? job.error_message : "Unknown error occurred",
//  });
//  }

//  // Case 3: Synchronous processing in progress
//  if (file.status === "processing") {
//  return res.json({
//  ...baseResponse,
//  message: "Document is being processed. Progress updates in real-time.",
//  });
//  }

//  // Case 4: Batch processing
//  if (file.status === "batch_processing" || file.status === "batch_queued") {
//  if (!job || !job.document_ai_operation_name) {
//  return res.json({
//  ...baseResponse,
//  current_operation: "Queued for batch processing",
//  message: "Document is queued for batch processing.",
//  });
//  }

//  console.log(
//  `[getDocumentProcessingStatus] Checking Document AI batch operation: ${job.document_ai_operation_name}`
//  );

//  // Step 1: Check operation status (0-5%)
//  await updateProcessingProgress(
//  file_id,
//  "batch_processing",
//  1.0,
//  "Checking batch processing status"
//  );

//  const operationStatus = await getOperationStatus(
//  job.document_ai_operation_name
//  );

//  // Batch still running
//  if (!operationStatus.done) {
//  // Progress from 5% to 50% while batch is processing
//  const currentProgress = Math.min(parseFloat(file.processing_progress) || 5, 50);
//  await updateProcessingProgress(
//  file_id,
//  "batch_processing",
//  currentProgress,
//  "Batch OCR processing in progress"
//  );

//  return res.json({
//  ...baseResponse,
//  processing_progress: currentProgress,
//  current_operation: "Batch OCR processing in progress",
//  message:
//  "Document AI is processing your document. This may take several minutes.",
//  });
//  }

//  // Batch failed
//  if (operationStatus.error) {
//  await updateProcessingProgress(
//  file_id,
//  "error",
//  0.0,
//  "Batch processing failed"
//  );
//  await ProcessingJobModel.updateJobStatus(
//  job.job_id,
//  "failed",
//  operationStatus.error.message
//  );
//  return res.json({
//  ...baseResponse,
//  status: "error",
//  processing_progress: 0,
//  current_operation: "Batch processing failed",
//  job_status: "failed",
//  job_error: operationStatus.error.message,
//  });
//  }

//  // Batch completed - now process the results step by step
//  // Step 2: Batch OCR completed (50-52%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  50.0,
//  "Batch OCR completed"
//  );

//  // Step 3: Preparing to fetch results (52-54%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  52.0,
//  "Preparing to fetch batch results"
//  );

//  // Step 4: Fetching batch results (54-58%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  54.0,
//  "Fetching batch results from storage"
//  );

//  const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
//  const prefix = job.gcs_output_uri_prefix.replace(
//  `gs://${bucketName}/`,
//  ""
//  );
//  const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  58.0,
//  "Batch results fetched successfully"
//  );

//  // Step 5: Fetch chunking method (58-60%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  59.0,
//  "Fetching chunking configuration"
//  );

//  let batchChunkingMethod = "recursive";
//  try {
//  const chunkMethodQuery = `
//  SELECT chunking_method
//  FROM processing_jobs pj
//  LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
//  WHERE pj.file_id = $1
//  ORDER BY pj.created_at DESC
//  LIMIT 1;
//  `;
//  const result = await db.query(chunkMethodQuery, [file_id]);
//  if (result.rows.length > 0 && result.rows[0].chunking_method) {
//  batchChunkingMethod = result.rows[0].chunking_method;
//  }
//  } catch (err) {
//  console.error(`Error fetching chunking method: ${err.message}`);
//  }

//  // Step 6: Starting chunking (60-62%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  60.0,
//  `Starting chunking with ${batchChunkingMethod} method`
//  );

//  // Step 7: Chunking document (62-68%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  62.0,
//  `Analyzing document structure for chunking`
//  );

//  const chunks = await chunkDocument(
//  extractedBatchTexts,
//  file_id,
//  batchChunkingMethod
//  );

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  68.0,
//  `Created ${chunks.length} chunks successfully`
//  );

//  // Step 8: Preparing embeddings (68-70%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  69.0,
//  "Preparing to generate embeddings"
//  );

//  const chunkContents = chunks.map((c) => c.content);

//  // Step 9: Generating embeddings (70-78%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  70.0,
//  `Generating embeddings for ${chunks.length} chunks`
//  );

//  const embeddings = await generateEmbeddings(chunkContents);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  78.0,
//  "Embeddings generated successfully"
//  );

//  // Step 10: Preparing to save chunks (78-80%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  79.0,
//  "Preparing chunks for database storage"
//  );

//  const chunksToSave = chunks.map((chunk, i) => ({
//  file_id,
//  chunk_index: i,
//  content: chunk.content,
//  token_count: chunk.token_count,
//  page_start: chunk.metadata.page_start,
//  page_end: chunk.metadata.page_end,
//  heading: chunk.metadata.heading,
//  }));

//  // Step 11: Saving chunks (80-84%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  80.0,
//  "Saving chunks to database"
//  );

//  const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  84.0,
//  `Saved ${savedChunks.length} chunks to database`
//  );

//  // Step 12: Preparing vectors (84-85%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  85.0,
//  "Preparing vector embeddings for storage"
//  );

//  const vectors = savedChunks.map((chunk, i) => ({
//  chunk_id: chunk.id,
//  embedding: embeddings[i],
//  file_id,
//  }));

//  // Step 13: Saving vectors (85-88%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  86.0,
//  "Saving vector embeddings to database"
//  );

//  await ChunkVectorModel.saveMultipleChunkVectors(vectors);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  88.0,
//  "Vector embeddings saved successfully"
//  );

//  // Step 14: Preparing summary (88-90%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  89.0,
//  "Preparing to generate document summary"
//  );

//  const fullText = chunks.map((c) => c.content).join("\n\n");

//  // Step 15: Generating summary (90-95%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  90.0,
//  "Generating AI-powered document summary"
//  );

//  try {
//  const summary = await getSummaryFromChunks(fullText);
//  await DocumentModel.updateFileSummary(file_id, summary);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  95.0,
//  "Summary generated successfully"
//  );
//  } catch (err) {
//  console.warn(`Summary generation failed: ${err.message}`);
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  95.0,
//  "Summary generation skipped (non-critical)"
//  );
//  }

//  // Step 16: Finalizing (95-98%)
//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  96.0,
//  "Updating document metadata"
//  );

//  await DocumentModel.updateFileProcessedAt(file_id);

//  await updateProcessingProgress(
//  file_id,
//  "processing",
//  98.0,
//  "Finalizing processing"
//  );

//  // Step 17: Completing (98-100%)
//  await updateProcessingProgress(
//  file_id,
//  "processed",
//  100.0,
//  "Processing completed successfully"
//  );

//  await ProcessingJobModel.updateJobStatus(job.job_id, "completed");

//  // Fetch final data
//  const updatedFile = await DocumentModel.getFileById(file_id);
//  const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

//  return res.json({
//  document_id: updatedFile.id,
//  filename: updatedFile.filename,
//  status: "processed",
//  processing_progress: 100,
//  current_operation: "Completed",
//  job_status: "completed",
//  chunks: finalChunks,
//  chunk_count: finalChunks.length,
//  summary: updatedFile.summary,
//  chunking_method: batchChunkingMethod,
//  processed_at: updatedFile.processed_at,
//  });
//  }

//  // Case 5: Just uploaded, not yet started
//  return res.json({
//  ...baseResponse,
//  current_operation: "Queued",
//  message: "Document uploaded successfully. Processing will begin shortly.",
//  });
//  } catch (error) {
//  console.error("❌ getDocumentProcessingStatus error:", error);
//  return res.status(500).json({
//  error: "Failed to fetch processing status.",
//  details: error.message,
//  });
//  }
// };
// Don't forget to update your DocumentModel to support current_operation field
// Add this migration:
/*
ALTER TABLE files ADD COLUMN IF NOT EXISTS current_operation TEXT DEFAULT 'Pending';

-- Update the updateFileStatus method in DocumentModel to also update current_operation:
exports.updateCurrentOperation = async (fileId, operation) => {
 const query = `
 UPDATE files
 SET current_operation = $1, updated_at = NOW()
 WHERE id = $2
 `;
 await db.query(query, [operation, fileId]);
};
*/

// exports.getDocumentProcessingStatus = async (req, res) => {
//   try {
//     const { file_id } = req.params;
//     if (!file_id) {
//       return res.status(400).json({ error: "file_id is required." });
//     }

//     console.log(
//       `[getDocumentProcessingStatus] Checking status for file_id: ${file_id}`
//     );

//     const file = await DocumentModel.getFileById(file_id);
//     if (!file || String(file.user_id) !== String(req.user.id)) {
//       return res
//         .status(403)
//         .json({ error: "Access denied or file not found." });
//     }

//     const job = await ProcessingJobModel.getJobByFileId(file_id);

//     // Prepare base response
//     const baseResponse = {
//       document_id: file.id,
//       filename: file.filename,
//       status: file.status,
//       processing_progress: parseFloat(file.processing_progress) || 0,
//       current_operation: file.current_operation || "Pending",
//       job_status: job ? job.status : "unknown",
//       job_error: job ? job.error_message : null,
//       last_updated: file.updated_at,
//       file_size: file.file_size,
//       mime_type: file.mime_type,
//     };

//     // Case 1: Document is fully processed
//     if (file.status === "processed") {
//       const chunks = await FileChunkModel.getChunksByFileId(file_id);
//       return res.json({
//         ...baseResponse,
//         processing_progress: 100,
//         current_operation: "Completed",
//         chunks: chunks,
//         chunk_count: chunks.length,
//         summary: file.summary,
//         processed_at: file.processed_at,
//       });
//     }

//     // Case 2: Document processing failed
//     if (file.status === "error") {
//       return res.json({
//         ...baseResponse,
//         processing_progress: 0,
//         current_operation: "Failed",
//         error_details: job ? job.error_message : "Unknown error occurred",
//       });
//     }

//     // Case 3: Synchronous processing in progress
//     if (file.status === "processing") {
//       return res.json({
//         ...baseResponse,
//         message: "Document is being processed. Progress updates in real-time.",
//       });
//     }

//     // Case 4: Batch processing
//     if (file.status === "batch_processing" || file.status === "batch_queued") {
//       if (!job || !job.document_ai_operation_name) {
//         return res.json({
//           ...baseResponse,
//           current_operation: "Queued for batch processing",
//           message: "Document is queued for batch processing.",
//         });
//       }

//       console.log(
//         `[getDocumentProcessingStatus] Checking Document AI batch operation: ${job.document_ai_operation_name}`
//       );

//       // Get current progress to avoid going backwards
//       const currentProgress = parseFloat(file.processing_progress) || 0;

//       // Only update if we're moving forward from the initial state
//       if (currentProgress < 5) {
//         await updateProcessingProgress(
//           file_id,
//           "batch_processing",
//           5.0,
//           "Checking batch processing status"
//         );
//       }

//       const operationStatus = await getOperationStatus(
//         job.document_ai_operation_name
//       );

//       // Batch still running
//       if (!operationStatus.done) {
//         // REFACTORED: Progress from 5% to 42% while batch is processing
//         // This aligns with the synchronous "OCR processing" step (18-42%)
//         const newProgress = Math.min(currentProgress + 2, 42);

//         if (newProgress > currentProgress) {
//           await updateProcessingProgress(
//             file_id,
//             "batch_processing",
//             newProgress,
//             "Batch OCR processing in progress"
//           );
//         }

//         return res.json({
//           ...baseResponse,
//           processing_progress: newProgress,
//           current_operation: "Batch OCR processing in progress",
//           message:
//             "Document AI is processing your document. This may take several minutes.",
//         });
//       }

//       // Batch failed
//       if (operationStatus.error) {
//         await updateProcessingProgress(
//           file_id,
//           "error",
//           0.0,
//           "Batch processing failed"
//         );
//         await ProcessingJobModel.updateJobStatus(
//           job.job_id,
//           "failed",
//           operationStatus.error.message
//         );
//         return res.json({
//           ...baseResponse,
//           status: "error",
//           processing_progress: 0,
//           current_operation: "Batch processing failed",
//           job_status: "failed",
//           job_error: operationStatus.error.message,
//         });
//       }

//       // Batch completed - now process the results step by step
//       // Only proceed if we haven't already processed this (check current progress)
//       if (currentProgress >= 42 && currentProgress < 100) {
//         // We're already in the middle of post-processing, just return current status
//         return res.json({
//           ...baseResponse,
//           message: "Processing document content and generating embeddings.",
//         });
//       }

//       // REFACTORED: Start all post-processing steps from 42%
//       // All percentages and messages are now aligned with processDocument()

//       // Step 6 (End): Batch OCR completed (42%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         42.0,
//         "Batch OCR completed"
//       );

//       // Step 7: Validate extracted text (42-45%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         43.0,
//         "Validating extracted text"
//       );

//       const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
//       const prefix = job.gcs_output_uri_prefix.replace(
//         `gs://${bucketName}/`,
//         ""
//       );
//       const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);

//       if (
//         !extractedBatchTexts.length ||
//         extractedBatchTexts.every((item) => !item.text || item.text.trim() === "")
//       ) {
//         // Handle failure
//         throw new Error("No meaningful text extracted from batch document.");
//       }

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         45.0,
//         "Text validation completed"
//       );

//       // Step 8: Prepare for chunking (45-48%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         46.0,
//         "Fetching chunking configuration"
//       );

//       let batchChunkingMethod = "recursive";
//       try {
//         const chunkMethodQuery = `
//           SELECT chunking_method
//           FROM processing_jobs pj
//           LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
//           WHERE pj.file_id = $1
//           ORDER BY pj.created_at DESC
//           LIMIT 1;
//         `;
//         const result = await db.query(chunkMethodQuery, [file_id]);
//         if (result.rows.length > 0 && result.rows[0].chunking_method) {
//           batchChunkingMethod = result.rows[0].chunking_method;
//         }
//       } catch (err) {
//         console.error(`Error fetching chunking method: ${err.message}`);
//       }

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         48.0,
//         `Configuration loaded: ${batchChunkingMethod} chunking`
//       );

//       // Step 9: Chunking (48-58%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         50.0,
//         `Chunking document with ${batchChunkingMethod} strategy`
//       );

//       const chunks = await chunkDocument(
//         extractedBatchTexts,
//         file_id,
//         batchChunkingMethod
//       );

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         58.0,
//         `Chunking completed with ${chunks.length} segments`
//       );

//       if (!chunks.length) {
//         // Handle no chunks (same as in processDocument)
//         await DocumentModel.updateFileProcessedAt(file_id);
//         await updateProcessingProgress(
//           file_id,
//           "processed",
//           100.0,
//           "Processing completed (no content to chunk)"
//         );
//         await ProcessingJobModel.updateJobStatus(job.job_id, "completed");
//         return res.json({
//            ...baseResponse,
//            status: "processed",
//            processing_progress: 100,
//            current_operation: "Processing completed (no content to chunk)",
//         });
//       }

//       // Step 10: Prepare embeddings (58-62%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         59.0,
//         "Preparing chunks for embedding generation"
//       );
//       const chunkContents = chunks.map((c) => c.content);

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         62.0,
//         `Ready to generate embeddings for ${chunks.length} chunks`
//       );

//       // Step 11: Generate Embeddings (62-76%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         64.0,
//         "Connecting to embedding service"
//       );

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         66.0,
//         `Processing embeddings for ${chunks.length} chunks`
//       );
//       const embeddings = await generateEmbeddings(chunkContents);

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         76.0,
//         "All embeddings generated successfully"
//       );

//       // Step 12: Prepare database save (76-78%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         77.0,
//         "Preparing data for database storage"
//       );
//       const chunksToSave = chunks.map((chunk, i) => ({
//         file_id,
//         chunk_index: i,
//         content: chunk.content,
//         token_count: chunk.token_count,
//         page_start: chunk.metadata.page_start,
//         page_end: chunk.metadata.page_end,
//         heading: chunk.metadata.heading,
//       }));

//       // Step 13: Save chunks to database (78-82%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         79.0,
//         "Saving chunks to database"
//       );
//       const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         82.0,
//         `${savedChunks.length} chunks saved successfully`
//       );

//       // Step 14: Prepare vectors (82-84%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         83.0,
//         "Preparing vector embeddings for storage"
//       );
//       const vectors = savedChunks.map((chunk, i) => ({
//         chunk_id: chunk.id,
//         embedding: embeddings[i],
//         file_id,
//       }));

//       // Step 15: Save vectors (84-88%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         85.0,
//         "Storing vector embeddings in database"
//       );
//       await ChunkVectorModel.saveMultipleChunkVectors(vectors);

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         88.0,
//         "Vector embeddings stored successfully"
//       );

//       // Step 16: Prepare for summary (88-90%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         89.0,
//         "Preparing document content for summarization"
//       );
//       const fullText = chunks.map((c) => c.content).join("\n\n");

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         90.0,
//         "Ready to generate summary"
//       );

//       // Step 17: Generate Summary (90-95%)
//       try {
//         if (fullText.trim()) {
//           await updateProcessingProgress(
//             file_id,
//             "processing",
//             92.0,
//             "Generating AI-powered document summary"
//           );
//           const summary = await getSummaryFromChunks(fullText);
//           await DocumentModel.updateFileSummary(file_id, summary);
//           await updateProcessingProgress(
//             file_id,
//             "processing",
//             95.0,
//             "Summary generated and saved successfully"
//           );
//         }
//       } catch (err) {
//         console.warn(`Summary generation failed: ${err.message}`);
//         await updateProcessingProgress(
//           file_id,
//           "processing",
//           95.0,
//           "Summary generation skipped (non-critical)"
//         );
//       }

//       // Step 18: Finalization (95-100%)
//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         96.0,
//         "Updating document metadata"
//       );
//       await DocumentModel.updateFileProcessedAt(file_id);

//       await updateProcessingProgress(
//         file_id,
//         "processing",
//         98.0,
//         "Finalizing document processing"
//       );

//       await updateProcessingProgress(
//         file_id,
//         "processed",
//         100.0,
//         "Document processing completed successfully"
//       );
//       await ProcessingJobModel.updateJobStatus(job.job_id, "completed");

//       // Fetch final data
//       const updatedFile = await DocumentModel.getFileById(file_id);
//       const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

//       return res.json({
//         document_id: updatedFile.id,
//         filename: updatedFile.filename,
//         status: "processed",
//         processing_progress: 100,
//         current_operation: "Completed",
//         job_status: "completed",
//         chunks: finalChunks,
//         chunk_count: finalChunks.length,
//         summary: updatedFile.summary,
//         chunking_method: batchChunkingMethod,
//         processed_at: updatedFile.processed_at,
//       });
//     }

//     // Case 5: Just uploaded, not yet started
//     return res.json({
//       ...baseResponse,
//       current_operation: "Queued",
//       message: "Document uploaded successfully. Processing will begin shortly.",
//     });
//   } catch (error) {
//     console.error("❌ getDocumentProcessingStatus error:", error);
//     // Try to update file status to error if we're in the middle of processing
//     try {
//         const { file_id } = req.params;
//         if (file_id) {
//              await updateProcessingProgress(
//                 file_id,
//                 "error",
//                 0.0,
//                 `Post-processing failed: ${error.message}`
//              );
//              const job = await ProcessingJobModel.getJobByFileId(file_id);
//              if (job) {
//                 await ProcessingJobModel.updateJobStatus(job.job_id, "failed", error.message);
//              }
//         }
//     } catch (updateError) {
//         console.error("❌ Failed to update error status:", updateError);
//     }
   
//     return res.status(500).json({
//       error: "Failed to fetch processing status.",
//       details: error.message,
//     });
//   }
// };

async function processBatchResults(file_id, job) {
  try {
    console.log(
      `[processBatchResults] Starting background post-processing for file: ${file_id}`
    );

    // Step 7: Validate extracted text (42-45%)
    await updateProcessingProgress(
      file_id,
      "processing",
      43.0,
      "Validating extracted text"
    );

    const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
    const prefix = job.gcs_output_uri_prefix.replace(
      `gs://${bucketName}/`,
      ""
    );
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);

    if (
      !extractedBatchTexts.length ||
      extractedBatchTexts.every((item) => !item.text || item.text.trim() === "")
    ) {
      throw new Error("No meaningful text extracted from batch document.");
    }

    await updateProcessingProgress(
      file_id,
      "processing",
      45.0,
      "Text validation completed"
    );

    // Step 8: Prepare for chunking (45-48%)
    await updateProcessingProgress(
      file_id,
      "processing",
      46.0,
      "Fetching chunking configuration"
    );

    let batchChunkingMethod = "recursive";
    try {
      const chunkMethodQuery = `
        SELECT chunking_method
        FROM processing_jobs pj
        LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
        WHERE pj.file_id = $1
        ORDER BY pj.created_at DESC
        LIMIT 1;
      `;
      const result = await db.query(chunkMethodQuery, [file_id]);
      if (result.rows.length > 0 && result.rows[0].chunking_method) {
        batchChunkingMethod = result.rows[0].chunking_method;
      }
    } catch (err) {
      console.error(`Error fetching chunking method: ${err.message}`);
    }

    await updateProcessingProgress(
      file_id,
      "processing",
      48.0,
      `Configuration loaded: ${batchChunkingMethod} chunking`
    );

    // Step 9: Chunking (48-58%)
    await updateProcessingProgress(
      file_id,
      "processing",
      50.0,
      `Chunking document with ${batchChunkingMethod} strategy`
    );

    const chunks = await chunkDocument(
      extractedBatchTexts,
      file_id,
      batchChunkingMethod
    );

    await updateProcessingProgress(
      file_id,
      "processing",
      58.0,
      `Chunking completed with ${chunks.length} segments`
    );

    if (!chunks.length) {
      // Handle no chunks (same as in processDocument)
      await DocumentModel.updateFileProcessedAt(file_id);
      await updateProcessingProgress(
        file_id,
        "processed",
        100.0,
        "Processing completed (no content to chunk)"
      );
      await ProcessingJobModel.updateJobStatus(job.job_id, "completed");
      return; // Stop execution
    }

    // Step 10: Prepare embeddings (58-62%)
    await updateProcessingProgress(
      file_id,
      "processing",
      59.0,
      "Preparing chunks for embedding generation"
    );
    const chunkContents = chunks.map((c) => c.content);

    await updateProcessingProgress(
      file_id,
      "processing",
      62.0,
      `Ready to generate embeddings for ${chunks.length} chunks`
    );

    // Step 11: Generate Embeddings (62-76%)
    await updateProcessingProgress(
      file_id,
      "processing",
      64.0,
      "Connecting to embedding service"
    );
    await updateProcessingProgress(
      file_id,
      "processing",
      66.0,
      `Processing embeddings for ${chunks.length} chunks`
    );
    const embeddings = await generateEmbeddings(chunkContents);
    await updateProcessingProgress(
      file_id,
      "processing",
      76.0,
      "All embeddings generated successfully"
    );

    // Step 12: Prepare database save (76-78%)
    await updateProcessingProgress(
      file_id,
      "processing",
      77.0,
      "Preparing data for database storage"
    );
    const chunksToSave = chunks.map((chunk, i) => ({
      file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    // Step 13: Save chunks to database (78-82%)
    await updateProcessingProgress(
      file_id,
      "processing",
      79.0,
      "Saving chunks to database"
    );
    const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);
    await updateProcessingProgress(
      file_id,
      "processing",
      82.0,
      `${savedChunks.length} chunks saved successfully`
    );

    // Step 14: Prepare vectors (82-84%)
    await updateProcessingProgress(
      file_id,
      "processing",
      83.0,
      "Preparing vector embeddings for storage"
    );
    const vectors = savedChunks.map((chunk, i) => ({
      chunk_id: chunk.id,
      embedding: embeddings[i],
      file_id,
    }));

    // Step 15: Save vectors (84-88%)
    await updateProcessingProgress(
      file_id,
      "processing",
      85.0,
      "Storing vector embeddings in database"
    );
    await ChunkVectorModel.saveMultipleChunkVectors(vectors);
    await updateProcessingProgress(
      file_id,
      "processing",
      88.0,
      "Vector embeddings stored successfully"
    );

    // Step 16: Prepare for summary (88-90%)
    await updateProcessingProgress(
      file_id,
      "processing",
      89.0,
      "Preparing document content for summarization"
    );
    const fullText = chunks.map((c) => c.content).join("\n\n");
    await updateProcessingProgress(
      file_id,
      "processing",
      90.0,
      "Ready to generate summary"
    );

    // Step 17: Generate Summary (90-95%)
    try {
      if (fullText.trim()) {
        await updateProcessingProgress(
          file_id,
          "processing",
          92.0,
          "Generating AI-powered document summary"
        );
        const summary = await getSummaryFromChunks(fullText);
        await DocumentModel.updateFileSummary(file_id, summary);
        await updateProcessingProgress(
          file_id,
          "processing",
          95.0,
          "Summary generated and saved successfully"
        );
      } else {
        await updateProcessingProgress(
          file_id,
          "processing",
          95.0,
          "Summary generation skipped (empty content)"
        );
      }
    } catch (err) {
      console.warn(`Summary generation failed: ${err.message}`);
      await updateProcessingProgress(
        file_id,
        "processing",
        95.0,
        "Summary generation skipped (non-critical)"
      );
    }

    // Step 18: Finalization (95-100%)
    await updateProcessingProgress(
      file_id,
      "processing",
      96.0,
      "Updating document metadata"
    );
    await DocumentModel.updateFileProcessedAt(file_id);
    await updateProcessingProgress(
      file_id,
      "processing",
      98.0,
      "Finalizing document processing"
    );
    await updateProcessingProgress(
      file_id,
      "processed",
      100.0,
      "Document processing completed successfully"
    );
    await ProcessingJobModel.updateJobStatus(job.job_id, "completed");

    console.log(
      `[processBatchResults] ✅ Successfully finished post-processing for file: ${file_id}`
    );
  } catch (error) {
    console.error(`❌ processBatchResults failed for file ${file_id}:`, error);
    try {
      await updateProcessingProgress(
        file_id,
        "error",
        0.0,
        `Post-processing failed: ${error.message}`
      );
      await ProcessingJobModel.updateJobStatus(
        job.job_id,
        "failed",
        error.message
      );
    } catch (err) {
      console.error(`❌ Failed to even update error status for ${file_id}:`, err);
    }
  }
}
exports.getDocumentProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      return res.status(400).json({ error: "file_id is required." });
    }

    console.log(
      `[getDocumentProcessingStatus] Checking status for file_id: ${file_id}`
    );

    const file = await DocumentModel.getFileById(file_id);
    if (!file || String(file.user_id) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ error: "Access denied or file not found." });
    }

    const job = await ProcessingJobModel.getJobByFileId(file_id);

    // Prepare base response
    const baseResponse = {
      document_id: file.id,
      filename: file.filename,
      status: file.status,
      processing_progress: parseFloat(file.processing_progress) || 0,
      current_operation: file.current_operation || "Pending",
      job_status: job ? job.status : "unknown",
      job_error: job ? job.error_message : null,
      last_updated: file.updated_at,
      file_size: file.file_size,
      mime_type: file.mime_type,
    };

    // Case 1: Document is fully processed
    if (file.status === "processed") {
      const chunks = await FileChunkModel.getChunksByFileId(file_id);
      return res.json({
        ...baseResponse,
        processing_progress: 100,
        current_operation: "Completed",
        chunks: chunks,
        chunk_count: chunks.length,
        summary: file.summary,
        processed_at: file.processed_at,
      });
    }

    // Case 2: Document processing failed
    if (file.status === "error") {
      return res.json({
        ...baseResponse,
        processing_progress: 0,
        current_operation: "Failed",
        error_details: job ? job.error_message : "Unknown error occurred",
      });
    }

    // Case 3: Synchronous OR *BACKGROUND* processing in progress
    if (file.status === "processing") {
      // This case now handles all polls *after* the background job is triggered
      return res.json({
        ...baseResponse,
        message: "Document is being processed. Progress updates in real-time.",
      });
    }

    // Case 4: Batch processing (polling the Google operation)
    if (file.status === "batch_processing" || file.status === "batch_queued") {
      if (!job || !job.document_ai_operation_name) {
        return res.json({
          ...baseResponse,
          current_operation: "Queued for batch processing",
          message: "Document is queued for batch processing.",
        });
      }

      const currentProgress = parseFloat(file.processing_progress) || 0;
     
      // Only update if we're moving forward from the initial state
      if (currentProgress < 5) {
        await updateProcessingProgress(
          file_id,
          "batch_processing",
          5.0, // Start at 5%
          "Checking batch processing status"
        );
      }

      const operationStatus = await getOperationStatus(
        job.document_ai_operation_name
      );

      // Batch still running
      if (!operationStatus.done) {
        // Smoothly progress from 5% to 42%
        const newProgress = Math.min(currentProgress + 2, 42);

        if (newProgress > currentProgress) {
          await updateProcessingProgress(
            file_id,
            "batch_processing",
            newProgress,
            "Batch OCR processing in progress"
          );
        }
        return res.json({
          ...baseResponse,
          processing_progress: newProgress,
          current_operation: "Batch OCR processing in progress",
          message:
            "Document AI is processing your document. This may take several minutes.",
        });
      }

      // Batch failed
      if (operationStatus.error) {
        await updateProcessingProgress(
          file_id,
          "error",
          0.0,
          "Batch processing failed"
        );
        await ProcessingJobModel.updateJobStatus(
          job.job_id,
          "failed",
          operationStatus.error.message
        );
        return res.json({
          ...baseResponse,
          status: "error",
          processing_progress: 0,
          current_operation: "Batch processing failed",
          job_status: "failed",
          job_error: operationStatus.error.message,
        });
      }

      // ---=== BATCH IS DONE (operationStatus.done === true) ===---

      // Check if this is the FIRST time we're seeing it 'done'
      // We check < 100 to prevent re-triggering a completed job.
      if (currentProgress < 100) {
        console.log(
          `[getDocumentProcessingStatus] Batch for ${file_id} is DONE. Triggering background post-processing.`
        );

        // ** THIS IS THE CRITICAL FIX **
        // Update status to 'processing' so Case 3 handles future polls
        await updateProcessingProgress(
          file_id,
          "processing", // Set status to 'processing'
          42.0, // Set progress to 42 (end of OCR)
          "Batch OCR completed"
        );

        // ** FIRE-AND-FORGET **
        // Call the worker function but DO NOT await it.
        // This lets the API request return immediately.
        processBatchResults(file_id, job);

        // Return the 42% status to the client *immediately*
        return res.json({
          ...baseResponse,
          status: "processing", // Reflect the new status
          processing_progress: 42.0,
          current_operation: "Batch OCR completed",
          message: "Batch processing complete. Starting post-processing.",
        });
      }

      // Fallback: If we're here, it's 'done' but progress is somehow 100
      // (or processing was triggered by a duplicate request).
      // This shouldn't happen, but if it does, just return the current status.
      return res.json({
        ...baseResponse,
        message: "Post-processing is complete.",
      });
    }

    // Case 5: Just uploaded, not yet started
    return res.json({
      ...baseResponse,
      current_operation: "Queued",
      message: "Document uploaded successfully. Processing will begin shortly.",
    });
  } catch (error) {
    console.error("❌ getDocumentProcessingStatus error:", error);
    try {
      const { file_id } = req.params;
      if (file_id) {
        await updateProcessingProgress(
          file_id,
          "error",
          0.0,
          `Status check failed: ${error.message}`
        );
        const job = await ProcessingJobModel.getJobByFileId(file_id);
        if (job) {
          await ProcessingJobModel.updateJobStatus(
            job.job_id,
            "failed",
            error.message
          );
        }
      }
    } catch (updateError) {
      console.error("❌ Failed to update error status:", updateError);
    }

    return res.status(500).json({
      error: "Failed to fetch processing status.",
      details: error.message,
    });
  }
};

exports.batchUploadDocuments = async (req, res) => {
 const userId = req.user.id;
 const authorizationHeader = req.headers.authorization;

 try {
 console.log(`[batchUploadDocuments] Received batch upload request.`);
 const { secret_id, llm_name, trigger_initial_analysis_with_secret } = req.body; // Destructure trigger_initial_analysis_with_secret
 console.log(`[batchUploadDocuments] Received secret_id: ${secret_id}, llm_name: ${llm_name}, trigger_initial_analysis_with_secret: ${trigger_initial_analysis_with_secret}`);

 if (!userId) return res.status(401).json({ error: "Unauthorized" });
 if (!req.files || req.files.length === 0)
 return res.status(400).json({ error: "No files uploaded." });

 // --- Fetch user usage and plan ---
 let usageAndPlan;
 try {
 usageAndPlan = await TokenUsageService.getUserUsageAndPlan(
 userId,
 authorizationHeader
 );
 } catch (planError) {
 console.error(`❌ Failed to retrieve user plan for user ${userId}:`, planError.message);
 return res.status(500).json({
 success: false,
 message: "Failed to retrieve user plan. Please ensure the user plan service is accessible.",
 details: planError.message,
 });
 }

 const { usage: userUsage, plan: userPlan } = usageAndPlan;

 // --- Calculate requested resources for this batch ---
 // For simplicity, assume each document uses 1 document slot and a fixed number of tokens (adjust as needed)
 const requestedResources = {
 tokens: req.files.length * 100, // Example: each file consumes 100 tokens
 documents: req.files.length,
 ai_analysis: req.files.length,
 storage_gb: req.files.reduce((acc, f) => acc + f.size / (1024 ** 3), 0), // convert bytes to GB
 };

 // --- Enforce limits ---
 const limitCheck = await TokenUsageService.enforceLimits(
 userId,
 userUsage,
 userPlan,
 requestedResources
 );

 if (!limitCheck.allowed) {
 return res.status(403).json({
 success: false,
 message: limitCheck.message,
 nextRenewalTime: limitCheck.nextRenewalTime,
 remainingTime: limitCheck.remainingTime,
 });
 }

 const uploadedFiles = [];
 for (const file of req.files) {
 try {
 const originalFilename = file.originalname;
 const mimeType = file.mimetype;

 const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
 const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
 originalFilename,
 file.buffer,
 batchUploadFolder,
 true,
 mimeType
 );

 const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
 const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;

 // Start DocAI Batch Operation
 const operationName = await batchProcessDocument(
 [gcsInputUri],
 gcsOutputUriPrefix,
 mimeType
 );

 // Save file metadata
 const fileId = await DocumentModel.saveFileMetadata(
 userId,
 originalFilename,
 gcsInputUri,
 folderPath,
 mimeType,
 file.size,
 "batch_queued"
 );

 // Create job entry
 const jobId = uuidv4();
 await ProcessingJobModel.createJob({
 job_id: jobId,
 file_id: fileId,
 type: "batch",
 gcs_input_uri: gcsInputUri,
 gcs_output_uri_prefix: gcsOutputUriPrefix,
 document_ai_operation_name: operationName,
 status: "queued",
 secret_id: secret_id || null, // Pass secret_id from request body
 });

 await DocumentModel.updateFileStatus(fileId, "batch_processing", 0.0);

 uploadedFiles.push({
 file_id: fileId,
 job_id: jobId,
 filename: originalFilename,
 operation_name: operationName,
 gcs_input_uri: gcsInputUri,
 gcs_output_uri_prefix: gcsOutputUriPrefix,
 });
 } catch (innerError) {
 console.error(`❌ Error processing ${file.originalname}:`, innerError);
 uploadedFiles.push({
 filename: file.originalname,
 error: innerError.message,
 });
 }
 }

 // --- Increment usage after successful upload(s) ---
 try {
 await TokenUsageService.incrementUsage(
 userId,
 requestedResources,
 userPlan
 );
 } catch (usageError) {
 console.error(`❌ Error incrementing token usage for user ${userId}:`, usageError);
 }

 return res.status(202).json({
 success: true,
 message: "Batch document upload successful; processing initiated.",
 uploaded_files: uploadedFiles,
 });
 } catch (error) {
 console.error("❌ Batch Upload Error:", error);
 return res.status(500).json({
 success: false,
 message: "Failed to initiate batch processing",
 details: error.message,
 });
 }
};

/**
 * @description Retrieves the total storage utilization for the authenticated user.
 * @route GET /api/doc/user-storage-utilization
 */
exports.getUserStorageUtilization = async (req, res) => {
 try {
 const userId = req.user.id;
 if (!userId) {
 return res.status(401).json({ message: 'Unauthorized' });
 }

 const totalStorageUsedBytes = await File.getTotalStorageUsed(userId);
 const totalStorageUsedGB = (totalStorageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);

 res.status(200).json({
 storage: {
 used_bytes: totalStorageUsedBytes,
 used_gb: totalStorageUsedGB,
 }
 });

 } catch (error) {
 console.error('❌ Error fetching user storage utilization:', error);
 res.status(500).json({ message: 'Internal server error', error: error.message });
 }
};

/**
 * @description Retrieves user's current usage and plan details from the Document Service.
 * This endpoint is intended to be called by the Payment Service.
 * @route GET /api/doc/user-usage-and-plan/:userId
 */
exports.getUserUsageAndPlan = async (req, res) => {
 try {
 const { userId } = req.params;
 const authorizationHeader = req.headers.authorization; // Pass through auth header

 if (!userId) {
 return res.status(400).json({ error: "User ID is required." });
 }

 // Call the TokenUsageService to get the combined usage and plan data
 const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

 return res.status(200).json({
 success: true,
 data: {
 usage,
 plan,
 timeLeft
 }
 });

 } catch (error) {
 console.error('❌ Error fetching user usage and plan:', error);
 res.status(500).json({ message: 'Internal server error', error: error.message });
 }
};



// Export processDocument for use in other modules (e.g., documentRoutes)
exports.processDocument = processDocument;
