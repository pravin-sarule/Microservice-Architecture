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
async function processDocument(fileId, fileBuffer, mimetype, userId, secretId = null) {
  const jobId = uuidv4();
  await ProcessingJobModel.createJob({
    job_id: jobId,
    file_id: fileId,
    type: "synchronous",
    document_ai_operation_name: null,
    status: "queued",
    secret_id: secretId, // Pass secretId to the job
  });

  await DocumentModel.updateFileStatus(fileId, "processing", 0.0);

  let chunkingMethod = "recursive"; // Default fallback

  try {
    // ✅ Step 1: Determine chunking method dynamically
    if (secretId) {
      console.log(`[processDocument] Fetching chunking method for secret ID: ${secretId}`);
      const secretQuery = `
        SELECT chunking_method 
        FROM secret_manager
        WHERE id = $1
      `;
      const result = await db.query(secretQuery, [secretId]);
      if (result.rows.length > 0 && result.rows[0].chunking_method) {
        chunkingMethod = result.rows[0].chunking_method;
        console.log(`[processDocument] Using chunking method from DB: ${chunkingMethod}`);
      } else {
        console.warn(`[processDocument] No custom chunking method found for secret ID: ${secretId}. Using default: ${chunkingMethod}`);
      }
    } else {
      console.log(`[processDocument] No secret_id provided. Using default chunking method: ${chunkingMethod}`);
    }

    // ✅ Step 2: Check if document is already processed
    const file = await DocumentModel.getFileById(fileId);
    if (file.status === "processed") {
      console.log(`[processDocument] File ${fileId} already processed. Skipping re-processing.`);
      await ProcessingJobModel.updateJobStatus(jobId, "completed");
      return;
    }

    // ✅ Step 3: Extract text from document (OCR or direct)
    let extractedTexts = [];
    const ocrMimeTypes = [
      "application/pdf", "image/png", "image/jpeg", "image/tiff",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ];

    const useOCR = ocrMimeTypes.includes(String(mimetype).toLowerCase());
    if (useOCR) {
      console.log(`[processDocument] Using Document AI OCR for file ID ${fileId}`);
      extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
    } else {
      console.log(`[processDocument] Using standard text extraction for file ID ${fileId}`);
      const text = await extractText(fileBuffer, mimetype);
      extractedTexts.push({ text });
    }

    if (!extractedTexts.length || extractedTexts.every(item => !item.text || item.text.trim() === "")) {
      throw new Error("No meaningful text extracted from document.");
    }

    await DocumentModel.updateFileStatus(fileId, "processing", 25.0);

    // ✅ Step 4: Chunk document using selected chunking method
    console.log(`[processDocument] Chunking file ID ${fileId} using method: ${chunkingMethod}`);
    const chunks = await chunkDocument(extractedTexts, fileId, chunkingMethod);
    console.log(`[processDocument] Generated ${chunks.length} chunks using ${chunkingMethod} method.`);
    await DocumentModel.updateFileStatus(fileId, "processing", 50.0);

    if (!chunks.length) {
      console.warn(`[processDocument] No chunks generated. Marking as processed.`);
      await DocumentModel.updateFileProcessedAt(fileId);
      await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
      await ProcessingJobModel.updateJobStatus(jobId, "completed");
      return;
    }

    // ✅ Step 5: Generate embeddings
    console.log(`[processDocument] Generating embeddings for ${chunks.length} chunks...`);
    const chunkContents = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    if (chunks.length !== embeddings.length) {
      throw new Error("Mismatch between number of chunks and embeddings generated.");
    }

    // ✅ Step 6: Save chunks and embeddings
    const chunksToSave = chunks.map((chunk, i) => ({
      file_id: fileId,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    const savedChunks = await FileChunkModel.saveMultipleChunks(chunksToSave);
    console.log(`[processDocument] Saved ${savedChunks.length} chunks to database.`);

    const vectorsToSave = savedChunks.map((savedChunk, i) => ({
      chunk_id: savedChunk.id,
      embedding: embeddings[i],
      file_id: fileId,
    }));

    await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);
    await DocumentModel.updateFileStatus(fileId, "processing", 75.0);

    // ✅ Step 7: Generate summary
    try {
      const fullText = chunks.map(c => c.content).join("\n\n");
      if (fullText.trim()) {
        const summary = await getSummaryFromChunks(fullText);
        await DocumentModel.updateFileSummary(fileId, summary);
        console.log(`[processDocument] Summary generated for file ID ${fileId}`);
      }
    } catch (summaryError) {
      console.warn(`[processDocument] Summary generation failed: ${summaryError.message}`);
    }

    // ✅ Step 8: Finalize status
    await DocumentModel.updateFileProcessedAt(fileId);
    await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
    await ProcessingJobModel.updateJobStatus(jobId, "completed");

    console.log(`✅ Document ID ${fileId} fully processed using '${chunkingMethod}' method.`);
  } catch (error) {
    console.error(`❌ processDocument failed for file ID ${fileId}:`, error);
    await DocumentModel.updateFileStatus(fileId, "error", 0.0);
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
      question,           // For custom queries
      used_secret_prompt = false,
      prompt_label = null,
      session_id = null,
      secret_id,          // NEW: For secret prompts
      llm_name,           // NEW: Optional LLM override
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
      finalPromptLabel,      // prompt_label
      used_secret_prompt ? secret_id : null  // secret_id (now passed to saveChat)
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



exports.getDocumentProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      return res.status(400).json({ error: "file_id is required." });
    }

    console.log(`[getDocumentProcessingStatus] Received request for file_id: ${file_id}`);

    const file = await DocumentModel.getFileById(file_id);
    if (!file || String(file.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied or file not found." });
    }

    const job = await ProcessingJobModel.getJobByFileId(file_id);

    // If already processed
    if (file.status === "processed") {
      const existingChunks = await FileChunkModel.getChunksByFileId(file_id);
      return res.json({
        document_id: file.id,
        status: file.status,
        processing_progress: file.processing_progress,
        job_status: job ? job.status : "completed",
        job_error: job ? job.error_message : null,
        last_updated: file.updated_at,
        chunks: existingChunks,
        summary: file.summary,
      });
    }

    // No job yet
    if (!job || !job.document_ai_operation_name) {
      return res.json({
        document_id: file.id,
        status: file.status,
        processing_progress: file.processing_progress,
        job_status: "not_queued",
        job_error: null,
        last_updated: file.updated_at,
        chunks: [],
        summary: file.summary,
      });
    }

    console.log(`[getDocumentProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
    const status = await getOperationStatus(job.document_ai_operation_name);
    console.log(`[getDocumentProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

    // If still running
    if (!status.done) {
      return res.json({
        file_id: file.id,
        status: "batch_processing",
        processing_progress: file.processing_progress,
        job_status: "running",
        job_error: null,
        last_updated: file.updated_at,
      });
    }

    // If failed
    if (status.error) {
      await DocumentModel.updateFileStatus(file_id, "error", 0.0);
      await ProcessingJobModel.updateJobStatus(job.id, "failed", status.error.message);
      return res.status(500).json({
        file_id: file.id,
        status: "error",
        processing_progress: 0.0,
        job_status: "failed",
        job_error: status.error.message,
        last_updated: new Date().toISOString(),
      });
    }

    // Fetch processed text
    const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
    const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
    console.log(`[getDocumentProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);

    await DocumentModel.updateFileStatus(file_id, "processing", 75.0);

    // ✅ Fetch chunking method via secret_manager → chunking_methods
    let batchChunkingMethod = "recursive";
    try {
      const chunkMethodQuery = `
        SELECT cm.method_name
        FROM processing_jobs pj
        LEFT JOIN secret_manager sm ON pj.secret_id = sm.id
        LEFT JOIN chunking_methods cm ON sm.chunking_method_id = cm.id
        WHERE pj.file_id = $1
        ORDER BY pj.created_at DESC
        LIMIT 1;
      `;
      const result = await db.query(chunkMethodQuery, [file_id]);

      if (result.rows.length > 0) {
        batchChunkingMethod = result.rows[0].method_name;
        console.log(`[getDocumentProcessingStatus] ✅ Using chunking method from DB: ${batchChunkingMethod}`);
      } else {
        console.log(`[getDocumentProcessingStatus] No secret_id found for file ${file_id}, using default chunking method.`);
      }
    } catch (err) {
      console.error(`[getDocumentProcessingStatus] Error fetching chunking method: ${err.message}`);
      console.log(`[getDocumentProcessingStatus] Falling back to default chunking method: recursive`);
    }

    // ✅ Chunking
    console.log(`[getDocumentProcessingStatus] Starting chunking for file ID ${file_id} using method: ${batchChunkingMethod}`);
    const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);

    // Save chunks and vectors
    const chunkContents = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    const chunksToSave = chunks.map((chunk, i) => ({
      file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    await FileChunkModel.saveMultipleChunks(chunksToSave);

    const savedChunks = await FileChunkModel.getChunksByFileId(file_id);
    const vectors = savedChunks.map((chunk, i) => ({
      chunk_id: chunk.id,
      embedding: embeddings[i],
      file_id,
    }));

    await ChunkVectorModel.saveMultipleChunkVectors(vectors);

    await DocumentModel.updateFileStatus(file_id, "processed", 100.0);
    await ProcessingJobModel.updateJobStatus(job.id, "completed");

    // Generate summary
    const fullText = chunks.map(c => c.content).join("\n\n");
    try {
      const summary = await getSummaryFromChunks(fullText);
      await DocumentModel.updateFileSummary(file_id, summary);
    } catch (err) {
      console.warn(`[getDocumentProcessingStatus] ⚠️ Summary generation failed: ${err.message}`);
    }

    // Return final response
    const updatedFile = await DocumentModel.getFileById(file_id);
    const finalChunks = await FileChunkModel.getChunksByFileId(file_id);

    return res.json({
      document_id: updatedFile.id,
      status: updatedFile.status,
      processing_progress: updatedFile.processing_progress,
      job_status: "completed",
      job_error: null,
      last_updated: updatedFile.updated_at,
      chunks: finalChunks,
      summary: updatedFile.summary,
      chunking_method: batchChunkingMethod,
    });

  } catch (error) {
    console.error("❌ getDocumentProcessingStatus error:", error);
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
