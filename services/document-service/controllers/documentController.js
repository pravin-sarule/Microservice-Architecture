


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
const { uploadToGCS, getSignedUrl, getSignedUploadUrl } = require("../services/gcsService");
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
 getAvailableProviders, // Add getAvailableProviders here
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

const CONVERSATION_HISTORY_TURNS = 5;

function formatConversationHistory(chats = [], limit = CONVERSATION_HISTORY_TURNS) {
  if (!Array.isArray(chats) || chats.length === 0) return '';
  const recentChats = chats.slice(-limit);
  return recentChats
    .map((chat, idx) => {
      const turnNumber = chats.length - recentChats.length + idx + 1;
      return `Turn ${turnNumber}:\nUser: ${chat.question || ''}\nAssistant: ${chat.answer || ''}`;
    })
    .join('\n\n');
}

function simplifyHistory(chats = []) {
  if (!Array.isArray(chats)) return [];
  return chats
    .map((chat) => ({
      id: chat.id,
      question: chat.question,
      answer: chat.answer,
      created_at: chat.created_at,
    }))
    .filter((entry) => typeof entry.question === 'string' && typeof entry.answer === 'string');
}

function appendConversationToPrompt(prompt, conversationText) {
  if (!conversationText) return prompt;
  return `You are continuing an existing conversation with the same user. Reference prior exchanges when helpful and keep the narrative consistent.\n\nPrevious Conversation:\n${conversationText}\n\n---\n\n${prompt}`;
}

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
 * @description Generate signed URL for direct upload to GCS (for large files >32MB)
 * @route POST /api/doc/generate-upload-url
 */
exports.generateUploadUrl = async (req, res) => {
  const userId = req.user.id;
  const authorizationHeader = req.headers.authorization;

  try {
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { filename, mimetype, size } = req.body;
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    // Generate GCS path
    const folderPath = `uploads/${userId}`;
    const path = require('path');
    const timestamp = Date.now();
    const safeFilename = filename.replace(/\s+/g, '_');
    const gcsPath = path.posix.join(folderPath, `${timestamp}_${safeFilename}`);

    // Generate signed URL for upload (15 minutes expiry)
    const signedUrl = await getSignedUploadUrl(
      gcsPath,
      mimetype || 'application/octet-stream',
      15,
      true // Use input bucket for document uploads
    );

    return res.status(200).json({
      signedUrl,
      gcsPath,
      filename: safeFilename,
      folderPath,
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
 * @description Handle post-upload processing after file is uploaded via signed URL
 * @route POST /api/doc/complete-upload
 */
exports.completeSignedUpload = async (req, res) => {
  const userId = req.user.id;
  const authorizationHeader = req.headers.authorization;

  try {
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { gcsPath, filename, mimetype, size, secret_id } = req.body;
    if (!gcsPath || !filename || !size) {
      return res.status(400).json({ error: "gcsPath, filename, and size are required" });
    }

    // Verify file exists in GCS
    const { fileInputBucket } = require("../config/gcs");
    const fileRef = fileInputBucket.file(gcsPath);
    const [exists] = await fileRef.exists();
    if (!exists) {
      console.error(`❌ [completeSignedUpload] File not found in GCS: ${gcsPath}`);
      return res.status(404).json({ error: "File not found in storage. Upload may have failed." });
    }
    
    // Verify file metadata
    const [metadata] = await fileRef.getMetadata();
    console.log(`✅ [completeSignedUpload] File found in GCS: ${gcsPath}`);
    console.log(`📋 [completeSignedUpload] File metadata:`, {
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      bucket: fileInputBucket.name
    });
    
    // Validate file size matches
    if (metadata.size && parseInt(metadata.size) !== parseInt(size)) {
      console.warn(`⚠️ [completeSignedUpload] Size mismatch: expected ${size}, got ${metadata.size}`);
    }
    
    // Validate mime type if provided
    if (mimetype && metadata.contentType && metadata.contentType !== mimetype) {
      console.warn(`⚠️ [completeSignedUpload] MIME type mismatch: expected ${mimetype}, got ${metadata.contentType}`);
      // Use the actual content type from GCS
      mimetype = metadata.contentType;
    }

    // Check storage limits
    const { usage: userUsage, plan: userPlan } = await TokenUsageService.getUserUsageAndPlan(userId, authorizationHeader);
    const storageLimitCheck = await checkStorageLimit(userId, size, userPlan);
    if (!storageLimitCheck.allowed) {
      // Delete the uploaded file if storage limit exceeded
      await fileRef.delete().catch(err => console.error("Failed to delete file:", err));
      return res.status(403).json({ error: storageLimitCheck.message });
    }

    // Calculate requested resources
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

    // Extract folder path from gcsPath
    const folderPath = `uploads/${userId}`;
    const gsUri = `gs://${fileInputBucket.name}/${gcsPath}`;

    // Save file metadata to database
    const fileId = await DocumentModel.saveFileMetadata(
      userId,
      filename,
      gsUri,
      folderPath,
      mimetype || 'application/octet-stream',
      size,
      "uploaded"
    );

    // Increment usage after successful upload
    await TokenUsageService.incrementUsage(userId, requestedResources, userPlan);

    // Download file buffer for processing
    console.log(`📥 [completeSignedUpload] Downloading file buffer for processing...`);
    const [fileBuffer] = await fileRef.download();
    
    if (!fileBuffer || fileBuffer.length === 0) {
      console.error(`❌ [completeSignedUpload] Downloaded file buffer is empty!`);
      await fileRef.delete().catch(err => console.error("Failed to delete empty file:", err));
      return res.status(400).json({ error: "Uploaded file appears to be empty or corrupted." });
    }
    
    console.log(`✅ [completeSignedUpload] File buffer downloaded: ${fileBuffer.length} bytes`);
    console.log(`🚀 [completeSignedUpload] Starting document processing with mime type: ${mimetype || 'application/octet-stream'}`);
    
    // Asynchronously process the document
    processDocument(fileId, fileBuffer, mimetype || metadata.contentType || 'application/octet-stream', userId, secret_id)
      .catch(err => {
        console.error(`❌ [completeSignedUpload] Error in processDocument:`, err);
        console.error(`❌ [completeSignedUpload] Error stack:`, err.stack);
      });

    return res.status(202).json({
      message: "Document uploaded and processing initiated.",
      file_id: fileId,
      gs_uri: gsUri,
    });
  } catch (error) {
    console.error("❌ completeSignedUpload error:", error);
    res.status(500).json({
      error: "Failed to complete upload",
      details: error.message
    });
  }
};




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

 const FILE_SIZE_LIMIT_INLINE = 20 * 1024 * 1024; // 20MB - Document AI inline limit
 const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
 const isLargeFile = fileBuffer.length > FILE_SIZE_LIMIT_INLINE;

 console.log(`[processDocument] Processing file with Document AI (${fileSizeMB}MB, mimeType: ${mimetype})`);

 // Try inline processing first, fall back to batch if it fails or file is too large
 let useBatchProcessing = isLargeFile;
 
 if (!useBatchProcessing) {
   // Try inline processing for smaller files
   try {
     extractedTexts = await extractTextFromDocument(fileBuffer, mimetype);
     
     if (!extractedTexts || extractedTexts.length === 0) {
       console.warn(`[processDocument] No text extracted from inline processing, trying batch processing`);
       useBatchProcessing = true;
     } else {
       console.log(`[processDocument] Successfully extracted ${extractedTexts.length} text segment(s) using inline processing`);
       
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
     }
   } catch (ocrError) {
     console.warn(`[processDocument] Inline OCR failed (${ocrError.message}), falling back to batch processing`);
     useBatchProcessing = true;
   }
 }

 // Use batch processing for large files or if inline failed
 if (useBatchProcessing) {
   console.log(`[processDocument] Using batch processing (file: ${fileSizeMB}MB)`);
   
   await updateProcessingProgress(
     fileId,
     "processing",
     26.0,
     "Uploading to GCS for batch processing"
   );
   
   // Get original filename from database if available
   const fileRecord = await DocumentModel.getFileById(fileId);
   const originalFilename = fileRecord?.originalname || `file_${fileId}`;
   
   // Upload to GCS for batch processing
   const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
   const { gsUri: gcsInputUri } = await uploadToGCS(
     originalFilename,
     fileBuffer,
     batchUploadFolder,
     true, // Use input bucket
     mimetype
   );
   
   await updateProcessingProgress(
     fileId,
     "batch_processing",
     30.0,
     "Starting batch OCR processing"
   );
   
   const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
   const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;
   
   const operationName = await batchProcessDocument(
     [gcsInputUri],
     gcsOutputUriPrefix,
     mimetype
   );
   
   console.log(`[processDocument] Batch operation started: ${operationName}`);
   
   // Update job with batch operation details
   const job = await ProcessingJobModel.getJobByFileId(fileId);
   if (job && job.job_id) {
     await ProcessingJobModel.updateJob(job.job_id, {
       gcs_input_uri: gcsInputUri,
       gcs_output_uri_prefix: gcsOutputUriPrefix,
       document_ai_operation_name: operationName,
       type: "batch",
       status: "running",
     });
   }
   
   // Poll for batch completion and continue processing
   let batchCompleted = false;
   let attempts = 0;
   const maxAttempts = 240; // 20 minutes max
   
   while (!batchCompleted && attempts < maxAttempts) {
     await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
     attempts++;
     
     try {
       const status = await getOperationStatus(operationName);
       
       if (status.done) {
         batchCompleted = true;
         
         if (status.error) {
           console.error(`[processDocument] Batch processing error:`, status.error);
           throw new Error(`Batch processing failed: ${JSON.stringify(status.error)}`);
         }
         
         // Fetch results from GCS
         await updateProcessingProgress(
           fileId,
           "processing",
           40.0,
           "Fetching batch processing results"
         );
         
         const bucketName = fileOutputBucket.name;
         const prefix = outputPrefix;
         extractedTexts = await fetchBatchResults(bucketName, prefix);
         
         if (!extractedTexts || extractedTexts.length === 0) {
           throw new Error("No text extracted from batch processing results");
         }
         
         console.log(`[processDocument] Successfully extracted ${extractedTexts.length} text segment(s) from batch processing`);
         
         await updateProcessingProgress(
           fileId,
           "processing",
           42.0,
           "Batch OCR processing completed"
         );
       } else {
         // Update progress
         const progress = Math.min(30 + (attempts * 0.15), 39);
         await updateProcessingProgress(
           fileId,
           "batch_processing",
           progress,
           "Batch OCR processing in progress"
         );
       }
     } catch (pollError) {
       console.error(`[processDocument] Batch polling error:`, pollError);
       throw pollError;
     }
   }
   
   if (!batchCompleted) {
     throw new Error("Batch processing timeout after 20 minutes");
   }
 }
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


// exports.chatWithDocument = async (req, res) => {
//   let userId = null;

//   try {
//     const {
//       file_id,
//       question,
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null,
//       secret_id,
//       llm_name,
//       additional_input = '',
//     } = req.body;

//     userId = req.user.id;

//     // ---------- VALIDATION ----------
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//     if (!file_id) return res.status(400).json({ error: 'file_id is required.' });
//     if (!uuidRegex.test(file_id)) return res.status(400).json({ error: 'Invalid file ID format.' });

//     const hasExistingSession = session_id && uuidRegex.test(session_id);
//     const finalSessionId = hasExistingSession ? session_id : uuidv4();

//     console.log(
//       `[chatWithDocument] started: used_secret_prompt=${used_secret_prompt}, secret_id=${secret_id}, llm_name=${llm_name}, session_id=${finalSessionId}`
//     );

//     // ---------- FILE ACCESS ----------
//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: 'File not found.' });
//     if (String(file.user_id) !== String(userId))
//       return res.status(403).json({ error: 'Access denied.' });
//     if (file.status !== 'processed') {
//       return res.status(400).json({
//         error: 'Document is not yet processed.',
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     let previousChats = [];
//     if (hasExistingSession) {
//       previousChats = await FileChat.getChatHistory(file_id, finalSessionId);
//     }
//     const conversationContext = formatConversationHistory(previousChats);
//     const historyForStorage = simplifyHistory(previousChats);
//     if (historyForStorage.length > 0) {
//       const lastTurn = historyForStorage[historyForStorage.length - 1];
//       console.log(
//         `[chatWithDocument] Using ${historyForStorage.length} prior turn(s) for context. Most recent: Q="${(lastTurn.question || '').slice(0, 120)}", A="${(lastTurn.answer || '').slice(0, 120)}"`
//       );
//     } else {
//       console.log('[chatWithDocument] No prior context for this session.');
//     }

//     // ✅ RAG CONFIGURATION
//     const SIMILARITY_THRESHOLD = 0.75; // Cosine similarity cutoff
//     const MIN_CHUNKS = 5; // Minimum chunks to retrieve
//     const MAX_CHUNKS = 10; // Maximum chunks to retrieve
//     const MAX_CONTEXT_TOKENS = 4000; // ~15% of model limit
//     const CHARS_PER_TOKEN = 4; // Average chars per token
//     const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN; // ~16,000 chars

//     // ---------- PROMPT BUILDING ----------
//     let usedChunkIds = [];
//     let storedQuestion = null;
//     let finalPromptLabel = prompt_label;
//     let provider = 'gemini';
//     let finalPrompt = '';

//     // ================================
//     // CASE 1: SECRET PROMPT
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id)
//         return res.status(400).json({ error: 'secret_id required for secret prompt.' });

//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1`;
//       const secretResult = await db.query(secretQuery, [secret_id]);
//       if (!secretResult.rows.length)
//         return res.status(404).json({ error: 'Secret configuration not found.' });

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
//         secretResult.rows[0];
//       finalPromptLabel = secretName;
//       provider = resolveProviderName(llm_name || dbLlmName || 'gemini');

//       const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
//       const client = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await client.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString('utf8');

//       // ✅ Get all chunks and apply smart selection
//       const allChunks = await FileChunkModel.getChunksByFileId(file_id);
      
//       if (!allChunks || allChunks.length === 0) {
//         return res.status(400).json({ error: 'No content found in document.' });
//       }

//       // ✅ For secret prompts, use embedding-based selection
//       const secretEmbedding = await generateEmbedding(secretValue);
//       const rankedChunks = await ChunkVectorModel.findNearestChunks(
//         secretEmbedding,
//         MAX_CHUNKS, // Retrieve top 10 candidates
//         file_id
//       );

//       // ✅ Filter by similarity threshold
//       const highQualityChunks = rankedChunks
//         .filter(chunk => {
//           const similarity = chunk.similarity || chunk.distance || 0;
//           const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//           return score >= SIMILARITY_THRESHOLD;
//         })
//         .sort((a, b) => {
//           const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
//           const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
//           return scoreB - scoreA; // Best first
//         });

//       console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

//       // ✅ Select 5-10 best chunks within token budget
//       let selectedChunks = [];
//       let currentContextLength = 0;

//       const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
//         ? highQualityChunks 
//         : rankedChunks; // Fallback if not enough high-quality chunks

//       for (const chunk of chunksToConsider) {
//         if (selectedChunks.length >= MAX_CHUNKS) break;
        
//         const chunkLength = chunk.content.length;
//         if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
//           selectedChunks.push(chunk);
//           currentContextLength += chunkLength;
//         } else if (selectedChunks.length < MIN_CHUNKS) {
//           // If we haven't reached minimum, truncate this chunk to fit
//           const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
//           if (remainingSpace > 500) {
//             selectedChunks.push({
//               ...chunk,
//               content: chunk.content.substring(0, remainingSpace - 100) + "..."
//             });
//             currentContextLength += remainingSpace;
//           }
//           break;
//         }
//       }

//       // ✅ Ensure minimum chunks
//       const finalChunks = selectedChunks.length >= MIN_CHUNKS 
//         ? selectedChunks 
//         : chunksToConsider.slice(0, MIN_CHUNKS);

//       console.log(`✅ Selected ${finalChunks.length} chunks for secret prompt | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

//       usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

//       // ✅ Build context with separators and metadata
//       const docContent = finalChunks
//         .map((c, idx) => {
//           const similarity = c.similarity || c.distance || 0;
//           const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//           return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
//         })
//         .join('\n\n');

//       finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${docContent}`;
      
//       if (additional_input?.trim()) {
//         const trimmedInput = additional_input.trim().substring(0, 500);
//         finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${trimmedInput}`;
//       }

//       storedQuestion = secretName;
//     } 
//     // ================================
//     // CASE 2: CUSTOM QUESTION
//     // ================================
//     else {
//       if (!question?.trim())
//         return res.status(400).json({ error: 'question is required.' });

//       storedQuestion = question.trim();

//       // Fetch LLM model from custom_query table for custom queries (always fetch from DB)
//       let dbLlmName = null;
//       const customQueryLlm = `
//         SELECT cq.llm_name, cq.llm_model_id
//         FROM custom_query cq
//         ORDER BY cq.id DESC
//         LIMIT 1;
//       `;
//       const customQueryResult = await db.query(customQueryLlm);
//       if (customQueryResult.rows.length > 0) {
//         dbLlmName = customQueryResult.rows[0].llm_name;
//         console.log(`🤖 Using LLM from custom_query table: ${dbLlmName}`);
//       } else {
//         console.warn(`⚠️ No LLM found in custom_query table — falling back to gemini`);
//         dbLlmName = 'gemini';
//       }

//       // Resolve provider name using the LLM from custom_query table
//       provider = resolveProviderName(dbLlmName || "gemini");
//       console.log(`🤖 Resolved LLM provider for custom query: ${provider}`);
      
//       // Check if provider is available
//       const availableProviders = getAvailableProviders();
//       if (!availableProviders[provider] || !availableProviders[provider].available) {
//         console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini`);
//         provider = 'gemini';
//       }

//       // ✅ Vector search with similarity scoring
//       const questionEmbedding = await generateEmbedding(storedQuestion);
//       const rankedChunks = await ChunkVectorModel.findNearestChunks(
//         questionEmbedding,
//         MAX_CHUNKS, // Retrieve top 10 candidates
//         file_id
//       );

//       if (!rankedChunks || rankedChunks.length === 0) {
//         // Fallback: use all chunks if no vector matches
//         console.log('⚠️ No vector matches found, using all chunks as fallback');
//         const allChunks = await FileChunkModel.getChunksByFileId(file_id);
//         const limitedChunks = allChunks.slice(0, MIN_CHUNKS);
//         usedChunkIds = limitedChunks.map((c) => c.id);
        
//         const docContent = limitedChunks
//           .map((c, idx) => `--- Chunk ${idx + 1} ---\n${c.content}`)
//           .join('\n\n');
        
//         finalPrompt = `${storedQuestion}\n\n=== DOCUMENT CONTEXT ===\n${docContent}`;
//       } else {
//         // ✅ Filter by similarity threshold
//         const highQualityChunks = rankedChunks
//           .filter(chunk => {
//             const similarity = chunk.similarity || chunk.distance || 0;
//             const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//             return score >= SIMILARITY_THRESHOLD;
//           })
//           .sort((a, b) => {
//             const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
//             const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
//             return scoreB - scoreA;
//           });

//         console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

//         // ✅ Select 5-10 best chunks within token budget
//         let selectedChunks = [];
//         let currentContextLength = 0;

//         const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
//           ? highQualityChunks 
//           : rankedChunks;

//         for (const chunk of chunksToConsider) {
//           if (selectedChunks.length >= MAX_CHUNKS) break;
          
//           const chunkLength = chunk.content.length;
//           if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
//             selectedChunks.push(chunk);
//             currentContextLength += chunkLength;
//           } else if (selectedChunks.length < MIN_CHUNKS) {
//             const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
//             if (remainingSpace > 500) {
//               selectedChunks.push({
//                 ...chunk,
//                 content: chunk.content.substring(0, remainingSpace - 100) + "..."
//               });
//               currentContextLength += remainingSpace;
//             }
//             break;
//           }
//         }

//         // ✅ Ensure minimum chunks
//         const finalChunks = selectedChunks.length >= MIN_CHUNKS 
//           ? selectedChunks 
//           : chunksToConsider.slice(0, MIN_CHUNKS);

//         console.log(`✅ Selected ${finalChunks.length} chunks | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

//         usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

//         // ✅ Build context with separators and metadata
//         const relevantTexts = finalChunks
//           .map((c, idx) => {
//             const similarity = c.similarity || c.distance || 0;
//             const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//             return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
//           })
//           .join('\n\n');

//         finalPrompt = `${storedQuestion}\n\n=== RELEVANT CONTEXT ===\n${relevantTexts}`;
//       }
//     }

//     finalPrompt = appendConversationToPrompt(finalPrompt, conversationContext);

//     // ---------- CALL LLM ----------
//     console.log(`[chatWithDocument] Calling LLM provider: ${provider} | Chunks used: ${usedChunkIds.length}`);
//     const answer = await askLLM(provider, finalPrompt);

//     if (!answer?.trim()) {
//       return res.status(500).json({ error: 'Empty response from AI.' });
//     }

//     console.log(`[chatWithDocument] Received answer, length: ${answer.length} characters`);

//     // ---------- SAVE CHAT ----------
//     const savedChat = await FileChat.saveChat(
//       file_id,
//       userId,
//       storedQuestion,
//       answer,
//       finalSessionId,
//       usedChunkIds,
//       used_secret_prompt,
//       finalPromptLabel,
//       used_secret_prompt ? secret_id : null,
//       historyForStorage
//     );

//     console.log(`[chatWithDocument] Chat saved with ID: ${savedChat.id} | Chunks used: ${usedChunkIds.length}`);

//     // ---------- TOKEN USAGE ----------
//     try {
//       const { userUsage, userPlan, requestedResources } = req;
//       await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
//     } catch (e) {
//       console.warn('Token usage increment failed:', e.message);
//     }

//     // ---------- FETCH HISTORY ----------
//     const historyRows = await FileChat.getChatHistory(file_id, savedChat.session_id);
//     const history = historyRows.map((row) => ({
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
//       chat_history: row.chat_history || [],
//       display_text_left_panel: row.used_secret_prompt
//         ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
//         : row.question,
//     }));

//     // ---------- RETURN COMPLETE RESPONSE ----------
//     return res.status(200).json({
//       success: true,
//       session_id: savedChat.session_id,
//       message_id: savedChat.id,
//       answer,
//       response: answer,
//       history,
//       used_chunk_ids: usedChunkIds,
//       chunks_used: usedChunkIds.length, // ✅ Show actual count
//       confidence: used_secret_prompt ? 0.9 : 0.85,
//       timestamp: savedChat.created_at || new Date().toISOString(),
//       llm_provider: provider,
//       used_secret_prompt,
//     });
//   } catch (error) {
//     console.error('❌ Error in chatWithDocument:', error);
//     console.error('Stack trace:', error.stack);
//     return res.status(500).json({
//       error: 'Failed to get AI answer.',
//       details: error.message,
//     });
//   }
// };


// exports.chatWithDocument = async (req, res) => {
//   let userId = null;

//   try {
//     const {
//       file_id,
//       question,
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null,
//       secret_id,
//       llm_name,
//       additional_input = '',
//     } = req.body;

//     userId = req.user.id;

//     // ---------- VALIDATION ----------
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//     const hasFileId = Boolean(file_id);
    
//     // Only validate file_id format if it's provided
//     if (hasFileId && !uuidRegex.test(file_id)) {
//       return res.status(400).json({ error: 'Invalid file ID format.' });
//     }

//     // Generate or validate session_id
//     const hasExistingSession = session_id && uuidRegex.test(session_id);
//     const finalSessionId = hasExistingSession ? session_id : uuidv4();

//     console.log(
//       `[chatWithDocument] started: used_secret_prompt=${used_secret_prompt}, secret_id=${secret_id}, llm_name=${llm_name}, session_id=${finalSessionId}, has_file=${hasFileId}`
//     );

//     // Load existing session history (works for both file-based and file-less sessions)
//     const sessionHistory = hasExistingSession
//       ? await FileChat.getChatHistoryBySession(userId, finalSessionId)
//       : [];

//     console.log(`[chatWithDocument] Loaded ${sessionHistory.length} previous messages from session`);

//     // ================================
//     // CASE 1: NO DOCUMENT YET (PRE-UPLOAD CHAT)
//     // ================================
//     if (!hasFileId) {
//       if (!question?.trim()) {
//         return res.status(400).json({ error: 'question is required when no document is provided.' });
//       }

//       console.log(`[chatWithDocument] Pre-upload mode - chatting without document`);

//       // Determine LLM provider
//       let provider = resolveProviderName(llm_name || 'gemini');
//       console.log(`[chatWithDocument] Resolved provider: ${provider}`);
      
//       const availableProviders = getAvailableProviders();
//       if (!availableProviders[provider] || !availableProviders[provider].available) {
//         console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini for pre-upload chat`);
//         provider = 'gemini';
//       }

//       // Build prompt with conversation history
//       const userPrompt = question.trim();
//       const conversationContext = formatConversationHistory(sessionHistory);
//       const finalPrompt = appendConversationToPrompt(userPrompt, conversationContext);

//       console.log(`[chatWithDocument] Pre-upload conversation | Provider: ${provider} | Session: ${finalSessionId}`);
//       console.log(`[chatWithDocument] Prompt length: ${finalPrompt.length} chars | History turns: ${sessionHistory.length}`);
      
//       // Get AI response
//       const answer = await askLLM(provider, finalPrompt, ''); // Empty context since it's already in prompt

//       if (!answer?.trim()) {
//         return res.status(500).json({ error: 'Empty response from AI.' });
//       }

//       console.log(`✅ [chatWithDocument] Received answer: ${answer.length} chars`);

//       // Save chat without file_id
//       const savedChat = await FileChat.saveChat(
//         null,              // No file_id for pre-upload chat
//         userId,
//         userPrompt,
//         answer,
//         finalSessionId,
//         [],                // No chunks used
//         false,             // Not a secret prompt
//         null,              // No prompt label
//         null,              // No secret_id
//         simplifyHistory(sessionHistory)  // Store conversation context
//       );

//       // Fetch updated history
//       const updatedHistoryRows = await FileChat.getChatHistoryBySession(userId, finalSessionId);
//       const history = updatedHistoryRows.map((row) => ({
//         id: row.id,
//         file_id: row.file_id,
//         session_id: row.session_id,
//         question: row.question,
//         answer: row.answer,
//         used_secret_prompt: row.used_secret_prompt || false,
//         prompt_label: row.prompt_label || null,
//         secret_id: row.secret_id || null,
//         used_chunk_ids: row.used_chunk_ids || [],
//         confidence: row.confidence || 0.8,
//         timestamp: row.created_at || row.timestamp,
//         display_text_left_panel: row.used_secret_prompt
//           ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
//           : row.question,
//       }));

//       // Increment usage
//       try {
//         const { userUsage, userPlan, requestedResources } = req;
//         await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
//       } catch (e) {
//         console.warn('Token usage increment failed for pre-upload chat:', e.message);
//       }

//       return res.status(200).json({
//         success: true,
//         session_id: finalSessionId,
//         message_id: savedChat.id,
//         answer,
//         response: answer,
//         history,
//         used_chunk_ids: [],
//         chunks_used: 0,
//         confidence: 0.8,
//         timestamp: savedChat.created_at || new Date().toISOString(),
//         llm_provider: provider,
//         used_secret_prompt: false,
//         mode: 'pre_document',  // Indicates this is a pre-upload conversation
//       });
//     }

//     // ================================
//     // CASE 2: DOCUMENT PROVIDED (POST-UPLOAD CHAT)
//     // ================================
    
//     console.log(`[chatWithDocument] Post-upload mode - chatting with document ${file_id}`);

//     // ---------- FILE ACCESS ----------
//     const file = await DocumentModel.getFileById(file_id);
//     if (!file) return res.status(404).json({ error: 'File not found.' });
//     if (String(file.user_id) !== String(userId)) {
//       return res.status(403).json({ error: 'Access denied.' });
//     }
//     if (file.status !== 'processed') {
//       return res.status(400).json({
//         error: 'Document is not yet processed.',
//         status: file.status,
//         progress: file.processing_progress,
//       });
//     }

//     // Link pre-upload chats to this file if they exist
//     if (sessionHistory.length > 0) {
//       const hasUnassignedChats = sessionHistory.some((chat) => !chat.file_id);
//       if (hasUnassignedChats) {
//         const linkedCount = await FileChat.assignFileIdToSession(userId, finalSessionId, file_id);
//         console.log(`✅ Linked ${linkedCount} pre-upload chat(s) to file ${file_id}`);
//       }
//     }

//     // Load previous chats for this file + session
//     let previousChats = [];
//     if (hasExistingSession) {
//       previousChats = await FileChat.getChatHistory(file_id, finalSessionId);
//     }

//     // Build conversation context from ALL chats (pre-upload + post-upload)
//     const conversationContext = formatConversationHistory(previousChats);
//     const historyForStorage = simplifyHistory(previousChats);
    
//     if (historyForStorage.length > 0) {
//       const lastTurn = historyForStorage[historyForStorage.length - 1];
//       console.log(
//         `[chatWithDocument] Using ${historyForStorage.length} prior turn(s) for context. Most recent: Q="${(lastTurn.question || '').slice(0, 120)}", A="${(lastTurn.answer || '').slice(0, 120)}"`
//       );
//     } else {
//       console.log('[chatWithDocument] No prior context for this session.');
//     }

//     // ✅ RAG CONFIGURATION
//     const SIMILARITY_THRESHOLD = 0.75;
//     const MIN_CHUNKS = 5;
//     const MAX_CHUNKS = 10;
//     const MAX_CONTEXT_TOKENS = 4000;
//     const CHARS_PER_TOKEN = 4;
//     const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

//     // ---------- PROMPT BUILDING ----------
//     let usedChunkIds = [];
//     let storedQuestion = null;
//     let finalPromptLabel = prompt_label;
//     let provider = 'gemini';
//     let finalPrompt = '';

//     // ================================
//     // SECRET PROMPT HANDLING
//     // ================================
//     if (used_secret_prompt) {
//       if (!secret_id) {
//         return res.status(400).json({ error: 'secret_id required for secret prompt.' });
//       }

//       const secretQuery = `
//         SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
//         FROM secret_manager s
//         LEFT JOIN llm_models l ON s.llm_id = l.id
//         WHERE s.id = $1`;
//       const secretResult = await db.query(secretQuery, [secret_id]);
//       if (!secretResult.rows.length) {
//         return res.status(404).json({ error: 'Secret configuration not found.' });
//       }

//       const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
//         secretResult.rows[0];
//       finalPromptLabel = secretName;
//       provider = resolveProviderName(llm_name || dbLlmName || 'gemini');

//       const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
//       const client = new SecretManagerServiceClient();
//       const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
//       const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//       const [accessResponse] = await client.accessSecretVersion({ name: gcpSecretName });
//       const secretValue = accessResponse.payload.data.toString('utf8');

//       // Get all chunks and apply smart selection
//       const allChunks = await FileChunkModel.getChunksByFileId(file_id);
      
//       if (!allChunks || allChunks.length === 0) {
//         return res.status(400).json({ error: 'No content found in document.' });
//       }

//       // Use embedding-based selection for secret prompts
//       const secretEmbedding = await generateEmbedding(secretValue);
//       const rankedChunks = await ChunkVectorModel.findNearestChunks(
//         secretEmbedding,
//         MAX_CHUNKS,
//         file_id
//       );

//       // Filter by similarity threshold
//       const highQualityChunks = rankedChunks
//         .filter(chunk => {
//           const similarity = chunk.similarity || chunk.distance || 0;
//           const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//           return score >= SIMILARITY_THRESHOLD;
//         })
//         .sort((a, b) => {
//           const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
//           const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
//           return scoreB - scoreA;
//         });

//       console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

//       // Select 5-10 best chunks within token budget
//       let selectedChunks = [];
//       let currentContextLength = 0;

//       const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
//         ? highQualityChunks 
//         : rankedChunks;

//       for (const chunk of chunksToConsider) {
//         if (selectedChunks.length >= MAX_CHUNKS) break;
        
//         const chunkLength = chunk.content.length;
//         if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
//           selectedChunks.push(chunk);
//           currentContextLength += chunkLength;
//         } else if (selectedChunks.length < MIN_CHUNKS) {
//           const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
//           if (remainingSpace > 500) {
//             selectedChunks.push({
//               ...chunk,
//               content: chunk.content.substring(0, remainingSpace - 100) + "..."
//             });
//             currentContextLength += remainingSpace;
//           }
//           break;
//         }
//       }

//       const finalChunks = selectedChunks.length >= MIN_CHUNKS 
//         ? selectedChunks 
//         : chunksToConsider.slice(0, MIN_CHUNKS);

//       console.log(`✅ Selected ${finalChunks.length} chunks for secret prompt | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

//       usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

//       // Build context with separators and metadata
//       const docContent = finalChunks
//         .map((c, idx) => {
//           const similarity = c.similarity || c.distance || 0;
//           const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//           return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
//         })
//         .join('\n\n');

//       finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${docContent}`;
      
//       if (additional_input?.trim()) {
//         const trimmedInput = additional_input.trim().substring(0, 500);
//         finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${trimmedInput}`;
//       }

//       storedQuestion = secretName;
//     } 
//     // ================================
//     // CUSTOM QUESTION HANDLING
//     // ================================
//     else {
//       if (!question?.trim()) {
//         return res.status(400).json({ error: 'question is required.' });
//       }

//       storedQuestion = question.trim();

//       // Fetch LLM model from custom_query table
//       let dbLlmName = null;
//       const customQueryLlm = `
//         SELECT cq.llm_name, cq.llm_model_id
//         FROM custom_query cq
//         ORDER BY cq.id DESC
//         LIMIT 1;
//       `;
//       const customQueryResult = await db.query(customQueryLlm);
//       if (customQueryResult.rows.length > 0) {
//         dbLlmName = customQueryResult.rows[0].llm_name;
//         console.log(`🤖 Using LLM from custom_query table: ${dbLlmName}`);
//       } else {
//         console.warn(`⚠️ No LLM found in custom_query table — falling back to gemini`);
//         dbLlmName = 'gemini';
//       }

//       provider = resolveProviderName(dbLlmName || "gemini");
//       console.log(`🤖 Resolved LLM provider for custom query: ${provider}`);
      
//       // Check if provider is available
//       const availableProviders = getAvailableProviders();
//       if (!availableProviders[provider] || !availableProviders[provider].available) {
//         console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini`);
//         provider = 'gemini';
//       }

//       // Vector search with similarity scoring
//       const questionEmbedding = await generateEmbedding(storedQuestion);
//       const rankedChunks = await ChunkVectorModel.findNearestChunks(
//         questionEmbedding,
//         MAX_CHUNKS,
//         file_id
//       );

//       if (!rankedChunks || rankedChunks.length === 0) {
//         // Fallback: use all chunks if no vector matches
//         console.log('⚠️ No vector matches found, using all chunks as fallback');
//         const allChunks = await FileChunkModel.getChunksByFileId(file_id);
//         const limitedChunks = allChunks.slice(0, MIN_CHUNKS);
//         usedChunkIds = limitedChunks.map((c) => c.id);
        
//         const docContent = limitedChunks
//           .map((c, idx) => `--- Chunk ${idx + 1} ---\n${c.content}`)
//           .join('\n\n');
        
//         finalPrompt = `${storedQuestion}\n\n=== DOCUMENT CONTEXT ===\n${docContent}`;
//       } else {
//         // Filter by similarity threshold
//         const highQualityChunks = rankedChunks
//           .filter(chunk => {
//             const similarity = chunk.similarity || chunk.distance || 0;
//             const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//             return score >= SIMILARITY_THRESHOLD;
//           })
//           .sort((a, b) => {
//             const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
//             const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
//             return scoreB - scoreA;
//           });

//         console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

//         // Select 5-10 best chunks within token budget
//         let selectedChunks = [];
//         let currentContextLength = 0;

//         const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
//           ? highQualityChunks 
//           : rankedChunks;

//         for (const chunk of chunksToConsider) {
//           if (selectedChunks.length >= MAX_CHUNKS) break;
          
//           const chunkLength = chunk.content.length;
//           if (currentContextLength + chunkLength <= MAX_CONTEXT_CHARS) {
//             selectedChunks.push(chunk);
//             currentContextLength += chunkLength;
//           } else if (selectedChunks.length < MIN_CHUNKS) {
//             const remainingSpace = MAX_CONTEXT_CHARS - currentContextLength;
//             if (remainingSpace > 500) {
//               selectedChunks.push({
//                 ...chunk,
//                 content: chunk.content.substring(0, remainingSpace - 100) + "..."
//               });
//               currentContextLength += remainingSpace;
//             }
//             break;
//           }
//         }

//         const finalChunks = selectedChunks.length >= MIN_CHUNKS 
//           ? selectedChunks 
//           : chunksToConsider.slice(0, MIN_CHUNKS);

//         console.log(`✅ Selected ${finalChunks.length} chunks | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

//         usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

//         // Build context with separators and metadata
//         const relevantTexts = finalChunks
//           .map((c, idx) => {
//             const similarity = c.similarity || c.distance || 0;
//             const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
//             return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
//           })
//           .join('\n\n');

//         finalPrompt = `${storedQuestion}\n\n=== RELEVANT CONTEXT ===\n${relevantTexts}`;
//       }
//     }

//     // ✅ CRITICAL: Append conversation history to the prompt
//     finalPrompt = appendConversationToPrompt(finalPrompt, conversationContext);

//     // ---------- CALL LLM ----------
//     console.log(`[chatWithDocument] Calling LLM provider: ${provider} | Chunks used: ${usedChunkIds.length}`);
//     const answer = await askLLM(provider, finalPrompt, '');

//     if (!answer?.trim()) {
//       return res.status(500).json({ error: 'Empty response from AI.' });
//     }

//     console.log(`[chatWithDocument] Received answer, length: ${answer.length} characters`);

//     // ---------- SAVE CHAT ----------
//     const savedChat = await FileChat.saveChat(
//       file_id,
//       userId,
//       storedQuestion,
//       answer,
//       finalSessionId,
//       usedChunkIds,
//       used_secret_prompt,
//       finalPromptLabel,
//       used_secret_prompt ? secret_id : null,
//       historyForStorage  // ✅ This includes both pre-upload and post-upload context
//     );

//     console.log(`[chatWithDocument] Chat saved with ID: ${savedChat.id} | Chunks used: ${usedChunkIds.length}`);

//     // ---------- TOKEN USAGE ----------
//     try {
//       const { userUsage, userPlan, requestedResources } = req;
//       await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
//     } catch (e) {
//       console.warn('Token usage increment failed:', e.message);
//     }

//     // ---------- FETCH HISTORY ----------
//     const historyRows = await FileChat.getChatHistory(file_id, savedChat.session_id);
//     const history = historyRows.map((row) => ({
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
//       chat_history: row.chat_history || [],
//       display_text_left_panel: row.used_secret_prompt
//         ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
//         : row.question,
//     }));

//     // ---------- RETURN COMPLETE RESPONSE ----------
//     return res.status(200).json({
//       success: true,
//       session_id: savedChat.session_id,
//       message_id: savedChat.id,
//       answer,
//       response: answer,
//       history,
//       used_chunk_ids: usedChunkIds,
//       chunks_used: usedChunkIds.length,
//       confidence: used_secret_prompt ? 0.9 : 0.85,
//       timestamp: savedChat.created_at || new Date().toISOString(),
//       llm_provider: provider,
//       used_secret_prompt,
//       mode: 'post_document',  // Indicates this is a post-upload conversation
//     });
//   } catch (error) {
//     console.error('❌ Error in chatWithDocument:', error);
//     console.error('Stack trace:', error.stack);
//     return res.status(500).json({
//       error: 'Failed to get AI answer.',
//       details: error.message,
//     });
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
      secret_id,
      llm_name,
      additional_input = '',
    } = req.body;

    userId = req.user.id;

    // ---------- VALIDATION ----------
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hasFileId = Boolean(file_id);
    
    // Only validate file_id format if it's provided
    if (hasFileId && !uuidRegex.test(file_id)) {
      return res.status(400).json({ error: 'Invalid file ID format.' });
    }

    // Generate or validate session_id
    const hasExistingSession = session_id && uuidRegex.test(session_id);
    const finalSessionId = hasExistingSession ? session_id : uuidv4();

    console.log(
      `[chatWithDocument] started: used_secret_prompt=${used_secret_prompt}, secret_id=${secret_id}, llm_name=${llm_name}, session_id=${finalSessionId}, has_file=${hasFileId}`
    );

    // Load existing session history (works for both file-based and file-less sessions)
    const sessionHistory = hasExistingSession
      ? await FileChat.getChatHistoryBySession(userId, finalSessionId)
      : [];

    console.log(`[chatWithDocument] Loaded ${sessionHistory.length} previous messages from session`);

    // ================================
    // CASE 1: NO DOCUMENT YET (PRE-UPLOAD CHAT)
    // ================================
    if (!hasFileId) {
      if (!question?.trim()) {
        return res.status(400).json({ error: 'question is required when no document is provided.' });
      }

      console.log(`[chatWithDocument] Pre-upload mode - chatting without document`);

      // For pre-upload chats, use llm_name from request OR fetch from custom_query table
      let dbLlmName = llm_name; // Use the one from request first
      
      // If no llm_name in request, fetch from custom_query table
      if (!dbLlmName) {
        const customQueryLlm = `
          SELECT cq.llm_name, cq.llm_model_id
          FROM custom_query cq
          ORDER BY cq.id DESC
          LIMIT 1;
        `;
        const customQueryResult = await db.query(customQueryLlm);
        if (customQueryResult.rows.length > 0) {
          dbLlmName = customQueryResult.rows[0].llm_name;
          console.log(`🤖 Using LLM from custom_query table: ${dbLlmName}`);
        } else {
          console.warn(`⚠️ No LLM found in custom_query table — falling back to gemini`);
          dbLlmName = 'gemini';
        }
      }

      let provider = resolveProviderName(dbLlmName || 'gemini');
      console.log(`[chatWithDocument] Resolved provider for pre-upload: ${provider}`);
      
      const availableProviders = getAvailableProviders();
      if (!availableProviders[provider] || !availableProviders[provider].available) {
        console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini for pre-upload chat`);
        provider = 'gemini';
      }

      // Build prompt with conversation history
      const userPrompt = question.trim();
      const conversationContext = formatConversationHistory(sessionHistory);
      const finalPrompt = appendConversationToPrompt(userPrompt, conversationContext);

      console.log(`[chatWithDocument] Pre-upload conversation | Provider: ${provider} | Session: ${finalSessionId}`);
      console.log(`[chatWithDocument] Prompt length: ${finalPrompt.length} chars | History turns: ${sessionHistory.length}`);
      
      // Get AI response
      const answer = await askLLM(provider, finalPrompt, ''); // Empty context since it's already in prompt

      if (!answer?.trim()) {
        return res.status(500).json({ error: 'Empty response from AI.' });
      }

      console.log(`✅ [chatWithDocument] Received answer: ${answer.length} chars`);

      // Save chat without file_id
      const savedChat = await FileChat.saveChat(
        null,              // No file_id for pre-upload chat
        userId,
        userPrompt,
        answer,
        finalSessionId,
        [],                // No chunks used
        false,             // Not a secret prompt
        null,              // No prompt label
        null,              // No secret_id
        simplifyHistory(sessionHistory)  // Store conversation context
      );

      // Fetch updated history
      const updatedHistoryRows = await FileChat.getChatHistoryBySession(userId, finalSessionId);
      const history = updatedHistoryRows.map((row) => ({
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
          : row.question,
      }));

      // Increment usage
      try {
        const { userUsage, userPlan, requestedResources } = req;
        await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
      } catch (e) {
        console.warn('Token usage increment failed for pre-upload chat:', e.message);
      }

      return res.status(200).json({
        success: true,
        session_id: finalSessionId,
        message_id: savedChat.id,
        answer,
        response: answer,
        history,
        used_chunk_ids: [],
        chunks_used: 0,
        confidence: 0.8,
        timestamp: savedChat.created_at || new Date().toISOString(),
        llm_provider: provider,
        used_secret_prompt: false,
        mode: 'pre_document',  // Indicates this is a pre-upload conversation
      });
    }

    // ================================
    // CASE 2: DOCUMENT PROVIDED (POST-UPLOAD CHAT)
    // ================================
    
    console.log(`[chatWithDocument] Post-upload mode - chatting with document ${file_id}`);

    // ---------- FILE ACCESS ----------
    const file = await DocumentModel.getFileById(file_id);
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (String(file.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (file.status !== 'processed') {
      return res.status(400).json({
        error: 'Document is not yet processed.',
        status: file.status,
        progress: file.processing_progress,
      });
    }

    // Link pre-upload chats to this file if they exist
    if (sessionHistory.length > 0) {
      const hasUnassignedChats = sessionHistory.some((chat) => !chat.file_id);
      if (hasUnassignedChats) {
        const linkedCount = await FileChat.assignFileIdToSession(userId, finalSessionId, file_id);
        console.log(`✅ Linked ${linkedCount} pre-upload chat(s) to file ${file_id}`);
      }
    }

    // Load previous chats for this file + session
    let previousChats = [];
    if (hasExistingSession) {
      previousChats = await FileChat.getChatHistory(file_id, finalSessionId);
    }

    // Build conversation context from ALL chats (pre-upload + post-upload)
    const conversationContext = formatConversationHistory(previousChats);
    const historyForStorage = simplifyHistory(previousChats);
    
    if (historyForStorage.length > 0) {
      const lastTurn = historyForStorage[historyForStorage.length - 1];
      console.log(
        `[chatWithDocument] Using ${historyForStorage.length} prior turn(s) for context. Most recent: Q="${(lastTurn.question || '').slice(0, 120)}", A="${(lastTurn.answer || '').slice(0, 120)}"`
      );
    } else {
      console.log('[chatWithDocument] No prior context for this session.');
    }

    // ✅ RAG CONFIGURATION
    const SIMILARITY_THRESHOLD = 0.75;
    const MIN_CHUNKS = 5;
    const MAX_CHUNKS = 10;
    const MAX_CONTEXT_TOKENS = 4000;
    const CHARS_PER_TOKEN = 4;
    const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

    // ---------- PROMPT BUILDING ----------
    let usedChunkIds = [];
    let storedQuestion = null;
    let finalPromptLabel = prompt_label;
    let provider = 'gemini';
    let finalPrompt = '';

    // ================================
    // SECRET PROMPT HANDLING
    // ================================
    if (used_secret_prompt) {
      if (!secret_id) {
        return res.status(400).json({ error: 'secret_id required for secret prompt.' });
      }

      const secretQuery = `
        SELECT s.id, s.name, s.secret_manager_id, s.version, s.llm_id, l.name AS llm_name
        FROM secret_manager s
        LEFT JOIN llm_models l ON s.llm_id = l.id
        WHERE s.id = $1`;
      const secretResult = await db.query(secretQuery, [secret_id]);
      if (!secretResult.rows.length) {
        return res.status(404).json({ error: 'Secret configuration not found.' });
      }

      const { name: secretName, secret_manager_id, version, llm_name: dbLlmName } =
        secretResult.rows[0];
      finalPromptLabel = secretName;
      provider = resolveProviderName(llm_name || dbLlmName || 'gemini');

      const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
      const client = new SecretManagerServiceClient();
      const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;
      const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
      const [accessResponse] = await client.accessSecretVersion({ name: gcpSecretName });
      const secretValue = accessResponse.payload.data.toString('utf8');

      // Get all chunks and apply smart selection
      const allChunks = await FileChunkModel.getChunksByFileId(file_id);
      
      if (!allChunks || allChunks.length === 0) {
        return res.status(400).json({ error: 'No content found in document.' });
      }

      // Use embedding-based selection for secret prompts
      const secretEmbedding = await generateEmbedding(secretValue);
      const rankedChunks = await ChunkVectorModel.findNearestChunks(
        secretEmbedding,
        MAX_CHUNKS,
        file_id
      );

      // Filter by similarity threshold
      const highQualityChunks = rankedChunks
        .filter(chunk => {
          const similarity = chunk.similarity || chunk.distance || 0;
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return score >= SIMILARITY_THRESHOLD;
        })
        .sort((a, b) => {
          const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
          const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
          return scoreB - scoreA;
        });

      console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

      // Select 5-10 best chunks within token budget
      let selectedChunks = [];
      let currentContextLength = 0;

      const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
        ? highQualityChunks 
        : rankedChunks;

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

      console.log(`✅ Selected ${finalChunks.length} chunks for secret prompt | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

      usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

      // Build context with separators and metadata
      const docContent = finalChunks
        .map((c, idx) => {
          const similarity = c.similarity || c.distance || 0;
          const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
          return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
        })
        .join('\n\n');

      finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n${secretValue}\n\n=== DOCUMENT TO ANALYZE ===\n${docContent}`;
      
      if (additional_input?.trim()) {
        const trimmedInput = additional_input.trim().substring(0, 500);
        finalPrompt += `\n\n=== ADDITIONAL USER INSTRUCTIONS ===\n${trimmedInput}`;
      }

      storedQuestion = secretName;
    } 
    // ================================
    // CUSTOM QUESTION HANDLING
    // ================================
    else {
      if (!question?.trim()) {
        return res.status(400).json({ error: 'question is required.' });
      }

      storedQuestion = question.trim();

      // ✅ KEEP ORIGINAL LOGIC: Fetch LLM model from custom_query table for custom queries
      let dbLlmName = null;
      const customQueryLlm = `
        SELECT cq.llm_name, cq.llm_model_id
        FROM custom_query cq
        ORDER BY cq.id DESC
        LIMIT 1;
      `;
      const customQueryResult = await db.query(customQueryLlm);
      if (customQueryResult.rows.length > 0) {
        dbLlmName = customQueryResult.rows[0].llm_name;
        console.log(`🤖 Using LLM from custom_query table: ${dbLlmName}`);
      } else {
        console.warn(`⚠️ No LLM found in custom_query table — falling back to gemini`);
        dbLlmName = 'gemini';
      }

      // Resolve provider name using the LLM from custom_query table
      provider = resolveProviderName(dbLlmName || "gemini");
      console.log(`🤖 Resolved LLM provider for custom query: ${provider}`);
      
      // Check if provider is available
      const availableProviders = getAvailableProviders();
      if (!availableProviders[provider] || !availableProviders[provider].available) {
        console.warn(`⚠️ Provider '${provider}' unavailable — falling back to gemini`);
        provider = 'gemini';
      }

      // Vector search with similarity scoring
      const questionEmbedding = await generateEmbedding(storedQuestion);
      const rankedChunks = await ChunkVectorModel.findNearestChunks(
        questionEmbedding,
        MAX_CHUNKS,
        file_id
      );

      if (!rankedChunks || rankedChunks.length === 0) {
        // Fallback: use all chunks if no vector matches
        console.log('⚠️ No vector matches found, using all chunks as fallback');
        const allChunks = await FileChunkModel.getChunksByFileId(file_id);
        const limitedChunks = allChunks.slice(0, MIN_CHUNKS);
        usedChunkIds = limitedChunks.map((c) => c.id);
        
        const docContent = limitedChunks
          .map((c, idx) => `--- Chunk ${idx + 1} ---\n${c.content}`)
          .join('\n\n');
        
        finalPrompt = `${storedQuestion}\n\n=== DOCUMENT CONTEXT ===\n${docContent}`;
      } else {
        // Filter by similarity threshold
        const highQualityChunks = rankedChunks
          .filter(chunk => {
            const similarity = chunk.similarity || chunk.distance || 0;
            const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
            return score >= SIMILARITY_THRESHOLD;
          })
          .sort((a, b) => {
            const scoreA = a.similarity > 1 ? (1 / (1 + a.similarity)) : a.similarity;
            const scoreB = b.similarity > 1 ? (1 / (1 + b.similarity)) : b.similarity;
            return scoreB - scoreA;
          });

        console.log(`🎯 Filtered chunks: ${highQualityChunks.length}/${rankedChunks.length} above similarity threshold ${SIMILARITY_THRESHOLD}`);

        // Select 5-10 best chunks within token budget
        let selectedChunks = [];
        let currentContextLength = 0;

        const chunksToConsider = highQualityChunks.length >= MIN_CHUNKS 
          ? highQualityChunks 
          : rankedChunks;

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

        console.log(`✅ Selected ${finalChunks.length} chunks | Context: ${currentContextLength} chars (~${Math.ceil(currentContextLength / CHARS_PER_TOKEN)} tokens)`);

        usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

        // Build context with separators and metadata
        const relevantTexts = finalChunks
          .map((c, idx) => {
            const similarity = c.similarity || c.distance || 0;
            const score = similarity > 1 ? (1 / (1 + similarity)) : similarity;
            return `--- Chunk ${idx + 1} | Relevance: ${(score * 100).toFixed(1)}% ---\n${c.content}`;
          })
          .join('\n\n');

        finalPrompt = `${storedQuestion}\n\n=== RELEVANT CONTEXT ===\n${relevantTexts}`;
      }
    }

    // ✅ CRITICAL: Append conversation history to the prompt
    finalPrompt = appendConversationToPrompt(finalPrompt, conversationContext);

    // ---------- CALL LLM ----------
    console.log(`[chatWithDocument] Calling LLM provider: ${provider} | Chunks used: ${usedChunkIds.length}`);
    const answer = await askLLM(provider, finalPrompt, '');

    if (!answer?.trim()) {
      return res.status(500).json({ error: 'Empty response from AI.' });
    }

    console.log(`[chatWithDocument] Received answer, length: ${answer.length} characters`);

    // ---------- SAVE CHAT ----------
    const savedChat = await FileChat.saveChat(
      file_id,
      userId,
      storedQuestion,
      answer,
      finalSessionId,
      usedChunkIds,
      used_secret_prompt,
      finalPromptLabel,
      used_secret_prompt ? secret_id : null,
      historyForStorage  // ✅ This includes both pre-upload and post-upload context
    );

    console.log(`[chatWithDocument] Chat saved with ID: ${savedChat.id} | Chunks used: ${usedChunkIds.length}`);

    // ---------- TOKEN USAGE ----------
    try {
      const { userUsage, userPlan, requestedResources } = req;
      await TokenUsageService.incrementUsage(userId, requestedResources, userUsage, userPlan);
    } catch (e) {
      console.warn('Token usage increment failed:', e.message);
    }

    // ---------- FETCH HISTORY ----------
    const historyRows = await FileChat.getChatHistory(file_id, savedChat.session_id);
    const history = historyRows.map((row) => ({
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
      chat_history: row.chat_history || [],
      display_text_left_panel: row.used_secret_prompt
        ? `Analysis: ${row.prompt_label || 'Secret Prompt'}`
        : row.question,
    }));

    // ---------- RETURN COMPLETE RESPONSE ----------
    return res.status(200).json({
      success: true,
      session_id: savedChat.session_id,
      message_id: savedChat.id,
      answer,
      response: answer,
      history,
      used_chunk_ids: usedChunkIds,
      chunks_used: usedChunkIds.length,
      confidence: used_secret_prompt ? 0.9 : 0.85,
      timestamp: savedChat.created_at || new Date().toISOString(),
      llm_provider: provider,
      used_secret_prompt,
      mode: 'post_document',  // Indicates this is a post-upload conversation
    });
  } catch (error) {
    console.error('❌ Error in chatWithDocument:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({
      error: 'Failed to get AI answer.',
      details: error.message,
    });
  }
};



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
        console.log(`[getDocumentProcessingStatus] Batch operation for ${file_id} is still running.`);
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
 console.log(`[batchUploadDocuments] Starting Document AI batch processing for ${originalFilename}`);
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
