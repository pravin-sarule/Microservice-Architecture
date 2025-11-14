

require("dotenv").config();

const mime = require("mime-types");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Database
const pool = require("../config/db");

// Models
const File = require("../models/File");
const FileChat = require("../models/FileChat");
const FileChunk = require("../models/FileChunk");
const ChunkVector = require("../models/ChunkVector");
const ProcessingJob = require("../models/ProcessingJob");
const FolderChat = require("../models/FolderChat");

// Services
const {
  uploadToGCS,
  getSignedUrl: getSignedUrlFromGCS, // Renamed to avoid conflict
  getSignedUploadUrl,
} = require("../services/gcsService");
const { getSignedUrl } = require("../services/folderService"); // Import from folderService
const { checkStorageLimit } = require("../utils/storage");
const { bucket } = require("../config/gcs");
const { askGemini, getSummaryFromChunks, askLLM, getAvailableProviders, resolveProviderName } = require("../services/aiService");
const { askLLM: askFolderLLMService, resolveProviderName: resolveFolderProviderName, getAvailableProviders: getFolderAvailableProviders } = require("../services/folderAiService"); // Import askLLM, resolveProviderName, and getAvailableProviders from folderAiService
const { extractText } = require("../utils/textExtractor");
const {
  extractTextFromDocument,
  batchProcessDocument,
  getOperationStatus,
  fetchBatchResults,
} = require("../services/documentAiService");
const { chunkDocument } = require("../services/chunkingService");
const { generateEmbedding, generateEmbeddings } = require("../services/embeddingService");
const { enqueueEmbeddingJob } = require("../queues/embeddingQueue");
const { fileInputBucket, fileOutputBucket } = require("../config/gcs");
const TokenUsageService = require("../services/tokenUsageService"); // Import TokenUsageService
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager'); // NEW
const secretManagerController = require('./secretManagerController'); // NEW
const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID; // NEW
let secretClient; // NEW

if (!secretClient) { // NEW
  secretClient = new SecretManagerServiceClient(); // NEW
} // NEW

/* ----------------- Helpers ----------------- */
function sanitizeName(name) {
  return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Helper to escape special characters in a string for use in a regular expression
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

async function ensureUniqueKey(key) {
  const dir = path.posix.dirname(key);
  const name = path.posix.basename(key);
  const ext = path.posix.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;

  let candidate = key;
  let counter = 1;

  while (true) {
    const [exists] = await bucket.file(candidate).exists();
    if (!exists) return candidate;
    candidate = path.posix.join(dir, `${stem}(${counter})${ext}`);
    counter++;
  }
}

async function makeSignedReadUrl(objectKey, minutes = 15) {
  const [signedUrl] = await bucket.file(objectKey).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + minutes * 60 * 1000,
  });
  return signedUrl;
}


// Progress stage definitions
const PROGRESS_STAGES = {
  INIT: { start: 0, end: 5, status: 'batch_queued' },
  UPLOAD: { start: 5, end: 15, status: 'batch_queued' },
  BATCH_START: { start: 15, end: 20, status: 'batch_processing' },
  BATCH_OCR: { start: 20, end: 42, status: 'batch_processing' },
  FETCH_RESULTS: { start: 42, end: 45, status: 'processing' },
  CONFIG: { start: 45, end: 48, status: 'processing' },
  CHUNKING: { start: 48, end: 58, status: 'processing' },
  EMBEDDING_QUEUE: { start: 58, end: 68, status: 'processing' },
  SAVE_CHUNKS: { start: 68, end: 78, status: 'processing' },
  SUMMARY: { start: 78, end: 88, status: 'embedding_pending' },
  FINALIZE: { start: 88, end: 100, status: 'embedding_pending' },
};

/**
 * Get human-readable operation name based on progress
 */
function getOperationName(progress, status) {
  if (status === "processed" || status === "completed") return "Completed";
  if (status === "error" || status === "failed") return "Failed";
  
  const p = parseFloat(progress) || 0;
  
  // Batch queued stage (0-15%)
  if (status === "batch_queued") {
    if (p < 5) return "Initializing document processing";
    if (p < 15) return "Uploading document to cloud storage";
    return "Preparing batch operation";
  }
  
  // Batch processing stage (15-42%)
  if (status === "batch_processing") {
    if (p < 20) return "Starting Document AI batch processing";
    if (p < 25) return "Document uploaded to processing queue";
    if (p < 30) return "OCR analysis in progress";
    if (p < 35) return "Extracting text from document";
    if (p < 40) return "Processing document layout";
    return "Completing OCR extraction";
  }
  
  if (status === "embedding_pending") {
    return "Waiting for background embedding";
  }

  if (status === "embedding_processing") {
    return "Embedding chunks in background";
  }

  if (status === "embedding_failed") {
    return "Embedding failed";
  }

  // Post-processing stage (42-100%)
  if (status === "processing") {
    if (p < 45) return "Fetching OCR results";
    if (p < 48) return "Loading chunking configuration";
    if (p < 52) return "Initializing chunking";
    if (p < 58) return "Chunking document into segments";
    if (p < 64) return "Preparing for embedding";
    if (p < 70) return "Connecting to embedding service";
    if (p < 76) return "Generating AI embeddings";
    if (p < 79) return "Preparing database storage";
    if (p < 82) return "Saving chunks to database";
    if (p < 85) return "Preparing vector embeddings";
    if (p < 88) return "Storing vector embeddings";
    if (p < 92) return "Generating AI summary";
    if (p < 96) return "Saving document summary";
    if (p < 98) return "Updating document metadata";
    if (p < 100) return "Finalizing document processing";
    return "Processing complete";
  }
  
  return "Queued";
}

// ============================================================================
// PROGRESS UPDATE HELPERS
// ============================================================================

/**
 * Update progress with consistent formatting and DATABASE WRITE
 */
const updateProgress = async (fileId, status, progress, operation = null) => {
  const currentOperation = operation || getOperationName(progress, status);
  
  // ✅ CRITICAL: Actually update the database
  await File.updateProcessingStatus(fileId, status, progress, currentOperation);
  
  console.log(`[Progress] File ${fileId.substring(0, 8)}...: ${progress.toFixed(1)}% - ${currentOperation}`);
  
  return {
    file_id: fileId,
    status,
    progress: parseFloat(progress.toFixed(1)),
    operation: currentOperation,
    timestamp: new Date().toISOString()
  };
};

/**
 * Smoothly increment progress with consistent intervals
 */
const smoothProgressIncrement = async (
  fileId,
  status,
  startProgress,
  endProgress,
  operation = null,
  delayMs = 100
) => {
  const start = parseFloat(startProgress);
  const end = parseFloat(endProgress);
  const steps = Math.ceil(end - start);
  
  for (let i = 0; i <= steps; i++) {
    const currentProgress = start + i;
    if (currentProgress > end) break;
    
    await updateProgress(fileId, status, currentProgress, operation);
    
    if (i < steps) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

// ============================================================================
// BATCH POLLING WITH CLEAR PROGRESS
// ============================================================================

/**
 * Background polling to update batch processing progress (20% -> 42%)
 */
async function pollBatchProgress(fileId, jobId, operationName) {
  console.log(`[Batch Polling] 🔄 Starting progress polling for file: ${fileId}`);
  
  const maxPolls = 300; // 25 minutes max
  let pollCount = 0;
  let batchCompleted = false;
  
  const pollInterval = setInterval(async () => {
    try {
      pollCount++;
      
      // Check file status
      const file = await File.getFileById(fileId);
      
      if (!file) {
        console.log(`[Batch Polling] ❌ File ${fileId} not found. Stopping.`);
        clearInterval(pollInterval);
        return;
      }
      
      // Stop if moved to post-processing
      if (file.status === "processing" || file.status === "processed") {
        console.log(`[Batch Polling] ✅ Status: ${file.status}. Stopping poll.`);
        clearInterval(pollInterval);
        return;
      }
      
      // Stop on error
      if (file.status === "error") {
        console.log(`[Batch Polling] ❌ Error detected. Stopping poll.`);
        clearInterval(pollInterval);
        return;
      }
      
      // Check batch operation status
      const status = await getOperationStatus(operationName);
      
      if (status.done && !batchCompleted) {
        batchCompleted = true;
        console.log(`[Batch Polling] ✅ Batch operation COMPLETED for file: ${fileId}`);
        
        if (status.error) {
          console.error(`[Batch Polling] ❌ Batch failed:`, status.error.message);
          await updateProgress(fileId, "error", 0, "Batch processing failed");
          await ProcessingJob.updateJobStatus(jobId, "failed", status.error.message);
          clearInterval(pollInterval);
          return;
        }
        
        // Move to post-processing at 42%
        await updateProgress(fileId, "processing", 42.0, "OCR completed. Starting post-processing");
        
        const job = await ProcessingJob.getJobByFileId(fileId);
        
        if (!job) {
          console.error(`[Batch Polling] ❌ Job not found for file: ${fileId}`);
          clearInterval(pollInterval);
          return;
        }
        
        console.log(`[Batch Polling] 🚀 Triggering post-processing for file: ${fileId}`);
        
        // Trigger post-processing
if (file.status !== "processing_locked") {
          File.updateProcessingStatus(fileId, "processing_locked", 42.0)
            .then(() => {
              processBatchResults(fileId, job).catch(err => {
                console.error(`[Batch Polling] ❌ Post-processing error:`, err);
                File.updateProcessingStatus(fileId, "error", 42.0, "Post-processing failed");
              });
            });
        }
        
        clearInterval(pollInterval);
        return;
      }
      
      // ✅ IMPORTANT: Gradual progress increment during batch processing (20% -> 41.5%)
      const currentProgress = parseFloat(file.processing_progress) || 20;
      
      if (file.status === "batch_processing" && currentProgress < 42) {
        // Increment by 0.5% every 5 seconds for smooth progress
        const newProgress = Math.min(currentProgress + 0.5, 41.5);
        await updateProgress(fileId, "batch_processing", newProgress);
      }
      
      // Stop after max attempts
      if (pollCount >= maxPolls) {
        console.warn(`[Batch Polling] ⚠️ Max polls reached for file: ${fileId}`);
        await updateProgress(fileId, "error", 0, "Batch processing timeout");
        await ProcessingJob.updateJobStatus(jobId, "failed", "Processing timeout");
        clearInterval(pollInterval);
      }
      
    } catch (error) {
      console.error(`[Batch Polling] ❌ Error in poll #${pollCount}:`, error.message);
      // Continue polling on error
    }
  }, 5000); // Poll every 5 seconds
}

// ============================================================================
// MAIN PROCESSING FUNCTIONS
// ============================================================================

/**
 * Initiates batch document processing (0% -> 20%)
 */
async function processDocumentWithAI(
  fileId,
  fileBuffer,
  mimetype,
  userId,
  originalFilename,
  secretId = null
) {
  const jobId = uuidv4();
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[START] Processing: ${originalFilename} (File ID: ${fileId})`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // STAGE 1: Initialize (0-5%)
    await updateProgress(fileId, "batch_queued", 0, "Initializing document processing");
    
    await ProcessingJob.createJob({
      job_id: jobId,
      file_id: fileId,
      type: "batch",
      document_ai_operation_name: null,
      status: "queued",
      secret_id: secretId,
    });
    
    await smoothProgressIncrement(fileId, "batch_queued", 1, 5, "Processing job created", 100);

    // STAGE 2: Upload to GCS (5-15%)
    await updateProgress(fileId, "batch_queued", 6, "Uploading to cloud storage");
    
    const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
    const { gsUri: gcsInputUri } = await uploadToGCS(
      originalFilename,
      fileBuffer,
      batchUploadFolder,
      true,
      mimetype
    );
    
    console.log(`[Upload] Success: ${gcsInputUri}`);
    await smoothProgressIncrement(fileId, "batch_queued", 7, 15, "Upload completed", 100);

    // STAGE 3: Start batch operation (15-20%)
    await updateProgress(fileId, "batch_processing", 16, "Initializing Document AI");
    
    const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
    const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;
    
    const operationName = await batchProcessDocument(
      [gcsInputUri],
      gcsOutputUriPrefix,
      mimetype
    );
    
    console.log(`[Document AI] Operation started: ${operationName}`);
    
    await ProcessingJob.updateJob(jobId, {
      gcs_input_uri: gcsInputUri,
      gcs_output_uri_prefix: gcsOutputUriPrefix,
      document_ai_operation_name: operationName,
      status: "running",
    });
    
    await smoothProgressIncrement(fileId, "batch_processing", 17, 20, "Batch processing started", 100);
    
    // Start background polling (20% -> 42%)
    console.log(`[Info] 🚀 Starting background polling for file: ${fileId}`);
    pollBatchProgress(fileId, jobId, operationName);
    
    console.log(`\n[Info] ✅ Batch processing initiated. Polling active.\n`);
    
  } catch (err) {
    console.error(`\n❌ [ERROR] Failed to process file ${fileId}:`, err.message);
    console.error(err.stack);
    await updateProgress(fileId, "error", 0, `Initialization failed: ${err.message}`);
    await ProcessingJob.updateJobStatus(jobId, "failed", err.message);
  }
}

/**
 * Processes batch results after OCR completion (42% -> 100%)
 */
async function processBatchResults(file_id, job) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`[POST-PROCESSING] Starting for File ID: ${file_id}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // Verify starting point
    const currentFile = await File.getFileById(file_id);
    console.log(`[POST-PROCESSING] Status: ${currentFile.status}, Progress: ${currentFile.processing_progress}%`);

    // STAGE 1: Fetch results (42-45%)
    await updateProgress(file_id, "processing", 42.5, "Fetching batch results");
    
    const bucketName = fileOutputBucket.name;
    const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
    
    await smoothProgressIncrement(file_id, "processing", 43, 44, "Retrieving processed documents", 100);
    
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
    console.log(`[Extraction] ✅ Retrieved ${extractedBatchTexts.length} text segments`);
    
    await updateProgress(file_id, "processing", 45, "Text extraction completed");

    if (!extractedBatchTexts?.length || extractedBatchTexts.every(item => !item.text?.trim())) {
      throw new Error("No text content extracted from document");
    }

    // STAGE 2: Fetch config (45-48%)
    await updateProgress(file_id, "processing", 45.5, "Loading chunking configuration");
    
    let chunkingMethod = "recursive";
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
      const result = await pool.query(chunkMethodQuery, [file_id]);
      if (result.rows.length > 0 && result.rows[0].method_name) {
        chunkingMethod = result.rows[0].method_name;
      }
    } catch (err) {
      console.warn(`[Config] Using default chunking method`);
    }
    
    console.log(`[Config] Chunking method: ${chunkingMethod}`);
    await smoothProgressIncrement(file_id, "processing", 46, 48, `Configuration loaded: ${chunkingMethod}`, 100);

    // STAGE 3: Chunk document (48-58%)
    await updateProgress(file_id, "processing", 49, `Starting ${chunkingMethod} chunking`);
    await smoothProgressIncrement(file_id, "processing", 50, 54, "Chunking document", 100);
    
    const chunks = await chunkDocument(extractedBatchTexts, file_id, chunkingMethod);
    console.log(`[Chunking] ✅ Generated ${chunks.length} chunks`);
    
    await smoothProgressIncrement(file_id, "processing", 55, 58, `Created ${chunks.length} chunks`, 100);

    if (chunks.length === 0) {
      console.warn(`[Warning] ⚠️ No chunks generated for file ${file_id}`);
      await updateProgress(file_id, "processed", 100, "Completed (no content)");
      await ProcessingJob.updateJobStatus(job.job_id, "completed");
      return;
    }

    // STAGE 4: Prepare background embedding job (58-68%)
    await updateProgress(file_id, "processing", 59, "Preparing embedding queue payload");
    const chunkContents = chunks.map(c => c.content);
    console.log(`[Embeddings] 🔄 Queueing ${chunkContents.length} chunks for background embedding`);
    await smoothProgressIncrement(file_id, "processing", 60, 66, "Collecting chunk metadata", 100);

    // STAGE 5: Save chunks (68-78%)
    await updateProgress(file_id, "processing", 67, "Preparing database storage");

    const chunksToSave = chunks.map((chunk, i) => ({
      file_id: file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));
    
    await smoothProgressIncrement(file_id, "processing", 68, 72, "Saving chunks to database", 100);
    
    const savedChunks = await FileChunk.saveMultipleChunks(chunksToSave);
    console.log(`[Database] ✅ Saved ${savedChunks.length} chunks`);
    
    await smoothProgressIncrement(file_id, "processing", 73, 78, `${savedChunks.length} chunks saved`, 100);

    // STAGE 6: Queue vectors for background worker (78% -> embedding_pending)
    const embeddingQueuePayload = savedChunks.map((savedChunk) => {
      const source = chunks[savedChunk.chunk_index];
      return {
        chunkId: savedChunk.id,
        chunkIndex: savedChunk.chunk_index,
        content: source.content,
        tokenCount: source.token_count,
      };
    });

    await enqueueEmbeddingJob({
      fileId: file_id,
      jobId: job.job_id,
      chunks: embeddingQueuePayload,
      progressBase: 78,
    });

    await updateProgress(file_id, "embedding_pending", 78, "Embeddings queued for background worker");

    // STAGE 7: Generate summary (78-88%)
    await updateProgress(file_id, "embedding_pending", 79, "Preparing summary generation");
    
    const fullText = chunks.map(c => c.content).join("\n\n");
    let summary = null;
    
    try {
      if (fullText.length > 0) {
        await smoothProgressIncrement(file_id, "embedding_pending", 80, 86, "Generating AI summary", 150);
        
        summary = await getSummaryFromChunks(chunks.map(c => c.content));
        await File.updateSummary(file_id, summary);
        
        console.log(`[Summary] ✅ Generated and saved`);
        await updateProgress(file_id, "embedding_pending", 88, "Summary saved");
      } else {
        await updateProgress(file_id, "embedding_pending", 88, "Summary skipped (empty content)");
      }
    } catch (summaryError) {
      console.warn(`⚠️ [Warning] Summary generation failed:`, summaryError.message);
      await updateProgress(file_id, "embedding_pending", 88, "Summary skipped (error)");
    }

    await updateProgress(file_id, "embedding_pending", 89, "Waiting for background embeddings to complete");
    console.log(`[Embeddings] Background task enqueued for file ${file_id}`);

  } catch (error) {
    console.error(`\n❌ [ERROR] Post-processing failed for ${file_id}:`, error.message);
    console.error(error.stack);
    
    try {
      await updateProgress(file_id, "error", 0, `Failed: ${error.message}`);
      await ProcessingJob.updateJobStatus(job.job_id, "failed", error.message);
    } catch (err) {
      console.error(`❌ Failed to update error status:`, err);
    }
  }
}

// ============================================================================
// STATUS API ENDPOINT - RETURNS REAL-TIME PROGRESS
// ============================================================================

/**
 * ✅ CRITICAL: This endpoint must return FRESH data from database
 */
// exports.getFileProcessingStatus = async (req, res) => {
//   try {
//     const { file_id } = req.params;

//     if (!file_id) {
//       return res.status(400).json({ 
//         success: false,
//         error: "file_id is required" 
//       });
//     }

//     // ✅ CRITICAL: Get FRESH data from database - NO CACHING
//     const file = await File.getFileById(file_id);
    
//     if (!file) {
//       return res.status(404).json({ 
//         success: false,
//         error: "File not found" 
//       });
//     }

//     if (String(file.user_id) !== String(req.user.id)) {
//       return res.status(403).json({ 
//         success: false,
//         error: "Access denied" 
//       });
//     }

//     const job = await ProcessingJob.getJobByFileId(file_id);
    
//     // ✅ Get REAL-TIME progress from database
//     let progress = parseFloat(file.processing_progress) || 0;
//     let status = file.status || 'unknown';
//     let operation = file.current_operation || getOperationName(progress, status);
    
//     // Round to 1 decimal place
//     progress = Math.round(progress * 10) / 10;
//     progress = Math.min(100, Math.max(0, progress));
    
//     // Log every status check
//     console.log(`[Status API] 📊 ${file_id.substring(0, 8)}... | ${progress.toFixed(1)}% | ${status} | ${operation}`);

//     // Base response
//     const response = {
//       success: true,
//       file_id: file.id,
//       filename: file.filename || file.original_filename,
//       status: status,
//       progress: progress,
//       progress_percentage: `${progress.toFixed(1)}%`,
//       current_operation: operation,
//       job_status: job?.status || "unknown",
//       last_updated: file.updated_at,
//       file_size: file.file_size,
//       mime_type: file.mime_type,
//     };

//     // CASE 1: Completed (100%)
//     if ((status === "processed" || status === "completed") && progress >= 100) {
//       const chunks = await FileChunk.getChunksByFileId(file_id);
      
//       if (chunks?.length > 0) {
//         const formattedChunks = chunks.map(chunk => ({
//           text: chunk.content,
//           metadata: {
//             page_start: chunk.page_start,
//             page_end: chunk.page_end,
//             heading: chunk.heading,
//           },
//         }));
        
//         return res.json({
//           ...response,
//           progress: 100,
//           progress_percentage: "100%",
//           current_operation: "Completed",
//           is_complete: true,
//           chunks: formattedChunks,
//           chunk_count: chunks.length,
//           summary: file.summary,
//         });
//       }
//     }

//     // CASE 2: Error
//     if (status === "error" || status === "failed") {
//       return res.json({
//         ...response,
//         progress: 0,
//         progress_percentage: "0%",
//         current_operation: "Failed",
//         is_error: true,
//         error_message: job?.error_message || operation || "Unknown error occurred",
//       });
//     }

//     // CASE 3: Processing (42-100%)
//     if (status === "processing") {
//       return res.json({
//         ...response,
//         is_processing: true,
//         message: "Document is being processed",
//         estimated_time_remaining: progress < 50 ? "5-10 minutes" : 
//                                   progress < 80 ? "2-5 minutes" : "Less than 2 minutes",
//       });
//     }

//     // CASE 4: Batch processing (0-42%)
//     if (status === "batch_processing") {
//       return res.json({
//         ...response,
//         is_processing: true,
//         message: "Document AI OCR is processing your document",
//         estimated_time_remaining: progress < 30 ? "5-10 minutes" : "2-5 minutes",
//       });
//     }

//     // CASE 5: Batch queued (0-15%)
//     if (status === "batch_queued") {
//       return res.json({
//         ...response,
//         is_processing: true,
//         message: "Document is queued for processing",
//         estimated_time_remaining: "Starting soon",
//       });
//     }

//     // CASE 6: Just uploaded
//     return res.json({
//       ...response,
//       progress: 0,
//       progress_percentage: "0%",
//       current_operation: "Queued",
//       is_queued: true,
//       message: "Document uploaded. Processing will begin shortly.",
//     });

//   } catch (error) {
//     console.error("❌ [Status API] Error:", error.message);
//     console.error(error.stack);
    
//     return res.status(500).json({
//       success: false,
//       error: "Failed to fetch processing status",
//       message: error.message,
//     });
//   }
// };
/**
 * Get real-time file processing status (Frontend-friendly)
 * Smoothly reflects each stage from 0% → 100%
 */
exports.getFileProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;

    if (!file_id) {
      return res.status(400).json({ success: false, error: "file_id is required" });
    }

    // ✅ Always fetch fresh data from DB
    const file = await File.getFileById(file_id);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    // ✅ Authorization check
    if (String(file.user_id) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // ✅ Get job info
    const job = await ProcessingJob.getJobByFileId(file_id);
    const progress = parseFloat(file.processing_progress) || 0;
    const status = file.status || "queued";
    const current_operation = file.current_operation || getOperationName(progress, status);

    // ✅ Unified response for all stages
    const baseResponse = {
      success: true,
      file_id: file.id,
      filename: file.filename || file.originalname,
      progress: parseFloat(progress.toFixed(1)),
      progress_percentage: `${progress.toFixed(1)}%`,
      status,
      current_operation,
      job_status: job?.status || "unknown",
      last_updated: file.updated_at,
      estimated_time_remaining:
        progress < 25
          ? "10-12 minutes"
          : progress < 50
          ? "6-8 minutes"
          : progress < 75
          ? "3-5 minutes"
          : progress < 90
          ? "1-2 minutes"
          : "Few seconds",
    };

    // ✅ CASE 1: Completed
    if ((status === "processed" || status === "completed") && progress >= 100) {
      const chunks = await FileChunk.getChunksByFileId(file_id);
      const formattedChunks = chunks.map((chunk) => ({
        text: chunk.content,
        metadata: {
          page_start: chunk.page_start,
          page_end: chunk.page_end,
          heading: chunk.heading,
        },
      }));
      return res.json({
        ...baseResponse,
        progress: 100,
        progress_percentage: "100%",
        current_operation: "Completed",
        is_complete: true,
        chunks: formattedChunks,
        summary: file.summary,
      });
    }

    // ✅ CASE 2: Error
    if (status === "error" || status === "failed") {
      return res.json({
        ...baseResponse,
        progress: 0,
        progress_percentage: "0%",
        current_operation: "Failed",
        is_error: true,
        error_message: job?.error_message || "Unknown error occurred",
      });
    }

    // ✅ CASE 3: Batch queued (0-15%)
    if (status === "batch_queued") {
      return res.json({
        ...baseResponse,
        is_processing: true,
        stage: "queued",
        message: "Document is queued for processing",
      });
    }

    // ✅ CASE 4: Batch processing (15-42%)
    if (status === "batch_processing") {
      return res.json({
        ...baseResponse,
        is_processing: true,
        stage: "ocr",
        message: "Performing OCR via Document AI",
      });
    }

    // ✅ CASE 5: Post-processing (42-100%)
    if (status === "processing") {
      let stage = "processing";
      if (progress < 45) stage = "fetching_results";
      else if (progress < 55) stage = "chunking";
      else if (progress < 75) stage = "embedding";
      else if (progress < 95) stage = "summarizing";
      else stage = "finalizing";

      return res.json({
        ...baseResponse,
        is_processing: true,
        stage,
        message: `Document is in ${stage.replace("_", " ")} stage`,
      });
    }

    // ✅ CASE 6: Just uploaded / awaiting processing
    return res.json({
      ...baseResponse,
      is_queued: true,
      progress: 0,
      current_operation: "Queued",
      message: "Document uploaded and queued for processing",
    });
  } catch (error) {
    console.error("❌ [getFileProcessingStatus] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch file processing status",
      details: error.message,
    });
  }
};

exports.createFolder = async (req, res) => {
  try {
    const { folderName, parentPath = '' } = req.body; // allow parent folder
    const userId = req.user.id;

    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Sanitize folder and parent names
    const cleanParentPath = parentPath ? parentPath.replace(/^\/+|\/+$/g, '') : '';
    const safeFolderName = sanitizeName(folderName.replace(/^\/+|\/+$/g, ''));

    // Construct full folder path
    const folderPath = cleanParentPath
      ? `${cleanParentPath}/${safeFolderName}`
      : safeFolderName;

    // GCS path for the folder
    const gcsPath = `${userId}/documents/${folderPath}/`;

    // Create placeholder file in GCS
    await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

    // Save folder record in DB
    const folder = await File.create({
      user_id: userId,
      originalname: safeFolderName,
      gcs_path: gcsPath,
      folder_path: cleanParentPath || null,
      mimetype: 'folder/x-directory',
      is_folder: true,
      status: "processed",
      processing_progress: 100,
      size: 0,
    });

    return res.status(201).json({ message: "Folder created", folder });
  } catch (error) {
    console.error("❌ createFolder error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};





/* ---------------------- Create Folder Internal (FIXED) ---------------------- */
async function createFolderInternal(userId, folderName, parentPath = "") {
  try {
    if (!folderName) {
      throw new Error("Folder name is required");
    }

    const safeFolderName = sanitizeName(folderName.replace(/^\/+|\/+$/g, ""));

    // FIX: Store folder_path consistently for querying later
    const folderPath = parentPath ? `${parentPath}/${safeFolderName}` : safeFolderName;
   
    // GCS path for folder
    const gcsPath = `${userId}/documents/${folderPath}/`;

    // Create placeholder file in GCS
    await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

    // FIX: Store the folder_path that will be used for file uploads
    const folder = await File.create({
      user_id: userId,
      originalname: safeFolderName,
      gcs_path: gcsPath,
      folder_path: folderPath, // This is what files will reference
      mimetype: "folder/x-directory",
      is_folder: true,
      status: "processed",
      processing_progress: 100,
      size: 0,
    });

    return folder;
  } catch (error) {
    console.error("❌ createFolderInternal error:", error);
    throw new Error("Failed to create folder: " + error.message);
  }
}

/* ---------------------- Create Case ---------------------- */


exports.createCase = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = parseInt(req.user?.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const {
      case_title,
      case_number,
      filing_date,
      case_type,
      sub_type,
      court_name,
      court_level,
      bench_division,
      jurisdiction,
      state,
      judges,
      court_room_no,
      petitioners,
      respondents,
      category_type,
      primary_category,
      sub_category,
      complexity,
      monetary_value,
      priority_level,
      status = "Active",
    } = req.body;

    if (!case_title || !case_type || !court_name) {
      return res.status(400).json({
        error: "Missing required fields: case_title, case_type, court_name",
      });
    }

    await client.query("BEGIN");

    // Insert case
    const insertQuery = `
      INSERT INTO cases (
        user_id, case_title, case_number, filing_date, case_type, sub_type,
        court_name, court_level, bench_division, jurisdiction, state, judges,
        court_room_no, petitioners, respondents, category_type, primary_category,
        sub_category, complexity, monetary_value, priority_level, status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22
      )
      RETURNING *;
    `;

    const values = [
      userId,
      case_title,
      case_number,
      filing_date,
      case_type,
      sub_type,
      court_name,
      court_level,
      bench_division,
      jurisdiction,
      state,
      judges ? JSON.stringify(judges) : null,
      court_room_no,
      petitioners ? JSON.stringify(petitioners) : null,
      respondents ? JSON.stringify(respondents) : null,
      category_type,
      primary_category,
      sub_category,
      complexity,
      monetary_value,
      priority_level,
      status,
    ];

    const { rows: caseRows } = await client.query(insertQuery, values);
    const newCase = caseRows[0];

    // Create folder for the case
    const safeCaseName = sanitizeName(case_title);
    const parentPath = `${userId}/cases`;
    const folder = await createFolderInternal(userId, safeCaseName, parentPath);

    // Link folder to case
    const updateQuery = `
      UPDATE cases
      SET folder_id = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows: updatedRows } = await client.query(updateQuery, [
      folder.id,
      newCase.id,
    ]);
    const updatedCase = updatedRows[0];

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Case created successfully with folder",
      case: updatedCase,
      folder,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating case:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

/* ---------------------- Delete Case ---------------------- */
exports.deleteCase = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = parseInt(req.user?.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const { caseId } = req.params;
    if (!caseId) {
      return res.status(400).json({ error: "Case ID is required." });
    }

    await client.query("BEGIN");

    // 1. Get the case to find its associated folder_id
    const getCaseQuery = `SELECT folder_id FROM cases WHERE id = $1 AND user_id = $2;`;
    const { rows: caseRows } = await client.query(getCaseQuery, [caseId, userId]);

    if (caseRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Case not found or not authorized." });
    }

    const folderId = caseRows[0].folder_id;

    // 2. Delete the case record
    const deleteCaseQuery = `DELETE FROM cases WHERE id = $1 AND user_id = $2 RETURNING *;`;
    const { rows: deletedCaseRows } = await client.query(deleteCaseQuery, [caseId, userId]);

    if (deletedCaseRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Case not found or not authorized." });
    }

    // 3. Delete the associated folder from user_files
    if (folderId) {
      // First, get the gcs_path of the folder to delete its contents from GCS
      const getFolderQuery = `SELECT gcs_path FROM user_files WHERE id = $1::uuid AND user_id = $2 AND is_folder = TRUE;`;
      const { rows: folderRows } = await client.query(getFolderQuery, [folderId, userId]);

      if (folderRows.length > 0) {
        const gcsPath = folderRows[0].gcs_path;
        // Delete all files within the GCS folder (including the .keep file)
        await bucket.deleteFiles({
          prefix: gcsPath,
        });
        console.log(`🗑️ Deleted GCS objects with prefix: ${gcsPath}`);
      }

      // Now delete the folder record itself from user_files
      const deleteFolderQuery = `DELETE FROM user_files WHERE id = $1::uuid AND user_id = $2;`;
      await client.query(deleteFolderQuery, [folderId, userId]);
      console.log(`🗑️ Deleted folder record with ID: ${folderId}`);
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Case and associated folder deleted successfully.",
      deletedCase: deletedCaseRows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting case:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

/* ---------------------- Update Case ---------------------- */
exports.updateCase = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = parseInt(req.user?.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const { caseId } = req.params;
    if (!caseId) {
      return res.status(400).json({ error: "Case ID is required." });
    }

    const {
      case_title,
      case_number,
      filing_date,
      case_type,
      sub_type,
      court_name,
      court_level,
      bench_division,
      jurisdiction,
      state,
      judges,
      court_room_no,
      petitioners,
      respondents,
      category_type,
      primary_category,
      sub_category,
      complexity,
      monetary_value,
      priority_level,
      status, // Allow updating status (e.g., 'Active', 'Inactive', 'Closed')
    } = req.body;

    const updates = {};
    if (case_title !== undefined) updates.case_title = case_title;
    if (case_number !== undefined) updates.case_number = case_number;
    if (filing_date !== undefined) updates.filing_date = filing_date;
    if (case_type !== undefined) updates.case_type = case_type;
    if (sub_type !== undefined) updates.sub_type = sub_type;
    if (court_name !== undefined) updates.court_name = court_name;
    if (court_level !== undefined) updates.court_level = court_level;
    if (bench_division !== undefined) updates.bench_division = bench_division;
    if (jurisdiction !== undefined) updates.jurisdiction = jurisdiction;
    if (state !== undefined) updates.state = state;
    if (judges !== undefined) updates.judges = judges ? JSON.stringify(judges) : null;
    if (court_room_no !== undefined) updates.court_room_no = court_room_no;
    if (petitioners !== undefined) updates.petitioners = petitioners ? JSON.stringify(petitioners) : null;
    if (respondents !== undefined) updates.respondents = respondents ? JSON.stringify(respondents) : null;
    if (category_type !== undefined) updates.category_type = category_type;
    if (primary_category !== undefined) updates.primary_category = primary_category;
    if (sub_category !== undefined) updates.sub_category = sub_category;
    if (complexity !== undefined) updates.complexity = complexity;
    if (monetary_value !== undefined) updates.monetary_value = monetary_value;
    if (priority_level !== undefined) updates.priority_level = priority_level;
    if (status !== undefined) updates.status = status; // Update case status

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No update fields provided." });
    }

    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 3}`).join(', ');
    const values = Object.values(updates);

    const updateQuery = `
      UPDATE cases
      SET ${fields}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;

    const { rows: updatedCaseRows } = await client.query(updateQuery, [caseId, userId, ...values]);

    if (updatedCaseRows.length === 0) {
      return res.status(404).json({ error: "Case not found or not authorized." });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Case updated successfully.",
      case: updatedCaseRows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating case:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  } finally {
    client.release();
  }
};

/* ---------------------- Get Case by ID ---------------------- */


exports.getCase = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { caseId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized user" });
    if (!caseId) return res.status(400).json({ error: "Case ID is required." });

    // 1️⃣ Fetch case details
    const caseQuery = `
      SELECT * FROM cases
      WHERE id = $1 AND user_id = $2;
    `;
    const { rows: caseRows } = await pool.query(caseQuery, [caseId, userId]);
    if (caseRows.length === 0) {
      return res.status(404).json({ error: "Case not found or not authorized." });
    }

    const caseData = caseRows[0];

    // 2️⃣ Fetch the main folder for this case
    const folderQuery = `
      SELECT *
      FROM user_files
      WHERE user_id = $1
        AND is_folder = true
        AND folder_path LIKE $2
      ORDER BY created_at ASC
      LIMIT 1;
    `;
    // Assuming folder_path contains the case title
    const folderPathPattern = `%${caseData.case_title}%`;
    const { rows: folderRows } = await pool.query(folderQuery, [userId, folderPathPattern]);

    // 3️⃣ Prepare folder metadata
    const folders = folderRows.map(folder => ({
      id: folder.id,
      name: folder.originalname,
      folder_path: folder.folder_path,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      children: [], // Files will be fetched when user opens this folder
    }));

    // 4️⃣ Attach folders to case
    caseData.folders = folders;

    return res.status(200).json({
      message: "Case fetched successfully.",
      case: caseData,
    });

  } catch (error) {
    console.error("❌ Error fetching case:", error);
    res.status(500).json({ message: "Internal server error", details: error.message });
  }
};


exports .getFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const files = await File.findByUserId(userId);

    // Separate folders and files
    const folders = files
      .filter(file => file.is_folder)
      .map(folder => ({
        id: folder.id,
        name: folder.originalname,
        folder_path: folder.folder_path,
        created_at: folder.created_at,
      }));

    const actualFiles = files.filter(file => !file.is_folder);

    // Generate signed URLs for files
    const signedFiles = await Promise.all(
      actualFiles.map(async (file) => {
        let signedUrl = null;
        try {
          signedUrl = await getSignedUrl(file.gcs_path);
        } catch (err) {
          console.error('Error generating signed URL:', err);
        }
        return {
          id: file.id,
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          created_at: file.created_at,
          folder_path: file.folder_path,
          url: signedUrl,
        };
      })
    );

    // Optionally: organize files under their folders
    const folderMap = {};
    folders.forEach(folder => {
      folder.children = [];
      folderMap[folder.folder_path ? folder.folder_path + '/' + folder.name : folder.name] = folder;
    });

    signedFiles.forEach(file => {
      const parentFolderKey = file.folder_path || '';
      if (folderMap[parentFolderKey]) {
        folderMap[parentFolderKey].children.push(file);
      }
    });

    return res.status(200).json({ folders });
  } catch (error) {
    console.error('Error fetching user files and folders:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



/* ---------------------- Upload Documents (FIXED) ---------------------- */
/**
 * Generate signed URL for direct upload to GCS (for large files >32MB)
 * @route POST /:folderName/generate-upload-url
 */
exports.generateUploadUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;
    const { filename, mimetype, size } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    // Find the folder
    const folderQuery = `
      SELECT * FROM user_files
      WHERE user_id = $1
        AND is_folder = true
        AND originalname = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { rows: folderRows } = await pool.query(folderQuery, [userId, folderName]);
   
    if (folderRows.length === 0) {
      return res.status(404).json({
        error: `Folder "${folderName}" not found for this user.`,
      });
    }

    const folderRow = folderRows[0];
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const safeName = sanitizeName(baseName) + ext;
    const key = `${folderRow.gcs_path}${safeName}`;
    const uniqueKey = await ensureUniqueKey(key);

    // Generate signed URL for upload (15 minutes expiry)
    const signedUrl = await getSignedUploadUrl(
      uniqueKey,
      mimetype || 'application/octet-stream',
      15,
      false // Use default bucket, not input bucket
    );

    return res.status(200).json({
      signedUrl,
      gcsPath: uniqueKey,
      filename: safeName,
      folderPath: folderRow.folder_path,
    });
  } catch (error) {
    console.error("❌ generateUploadUrl error:", error);
    res.status(500).json({
      error: "Failed to generate upload URL",
      details: error.message
    });
  }
};

/**
 * Handle post-upload processing after file is uploaded via signed URL
 * @route POST /:folderName/complete-upload
 */
exports.completeSignedUpload = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;
    const { gcsPath, filename, mimetype, size, secret_id } = req.body;

    if (!gcsPath || !filename || !size) {
      return res.status(400).json({ error: "gcsPath, filename, and size are required" });
    }

    // Find the folder
    const folderQuery = `
      SELECT * FROM user_files
      WHERE user_id = $1
        AND is_folder = true
        AND originalname = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { rows: folderRows } = await pool.query(folderQuery, [userId, folderName]);
   
    if (folderRows.length === 0) {
      return res.status(404).json({
        error: `Folder "${folderName}" not found for this user.`,
      });
    }

    const folderRow = folderRows[0];

    // Verify file exists in GCS
    const fileRef = bucket.file(gcsPath);
    const [exists] = await fileRef.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found in storage. Upload may have failed." });
    }

    // Check storage limits
    const authorizationHeader = req.headers.authorization;
    const { usage: userUsage, plan: userPlan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);
    const storageLimitCheck = await checkStorageLimit(userId, size, userPlan);
    if (!storageLimitCheck.allowed) {
      // Delete the uploaded file if storage limit exceeded
      await fileRef.delete().catch(err => console.error("Failed to delete file:", err));
      return res.status(403).json({ error: storageLimitCheck.message });
    }

    // Calculate requested resources
    const { DOCUMENT_UPLOAD_COST_TOKENS } = require("../middleware/checkTokenLimits");
    const requestedResources = {
      tokens: DOCUMENT_UPLOAD_COST_TOKENS,
      documents: 1,
      ai_analysis: 1,
      storage_gb: size / (1024 ** 3),
    };

    // Enforce limits
    const limitCheck = await TokenUsageService.enforceLimits(
      userId,
      userUsage,
      userPlan,
      requestedResources
    );

    if (!limitCheck.allowed) {
      // Delete the uploaded file if limits exceeded
      await fileRef.delete().catch(err => console.error("Failed to delete file:", err));
      return res.status(403).json({
        success: false,
        message: limitCheck.message,
        nextRenewalTime: limitCheck.nextRenewalTime,
        remainingTime: limitCheck.remainingTime,
      });
    }

    // Save file metadata to database
    const savedFile = await File.create({
      user_id: userId,
      originalname: filename,
      gcs_path: gcsPath,
      folder_path: folderRow.folder_path,
      mimetype: mimetype || 'application/octet-stream',
      size: size,
      is_folder: false,
      status: "queued",
      processing_progress: 0,
    });

    // Increment usage after successful upload
    await TokenUsageService.incrementUsage(userId, requestedResources, userPlan);

    // Download file buffer for processing (since we need it for processDocumentWithAI)
    const [fileBuffer] = await fileRef.download();

    // Process document asynchronously
    processDocumentWithAI(
      savedFile.id,
      fileBuffer,
      mimetype || 'application/octet-stream',
      userId,
      filename,
      secret_id
    ).catch(err =>
      console.error(`❌ Background processing failed for ${savedFile.id}:`, err.message)
    );

    const previewUrl = await makeSignedReadUrl(gcsPath, 15);

    return res.status(201).json({
      message: "File uploaded and processing started.",
      document: {
        ...savedFile,
        previewUrl,
        status: "uploaded_and_queued",
      },
      folderInfo: {
        folderName: folderRow.originalname,
        folder_path: folderRow.folder_path,
        gcs_path: folderRow.gcs_path
      }
    });
  } catch (error) {
    console.error("❌ completeSignedUpload error:", error);
    res.status(500).json({
      error: "Failed to complete upload",
      details: error.message
    });
  }
};

exports.uploadDocumentsToCaseByFolderName = async (req, res) => {
  try {
    const username = req.user.username;
    const userId = req.user.id;
    const { folderName } = req.params;
    const { secret_id } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    console.log(`📁 Uploading to folder: ${folderName} for user: ${username}`);

    // FIX 1: Find the folder using the stored folder_path pattern
    const folderQuery = `
      SELECT * FROM user_files
      WHERE user_id = $1
        AND is_folder = true
        AND originalname = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const { rows: folderRows } = await pool.query(folderQuery, [userId, folderName]);
   
    if (folderRows.length === 0) {
      return res.status(404).json({
        error: `Folder "${folderName}" not found for this user.`,
        debug: { userId, folderName }
      });
    }

    const folderRow = folderRows[0];
   
    // FIX 2: Use the folder_path from the database for consistency
    let folderPathForFiles = folderRow.folder_path;
   
    console.log(`📁 Found folder. Database folder_path: ${folderPathForFiles}`);
    console.log(`📁 GCS path: ${folderRow.gcs_path}`);

    // Upload each file
    const uploadedFiles = [];
    for (const file of req.files) {
      try {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const safeName = sanitizeName(baseName) + ext;

        // FIX 3: Build the GCS key using the folder's gcs_path
        const key = `${folderRow.gcs_path}${safeName}`;
        const uniqueKey = await ensureUniqueKey(key);

        console.log(`📄 Uploading file: ${safeName} to ${uniqueKey}`);

        const fileRef = bucket.file(uniqueKey);
        await fileRef.save(file.buffer, {
          resumable: false,
          metadata: { contentType: file.mimetype },
        });

        // FIX 4: Store with the same folder_path for consistent querying
        const savedFile = await File.create({
          user_id: userId,
          originalname: safeName,
          gcs_path: uniqueKey,
          folder_path: folderPathForFiles, // Use the folder's folder_path
          mimetype: file.mimetype,
          size: file.size,
          is_folder: false,
          status: "queued",
          processing_progress: 0,
        });

        console.log(`✅ File saved to DB with folder_path: ${folderPathForFiles}`);

        const previewUrl = await makeSignedReadUrl(uniqueKey, 15);

        // Process document
        processDocumentWithAI(
          savedFile.id,
          file.buffer,
          file.mimetype,
          userId,
          safeName,
          secret_id
        ).catch(err =>
          console.error(`❌ Background processing failed for ${savedFile.id}:`, err.message)
        );

        uploadedFiles.push({
          ...savedFile,
          previewUrl,
          status: "uploaded_and_queued",
        });
      } catch (fileError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, fileError);
        uploadedFiles.push({
          originalname: file.originalname,
          error: fileError.message,
          status: "failed"
        });
      }
    }

    return res.status(201).json({
      message: "Documents uploaded to case folder and processing started.",
      documents: uploadedFiles,
      folderInfo: {
        folderName: folderRow.originalname,
        folder_path: folderPathForFiles,
        gcs_path: folderRow.gcs_path
      }
    });

  } catch (error) {
    console.error("❌ uploadDocumentsToCaseByFolderName error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;

    // 1️⃣ Validate file existence and ownership
    const { rows } = await pool.query(
      `SELECT * FROM user_files WHERE id = $1 AND user_id = $2 AND is_folder = false`,
      [fileId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "File not found or access denied",
        debug: { fileId, userId },
      });
    }

    const fileRow = rows[0];
    const gcsPath = fileRow.gcs_path;

    console.log(`🗑️ Deleting file: ${fileRow.originalname} (${gcsPath})`);

    // 2️⃣ Delete from Google Cloud Storage
    const fileRef = bucket.file(gcsPath);
    const [exists] = await fileRef.exists();

    if (exists) {
      await fileRef.delete();
      console.log(`✅ GCS file deleted: ${gcsPath}`);
    } else {
      console.warn(`⚠️ File not found in GCS: ${gcsPath}`);
    }

    // 3️⃣ Delete from database
    await pool.query(`DELETE FROM user_files WHERE id = $1`, [fileId]);
    console.log(`✅ DB record deleted for file ID: ${fileId}`);

    // 4️⃣ Response
    return res.status(200).json({
      message: "File deleted successfully",
      deletedFile: {
        id: fileId,
        originalname: fileRow.originalname,
        folder_path: fileRow.folder_path,
        gcs_path: gcsPath,
      },
    });
  } catch (error) {
    console.error("❌ deleteDocument error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
/* ----------------- Enhanced Folder Summary ----------------- */
exports.getFolderSummary = async (req, res) => {
  const userId = req.user.id;
  const authorizationHeader = req.headers.authorization;

  try {
    const { folderName } = req.params;

    // 1. Fetch user's usage and plan details
    const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    console.log(`[getFolderSummary] Found files in folder '${folderName}' for user ${userId}:`, files.map(f => ({ id: f.id, originalname: f.originalname, status: f.status })));

    const processed = files.filter((f) => !f.is_folder && f.status === "processed");
    console.log(`[getFolderSummary] Processed documents in folder '${folderName}':`, processed.map(f => ({ id: f.id, originalname: f.originalname })));

    if (processed.length === 0) {
      return res.status(404).json({ error: "No processed documents in folder" });
    }

    let combinedText = "";
    let documentDetails = [];
   
    for (const f of processed) {
      const chunks = await FileChunk.getChunksByFileId(f.id);
      const fileText = chunks.map((c) => c.content).join("\n\n");
      combinedText += `\n\n[Document: ${f.originalname}]\n${fileText}`;
     
      documentDetails.push({
        name: f.originalname,
        summary: f.summary || "Summary not available",
        chunkCount: chunks.length
      });
    }

    // Calculate token cost for summary generation
    const summaryCost = Math.ceil(combinedText.length / 200); // Rough estimate

    // 2. Enforce token limits for summary generation
    const requestedResources = { tokens: summaryCost, ai_analysis: 1 };
    const { allowed, message } = await TokenUsageService.enforceLimits(usage, plan, requestedResources);

    if (!allowed) {
      return res.status(403).json({
        error: `Summary generation failed: ${message}`,
        timeLeftUntilReset: timeLeft
      });
    }

    const summary = await getSummaryFromChunks(combinedText);

    // 3. Increment usage after successful summary generation
    await TokenUsageService.incrementUsage(userId, requestedResources);

    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      `Summary for folder "${folderName}"`,
      summary,
      null,
      processed.map(f => f.id)
    );

    return res.json({
      folder: folderName,
      summary,
      documentCount: processed.length,
      documents: documentDetails,
      session_id: savedChat.session_id,
    });
  } catch (error) {
    console.error("❌ getFolderSummary error:", error);
    res.status(500).json({ error: "Failed to generate folder summary", details: error.message });
  }
};


// exports.queryFolderDocuments = async (req, res) => {
//   let chatCost;
//   let userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const { folderName } = req.params;
//     const {
//       question,
//       prompt_label = null,
//       session_id = null,
//       maxResults = 10,
//       secret_id,
//       llm_name,
//       additional_input = "",
//     } = req.body;

//     // Dynamically determine if a secret prompt is being used
//     let used_secret_prompt = !!secret_id; // If secret_id is present, it's a secret prompt

//     if (!folderName) {
//       return res.status(400).json({ error: "folderName is required." });
//     }

//     const finalSessionId = session_id || `session-${Date.now()}`;
//     console.log(`📁 Querying folder: ${folderName} | used_secret_prompt=${used_secret_prompt} | secret_id=${secret_id}`);

//     // 1️⃣ Get user plan & usage
//     const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(
//       userId,
//       authorizationHeader
//     );

//     // 2️⃣ Fetch all processed files in folder
//     const folderPattern = `%${folderName}%`;
//     const filesQuery = `
//       SELECT id, originalname, folder_path, status
//       FROM user_files
//       WHERE user_id = $1
//         AND is_folder = false
//         AND status = 'processed'
//         AND folder_path LIKE $2
//       ORDER BY created_at DESC;
//     `;
//     const { rows: files } = await pool.query(filesQuery, [userId, folderPattern]);

//     if (files.length === 0) {
//       return res.status(404).json({ error: "No processed files found in this folder." });
//     }

//     console.log(`📄 Found ${files.length} processed files in folder "${folderName}"`);

//     // 3️⃣ Collect all chunks across all files
//     let allChunks = [];
//     for (const file of files) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
//       allChunks.push(
//         ...chunks.map((chunk) => ({
//           ...chunk,
//           file_id: file.id,
//           filename: file.originalname,
//         }))
//       );
//     }

//     if (allChunks.length === 0) {
//       return res.status(400).json({ error: "No content found in folder documents." });
//     }

//     console.log(`🧩 Total chunks aggregated: ${allChunks.length}`);

//     // 4️⃣ Initialize variables
//     let answer;
//     let usedChunkIds = [];
//     let storedQuestion; // This will be what we store in the DB
//     let displayQuestion; // This will be what we show to the user
//     let finalPromptLabel = prompt_label;
//     let provider = "gemini";

//     // ================================
//     // CASE 1: SECRET PROMPT
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id)
//         return res.status(400).json({ error: "secret_id is required for secret prompts." });

//       console.log(`🔐 Using secret prompt id=${secret_id}`);

//       // Fetch secret metadata
//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1;
//       `;
//       const secretResult = await pool.query(secretQuery, [secret_id]);
//       if (secretResult.rows.length === 0)
//         return res.status(404).json({ error: "Secret configuration not found." });

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
//         secretResult.rows[0];
     
//       // ✅ FIX: Store only the secret name, not the actual secret content
//       finalPromptLabel = secretName;
//       storedQuestion = secretName; // Store the prompt name in DB
//       displayQuestion = `Analysis: ${secretName}`; // Display format for frontend

//       provider = resolveProviderName(llm_name || dbLlmName || "gemini");

//       // Fetch secret value securely from GCP Secret Manager
//       const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
//       const secretClient = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString("utf8");

//       if (!secretValue?.trim()) {
//         return res.status(500).json({ error: "Secret value is empty." });
//       }

//       // Use vector search to find relevant chunks
//       const questionEmbedding = await generateEmbedding(secretValue);
//       const allRelevantChunks = [];

//       for (const file of files) {
//         const relevant = await ChunkVector.findNearestChunksAcrossFiles(
//           questionEmbedding,
//           maxResults,
//           [file.id]
//         );
//         if (relevant.length) {
//           allRelevantChunks.push(
//             ...relevant.map((r) => ({ ...r, filename: file.originalname }))
//           );
//         }
//       }

//       if (allRelevantChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = allRelevantChunks.map((c) => c.chunk_id || c.id);

//       const combinedContext = allRelevantChunks
//         .map((c) => `📄 [${c.filename}]\n${c.content}`)
//         .join("\n\n");

//       let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
//       finalPrompt += `${secretValue}\n\n=== RELEVANT DOCUMENTS (FOLDER: "${folderName}") ===\n${combinedContext}`;

//       if (additional_input?.trim()) {
//         finalPrompt += `\n\n=== ADDITIONAL USER INPUT ===\n${additional_input.trim()}`;
//       }

//       answer = await askFolderLLMService(provider, finalPrompt);
     
//       console.log(`✅ Secret prompt processed: "${secretName}"`);
//     }

//     // ================================
//     // CASE 2: CUSTOM QUESTION
//     // ================================
//     else {
//       if (!question?.trim())
//         return res.status(400).json({ error: "question is required for custom queries." });

//       console.log(`💬 Handling custom question: "${question.substring(0, 50)}..."`);

//       // ✅ FIX: Store the actual user question for custom queries
//       storedQuestion = question;
//       displayQuestion = question;
//       finalPromptLabel = null; // No prompt label for custom questions

//       provider = "gemini"; // default
     
//       // Calculate token cost
//       chatCost = Math.ceil(question.length / 100) +
//                  Math.ceil(allChunks.reduce((sum, c) => sum + c.content.length, 0) / 200);

//       // Check token limits
//       const requestedResources = { tokens: chatCost, ai_analysis: 1 };
//       const { allowed, message } = await TokenUsageService.enforceLimits(
//         usage,
//         plan,
//         requestedResources
//       );

//       if (!allowed) {
//         return res.status(403).json({
//           error: `AI chat failed: ${message}`,
//           timeLeftUntilReset: timeLeft
//         });
//       }

//       // Use vector search for relevant chunks
//       const questionEmbedding = await generateEmbedding(question);
//       const allRelevantChunks = [];

//       for (const file of files) {
//         const relevant = await ChunkVector.findNearestChunksAcrossFiles(
//           questionEmbedding,
//           maxResults,
//           [file.id]
//         );
//         if (relevant.length) {
//           allRelevantChunks.push(
//             ...relevant.map((r) => ({ ...r, filename: file.originalname }))
//           );
//         }
//       }

//       if (allRelevantChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = allRelevantChunks.map((c) => c.chunk_id || c.id);

//       const combinedContext = allRelevantChunks
//         .map((c) => `📄 [${c.filename}]\n${c.content}`)
//         .join("\n\n");

//       answer = await askFolderLLMService(provider, question, "", combinedContext);
     
//       console.log(`✅ Custom question processed`);
//     }

//     // Validate AI output
//     if (!answer?.trim()) {
//       return res.status(500).json({ error: "Empty response from AI." });
//     }

//     console.log(`✅ Folder query successful | Answer length: ${answer.length}`);

//     // 5️⃣ ✅ FIX: Save chat with correct question format
//     const savedChat = await FolderChat.saveFolderChat(
//       userId,
//       folderName,
//       storedQuestion, // ✅ This is the prompt name (for secret) or actual question (for custom)
//       answer,
//       finalSessionId,
//       files.map((f) => f.id), // summarizedFileIds
//       usedChunkIds, // usedChunkIds
//       used_secret_prompt, // Boolean flag
//       finalPromptLabel, // Prompt label (only for secret prompts)
//       secret_id // Secret ID (only for secret prompts)
//     );

//     // Increment token usage for custom queries
//     if (chatCost && !used_secret_prompt) {
//       await TokenUsageService.incrementUsage(userId, { tokens: chatCost, ai_analysis: 1 });
//     }

//     // 6️⃣ ✅ FIX: Return response with proper display format
//     return res.json({
//       success: true,
//       session_id: finalSessionId,
//       answer,
//       response: answer,
//       llm_provider: provider,
//       used_secret_prompt, // ✅ Include flag
//       prompt_label: finalPromptLabel, // ✅ Include label (null for custom queries)
//       secret_id: used_secret_prompt ? secret_id : null, // ✅ Include secret_id only if used
//       used_chunk_ids: usedChunkIds,
//       files_queried: files.map((f) => f.originalname),
//       total_files: files.length,
//       timestamp: new Date().toISOString(),
//       displayQuestion: displayQuestion, // ✅ Frontend should use this for display
//       storedQuestion: storedQuestion, // ✅ What's stored in DB (for debugging)
//     });
//   } catch (error) {
//     console.error("❌ Error in queryFolderDocuments:", error);
//     return res.status(500).json({
//       error: "Failed to get AI answer.",
//       details: error.message,
//     });
//   }
// };
// exports.queryFolderDocuments = async (req, res) => {
//   let chatCost;
//   let userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const { folderName } = req.params;
//     const {
//       question,
//       prompt_label = null,
//       session_id = null,
//       maxResults = 5, // ✅ REDUCED from 10
//       secret_id,
//       llm_name,
//       additional_input = "",
//     } = req.body;

//     let used_secret_prompt = !!secret_id;

//     if (!folderName) {
//       return res.status(400).json({ error: "folderName is required." });
//     }

//     const finalSessionId = session_id || `session-${Date.now()}`;
//     console.log(`📁 Querying folder: ${folderName} | used_secret_prompt=${used_secret_prompt} | secret_id=${secret_id}`);

//     // 1️⃣ Get user plan & usage
//     const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(
//       userId,
//       authorizationHeader
//     );

//     // 2️⃣ Fetch all processed files in folder
//     const folderPattern = `%${folderName}%`;
//     const filesQuery = `
//       SELECT id, originalname, folder_path, status
//       FROM user_files
//       WHERE user_id = $1
//         AND is_folder = false
//         AND status = 'processed'
//         AND folder_path LIKE $2
//       ORDER BY created_at DESC;
//     `;
//     const { rows: files } = await pool.query(filesQuery, [userId, folderPattern]);

//     if (files.length === 0) {
//       return res.status(404).json({ error: "No processed files found in this folder." });
//     }

//     console.log(`📄 Found ${files.length} processed files in folder "${folderName}"`);

//     // 3️⃣ ✅ KEY FIX: Collect chunks with AGGRESSIVE pre-filtering
//     let allChunks = [];
//     const MAX_CHUNKS_PER_FILE = 10; // ✅ Limit chunks per file
    
//     for (const file of files) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
      
//       // ✅ Take only top N chunks per file (by length - usually more informative)
//       const topChunks = chunks
//         .sort((a, b) => b.content.length - a.content.length)
//         .slice(0, MAX_CHUNKS_PER_FILE)
//         .map((chunk) => ({
//           ...chunk,
//           file_id: file.id,
//           filename: file.originalname,
//         }));
      
//       allChunks.push(...topChunks);
//     }

//     console.log(`🧩 Pre-filtered chunks: ${allChunks.length} (from ${files.length} files, max ${MAX_CHUNKS_PER_FILE} per file)`);

//     if (allChunks.length === 0) {
//       return res.status(400).json({ error: "No content found in folder documents." });
//     }

//     // 4️⃣ Initialize variables
//     let answer;
//     let usedChunkIds = [];
//     let storedQuestion;
//     let displayQuestion;
//     let finalPromptLabel = prompt_label;
//     let provider = "gemini";

//     // ================================
//     // CASE 1: SECRET PROMPT
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id)
//         return res.status(400).json({ error: "secret_id is required for secret prompts." });

//       console.log(`🔐 Using secret prompt id=${secret_id}`);

//       // Fetch secret metadata
//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1;
//       `;
//       const secretResult = await pool.query(secretQuery, [secret_id]);
//       if (secretResult.rows.length === 0)
//         return res.status(404).json({ error: "Secret configuration not found." });

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
//         secretResult.rows[0];
     
//       finalPromptLabel = secretName;
//       storedQuestion = secretName;
//       displayQuestion = `Analysis: ${secretName}`;

//       provider = resolveProviderName(llm_name || dbLlmName || "gemini");

//       // Fetch secret value securely
//       const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
//       const secretClient = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString("utf8");

//       if (!secretValue?.trim()) {
//         return res.status(500).json({ error: "Secret value is empty." });
//       }

//       // ✅ Vector search with REDUCED maxResults
//       const questionEmbedding = await generateEmbedding(secretValue);
//       const allRelevantChunks = [];

//       for (const file of files) {
//         const relevant = await ChunkVector.findNearestChunksAcrossFiles(
//           questionEmbedding,
//           maxResults, // Now only 5 instead of 10
//           [file.id]
//         );
//         if (relevant.length) {
//           allRelevantChunks.push(
//             ...relevant.map((r) => ({ ...r, filename: file.originalname }))
//           );
//         }
//       }

//       // ✅ Limit total chunks across all files
//       const limitedChunks = allRelevantChunks.slice(0, maxResults * 2); // Max 10 chunks total

//       if (limitedChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = limitedChunks.map((c) => c.chunk_id || c.id);

//       // ✅ Truncate long chunks to save tokens
//       const combinedContext = limitedChunks
//         .map((c) => {
//           const content = c.content.length > 1500 
//             ? c.content.substring(0, 1500) + "..." 
//             : c.content;
//           return `📄 [${c.filename}]\n${content}`;
//         })
//         .join("\n\n");

//       console.log(`📊 Context size: ~${Math.ceil(combinedContext.length / 4)} tokens`);

//       // ✅ Build minimal prompt
//       let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
//       finalPrompt += `${secretValue}\n\n=== RELEVANT DOCUMENTS (FOLDER: "${folderName}") ===\n${combinedContext}`;

//       if (additional_input?.trim()) {
//         const trimmedInput = additional_input.trim().substring(0, 500); // ✅ Limit additional input
//         finalPrompt += `\n\n=== ADDITIONAL INPUT ===\n${trimmedInput}`;
//       }

//       answer = await askFolderLLMService(provider, finalPrompt);
     
//       console.log(`✅ Secret prompt processed: "${secretName}"`);
//     }

//     // ================================
//     // CASE 2: CUSTOM QUESTION
//     // ================================
//     else {
//       if (!question?.trim())
//         return res.status(400).json({ error: "question is required for custom queries." });

//       console.log(`💬 Handling custom question: "${question.substring(0, 50)}..."`);

//       storedQuestion = question;
//       displayQuestion = question;
//       finalPromptLabel = null;
//       provider = "gemini";
     
//       // ✅ Calculate realistic token cost
//       chatCost = Math.ceil(question.length / 100) + 
//                  Math.ceil(allChunks.slice(0, maxResults * 2).reduce((sum, c) => 
//                    sum + Math.min(c.content.length, 1500), 0) / 200
//                  );

//       const requestedResources = { tokens: chatCost, ai_analysis: 1 };
//       const { allowed, message } = await TokenUsageService.enforceLimits(
//         usage,
//         plan,
//         requestedResources
//       );

//       if (!allowed) {
//         return res.status(403).json({
//           error: `AI chat failed: ${message}`,
//           timeLeftUntilReset: timeLeft
//         });
//       }

//       // ✅ Vector search with REDUCED maxResults
//       const questionEmbedding = await generateEmbedding(question);
//       const allRelevantChunks = [];

//       for (const file of files) {
//         const relevant = await ChunkVector.findNearestChunksAcrossFiles(
//           questionEmbedding,
//           maxResults,
//           [file.id]
//         );
//         if (relevant.length) {
//           allRelevantChunks.push(
//             ...relevant.map((r) => ({ ...r, filename: file.originalname }))
//           );
//         }
//       }

//       // ✅ Limit total chunks
//       const limitedChunks = allRelevantChunks.slice(0, maxResults * 2);

//       if (limitedChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = limitedChunks.map((c) => c.chunk_id || c.id);

//       // ✅ Truncate chunks
//       const combinedContext = limitedChunks
//         .map((c) => {
//           const content = c.content.length > 1500 
//             ? c.content.substring(0, 1500) + "..." 
//             : c.content;
//           return `📄 [${c.filename}]\n${content}`;
//         })
//         .join("\n\n");

//       console.log(`📊 Context size: ~${Math.ceil(combinedContext.length / 4)} tokens`);

//       answer = await askFolderLLMService(provider, question, "", combinedContext);
     
//       console.log(`✅ Custom question processed`);
//     }

//     if (!answer?.trim()) {
//       return res.status(500).json({ error: "Empty response from AI." });
//     }

//     console.log(`✅ Folder query successful | Answer length: ${answer.length}`);

//     // 5️⃣ Save chat
//     const savedChat = await FolderChat.saveFolderChat(
//       userId,
//       folderName,
//       storedQuestion,
//       answer,
//       finalSessionId,
//       files.map((f) => f.id),
//       usedChunkIds,
//       used_secret_prompt,
//       finalPromptLabel,
//       secret_id
//     );

//     if (chatCost && !used_secret_prompt) {
//       await TokenUsageService.incrementUsage(userId, { tokens: chatCost, ai_analysis: 1 });
//     }

//     // 6️⃣ Return response
//     return res.json({
//       success: true,
//       session_id: finalSessionId,
//       answer,
//       response: answer,
//       llm_provider: provider,
//       used_secret_prompt,
//       prompt_label: finalPromptLabel,
//       secret_id: used_secret_prompt ? secret_id : null,
//       used_chunk_ids: usedChunkIds,
//       files_queried: files.map((f) => f.originalname),
//       total_files: files.length,
//       chunks_used: usedChunkIds.length, // ✅ Show actual chunks used
//       timestamp: new Date().toISOString(),
//       displayQuestion: displayQuestion,
//       storedQuestion: storedQuestion,
//     });
//   } catch (error) {
//     console.error("❌ Error in queryFolderDocuments:", error);
//     return res.status(500).json({
//       error: "Failed to get AI answer.",
//       details: error.message,
//     });
//   }
// };


// exports.queryFolderDocuments = async (req, res) => {
//   let chatCost;
//   let userId = req.user.id;
//   const authorizationHeader = req.headers.authorization;

//   try {
//     const { folderName } = req.params;
//     const {
//       question,
//       prompt_label = null,
//       session_id = null,
//       maxResults = 5,
//       secret_id,
//       llm_name,
//       additional_input = "",
//     } = req.body;

//     let used_secret_prompt = !!secret_id;

//     if (!folderName) {
//       return res.status(400).json({ error: "folderName is required." });
//     }

//     const finalSessionId = session_id || `session-${Date.now()}`;
//     console.log(`📁 Querying folder: ${folderName} | used_secret_prompt=${used_secret_prompt} | secret_id=${secret_id}`);

//     // 1️⃣ Get user plan & usage
//     const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(
//       userId,
//       authorizationHeader
//     );

//     // 2️⃣ ✅ FIX: Fetch ONLY files in THIS specific folder
//     const filesQuery = `
//       SELECT id, originalname, folder_path, status
//       FROM user_files
//       WHERE user_id = $1
//         AND is_folder = false
//         AND status = 'processed'
//         AND folder_path = $2
//       ORDER BY created_at DESC;
//     `;
//     const { rows: files } = await pool.query(filesQuery, [userId, folderName]);

//     if (files.length === 0) {
//       return res.status(404).json({ error: "No processed files found in this folder." });
//     }

//     console.log(`📄 Found ${files.length} processed files in folder "${folderName}":`, files.map(f => f.originalname));

//     // 3️⃣ ✅ CRITICAL FIX: Only get chunks from FILES IN THIS FOLDER
//     const fileIds = files.map(f => f.id);
//     console.log(`🔍 Fetching chunks ONLY from file IDs:`, fileIds);

//     // Query chunks directly with file_id filter
//     const chunksQuery = `
//       SELECT 
//         fc.id,
//         fc.file_id,
//         fc.chunk_index,
//         fc.content,
//         fc.token_count,
//         fc.page_start,
//         fc.page_end,
//         fc.heading,
//         uf.originalname as filename
//       FROM file_chunks fc
//       INNER JOIN user_files uf ON fc.file_id = uf.id
//       WHERE fc.file_id = ANY($1::uuid[])
//         AND uf.user_id = $2
//       ORDER BY fc.file_id, fc.chunk_index;
//     `;
//     const { rows: allChunks } = await pool.query(chunksQuery, [fileIds, userId]);

//     console.log(`🧩 Total chunks from folder files: ${allChunks.length}`);
    
//     // ✅ Verify chunks belong to correct files
//     const chunksByFile = {};
//     allChunks.forEach(chunk => {
//       if (!chunksByFile[chunk.file_id]) {
//         chunksByFile[chunk.file_id] = [];
//       }
//       chunksByFile[chunk.file_id].push(chunk);
//     });
    
//     console.log(`📊 Chunks per file:`, Object.entries(chunksByFile).map(([fileId, chunks]) => {
//       const file = files.find(f => f.id === fileId);
//       return `${file?.originalname}: ${chunks.length} chunks`;
//     }).join(', '));

//     if (allChunks.length === 0) {
//       return res.status(400).json({ error: "No content found in folder documents." });
//     }

//     // 4️⃣ Initialize variables
//     let answer;
//     let usedChunkIds = [];
//     let storedQuestion;
//     let displayQuestion;
//     let finalPromptLabel = prompt_label;
//     let provider = "gemini";

//     // ================================
//     // CASE 1: SECRET PROMPT
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id)
//         return res.status(400).json({ error: "secret_id is required for secret prompts." });

//       console.log(`🔐 Using secret prompt id=${secret_id}`);

//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1;
//       `;
//       const secretResult = await pool.query(secretQuery, [secret_id]);
//       if (secretResult.rows.length === 0)
//         return res.status(404).json({ error: "Secret configuration not found." });

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
//         secretResult.rows[0];
     
//       finalPromptLabel = secretName;
//       storedQuestion = secretName;
//       displayQuestion = `Analysis: ${secretName}`;

//       provider = resolveProviderName(llm_name || dbLlmName || "gemini");

//       const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
//       const secretClient = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString("utf8");

//       if (!secretValue?.trim()) {
//         return res.status(500).json({ error: "Secret value is empty." });
//       }

//       // ✅ Vector search ONLY in folder file chunks
//       const questionEmbedding = await generateEmbedding(secretValue);
      
//       // Query vectors ONLY for chunks in this folder
//       const vectorQuery = `
//         SELECT 
//           cv.chunk_id,
//           cv.embedding,
//           fc.content,
//           fc.page_start,
//           fc.page_end,
//           fc.heading,
//           uf.originalname as filename,
//           cv.embedding <=> $1::vector as distance
//         FROM chunk_vectors cv
//         INNER JOIN file_chunks fc ON cv.chunk_id = fc.id
//         INNER JOIN user_files uf ON fc.file_id = uf.id
//         WHERE fc.file_id = ANY($2::uuid[])
//           AND uf.user_id = $3
//         ORDER BY distance ASC
//         LIMIT $4;
//       `;
      
//       const { rows: relevantChunks } = await pool.query(vectorQuery, [
//         JSON.stringify(questionEmbedding),
//         fileIds,
//         userId,
//         maxResults * 2
//       ]);

//       console.log(`🎯 Found ${relevantChunks.length} relevant chunks via vector search`);

//       if (relevantChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = relevantChunks.map((c) => c.chunk_id);

//       const combinedContext = relevantChunks
//         .map((c) => {
//           const content = c.content.length > 1500 
//             ? c.content.substring(0, 1500) + "..." 
//             : c.content;
//           return `📄 [${c.filename}]\n${content}`;
//         })
//         .join("\n\n");

//       console.log(`📊 Context size: ~${Math.ceil(combinedContext.length / 4)} tokens`);

//       let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
//       finalPrompt += `${secretValue}\n\n=== RELEVANT DOCUMENTS (FOLDER: "${folderName}") ===\n${combinedContext}`;

//       if (additional_input?.trim()) {
//         const trimmedInput = additional_input.trim().substring(0, 500);
//         finalPrompt += `\n\n=== ADDITIONAL INPUT ===\n${trimmedInput}`;
//       }

//       answer = await askFolderLLMService(provider, finalPrompt);
     
//       console.log(`✅ Secret prompt processed: "${secretName}"`);
//     }

//     // ================================
//     // CASE 2: CUSTOM QUESTION
//     // ================================
//     else {
//       if (!question?.trim())
//         return res.status(400).json({ error: "question is required for custom queries." });

//       console.log(`💬 Handling custom question: "${question.substring(0, 50)}..."`);

//       storedQuestion = question;
//       displayQuestion = question;
//       finalPromptLabel = null;
//       provider = "gemini";
     
//       chatCost = Math.ceil(question.length / 100) + 
//                  Math.ceil(allChunks.slice(0, maxResults * 2).reduce((sum, c) => 
//                    sum + Math.min(c.content.length, 1500), 0) / 200
//                  );

//       const requestedResources = { tokens: chatCost, ai_analysis: 1 };
//       const { allowed, message } = await TokenUsageService.enforceLimits(
//         usage,
//         plan,
//         requestedResources
//       );

//       if (!allowed) {
//         return res.status(403).json({
//           error: `AI chat failed: ${message}`,
//           timeLeftUntilReset: timeLeft
//         });
//       }

//       // ✅ Vector search ONLY in folder file chunks
//       const questionEmbedding = await generateEmbedding(question);
      
//       const vectorQuery = `
//         SELECT 
//           cv.chunk_id,
//           cv.embedding,
//           fc.content,
//           fc.page_start,
//           fc.page_end,
//           fc.heading,
//           uf.originalname as filename,
//           cv.embedding <=> $1::vector as distance
//         FROM chunk_vectors cv
//         INNER JOIN file_chunks fc ON cv.chunk_id = fc.id
//         INNER JOIN user_files uf ON fc.file_id = uf.id
//         WHERE fc.file_id = ANY($2::uuid[])
//           AND uf.user_id = $3
//         ORDER BY distance ASC
//         LIMIT $4;
//       `;
      
//       const { rows: relevantChunks } = await pool.query(vectorQuery, [
//         JSON.stringify(questionEmbedding),
//         fileIds,
//         userId,
//         maxResults * 2
//       ]);

//       console.log(`🎯 Found ${relevantChunks.length} relevant chunks via vector search`);

//       if (relevantChunks.length === 0) {
//         return res.status(404).json({ error: "No relevant information found for your query." });
//       }

//       usedChunkIds = relevantChunks.map((c) => c.chunk_id);

//       const combinedContext = relevantChunks
//         .map((c) => {
//           const content = c.content.length > 1500 
//             ? c.content.substring(0, 1500) + "..." 
//             : c.content;
//           return `📄 [${c.filename}]\n${content}`;
//         })
//         .join("\n\n");

//       console.log(`📊 Context size: ~${Math.ceil(combinedContext.length / 4)} tokens`);

//       answer = await askFolderLLMService(provider, question, "", combinedContext);
     
//       console.log(`✅ Custom question processed`);
//     }

//     if (!answer?.trim()) {
//       return res.status(500).json({ error: "Empty response from AI." });
//     }

//     console.log(`✅ Folder query successful | Answer length: ${answer.length}`);

//     // 5️⃣ Save chat
//     const savedChat = await FolderChat.saveFolderChat(
//       userId,
//       folderName,
//       storedQuestion,
//       answer,
//       finalSessionId,
//       files.map((f) => f.id),
//       usedChunkIds,
//       used_secret_prompt,
//       finalPromptLabel,
//       secret_id
//     );

//     if (chatCost && !used_secret_prompt) {
//       await TokenUsageService.incrementUsage(userId, { tokens: chatCost, ai_analysis: 1 });
//     }

//     // 6️⃣ Return response
//     return res.json({
//       success: true,
//       session_id: finalSessionId,
//       answer,
//       response: answer,
//       llm_provider: provider,
//       used_secret_prompt,
//       prompt_label: finalPromptLabel,
//       secret_id: used_secret_prompt ? secret_id : null,
//       used_chunk_ids: usedChunkIds,
//       files_queried: files.map((f) => f.originalname),
//       total_files: files.length,
//       chunks_used: usedChunkIds.length,
//       chunks_available: allChunks.length, // ✅ Show how many chunks were in folder
//       timestamp: new Date().toISOString(),
//       displayQuestion: displayQuestion,
//       storedQuestion: storedQuestion,
//     });
//   } catch (error) {
//     console.error("❌ Error in queryFolderDocuments:", error);
//     return res.status(500).json({
//       error: "Failed to get AI answer.",
//       details: error.message,
//     });
//   }
// };

exports.queryFolderDocuments = async (req, res) => {
  let chatCost;
  let userId = req.user.id;
  const authorizationHeader = req.headers.authorization;

  try {
    const { folderName } = req.params;
    const {
      question,
      prompt_label = null,
      session_id = null,
      maxResults = 10, // ✅ Retrieve top 10 candidates
      secret_id,
      llm_name,
      additional_input = "",
    } = req.body;

    let used_secret_prompt = !!secret_id;

    if (!folderName) {
      return res.status(400).json({ error: "folderName is required." });
    }

    const finalSessionId = session_id || `session-${Date.now()}`;
    console.log(`📁 Querying folder: ${folderName} | used_secret_prompt=${used_secret_prompt} | secret_id=${secret_id}`);

    // 1️⃣ Get user plan & usage
    const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(
      userId,
      authorizationHeader
    );

    // 2️⃣ Fetch all processed files in folder
    const folderPattern = `%${folderName}%`;
    const filesQuery = `
      SELECT id, originalname, folder_path, status
      FROM user_files
      WHERE user_id = $1
        AND is_folder = false
        AND status = 'processed'
        AND folder_path LIKE $2
      ORDER BY created_at DESC;
    `;
    const { rows: files } = await pool.query(filesQuery, [userId, folderPattern]);

    if (files.length === 0) {
      return res.status(404).json({ error: "No processed files found in this folder." });
    }

    console.log(`📄 Found ${files.length} processed files in folder "${folderName}"`);

    // 3️⃣ ✅ RAG Configuration
    const SIMILARITY_THRESHOLD = 0.75; // Cosine similarity cutoff
    const MIN_CHUNKS = 5; // Minimum chunks to retrieve
    const MAX_CHUNKS = 10; // Maximum chunks to retrieve
    const MAX_CONTEXT_TOKENS = 4000; // ~15% of most model limits (e.g., 32k * 0.15 ≈ 4800)
    const CHARS_PER_TOKEN = 4; // Average chars per token
    const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN; // ~16,000 chars

    // 4️⃣ Initialize variables
    let answer;
    let usedChunkIds = [];
    let storedQuestion;
    let displayQuestion;
    let finalPromptLabel = prompt_label;
    let provider = "gemini";

    // ================================
    // CASE 1: SECRET PROMPT
    // ================================
    if (used_secret_prompt) {
      if (!secret_id)
        return res.status(400).json({ error: "secret_id is required for secret prompts." });

      console.log(`🔐 Using secret prompt id=${secret_id}`);

      // Fetch secret metadata
      const secretQuery = `
        SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
        FROM secret_manager s
        LEFT JOIN llm_models l ON s.llm_id = l.id
        WHERE s.id = $1;
      `;
      const secretResult = await pool.query(secretQuery, [secret_id]);
      if (secretResult.rows.length === 0)
        return res.status(404).json({ error: "Secret configuration not found." });

      const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
        secretResult.rows[0];
     
      finalPromptLabel = secretName;
      storedQuestion = secretName;
      displayQuestion = `Analysis: ${secretName}`;

      provider = resolveProviderName(llm_name || dbLlmName || "gemini");

      // Fetch secret value securely
      const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
      const secretClient = new SecretManagerServiceClient();
      const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

      const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
      const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
      const secretValue = accessResponse.payload.data.toString("utf8");

      if (!secretValue?.trim()) {
        return res.status(500).json({ error: "Secret value is empty." });
      }

      // ✅ Vector search with similarity scoring
      const questionEmbedding = await generateEmbedding(secretValue);
      const allRelevantChunks = [];

      for (const file of files) {
        const relevant = await ChunkVector.findNearestChunksAcrossFiles(
          questionEmbedding,
          maxResults, // Retrieve top 10 candidates per file
          [file.id]
        );
        if (relevant.length) {
          allRelevantChunks.push(
            ...relevant.map((r) => ({ 
              ...r, 
              filename: file.originalname,
              similarity: r.similarity || r.distance || 0 // Ensure similarity score exists
            }))
          );
        }
      }

      if (allRelevantChunks.length === 0) {
        return res.status(404).json({ error: "No relevant information found for your query." });
      }

      // ✅ Filter by similarity threshold and sort by relevance
      const highQualityChunks = allRelevantChunks
        .filter(chunk => {
          const similarity = chunk.similarity || 0;
          // Handle both similarity (higher is better) and distance (lower is better)
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return score >= SIMILARITY_THRESHOLD;
        })
        .sort((a, b) => {
          const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
          const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
          return scoreB - scoreA; // Descending order (best first)
        });

      console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${allRelevantChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

      // ✅ Select 5-10 best chunks while respecting token budget
      let selectedChunks = [];
      let currentContextLength = 0;

      const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
        ? highQualityChunks 
        : allRelevantChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0)); // Fallback to top chunks if not enough high-quality ones

      for (const chunk of chunksToConsider) {
        if (selectedChunks.length >= MAX_CHUNKS) break;
        
        const chunkLength = chunk.content.length;
        if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
          selectedChunks.push(chunk);
          currentContextLength += chunkLength;
        } else if (selectedChunks.length < MIN_CHUNKS) {
          // If we haven't reached minimum, truncate this chunk to fit
          const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
          if (remainingSpace > 500) { // Only include if we have reasonable space
            selectedChunks.push({
              ...chunk,
              content: chunk.content.substring(0, remainingSpace - 100) + "..."
            });
            currentContextLength += remainingSpace;
          }
          break;
        }
      }

      const finalChunks = selectedChunks.length >= MIN_CHUNKS 
        ? selectedChunks 
        : chunksToConsider.slice(0, MIN_CHUNKS); // Ensure minimum chunks

      console.log(`✅ Selected ${finalChunks.length} chunks | Context size: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

      usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

      // ✅ Build context with separators and metadata
      const combinedContext = finalChunks
        .map((c, idx) => {
          const similarity = c.similarity || 0;
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return `--- Chunk ${idx + 1} | File: ${c.filename} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
        })
        .join("\n\n");

      console.log(`📊 Final context: ${combinedContext.length} chars (~${Math.ceil(combinedContext.length / CHARS_PER_TOKEN)} tokens, ${((combinedContext.length / CHARS_PER_TOKEN) / 32000 * 100).toFixed(1)}% of 32k limit)`);

      // ✅ Build minimal prompt
      let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
      finalPrompt += `${secretValue}\n\n=== RELEVANT DOCUMENTS (FOLDER: "${folderName}") ===\n${combinedContext}`;

      if (additional_input?.trim()) {
        const trimmedInput = additional_input.trim().substring(0, 500);
        finalPrompt += `\n\n=== ADDITIONAL INPUT ===\n${trimmedInput}`;
      }

      answer = await askFolderLLMService(provider, finalPrompt);
     
      console.log(`✅ Secret prompt processed: "${secretName}"`);
    }

    // ================================
    // CASE 2: CUSTOM QUESTION
    // ================================
    else {
      if (!question?.trim())
        return res.status(400).json({ error: "question is required for custom queries." });

      console.log(`💬 Handling custom question: "${question.substring(0, 50)}..."`);

      storedQuestion = question;
      displayQuestion = question;
      finalPromptLabel = null;

      // Fetch LLM model from custom_query table for custom queries (always fetch from DB)
      let dbLlmName = null;
      const customQueryLlm = `
        SELECT cq.llm_name, cq.llm_model_id
        FROM custom_query cq
        ORDER BY cq.id DESC
        LIMIT 1;
      `;
      const customQueryResult = await pool.query(customQueryLlm);
      if (customQueryResult.rows.length > 0) {
        dbLlmName = customQueryResult.rows[0].llm_name;
        console.log(`🤖 Using LLM from custom_query table: ${dbLlmName}`);
      } else {
        console.warn(`⚠️ No LLM found in custom_query table — falling back to gemini`);
        dbLlmName = 'gemini';
      }

      // Resolve provider name using the LLM from custom_query table
      provider = resolveFolderProviderName(dbLlmName || "gemini");
      console.log(`🤖 Resolved LLM provider for custom query: ${provider}`);
      
      // Check if provider is available
      const availableProviders = getFolderAvailableProviders();
      if (!availableProviders[provider] || !availableProviders[provider].available) {
        console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini`);
        provider = 'gemini';
      }
     
      // ✅ Vector search with similarity scoring
      const questionEmbedding = await generateEmbedding(question);
      const allRelevantChunks = [];

      for (const file of files) {
        const relevant = await ChunkVector.findNearestChunksAcrossFiles(
          questionEmbedding,
          maxResults, // Retrieve top 10 candidates per file
          [file.id]
        );
        if (relevant.length) {
          allRelevantChunks.push(
            ...relevant.map((r) => ({ 
              ...r, 
              filename: file.originalname,
              similarity: r.similarity || r.distance || 0
            }))
          );
        }
      }

      if (allRelevantChunks.length === 0) {
        return res.status(404).json({ error: "No relevant information found for your query." });
      }

      // ✅ Filter by similarity threshold and sort by relevance
      const highQualityChunks = allRelevantChunks
        .filter(chunk => {
          const similarity = chunk.similarity || 0;
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return score >= SIMILARITY_THRESHOLD;
        })
        .sort((a, b) => {
          const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
          const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
          return scoreB - scoreA;
        });

      console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${allRelevantChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

      // ✅ Select 5-10 best chunks while respecting token budget
      let selectedChunks = [];
      let currentContextLength = 0;

      const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
        ? highQualityChunks 
        : allRelevantChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

      for (const chunk of chunksToConsider) {
        if (selectedChunks.length >= MAX_CHUNKS) break;
        
        const chunkLength = chunk.content.length;
        if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
          selectedChunks.push(chunk);
          currentContextLength += chunkLength;
        } else if (selectedChunks.length < MIN_CHUNKS) {
          const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
          if (remainingSpace > 500) {
            selectedChunks.push({
              ...chunk,
              content: chunk.content.substring(0, remainingSpace - 100) + "..."
            });
            currentContextLength += remainingSpace;
          }
          break;
        }
      }

      const finalChunks = selectedChunks.length >= MIN_CHUNKS 
        ? selectedChunks 
        : chunksToConsider.slice(0, MIN_CHUNKS);

      console.log(`✅ Selected ${finalChunks.length} chunks | Context size: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

      usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

      // ✅ Calculate realistic token cost
      chatCost = Math.ceil(question.length / 100) + Math.ceil(currentContextLength / 200);

      const requestedResources = { tokens: chatCost, ai_analysis: 1 };
      const { allowed, message } = await TokenUsageService.enforceLimits(
        usage,
        plan,
        requestedResources
      );

      if (!allowed) {
        return res.status(403).json({
          error: `AI chat failed: ${message}`,
          timeLeftUntilReset: timeLeft
        });
      }

      // ✅ Build context with separators and metadata
      const combinedContext = finalChunks
        .map((c, idx) => {
          const similarity = c.similarity || 0;
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return `--- Chunk ${idx + 1} | File: ${c.filename} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
        })
        .join("\n\n");

      console.log(`📊 Final context: ${combinedContext.length} chars (~${Math.ceil(combinedContext.length / CHARS_PER_TOKEN)} tokens, ${((combinedContext.length / CHARS_PER_TOKEN) / 32000 * 100).toFixed(1)}% of 32k limit)`);

      answer = await askFolderLLMService(provider, question, "", combinedContext);
     
      console.log(`✅ Custom question processed`);
    }

    if (!answer?.trim()) {
      return res.status(500).json({ error: "Empty response from AI." });
    }

    console.log(`✅ Folder query successful | Answer length: ${answer.length} | Chunks used: ${usedChunkIds.length}`);

    // 5️⃣ Save chat
    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      storedQuestion,
      answer,
      finalSessionId,
      files.map((f) => f.id),
      usedChunkIds,
      used_secret_prompt,
      finalPromptLabel,
      secret_id
    );

    if (chatCost && !used_secret_prompt) {
      await TokenUsageService.incrementUsage(userId, { tokens: chatCost, ai_analysis: 1 });
    }

    // 6️⃣ Return response
    return res.json({
      success: true,
      session_id: finalSessionId,
      answer,
      response: answer,
      llm_provider: provider,
      used_secret_prompt,
      prompt_label: finalPromptLabel,
      secret_id: used_secret_prompt ? secret_id : null,
      used_chunk_ids: usedChunkIds,
      files_queried: files.map((f) => f.originalname),
      total_files: files.length,
      chunks_used: usedChunkIds.length,
      timestamp: new Date().toISOString(),
      displayQuestion: displayQuestion,
      storedQuestion: storedQuestion,
    });
  } catch (error) {
    console.error("❌ Error in queryFolderDocuments:", error);
    return res.status(500).json({
      error: "Failed to get AI answer.",
      details: error.message,
    });
  }
};
/* ----------------- Get Folder Processing Status (NEW) ----------------- */
exports.getFolderProcessingStatus = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user.id;

    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const documents = files.filter(f => !f.is_folder);
   
    if (documents.length === 0) {
      return res.json({
        folderName,
        overallProgress: 100,
        processingStatus: { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 },
        documents: []
      });
    }

    const processingStatus = {
      total: documents.length,
      queued: documents.filter(f => f.status === "queued" || f.status === "batch_queued").length,
      processing: documents.filter(f => f.status === "batch_processing" || f.status === "processing").length,
      completed: documents.filter(f => f.status === "processed").length,
      failed: documents.filter(f => f.status === "error").length
    };

    const overallProgress = Math.round((processingStatus.completed / documents.length) * 100);

    return res.json({
      folderName,
      overallProgress,
      processingStatus,
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.originalname,
        status: doc.status, // Fixed: was using doc.processing_status
        progress: doc.processing_progress
      }))
    });

  } catch (error) {
    console.error("❌ getFolderProcessingStatus error:", error);
    res.status(500).json({
      error: "Failed to get folder processing status",
      details: error.message
    });
  }
};

/* ----------------- Get File Processing Status (Existing) ----------------- */
exports.getFileProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;
    if (!file_id || file_id === 'undefined') {
      return res.status(400).json({ error: "A valid file_id is required." });
    }

    const file = await File.getFileById(file_id);
    if (!file || String(file.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Access denied or file not found." });
    }

    const job = await ProcessingJob.getJobByFileId(file_id);

    if (file.status === "processed") {
      const existingChunks = await FileChunk.getChunksByFileId(file_id);
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
          file_id: file.id,
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
        file_id: file.id,
        status: file.status,
        processing_progress: file.processing_progress,
        job_status: "not_queued",
        job_error: null,
        last_updated: file.updated_at,
        chunks: [],
        summary: file.summary,
      });
    }

    const status = await getOperationStatus(job.document_ai_operation_name);

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
      await File.updateProcessingStatus(file_id, "error", 0.0);
      await ProcessingJob.updateJobStatus(job.job_id, "failed", status.error.message);
      return res.status(500).json({
        file_id: file.id,
        status: "error",
        processing_progress: 0.0,
        job_status: "failed",
        job_error: status.error.message,
        last_updated: new Date().toISOString(),
      });
    }

    // Check if another process has already locked this file for processing
    const preProcessFile = await File.getFileById(file_id);
    if (preProcessFile.status === "processing_locked") {
      console.log(`[getFileProcessingStatus] 🔒 File ${file_id} is already being processed. Aborting duplicate trigger.`);
      return res.json({
        file_id: file.id,
        status: "processing",
        processing_progress: file.processing_progress,
        job_status: "running",
        job_error: null,
        last_updated: file.updated_at,
      });
    }
    
    // Acquire lock
    await File.updateProcessingStatus(file_id, "processing_locked", 75.0);

    const bucketName = fileOutputBucket.name;
    const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);

    if (!extractedBatchTexts || extractedBatchTexts.length === 0) {
      throw new Error("Could not extract any meaningful text content from batch document.");
    }

    // Dynamically determine chunking method from secret_manager → chunking_methods
    let batchChunkingMethod = "recursive"; // Default fallback
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
      const result = await pool.query(chunkMethodQuery, [file_id]);

      if (result.rows.length > 0) {
        batchChunkingMethod = result.rows[0].method_name;
        console.log(`[getFileProcessingStatus] ✅ Using chunking method from DB: ${batchChunkingMethod}`);
      } else {
        console.log(`[getFileProcessingStatus] No secret_id found for file ${file_id}, using default chunking method.`);
      }
    } catch (err) {
      console.error(`[getFileProcessingStatus] Error fetching chunking method: ${err.message}`);
      console.log(`[getFileProcessingStatus] Falling back to default chunking method: recursive`);
    }

    const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod || 'recursive');

    if (chunks.length === 0) {
      await File.updateProcessingStatus(file_id, "processed", 100.0);
      await ProcessingJob.updateJobStatus(job.job_id, "completed");
      const updatedFile = await File.getFileById(file_id);
      return res.json({
        file_id: updatedFile.id,
        chunks: [],
        summary: updatedFile.summary,
        chunking_method: batchChunkingMethod,
      });
    }

    const chunkContents = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkContents);

    const chunksToSaveBatch = chunks.map((chunk, i) => ({
      file_id: file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    const savedChunksBatch = await FileChunk.saveMultipleChunks(chunksToSaveBatch);

    const vectorsToSaveBatch = savedChunksBatch.map((savedChunk) => {
      const originalChunkIndex = savedChunk.chunk_index;
      const embedding = embeddings[originalChunkIndex];
      return {
        chunk_id: savedChunk.id,
        embedding: embedding,
        file_id: file_id,
      };
    });

    await ChunkVector.saveMultipleChunkVectors(vectorsToSaveBatch);
    await File.updateProcessingStatus(file_id, "processed", 100.0);
    await ProcessingJob.updateJobStatus(job.job_id, "completed");

    let summary = null;
    try {
      if (chunks.length > 0) {
        // FIX: Pass the array of chunk objects directly to the summary function
        summary = await getSummaryFromChunks(chunks.map(c => c.content));
        await File.updateSummary(file_id, summary);
      }
    } catch (summaryError) {
      console.warn(`⚠️ Could not generate summary for file ID ${file_id}:`, summaryError.message);
    }

    const updatedFile = await File.getFileById(file_id);
    const fileChunks = await FileChunk.getChunksByFileId(file_id);

    const formattedChunks = fileChunks.map((chunk) => ({
      text: chunk.content,
      metadata: {
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        heading: chunk.heading,
      },
    }));

    return res.json({
      file_id: updatedFile.id,
      status: updatedFile.status,
      processing_progress: updatedFile.processing_progress,
      job_status: "completed",
      job_error: null,
      last_updated: updatedFile.updated_at,
      chunks: formattedChunks,
      summary: updatedFile.summary,
      chunking_method: batchChunkingMethod,
    });
  } catch (error) {
    console.error("❌ getFileProcessingStatus error:", error);
    return res.status(500).json({
      error: "Failed to fetch processing status.",
      details: error.message,
    });
  }
};

/* ----------------- Helper function for cosine similarity ----------------- */
function calculateCosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}


/* ----------------- Get Folder Chat Session with History ----------------- */
exports.getFolderChatSessionById = async (req, res) => {
  try {
    const { folderName, sessionId } = req.params;
    const userId = req.user.id;

    // Get all messages for this session, ordered chronologically
    const chatHistory = await FolderChat.findAll({
      where: {
        user_id: userId,
        folder_name: folderName, // Changed from folder_id to folder_name
        session_id: sessionId
      },
      order: [["created_at", "ASC"]],
    });

    if (chatHistory.length === 0) {
      return res.status(404).json({
        error: "Chat session not found",
        folderName,
        sessionId
      });
    }

    // Get folder info
    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");

    return res.json({
      success: true,
      folderName,
      sessionId,
      chatHistory: chatHistory.map(chat => ({
        id: chat.id,
        question: chat.used_secret_prompt ? `Analysis: ${chat.prompt_label || 'Secret Prompt'}` : chat.question,
        response: chat.answer,
        timestamp: chat.created_at,
        documentIds: chat.summarized_file_ids || [],
        usedChunkIds: chat.used_chunk_ids || [],
        used_secret_prompt: chat.used_secret_prompt || false,
        prompt_label: chat.prompt_label || null,
      })),
      documentsInFolder: processedFiles.map(f => ({
        id: f.id,
        name: f.originalname,
        status: f.status
      })),
      totalMessages: chatHistory.length
    });
  } catch (error) {
    console.error("❌ getFolderChatSessionById error:", error);
    res.status(500).json({
      error: "Failed to fetch chat session",
      details: error.message
    });
  }
};

exports.getFolderChatSessions = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user found in token" });
    }

    const chatHistory = await FolderChat.findAll({
      where: {
        user_id: userId,
        folder_name: folderName
      },
      order: [["created_at", "ASC"]],
    });

    if (!chatHistory.length) {
      return res.status(200).json({
        success: true,
        folderName,
        sessions: [],
        documentsInFolder: [],
        totalSessions: 0,
        totalMessages: 0
      });
    }

    const sessions = {};
    chatHistory.forEach(chat => {
      if (!sessions[chat.session_id]) {
        sessions[chat.session_id] = {
          sessionId: chat.session_id,
          messages: []
        };
      }
      sessions[chat.session_id].messages.push({
        id: chat.id,
        question: chat.used_secret_prompt ? `Analysis: ${chat.prompt_label || 'Secret Prompt'}` : chat.question,
        response: chat.answer,
        timestamp: chat.created_at,
        documentIds: chat.summarized_file_ids || [],
        usedChunkIds: chat.used_chunk_ids || [],
        used_secret_prompt: chat.used_secret_prompt || false,
        prompt_label: chat.prompt_label || null,
      });
    });

    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");

    return res.json({
      success: true,
      folderName,
      sessions: Object.values(sessions),
      documentsInFolder: processedFiles.map(f => ({
        id: f.id,
        name: f.originalname,
        status: f.status
      })),
      totalSessions: Object.keys(sessions).length,
      totalMessages: chatHistory.length
    });
  } catch (error) {
    console.error("❌ getFolderChatSessions error:", error);
    res.status(500).json({
      error: "Failed to fetch folder chat sessions",
      details: error.message
    });
  }
};


/* ----------------- Continue Folder Chat Session ----------------- */
exports.continueFolderChat = async (req, res) => {
  let chatCost;
  const userId = req.user.id;
  const authorizationHeader = req.headers.authorization;

  try {
    const { folderName, sessionId } = req.params;
    const {
      question, // For custom queries
      maxResults = 10,
      used_secret_prompt = false, // NEW
      prompt_label = null, // NEW
      secret_id, // NEW
      llm_name, // NEW
      additional_input = '', // NEW
    } = req.body;

    if (!folderName) {
      return res.status(400).json({ error: "folderName is required." });
    }

    console.log(`[continueFolderChat] Continuing session ${sessionId} for folder: ${folderName}`);
    console.log(`[continueFolderChat] New question: ${question}`);
    console.log(`[continueFolderChat] Used secret prompt: ${used_secret_prompt}, secret_id: ${secret_id}, llm_name: ${llm_name}`);

    // 1. Fetch user's usage and plan details
    const { usage, plan, timeLeft } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);

    // Verify session exists and get chat history
    const existingChats = await FolderChat.findAll({
      where: {
        user_id: userId,
        folder_name: folderName,
        session_id: sessionId
      },
      order: [["created_at", "ASC"]],
    });

    if (existingChats.length === 0) {
      return res.status(404).json({
        error: "Chat session not found. Please start a new conversation.",
        folderName,
        sessionId
      });
    }

    // Get all processed files in the folder
    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");
   
    console.log(`[continueFolderChat] Found ${processedFiles.length} processed files in folder ${folderName}`);
   
    if (processedFiles.length === 0) {
      return res.status(404).json({
        error: "No processed documents in folder",
        sessionId,
        chatHistory: existingChats.map(chat => ({
          question: chat.question,
          response: chat.response,
          timestamp: chat.created_at
        }))
      });
    }

    // Get all chunks from all files in the folder
    let allChunks = [];
    for (const file of processedFiles) {
      const chunks = await FileChunk.getChunksByFileId(file.id);
      const chunksWithFileInfo = chunks.map(chunk => ({
        ...chunk,
        filename: file.originalname,
        file_id: file.id
      }));
      allChunks = allChunks.concat(chunksWithFileInfo);
    }

    console.log(`[continueFolderChat] Total chunks found: ${allChunks.length}`);

    if (allChunks.length === 0) {
      const answer = "The documents in this folder don't appear to have any processed content yet. Please wait for processing to complete or check the document processing status.";
     
      // Save the new chat message
      const savedChat = await FolderChat.saveFolderChat(
        userId,
        folderName,
        question,
        answer,
        sessionId,
        processedFiles.map(f => f.id),
        [], // usedChunkIds - will be populated by vector search
        used_secret_prompt,
        prompt_label,
        secret_id
      );

      return res.json({
        answer,
        sources: [],
        sessionId,
        chatHistory: [...existingChats, savedChat].map(chat => ({
          question: chat.question,
          response: chat.answer,
          timestamp: chat.created_at || chat.created_at,
          used_secret_prompt: chat.used_secret_prompt || false,
          prompt_label: chat.prompt_label || null,
        })),
        newMessage: {
          question,
          response: answer,
          timestamp: savedChat.created_at
        }
      });
    }

    // Build conversation context from previous messages
    const conversationContext = existingChats
      .map(chat => `Q: ${chat.question}\nA: ${chat.answer}`)
      .join('\n\n---\n\n');

    // Token cost (rough estimate)
    chatCost = Math.ceil(question.length / 100) + Math.ceil(allChunks.reduce((sum, c) => sum + c.content.length, 0) / 200) + Math.ceil(conversationContext.length / 200); // Question tokens + context tokens + history tokens
   
    // 2. Enforce token limits for AI analysis
    const requestedResources = { tokens: chatCost, ai_analysis: 1 };
    const { allowed, message } = await TokenUsageService.enforceLimits(usage, plan, requestedResources);

    if (!allowed) {
      return res.status(403).json({
        error: `AI chat failed: ${message}`,
        timeLeftUntilReset: timeLeft
      });
    }

    // Use keyword-based search for the new question
    const questionLower = question.toLowerCase();
    const questionWords = questionLower
      .split(/\s+/)
      .filter(word => word.length > 3 && !['what', 'where', 'when', 'how', 'why', 'which', 'this', 'that', 'these', 'those'].includes(word));
   
    console.log(`[continueFolderChat] Question keywords:`, questionWords);

    let relevantChunks = [];
   
    if (questionWords.length > 0) {
      // Score chunks based on keyword matches
      relevantChunks = allChunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
       
        // Check for exact keyword matches
        for (const word of questionWords) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = (contentLower.match(regex) || []).length;
          score += matches * 2;
        }
       
        // Check for partial matches
        for (const word of questionWords) {
          if (contentLower.includes(word)) {
            score += 1;
          }
        }
       
        return {
          ...chunk,
          similarity_score: score
        };
      })
      .filter(chunk => chunk.similarity_score > 0)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, maxResults);
    } else {
      // If no meaningful keywords, use first chunks from each document
      const chunksPerDoc = Math.max(1, Math.floor(maxResults / processedFiles.length));
      for (const file of processedFiles) {
        const fileChunks = allChunks.filter(chunk => chunk.file_id === file.id);
        const topChunks = fileChunks.slice(0, chunksPerDoc).map(chunk => ({
          ...chunk,
          similarity_score: 0.5
        }));
        relevantChunks = relevantChunks.concat(topChunks);
      }
    }

    console.log(`[continueFolderChat] Found ${relevantChunks.length} relevant chunks`);

    // Determine provider based on request type
    let provider;
    if (used_secret_prompt && secret_id) {
      // Handle secret prompt - resolve provider from secret config
      const { resolveProviderName: resolveFolderProviderName } = require('../services/folderAiService');
      const secretQuery = `
        SELECT s.llm_id, l.name AS llm_name
        FROM secret_manager s
        LEFT JOIN llm_models l ON s.llm_id = l.id
        WHERE s.id = $1
      `;
      const secretResult = await pool.query(secretQuery, [secret_id]);
      const dbLlmName = secretResult.rows[0]?.llm_name;
      provider = resolveFolderProviderName(llm_name || dbLlmName || 'gemini');
    } else {
      // Custom query - use Claude Sonnet 4
      provider = 'claude-sonnet-4';
      console.log(`🤖 Using Claude Sonnet 4 for custom query in continueFolderChat`);
    }

    // Prepare context for AI with conversation history
    const contextText = relevantChunks.map((chunk, index) =>
      `[Document: ${chunk.filename} - Page ${chunk.page_start || 'N/A'}]\n${chunk.content.substring(0, 2000)}`
    ).join("\n\n---\n\n");

    // Enhanced prompt with conversation context
    const prompt = `
You are an AI assistant continuing a conversation about documents in folder "${folderName}".
 
PREVIOUS CONVERSATION:
${conversationContext}
 
CURRENT QUESTION: "${question}"
 
RELEVANT DOCUMENT CONTENT:
${contextText}
 
INSTRUCTIONS:
1. Consider the conversation history when answering the current question
2. If the question refers to previous responses (e.g., "tell me more about that", "what else", "can you elaborate"), use the conversation context
3. Provide a comprehensive answer based on both the conversation history and document content
4. Use specific details, quotes, and examples from the documents when possible
5. If information spans multiple documents, clearly indicate which documents contain what information
6. Maintain conversational flow and reference previous parts of the conversation when relevant
7. Be thorough and helpful - synthesize information across all relevant documents
 
Provide your answer:`;
 
    const answer = await askFolderLLM(provider, question, contextText, existingChats.map(chat => ({ question: chat.question, answer: chat.answer })), contextText); // Use askFolderLLM
    console.log(`[continueFolderChat] Generated answer length: ${answer.length} characters`);

    // Save the new chat message
    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      question,
      answer,
      sessionId,
      processedFiles.map(f => f.id),
      relevantChunks.map(c => c.id) // usedChunkIds
    );

    // 3. Increment usage after successful AI chat
    await TokenUsageService.incrementUsage(userId, requestedResources);

    // Prepare sources with detail
    const sources = relevantChunks.map(chunk => ({
      document: chunk.filename,
      content: chunk.content.substring(0, 400) + (chunk.content.length > 400 ? "..." : ""),
      page: chunk.page_start || 'N/A',
      relevanceScore: chunk.similarity_score || 0
    }));

    // Return complete chat history plus new message
    const fullChatHistory = [...existingChats, savedChat].map(chat => ({
      question: chat.question,
      response: chat.answer,
      timestamp: chat.created_at,
      usedChunkIds: chat.used_chunk_ids || [],
      usedChunkIds: chat.used_chunk_ids || [],
      usedChunkIds: chat.used_chunk_ids || [],
      used_secret_prompt: chat.used_secret_prompt || false,
      prompt_label: chat.prompt_label || null,
    }));

    return res.json({
      answer,
      sources,
      sessionId,
      folderName,
      chatHistory: fullChatHistory,
      newMessage: {
        question,
        response: answer,
        timestamp: savedChat.created_at
      },
      documentsSearched: processedFiles.length,
      chunksFound: relevantChunks.length,
      totalMessages: fullChatHistory.length,
      searchMethod: questionWords.length > 0 ? 'keyword_search' : 'document_sampling'
    });

  } catch (error) {
    console.error("❌ continueFolderChat error:", error);
    // If an error occurs after token check but before increment, we should ideally roll back.
    // For now, we'll just log the error.
    res.status(500).json({
      error: "Failed to continue chat",
      details: error.message
    });
  }
};


/* ----------------- Delete Folder Chat Session ----------------- */
exports.deleteFolderChatSession = async (req, res) => {
  try {
    const { folderName, sessionId } = req.params;
    const userId = req.user.id;

    // Delete all messages in this session
    const deletedCount = await FolderChat.destroy({
      where: {
        user_id: userId,
        folder_name: folderName, // Changed from folder_id to folder_name
        session_id: sessionId
      }
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        error: "Chat session not found",
        folderName,
        sessionId
      });
    }

    return res.json({
      success: true,
      message: `Deleted chat session with ${deletedCount} messages`,
      folderName,
      sessionId,
      deletedMessages: deletedCount
    });
  } catch (error) {
    console.error("❌ deleteFolderChatSession error:", error);
    res.status(500).json({
      error: "Failed to delete chat session",
      details: error.message
    });
  }
};




// Fetch all chats for a specific folder
exports.getFolderChatsByFolder = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user.id; // assuming user is authenticated and middleware sets req.user

    const chats = await FolderChat.getFolderChatHistory(userId, folderName);

    res.status(200).json({
      success: true,
      folderName,
      chats,
    });
  } catch (error) {
    console.error("Error fetching folder chats:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chats for folder",
    });
  }
};

/* ---------------------- Get Documents in a Specific Folder ---------------------- */
exports.getDocumentsInFolder = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user.id;

    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required." });
    }

    const files = await File.findByUserIdAndFolderPath(userId, folderName);

    const documents = files
      .filter(file => !file.is_folder)
      .map(file => ({
        id: file.id,
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        created_at: file.created_at,
        status: file.status,
        processing_progress: file.processing_progress,
        folder_path: file.folder_path,
      }));

    return res.status(200).json({
      message: `Documents in folder '${folderName}' fetched successfully.`,
      folderName: folderName,
      documents: documents,
      totalDocuments: documents.length,
    });
  } catch (error) {
    console.error("❌ Error fetching documents in folder:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};



/* ---------------------- Get All Cases for User (FIXED) ---------------------- */
exports.getAllCases = async (req, res) => {
  try {
    const userId = parseInt(req.user?.id);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const getAllCasesQuery = `
      SELECT
        c.*,
        ct.name as case_type_name,
        st.name as sub_type_name,
        co.name as court_name_name
      FROM cases c
      LEFT JOIN case_types ct ON 
        CASE 
          WHEN c.case_type ~ '^[0-9]+$' THEN c.case_type::integer = ct.id
          ELSE false
        END
      LEFT JOIN sub_types st ON 
        CASE 
          WHEN c.sub_type ~ '^[0-9]+$' THEN c.sub_type::integer = st.id
          ELSE false
        END
      LEFT JOIN courts co ON 
        CASE 
          WHEN c.court_name ~ '^[0-9]+$' THEN c.court_name::integer = co.id
          ELSE false
        END
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC;
    `;
    const { rows: cases } = await pool.query(getAllCasesQuery, [userId]);

    // Parse JSON fields for each case
    const formattedCases = cases.map(caseData => {
      // Use lookup table names if available, otherwise use the original values
      caseData.case_type = caseData.case_type_name || caseData.case_type;
      caseData.sub_type = caseData.sub_type_name || caseData.sub_type;
      caseData.court_name = caseData.court_name_name || caseData.court_name;

      // Remove the now redundant name fields
      delete caseData.case_type_name;
      delete caseData.sub_type_name;
      delete caseData.court_name_name;

      try {
        if (typeof caseData.judges === 'string' && caseData.judges.trim() !== '') {
          caseData.judges = JSON.parse(caseData.judges);
        } else if (caseData.judges === null) {
          caseData.judges = []; // Default to empty array if null
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse judges JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.judges}`);
        caseData.judges = []; // Fallback to empty array on error
      }
      try {
        if (typeof caseData.petitioners === 'string' && caseData.petitioners.trim() !== '') {
          caseData.petitioners = JSON.parse(caseData.petitioners);
        } else if (caseData.petitioners === null) {
          caseData.petitioners = []; // Default to empty array if null
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse petitioners JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.petitioners}`);
        caseData.petitioners = []; // Fallback to empty array on error
      }
      try {
        if (typeof caseData.respondents === 'string' && caseData.respondents.trim() !== '') {
          caseData.respondents = JSON.parse(caseData.respondents);
        } else if (caseData.respondents === null) {
          caseData.respondents = []; // Default to empty array if null
        }
      } catch (e) {
        console.warn(`⚠️ Could not parse respondents JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.respondents}`);
        caseData.respondents = []; // Fallback to empty array on error
      }
      return caseData;
    });

    return res.status(200).json({
      message: "Cases fetched successfully.",
      cases: formattedCases,
      totalCases: formattedCases.length,
    });
  } catch (error) {
    console.error("❌ Error fetching all cases:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

/* ---------------------- Get Case Files by Folder (FINAL FIXED) ---------------------- */
exports.getCaseFilesByFolderName = async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;
    const { folderName } = req.params;

    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    console.log(`📂 [getCaseFilesByFolderName] User: ${username}, Folder: ${folderName}`);

    // Step 1: Find folder record in DB
    const folderQuery = `
      SELECT * FROM user_files
      WHERE user_id = $1
        AND is_folder = true
        AND originalname = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const { rows: folderRows } = await pool.query(folderQuery, [userId, folderName]);

    if (folderRows.length === 0) {
      console.warn(`⚠️ Folder "${folderName}" not found for user ${userId}`);
      return res.status(404).json({
        error: `Folder "${folderName}" not found for this user.`,
      });
    }

    const folder = folderRows[0];
    const folderPath = folder.folder_path; // ✅ Use the same folder_path stored during upload
    console.log(`✅ Folder found. Using folder_path: ${folderPath}`);

    // Step 2: Fetch all files having the same folder_path
    const filesQuery = `
      SELECT
        id,
        user_id,
        originalname,
        gcs_path,
        folder_path,
        mimetype,
        size,
        status,
        processing_progress,
        full_text_content,
        summary,
        edited_docx_path,
        edited_pdf_path,
        processed_at,
        created_at,
        updated_at,
        is_folder
      FROM user_files
      WHERE user_id = $1
        AND is_folder = false
        AND folder_path = $2
      ORDER BY created_at DESC;
    `;
    const { rows: files } = await pool.query(filesQuery, [userId, folderPath]);

    if (files.length === 0) {
      console.warn(`⚠️ No files found under folder_path: ${folderPath}`);
      return res.status(200).json({
        message: "Folder files fetched successfully, but no documents found.",
        folder,
        files: [],
        debug: {
          searched_folder_path: folderPath,
          hint: "Check that uploaded files used the same folder_path value",
        },
      });
    }

    // Step 3: Add signed URLs
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const previewUrl = await makeSignedReadUrl(file.gcs_path, 15);
        const viewUrl = await makeSignedReadUrl(file.gcs_path, 60); // Longer expiry for viewing
        return { 
          ...file, 
          previewUrl,
          viewUrl, // Direct URL to open/view the document
        };
      })
    );

    console.log(`✅ Returning ${filesWithUrls.length} files for folder "${folderName}"`);

    return res.status(200).json({
      message: "Folder files fetched successfully.",
      folder: {
        id: folder.id,
        name: folder.originalname,
        folder_path: folder.folder_path,
        gcs_path: folder.gcs_path,
      },
      files: filesWithUrls,
    });

  } catch (error) {
    console.error("❌ getCaseFilesByFolderName error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

/* ---------------------- View/Open Document ---------------------- */
/**
 * Get a signed URL to view/open a document directly
 * @route GET /files/:fileId/view
 */
exports.viewDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;
    const { expiryMinutes = 60 } = req.query; // Default 60 minutes

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    console.log(`👁️ [viewDocument] User: ${userId}, FileId: ${fileId}`);

    // Fetch the file from database
    const fileQuery = `
      SELECT 
        id,
        user_id,
        originalname,
        gcs_path,
        folder_path,
        mimetype,
        size,
        status,
        is_folder,
        created_at
      FROM user_files
      WHERE id = $1 AND user_id = $2 AND is_folder = false;
    `;
    const { rows } = await pool.query(fileQuery, [fileId, userId]);

    if (rows.length === 0) {
      console.warn(`⚠️ File ${fileId} not found for user ${userId}`);
      return res.status(404).json({
        error: "Document not found or you don't have permission to access it.",
      });
    }

    const file = rows[0];
    
    // Check if file exists in GCS
    const fileRef = bucket.file(file.gcs_path);
    const [exists] = await fileRef.exists();
    
    if (!exists) {
      console.error(`❌ File ${file.gcs_path} not found in GCS`);
      return res.status(404).json({
        error: "Document file not found in storage.",
      });
    }

    // Generate signed URL for viewing
    const viewUrl = await makeSignedReadUrl(file.gcs_path, parseInt(expiryMinutes));

    console.log(`✅ Generated view URL for file: ${file.originalname}`);

    return res.status(200).json({
      message: "Document view URL generated successfully.",
      document: {
        id: file.id,
        name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        status: file.status,
        folder_path: file.folder_path,
        created_at: file.created_at,
      },
      viewUrl,
      expiresIn: `${expiryMinutes} minutes`,
    });

  } catch (error) {
    console.error("❌ viewDocument error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

/* ---------------------- Stream/Download Document ---------------------- */
/**
 * Stream a document directly to the browser for inline viewing
 * @route GET /files/:fileId/stream
 */
exports.streamDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;
    const { download = false } = req.query; // Download vs inline viewing

    if (!fileId) {
      return res.status(400).json({ error: "File ID is required" });
    }

    console.log(`📥 [streamDocument] User: ${userId}, FileId: ${fileId}, Download: ${download}`);

    // Fetch the file from database
    const fileQuery = `
      SELECT 
        id,
        user_id,
        originalname,
        gcs_path,
        mimetype,
        size,
        is_folder
      FROM user_files
      WHERE id = $1 AND user_id = $2 AND is_folder = false;
    `;
    const { rows } = await pool.query(fileQuery, [fileId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Document not found or you don't have permission to access it.",
      });
    }

    const file = rows[0];
    
    // Get file from GCS
    const fileRef = bucket.file(file.gcs_path);
    const [exists] = await fileRef.exists();
    
    if (!exists) {
      return res.status(404).json({
        error: "Document file not found in storage.",
      });
    }

    // Get file metadata
    const [metadata] = await fileRef.getMetadata();

    // Set appropriate headers
    const contentDisposition = download === 'true' || download === true
      ? `attachment; filename="${file.originalname}"`
      : `inline; filename="${file.originalname}"`;

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Length', metadata.size || file.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream the file
    const readStream = fileRef.createReadStream();
    
    readStream.on('error', (error) => {
      console.error(`❌ Stream error for file ${fileId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Error streaming document",
          details: error.message,
        });
      }
    });

    readStream.pipe(res);

    console.log(`✅ Streaming file: ${file.originalname}`);

  } catch (error) {
    console.error("❌ streamDocument error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  }
};

