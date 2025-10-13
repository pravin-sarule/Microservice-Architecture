const db = require("../config/db");
const axios = require("axios"); // Import axios
const DocumentModel = require("../models/documentModel");
const File = require("../models/File"); // Import the File model
const FileChunkModel = require("../models/FileChunk");
const ChunkVectorModel = require("../models/ChunkVector");
const ProcessingJobModel = require("../models/ProcessingJob");
const FileChat = require("../models/FileChat");

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
  askLLM, // Add askLLM here
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

/**
 * @description Asynchronously processes a document by extracting text, chunking, generating embeddings, and summarizing.
 */
async function processDocument(fileId, fileBuffer, mimetype, userId) {
  const jobId = uuidv4();
  await ProcessingJobModel.createJob({
    job_id: jobId,
    file_id: fileId,
    type: "synchronous",
    document_ai_operation_name: null,
    status: "queued",
  });
  await DocumentModel.updateFileStatus(fileId, "processing", 0.0);

  try {
    const file = await DocumentModel.getFileById(fileId);
    if (file.status === "processed") {
      const existingChunks = await FileChunkModel.getChunksByFileId(fileId);
      if (existingChunks && existingChunks.length > 0) {
        console.log(
          `[processDocument] Returning cached chunks for file ID ${fileId}.`
        );
        await ProcessingJobModel.updateJobStatus(jobId, "completed");
        console.log(
          `✅ Document ID ${fileId} already processed. Skipping re-processing.`
        );
        return;
      }
    }

    let extractedTexts = [];
    const ocrMimeTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/tiff",
    ];
    const useOCR = Boolean(
      mimetype && ocrMimeTypes.includes(String(mimetype).toLowerCase())
    );

    if (useOCR) {
      console.log(`Using Document AI OCR for file ID ${fileId}`);
      extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
    } else {
      console.log(`Using standard text extraction for file ID ${fileId}`);
      const text = await extractText(fileBuffer, mimetype);
      extractedTexts.push({ text: text });
    }

    if (
      !extractedTexts ||
      extractedTexts.length === 0 ||
      extractedTexts.every(
        (item) => !item || !item.text || item.text.trim() === ""
      )
    ) {
      throw new Error(
        "Could not extract any meaningful text content from document."
      );
    }

    await DocumentModel.updateFileStatus(fileId, "processing", 25.0);

    const chunks = await chunkDocument(extractedTexts, fileId);
    console.log(`Chunked file ID ${fileId} into ${chunks.length} chunks.`);
    await DocumentModel.updateFileStatus(fileId, "processing", 50.0);

    if (chunks.length === 0) {
      console.warn(
        `No chunks generated for file ID ${fileId}. Skipping embedding generation.`
      );
      await DocumentModel.updateFileProcessedAt(fileId);
      await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
      await ProcessingJobModel.updateJobStatus(jobId, "completed");
      console.log(
        `✅ Document ID ${fileId} processed successfully (no chunks).`
      );
      return;
    }

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    if (chunks.length !== embeddings.length) {
      throw new Error(
        "Mismatch between number of chunks and embeddings generated."
      );
    }

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

    const vectorsToSave = savedChunks.map((savedChunk) => {
      const originalChunkIndex = savedChunk.chunk_index;
      const originalChunk = chunks[originalChunkIndex];
      const embedding = embeddings[originalChunkIndex];
      return {
        chunk_id: savedChunk.id,
        embedding: embedding,
        file_id: fileId,
      };
    });

    await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSave);

    await DocumentModel.updateFileStatus(fileId, "processing", 75.0);

    let summary = null;
    try {
      const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
      if (fullTextForSummary.length > 0) {
        summary = await getSummaryFromChunks(fullTextForSummary);
        await DocumentModel.updateFileSummary(fileId, summary);
        console.log(`📝 Generated summary for document ID ${fileId}.`);
      }
    } catch (summaryError) {
      console.warn(
        `⚠️ Could not generate summary for document ID ${fileId}:`,
        summaryError.message
      );
    }

    await DocumentModel.updateFileProcessedAt(fileId);
    await DocumentModel.updateFileStatus(fileId, "processed", 100.0);
    await ProcessingJobModel.updateJobStatus(jobId, "completed");

    console.log(`✅ Document ID ${fileId} processed successfully.`);
  } catch (error) {
    console.error(`❌ Error processing document ID ${fileId}:`, error);
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

// exports.chatWithDocument = async (req, res) => {
//   let userId = null;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const {
//       file_id,
//       question,
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null,
//     } = req.body;

//     userId = req.user.id;

//     // Validation
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//     if (!file_id || !question) {
//       console.error("❌ Chat Error: file_id or question missing.");
//       return res.status(400).json({ error: "file_id and question are required." });
//     }
//     if (!uuidRegex.test(file_id)) {
//       console.error(`❌ Chat Error: Invalid file ID format for file_id: ${file_id}`);
//       return res.status(400).json({ error: "Invalid file ID format." });
//     }

//     // Check file access
//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: "File not found." });
//     if (String(file.user_id) !== String(userId)) {
//       return res.status(403).json({ error: "Access denied." });
//     }
//     if (file.status !== "processed") {
//       console.error(`❌ Chat Error: Document ${file_id} not yet processed. Current status: ${file.status}`);
//       return res.status(400).json({
//         error: "Document is not yet processed.",
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     // Build document text
//     const allChunks = await FileChunkModel.getChunksByFileId(file_id);
//     const documentFullText = allChunks.map((c) => c.content).join("\n\n");
//     if (!documentFullText || documentFullText.trim() === "") {
//       console.error(`❌ Chat Error: Document ${file_id} has no readable content.`);
//       return res.status(400).json({ error: "Document has no readable content." });
//     }

//     // Token cost
//     const chatCost = Math.ceil(question.length / 100) + Math.ceil(documentFullText.length / 200);

//     const { userUsage, userPlan, requestedResources } = req;

//     // Enforce limits is already handled by middleware. If we reach here, it's allowed.
//     // The middleware also handles refetching usage if renewal occurred.

//     // Find context
//     const questionEmbedding = await generateEmbedding(question);
//     const relevantChunks = await ChunkVectorModel.findNearestChunks(questionEmbedding, 5, file_id);
//     const relevantChunkContents = relevantChunks.map((chunk) => chunk.content);
//     const usedChunkIds = relevantChunks.map((chunk) => chunk.chunk_id);

//     let answer;
//     if (relevantChunkContents.length === 0) {
//       answer = await askGemini("No relevant context found in the document.", question);
//     } else {
//       const context = relevantChunkContents.join("\n\n");
//       answer = await askGemini(context, question);
//     }

//     // Store chat
//     const storedQuestion = used_secret_prompt
//       ? `[${prompt_label || "Secret Prompt"}]`
//       : question;

//     const savedChat = await FileChat.saveChat(
//       file_id,
//       userId,
//       storedQuestion,
//       answer,
//       session_id,
//       usedChunkIds,
//       used_secret_prompt,
//       used_secret_prompt ? prompt_label : null
//     );

//     // Increment usage after successful AI chat
//     await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);

//     // Fetch full session history
//     const history = await FileChat.getChatHistory(file_id, savedChat.session_id);

//     return res.json({
//       session_id: savedChat.session_id,
//       answer,
//       history,
//     });
//   } catch (error) {
//     console.error("❌ Error chatting with document:", error);
//     return res.status(500).json({ error: "Failed to get AI answer.", details: error.message });
//   }
// };

exports.chatWithDocument = async (req, res) => {
  let userId = null;

  try {
    const {
      file_id,
      question,
      used_secret_prompt = false,
      prompt_label = null,
      session_id = null,
    } = req.body;

    userId = req.user.id;

    // Validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!file_id || !question) {
      console.error("❌ Chat Error: file_id or question missing.");
      return res.status(400).json({ error: "file_id and question are required." });
    }
    if (!uuidRegex.test(file_id)) {
      console.error(`❌ Chat Error: Invalid file ID format for file_id: ${file_id}`);
      return res.status(400).json({ error: "Invalid file ID format." });
    }

    console.log(`[chatWithDocument] User ${userId} asking: "${question.substring(0, 50)}..." for file ${file_id}`);

    // Check file access
    const file = await DocumentModel.getFileById(file_id);
    if (!file) return res.status(404).json({ error: "File not found." });
    if (String(file.user_id) !== String(userId)) {
      return res.status(403).json({ error: "Access denied." });
    }
    if (file.status !== "processed") {
      console.error(`❌ Chat Error: Document ${file_id} not yet processed. Current status: ${file.status}`);
      return res.status(400).json({
        error: "Document is not yet processed.",
        status: file.status,
        progress: file.processing_progress,
      });
    }

    // Build document text
    const allChunks = await FileChunkModel.getChunksByFileId(file_id);
    const documentFullText = allChunks.map((c) => c.content).join("\n\n");
    if (!documentFullText || documentFullText.trim() === "") {
      console.error(`❌ Chat Error: Document ${file_id} has no readable content.`);
      return res.status(400).json({ error: "Document has no readable content." });
    }

    // Token cost calculation (if using limits)
    const chatCost = Math.ceil(question.length / 100) + Math.ceil(documentFullText.length / 200);
    const { userUsage, userPlan, requestedResources } = req;

    // ✅ For custom queries: Use vector search for relevant context
    console.log(`[chatWithDocument] Generating embedding for question...`);
    const questionEmbedding = await generateEmbedding(question);
    
    console.log(`[chatWithDocument] Finding nearest chunks...`);
    const relevantChunks = await ChunkVectorModel.findNearestChunks(questionEmbedding, 5, file_id);
    const relevantChunkContents = relevantChunks.map((chunk) => chunk.content);
    const usedChunkIds = relevantChunks.map((chunk) => chunk.chunk_id);

    console.log(`[chatWithDocument] Found ${relevantChunks.length} relevant chunks`);

    let answer;
    const provider = 'gemini'; // ✅ Default to Gemini for custom queries

    if (relevantChunkContents.length === 0) {
      console.log(`[chatWithDocument] No relevant chunks found, using full document`);
      // No relevant context, use full document
      answer = await askLLM(provider, question, documentFullText);
    } else {
      // Use relevant chunks as context
      const context = relevantChunkContents.join("\n\n");
      console.log(`[chatWithDocument] Using context of ${context.length} characters`);
      answer = await askLLM(provider, question, context);
    }

    console.log(`[chatWithDocument] Received answer of ${answer.length} characters`);

    // Store chat
    const storedQuestion = used_secret_prompt
      ? `[${prompt_label || "Secret Prompt"}]`
      : question;

    const savedChat = await FileChat.saveChat(
      file_id,
      userId,
      storedQuestion,
      answer,
      session_id,
      usedChunkIds,
      used_secret_prompt,
      used_secret_prompt ? prompt_label : null
    );

    console.log(`[chatWithDocument] Chat saved with ID: ${savedChat.id}`);

    // Increment usage after successful AI chat
    await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);

    // Fetch full session history
    const history = await FileChat.getChatHistory(file_id, savedChat.session_id);

    return res.json({
      session_id: savedChat.session_id,
      answer,
      history,
      used_chunk_ids: usedChunkIds,
    });
  } catch (error) {
    console.error("❌ Error chatting with document:", error);
    console.error("Stack trace:", error.stack);
    return res.status(500).json({ error: "Failed to get AI answer.", details: error.message });
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

/**
 * @description Retrieves the processing status of a document, including progress and extracted chunks/summary if available.
 * @route GET /api/doc/status/:file_id
 */
exports.getDocumentProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;
    if (!file_id) {
      console.error("❌ getDocumentProcessingStatus Error: file_id is missing from request parameters.");
      return res.status(400).json({ error: "file_id is required." });
    }
    console.log(`[getDocumentProcessingStatus] Received request for file_id: ${file_id}`);

    const file = await DocumentModel.getFileById(file_id);
    if (!file || String(file.user_id) !== String(req.user.id)) {
      console.error(`❌ getDocumentProcessingStatus Error: Access denied for file ${file_id}. File owner: ${file.user_id}, Requesting user: ${req.user.id}`);
      return res
        .status(403)
        .json({ error: "Access denied or file not found." });
    }

    const job = await ProcessingJobModel.getJobByFileId(file_id);

    if (file.status === "processed") {
      const existingChunks = await FileChunkModel.getChunksByFileId(file_id);
      if (existingChunks && existingChunks.length > 0) {
        const formattedChunks = existingChunks.map((chunk) => ({
          text: chunk.content,
          metadata: {
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            heading: chunk.heading,
          },
        }));
        return res.json({
          document_id: file.id,
          status: file.status,
          processing_progress: file.processing_progress,
          job_status: job ? job.status : "completed",
          job_error: job ? job.error_message : null,
          last_updated: file.updated_at,
          chunks: formattedChunks,
          summary: file.summary,
        });
      }
    }

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

    if (status.error) {
      console.error(`[getDocumentProcessingStatus] Document AI operation failed with error: ${status.error.message}`);
      await DocumentModel.updateFileStatus(file_id, "error", 0.0);
      await ProcessingJobModel.updateJobStatus(
        job.id,
        "failed",
        status.error.message
      );
      return res.status(500).json({
        file_id: file.id,
        status: "error",
        processing_progress: 0.0,
        job_status: "failed",
        job_error: status.error.message,
        last_updated: new Date().toISOString(),
      });
    }

    const bucketName = process.env.GCS_OUTPUT_BUCKET_NAME;
    const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
    console.log(`[getDocumentProcessingStatus] Document AI operation completed. Fetching results from GCS. Bucket: ${bucketName}, Prefix: ${prefix}`);
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
    console.log(`[getDocumentProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);
    if (extractedBatchTexts.length === 0) {
      console.warn(`[getDocumentProcessingStatus] No text extracted from batch results for file ID ${file_id}.`);
    }

    if (
      !extractedBatchTexts ||
      extractedBatchTexts.length === 0 ||
      extractedBatchTexts.every(
        (item) => !item || !item.text || item.text.trim() === ""
      )
    ) {
      throw new Error(
        "Could not extract any meaningful text content from batch document."
      );
    }

    await DocumentModel.updateFileStatus(file_id, "processing", 75.0);
    console.log(`[getDocumentProcessingStatus] Document ID ${file_id} status updated to 75% (text extracted).`);

    console.log(`[getDocumentProcessingStatus] Starting chunking for file ID ${file_id}.`);
    const chunks = await chunkDocument(extractedBatchTexts, file_id);
    console.log(`[getDocumentProcessingStatus] Chunked file ID ${file_id} into ${chunks.length} chunks.`);
    if (chunks.length === 0) {
      console.warn(`[getDocumentProcessingStatus] Chunking resulted in 0 chunks for file ID ${file_id}.`);
    }

    if (chunks.length === 0) {
      await DocumentModel.updateFileStatus(file_id, "processed", 100.0);
      await ProcessingJobModel.updateJobStatus(job.id, "completed");
      const updatedFile = await DocumentModel.getFileById(file_id);
      return res.json({
        document_id: updatedFile.id,
        chunks: [],
        summary: updatedFile.summary,
      });
    }

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    if (chunks.length !== embeddings.length) {
      throw new Error(
        "Mismatch between number of chunks and embeddings generated for batch document."
      );
    }

    const chunksToSaveBatch = chunks.map((chunk, i) => ({
      file_id: file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    console.log(`[getDocumentProcessingStatus] Attempting to save ${chunksToSaveBatch.length} chunks for file ID ${file_id}.`);
    const savedChunksBatch = await FileChunkModel.saveMultipleChunks(
      chunksToSaveBatch
    );
    console.log(`[getDocumentProcessingStatus] Saved ${savedChunksBatch.length} chunks for file ID ${file_id}.`);
    if (savedChunksBatch.length === 0) {
      console.error(`[getDocumentProcessingStatus] Failed to save any chunks for file ID ${file_id}.`);
    }

    const vectorsToSaveBatch = savedChunksBatch.map((savedChunk) => {
      const originalChunkIndex = savedChunk.chunk_index;
      const originalChunk = chunks[originalChunkIndex];
      const embedding = embeddings[originalChunkIndex];
      return {
        chunk_id: savedChunk.id,
        embedding: embedding,
        file_id: file_id,
      };
    });

    console.log(`[getDocumentProcessingStatus] Attempting to save ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);
    await ChunkVectorModel.saveMultipleChunkVectors(vectorsToSaveBatch);
    console.log(`[getDocumentProcessingStatus] Saved ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);

    await DocumentModel.updateFileStatus(file_id, "processed", 100.0);
    await ProcessingJobModel.updateJobStatus(job.id, "completed");
    console.log(`[getDocumentProcessingStatus] Document ID ${file_id} processing completed.`);

    let summary = null;
    try {
      const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
      if (fullTextForSummary.length > 0) {
        console.log(`[getDocumentProcessingStatus] Generating summary for document ID ${file_id}.`);
        summary = await getSummaryFromChunks(fullTextForSummary);
        await DocumentModel.updateFileSummary(file_id, summary);
        console.log(`[getDocumentProcessingStatus] Generated summary for document ID ${file_id}.`);
      }
    } catch (summaryError) {
      console.warn(
        `⚠️ Could not generate summary for batch document ID ${file_id}:`,
        summaryError.message
      );
    }

    const updatedFile = await DocumentModel.getFileById(file_id);
    const fileChunks = await FileChunkModel.getChunksByFileId(file_id);

    const formattedChunks = fileChunks.map((chunk) => ({
      text: chunk.content,
      metadata: {
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        heading: chunk.heading,
      },
    }));

    return res.json({
      document_id: updatedFile.id,
      status: updatedFile.status,
      processing_progress: updatedFile.processing_progress,
      job_status: "completed",
      job_error: null,
      last_updated: updatedFile.updated_at,
      chunks: formattedChunks,
      summary: updatedFile.summary,
    });
  } catch (error) {
    console.error("❌ getDocumentProcessingStatus error:", error);
    return res
      .status(500)
      .json({
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

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded." });

    const { userUsage, userPlan, requestedResources } = req;

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
        console.log(`📄 Started Document AI batch operation: ${operationName}`);

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
        console.log(`[batchUploadDocuments] Saved file metadata ID: ${fileId}`);

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

    // Increment usage after successful upload(s)
    await TokenUsageService.incrementUsage(
      userId,
      requestedResources,
      userUsage,
      userPlan
    );

    return res.status(202).json({
      message: "Batch document upload successful; processing initiated.",
      uploaded_files: uploadedFiles,
    });
  } catch (error) {
    console.error("❌ Batch Upload Error:", error);
    return res.status(500).json({
      error: "Failed to initiate batch processing",
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
