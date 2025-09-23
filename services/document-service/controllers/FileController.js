
// require("dotenv").config();

// const mime = require("mime-types");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// // Models
// const File = require("../models/File");
// const FileChat = require("../models/FileChat");
// const FileChunk = require("../models/FileChunk");
// const ChunkVector = require("../models/ChunkVector");
// const ProcessingJob = require("../models/ProcessingJob");

// // Services
// const {
//   uploadToGCS,
//   getSignedUrl,
// } = require("../services/gcsService");
// const { checkStorageLimit } = require("../utils/storage");
// const { bucket } = require("../config/gcs");
// const { askGemini, getSummaryFromChunks } = require("../services/aiService");
// const { extractText } = require("../utils/textExtractor");
// const {
//   extractTextFromDocument,
//   batchProcessDocument,
//   getOperationStatus, // Added for batch processing status
//   fetchBatchResults, // Added for fetching batch results
// } = require("../services/documentAiService");
// const { chunkDocument } = require("../services/chunkingService");
// const { generateEmbedding, generateEmbeddings } = require("../services/embeddingService");
// const { fileInputBucket, fileOutputBucket } = require("../config/gcs");

// /* ----------------- Helpers ----------------- */
// function sanitizeName(name) {
//   return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
// }

// async function ensureUniqueKey(key) {
//   const dir = path.posix.dirname(key);
//   const name = path.posix.basename(key);
//   const ext = path.posix.extname(name);
//   const stem = ext ? name.slice(0, -ext.length) : name;

//   let candidate = key;
//   let counter = 1;

//   while (true) {
//     const [exists] = await bucket.file(candidate).exists();
//     if (!exists) return candidate;
//     candidate = path.posix.join(dir, `${stem}(${counter})${ext}`);
//     counter++;
//   }
// }

// async function makeSignedReadUrl(objectKey, minutes = 15) {
//   const [signedUrl] = await bucket.file(objectKey).getSignedUrl({
//     version: "v4",
//     action: "read",
//     expires: Date.now() + minutes * 60 * 1000,
//   });
//   return signedUrl;
// }

// /* ----------------- Process Document ----------------- */
// async function processDocumentWithAI(fileId, fileBuffer, mimetype, userId, originalFilename) { // Added originalFilename
//   const jobId = uuidv4();

//   try {
//     await ProcessingJob.createJob({
//       job_id: jobId,
//       file_id: fileId,
//       type: "batch", // Changed to batch
//       document_ai_operation_name: null,
//       status: "queued",
//     });

//     await File.updateProcessingStatus(fileId, "batch_queued", 0); // Initial status for batch

//     // Upload file to GCS input bucket for Document AI batch processing
//     const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
//     const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
//       originalFilename,
//       fileBuffer,
//       batchUploadFolder,
//       true, // isBatch = true
//       mimetype
//     );

//     const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
//     const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;

//     const operationName = await batchProcessDocument(
//       [gcsInputUri],
//       gcsOutputUriPrefix,
//       mimetype
//     );
//     console.log(`📄 Started Document AI batch operation for file ${fileId}: ${operationName}`);

//     // Update processing job with batch operation details
//     await ProcessingJob.updateJob(jobId, {
//       gcs_input_uri: gcsInputUri,
//       gcs_output_uri_prefix: gcsOutputUriPrefix,
//       document_ai_operation_name: operationName,
//       status: "running",
//     });

//     await File.updateProcessingStatus(fileId, "batch_processing", 0); // Update file status

//     // Note: The actual chunking, embedding, and summary generation will happen
//     // when getDocumentProcessingStatus is called and the batch operation is done.
//     // For now, we just initiate the batch process.

//   } catch (err) {
//     console.error(`❌ Error processing document ${fileId} in batch:`, err.message);
//     await File.updateProcessingStatus(fileId, "error", 0);
//     await ProcessingJob.updateJobStatus(jobId, "failed", err.message);
//   }
// }

// /* ----------------- Create Folder ----------------- */
// exports.createFolder = async (req, res) => {
//   try {
//     const { folderName } = req.body;
//     const userId = req.user.id;

//     if (!folderName) return res.status(400).json({ error: "Folder name is required" });

//     const safeFolderName = sanitizeName(folderName);
//     const gcsPath = `${userId}/documents/${safeFolderName}/`;

//     // Create placeholder
//     await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

//     const folder = await File.create({
//       user_id: userId,
//       originalname: safeFolderName,
//       gcs_path: gcsPath,
//       mimetype: 'folder/x-directory', // Assign a default mimetype for folders
//       is_folder: true,
//       processing_status: "processed",
//       processing_progress: 100,
//     });

//     return res.status(201).json({ message: "Folder created", folder });
//   } catch (error) {
//     console.error("❌ createFolder error:", error);
//     res.status(500).json({ error: "Internal server error", details: error.message });
//   }
// };

// /* ----------------- Upload Multiple Docs ----------------- */
// exports.uploadDocuments = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const userId = req.user.id;

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     const safeFolder = sanitizeName(folderName);
//     const uploadedFiles = [];

//     for (const file of req.files) {
//       if (file.size > 50 * 1024 * 1024) {
//         return res.status(413).json({ error: `${file.originalname} too large` });
//       }

//       // Temporarily bypass storage limit check as requested by user
//       // if (!(await checkStorageLimit(userId, file.size))) {
//       //   return res.status(403).json({ error: "Storage limit exceeded" });
//       // }

//       const ext = mime.extension(file.mimetype) || "";
//       const safeName = sanitizeName(path.basename(file.originalname, path.extname(file.originalname))) + (ext ? `.${ext}` : "");

//       const basePath = `${userId}/documents/${safeFolder}`;
//       const key = path.posix.join(basePath, safeName);
//       const uniqueKey = await ensureUniqueKey(key);

//       const fileRef = bucket.file(uniqueKey);
//       await fileRef.save(file.buffer, {
//         resumable: false,
//         metadata: { contentType: file.mimetype },
//       });

//       const savedFile = await File.create({
//         user_id: userId,
//         originalname: safeName,
//         gcs_path: uniqueKey,
//         folder_path: safeFolder,
//         mimetype: file.mimetype,
//         size: file.size,
//         is_folder: false,
//         processing_status: "queued",
//         processing_progress: 0,
//       });

//       processDocumentWithAI(savedFile.id, file.buffer, file.mimetype, userId, safeName).catch((err) => // Pass safeName as originalFilename
//         console.error(`❌ Background processing failed for ${savedFile.id}:`, err.message)
//       );

//       const previewUrl = await makeSignedReadUrl(uniqueKey, 15);

//       uploadedFiles.push({
//         ...savedFile,
//         previewUrl,
//       });
//     }

//     return res.status(201).json({
//       message: "Documents uploaded and processing started",
//       documents: uploadedFiles,
//     });
//   } catch (error) {
//     console.error("❌ uploadDocuments error:", error);
//     res.status(500).json({ error: "Internal server error", details: error.message });
//   }
// };

// /* ----------------- Folder Summary ----------------- */
// exports.getFolderSummary = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const userId = req.user.id;

//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     console.log(`[getFolderSummary] Found files in folder '${folderName}' for user ${userId}:`, files.map(f => ({ id: f.id, originalname: f.originalname, status: f.processing_status })));

//     const processed = files.filter((f) => !f.is_folder && f.processing_status === "processed");
//     console.log(`[getFolderSummary] Processed documents in folder '${folderName}':`, processed.map(f => ({ id: f.id, originalname: f.originalname })));

//     if (processed.length === 0) {
//       return res.status(404).json({ error: "No processed documents in folder" });
//     }

//     let combinedText = "";
//     for (const f of processed) {
//       const chunks = await FileChunk.getChunksByFileId(f.id);
//       combinedText += `\n\n[${f.originalname}]\n${chunks.map((c) => c.content).join("\n\n")}`;
//     }

//     const summary = await getSummaryFromChunks(combinedText);

//     // Save as a chat entry (type: folder_summary)
//     const savedChat = await FileChat.saveChat(
//       null,
//       userId,
//       "Generate folder summary",
//       summary,
//       null,
//       [],
//       false,
//       null
//     );

//     return res.json({
//       folder: folderName,
//       summary,
//       session_id: savedChat.session_id,
//     });
//   } catch (error) {
//     console.error("❌ getFolderSummary error:", error);
//     res.status(500).json({ error: "Failed to generate folder summary", details: error.message });
//   }
// };

// /* ----------------- Get File Processing Status ----------------- */
// exports.getFileProcessingStatus = async (req, res) => {
//   try {
//     const { file_id } = req.params;
//     if (!file_id) {
//       console.error("❌ getFileProcessingStatus Error: file_id is missing from request parameters.");
//       return res.status(400).json({ error: "file_id is required." });
//     }
//     console.log(`[getFileProcessingStatus] Received request for file_id: ${file_id}`);

//     const file = await File.getFileById(file_id); // Using File model
//     if (!file || String(file.user_id) !== String(req.user.id)) {
//       console.error(`❌ getFileProcessingStatus Error: Access denied for file ${file_id}. File owner: ${file.user_id}, Requesting user: ${req.user.id}`);
//       return res
//         .status(403)
//         .json({ error: "Access denied or file not found." });
//     }

//     const job = await ProcessingJob.getJobByFileId(file_id); // Using ProcessingJob model

//     if (file.processing_status === "processed") {
//       const existingChunks = await FileChunk.getChunksByFileId(file_id); // Using FileChunk model
//       if (existingChunks && existingChunks.length > 0) {
//         const formattedChunks = existingChunks.map((chunk) => ({
//           text: chunk.content,
//           metadata: {
//             page_start: chunk.page_start,
//             page_end: chunk.page_end,
//             heading: chunk.heading,
//           },
//         }));
//         return res.json({
//           file_id: file.id,
//           status: file.processing_status,
//           processing_progress: file.processing_progress,
//           job_status: job ? job.status : "completed",
//           job_error: job ? job.error_message : null,
//           last_updated: file.updated_at,
//           chunks: formattedChunks,
//           summary: file.summary,
//         });
//       }
//     }

//     if (!job || !job.document_ai_operation_name) {
//       return res.json({
//         file_id: file.id,
//         status: file.processing_status,
//         processing_progress: file.processing_progress,
//         job_status: "not_queued",
//         job_error: null,
//         last_updated: file.updated_at,
//         chunks: [],
//         summary: file.summary,
//       });
//     }

//     console.log(`[getFileProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
//     const status = await getOperationStatus(job.document_ai_operation_name);
//     console.log(`[getFileProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

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

//     if (status.error) {
//       console.error(`[getFileProcessingStatus] Document AI operation failed with error: ${status.error.message}`);
//       await File.updateProcessingStatus(file_id, "error", 0.0);
//       await ProcessingJob.updateJobStatus(
//         job.job_id, // Use job_id here
//         "failed",
//         status.error.message
//       );
//       return res.status(500).json({
//         file_id: file.id,
//         status: "error",
//         processing_progress: 0.0,
//         job_status: "failed",
//         job_error: status.error.message,
//         last_updated: new Date().toISOString(),
//       });
//     }

//     const bucketName = fileOutputBucket.name; // Use fileOutputBucket from config
//     const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
//     console.log(`[getFileProcessingStatus] Document AI operation completed. Fetching results from GCS. Bucket: ${bucketName}, Prefix: ${prefix}`);
//     const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
//     console.log(`[getFileProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);
//     if (extractedBatchTexts.length === 0) {
//       console.warn(`[getFileProcessingStatus] No text extracted from batch results for file ID ${file_id}.`);
//     }

//     if (
//       !extractedBatchTexts ||
//       extractedBatchTexts.length === 0 ||
//       extractedBatchTexts.every(
//         (item) => !item || !item.text || item.text.trim() === ""
//       )
//     ) {
//       throw new Error(
//         "Could not extract any meaningful text content from batch document."
//       );
//     }

//     await File.updateProcessingStatus(file_id, "processing", 75.0);
//     console.log(`[getFileProcessingStatus] File ID ${file_id} status updated to 75% (text extracted).`);

//     console.log(`[getFileProcessingStatus] Starting chunking for file ID ${file_id}.`);
//     const chunks = await chunkDocument(extractedBatchTexts, file_id);
//     console.log(`[getFileProcessingStatus] Chunked file ID ${file_id} into ${chunks.length} chunks.`);
//     if (chunks.length === 0) {
//       console.warn(`[getFileProcessingStatus] Chunking resulted in 0 chunks for file ID ${file_id}.`);
//     }

//     if (chunks.length === 0) {
//       await File.updateProcessingStatus(file_id, "processed", 100.0);
//       await ProcessingJob.updateJobStatus(job.job_id, "completed"); // Use job_id here
//       const updatedFile = await File.getFileById(file_id);
//       return res.json({
//         file_id: updatedFile.id,
//         chunks: [],
//         summary: updatedFile.summary,
//       });
//     }

//     const chunkContents = chunks.map((c) => c.content);
//     const embeddings = await generateEmbeddings(chunkContents);

//     if (chunks.length !== embeddings.length) {
//       throw new Error(
//         "Mismatch between number of chunks and embeddings generated for batch document."
//       );
//     }

//     const chunksToSaveBatch = chunks.map((chunk, i) => ({
//       file_id: file_id,
//       chunk_index: i,
//       content: chunk.content,
//       token_count: chunk.token_count,
//       page_start: chunk.metadata.page_start,
//       page_end: chunk.metadata.page_end,
//       heading: chunk.metadata.heading,
//     }));

//     console.log(`[getFileProcessingStatus] Attempting to save ${chunksToSaveBatch.length} chunks for file ID ${file_id}.`);
//     const savedChunksBatch = await FileChunk.saveMultipleChunks( // Using FileChunk model
//       chunksToSaveBatch
//     );
//     console.log(`[getFileProcessingStatus] Saved ${savedChunksBatch.length} chunks for file ID ${file_id}.`);
//     if (savedChunksBatch.length === 0) {
//       console.error(`[getFileProcessingStatus] Failed to save any chunks for file ID ${file_id}.`);
//     }

//     const vectorsToSaveBatch = savedChunksBatch.map((savedChunk) => {
//       const originalChunkIndex = savedChunk.chunk_index;
//       const originalChunk = chunks[originalChunkIndex];
//       const embedding = embeddings[originalChunkIndex];
//       return {
//         chunk_id: savedChunk.id,
//         embedding: embedding,
//         file_id: file_id,
//       };
//     });

//     console.log(`[getFileProcessingStatus] Attempting to save ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);
//     await ChunkVector.saveMultipleChunkVectors(vectorsToSaveBatch); // Using ChunkVector model
//     console.log(`[getFileProcessingStatus] Saved ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);

//     await File.updateProcessingStatus(file_id, "processed", 100.0);
//     await ProcessingJob.updateJobStatus(job.job_id, "completed"); // Use job_id here
//     console.log(`[getFileProcessingStatus] File ID ${file_id} processing completed.`);

//     let summary = null;
//     try {
//       const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
//       if (fullTextForSummary.length > 0) {
//         console.log(`[getFileProcessingStatus] Generating summary for file ID ${file_id}.`);
//         summary = await getSummaryFromChunks(fullTextForSummary);
//         await File.updateSummary(file_id, summary); // Using File model
//         console.log(`[getFileProcessingStatus] Generated summary for file ID ${file_id}.`);
//       }
//     } catch (summaryError) {
//       console.warn(
//         `⚠️ Could not generate summary for batch file ID ${file_id}:`,
//         summaryError.message
//       );
//     }

//     const updatedFile = await File.getFileById(file_id);
//     const fileChunks = await FileChunk.getChunksByFileId(file_id);

//     const formattedChunks = fileChunks.map((chunk) => ({
//       text: chunk.content,
//       metadata: {
//         page_start: chunk.page_start,
//         page_end: chunk.page_end,
//         heading: chunk.heading,
//       },
//     }));

//     return res.json({
//       file_id: updatedFile.id,
//       status: updatedFile.processing_status,
//       processing_progress: updatedFile.processing_progress,
//       job_status: "completed",
//       job_error: null,
//       last_updated: updatedFile.updated_at,
//       chunks: formattedChunks,
//       summary: updatedFile.summary,
//     });
//   } catch (error) {
//     console.error("❌ getFileProcessingStatus error:", error);
//     return res
//       .status(500)
//       .json({
//         error: "Failed to fetch processing status.",
//         details: error.message,
//       });
//   }
// };
// require("dotenv").config();

// const mime = require("mime-types");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// // Models
// const File = require("../models/File");
// const FileChat = require("../models/FileChat");
// const FileChunk = require("../models/FileChunk");
// const ChunkVector = require("../models/ChunkVector");
// const ProcessingJob = require("../models/ProcessingJob");
// const FolderChat = require("../models/FolderChat"); // Import FolderChat model

// // Services
// const {
//   uploadToGCS,
//   getSignedUrl,
// } = require("../services/gcsService");
// const { checkStorageLimit } = require("../utils/storage");
// const { bucket } = require("../config/gcs");
// const { askGemini, getSummaryFromChunks } = require("../services/aiService");
// const { extractText } = require("../utils/textExtractor");
// const {
//   extractTextFromDocument,
//   batchProcessDocument,
//   getOperationStatus,
//   fetchBatchResults,
// } = require("../services/documentAiService");
// const { chunkDocument } = require("../services/chunkingService");
// const { generateEmbedding, generateEmbeddings } = require("../services/embeddingService");
// const { fileInputBucket, fileOutputBucket } = require("../config/gcs");

// /* ----------------- Helpers ----------------- */
// function sanitizeName(name) {
//   return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
// }

// async function ensureUniqueKey(key) {
//   const dir = path.posix.dirname(key);
//   const name = path.posix.basename(key);
//   const ext = path.posix.extname(name);
//   const stem = ext ? name.slice(0, -ext.length) : name;

//   let candidate = key;
//   let counter = 1;

//   while (true) {
//     const [exists] = await bucket.file(candidate).exists();
//     if (!exists) return candidate;
//     candidate = path.posix.join(dir, `${stem}(${counter})${ext}`);
//     counter++;
//   }
// }

// async function makeSignedReadUrl(objectKey, minutes = 15) {
//   const [signedUrl] = await bucket.file(objectKey).getSignedUrl({
//     version: "v4",
//     action: "read",
//     expires: Date.now() + minutes * 60 * 1000,
//   });
//   return signedUrl;
// }

// /* ----------------- Process Document ----------------- */
// async function processDocumentWithAI(fileId, fileBuffer, mimetype, userId, originalFilename) {
//   const jobId = uuidv4();

//   try {
//     await ProcessingJob.createJob({
//       job_id: jobId,
//       file_id: fileId,
//       type: "batch",
//       document_ai_operation_name: null,
//       status: "queued",
//     });

//     await File.updateProcessingStatus(fileId, "batch_queued", 0);

//     // Upload file to GCS input bucket for Document AI batch processing
//     const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
//     const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
//       originalFilename,
//       fileBuffer,
//       batchUploadFolder,
//       true, // isBatch = true
//       mimetype
//     );

//     const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
//     const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;

//     const operationName = await batchProcessDocument(
//       [gcsInputUri],
//       gcsOutputUriPrefix,
//       mimetype
//     );
//     console.log(`📄 Started Document AI batch operation for file ${fileId}: ${operationName}`);

//     // Update processing job with batch operation details
//     await ProcessingJob.updateJob(jobId, {
//       gcs_input_uri: gcsInputUri,
//       gcs_output_uri_prefix: gcsOutputUriPrefix,
//       document_ai_operation_name: operationName,
//       status: "running",
//     });

//     await File.updateProcessingStatus(fileId, "batch_processing", 0);

//   } catch (err) {
//     console.error(`❌ Error processing document ${fileId} in batch:`, err.message);
//     await File.updateProcessingStatus(fileId, "error", 0);
//     await ProcessingJob.updateJobStatus(jobId, "failed", err.message);
//   }
// }

// /* ----------------- Create Folder ----------------- */
// exports.createFolder = async (req, res) => {
//   try {
//     const { folderName } = req.body;
//     const userId = req.user.id;

//     if (!folderName) return res.status(400).json({ error: "Folder name is required" });

//     const safeFolderName = sanitizeName(folderName);
//     const gcsPath = `${userId}/documents/${safeFolderName}/`;

//     // Create placeholder
//     await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

//     const folder = await File.create({
//       user_id: userId,
//       originalname: safeFolderName,
//       gcs_path: gcsPath,
//       mimetype: 'folder/x-directory',
//       is_folder: true,
//       status: "processed", // Changed from processing_status
//       processing_progress: 100,
//     });

//     return res.status(201).json({ message: "Folder created", folder });
//   } catch (error) {
//     console.error("❌ createFolder error:", error);
//     res.status(500).json({ error: "Internal server error", details: error.message });
//   }
// };

// /* ----------------- Upload Multiple Docs ----------------- */
// exports.uploadDocuments = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const userId = req.user.id;

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     const safeFolder = sanitizeName(folderName);
//     const uploadedFiles = [];

//     for (const file of req.files) {
//       if (file.size > 50 * 1024 * 1024) {
//         return res.status(413).json({ error: `${file.originalname} too large` });
//       }

//       const ext = mime.extension(file.mimetype) || "";
//       const safeName = sanitizeName(path.basename(file.originalname, path.extname(file.originalname))) + (ext ? `.${ext}` : "");

//       const basePath = `${userId}/documents/${safeFolder}`;
//       const key = path.posix.join(basePath, safeName);
//       const uniqueKey = await ensureUniqueKey(key);

//       const fileRef = bucket.file(uniqueKey);
//       await fileRef.save(file.buffer, {
//         resumable: false,
//         metadata: { contentType: file.mimetype },
//       });

//       const savedFile = await File.create({
//         user_id: userId,
//         originalname: safeName,
//         gcs_path: uniqueKey,
//         folder_path: safeFolder,
//         mimetype: file.mimetype,
//         size: file.size,
//         is_folder: false,
//         status: "queued", // Changed from processing_status
//         processing_progress: 0,
//       });

//       processDocumentWithAI(savedFile.id, file.buffer, file.mimetype, userId, safeName).catch((err) =>
//         console.error(`❌ Background processing failed for ${savedFile.id}:`, err.message)
//       );

//       const previewUrl = await makeSignedReadUrl(uniqueKey, 15);

//       uploadedFiles.push({
//         ...savedFile,
//         previewUrl,
//       });
//     }

//     return res.status(201).json({
//       message: "Documents uploaded and processing started",
//       documents: uploadedFiles,
//     });
//   } catch (error) {
//     console.error("❌ uploadDocuments error:", error);
//     res.status(500).json({ error: "Internal server error", details: error.message });
//   }
// };

// /* ----------------- Enhanced Folder Summary ----------------- */
// exports.getFolderSummary = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const userId = req.user.id;

//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     console.log(`[getFolderSummary] Found files in folder '${folderName}' for user ${userId}:`, files.map(f => ({ id: f.id, originalname: f.originalname, status: f.status }))); // Changed f.processing_status to f.status

//     const processed = files.filter((f) => !f.is_folder && f.status === "processed"); // Changed f.processing_status to f.status
//     console.log(`[getFolderSummary] Processed documents in folder '${folderName}':`, processed.map(f => ({ id: f.id, originalname: f.originalname })));

//     if (processed.length === 0) {
//       return res.status(404).json({ error: "No processed documents in folder" });
//     }

//     let combinedText = "";
//     let documentDetails = [];
    
//     for (const f of processed) {
//       const chunks = await FileChunk.getChunksByFileId(f.id);
//       const fileText = chunks.map((c) => c.content).join("\n\n");
//       combinedText += `\n\n[Document: ${f.originalname}]\n${fileText}`;
      
//       documentDetails.push({
//         name: f.originalname,
//         summary: f.summary || "Summary not available",
//         chunkCount: chunks.length
//       });
//     }

//     // Generate comprehensive folder summary
//     const summary = await getSummaryFromChunks(combinedText);

//     // Save as a chat entry
//     const savedChat = await FolderChat.saveFolderChat( // Changed to FolderChat.saveFolderChat
//       userId,
//       folderName,
//       `Summary for folder "${folderName}"`, // Question
//       summary,
//       null, // Session ID
//       processed.map(f => f.id) // Summarized file IDs
//     );

//     return res.json({
//       folder: folderName,
//       summary,
//       documentCount: processed.length,
//       documents: documentDetails,
//       session_id: savedChat.session_id,
//     });
//   } catch (error) {
//     console.error("❌ getFolderSummary error:", error);
//     res.status(500).json({ error: "Failed to generate folder summary", details: error.message });
//   }
// };

// /* ----------------- Query Folder Documents (NEW) ----------------- */
// exports.queryFolderDocuments = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const { question, sessionId, maxResults = 10 } = req.body;
//     const userId = req.user.id;

//     if (!question) {
//       return res.status(400).json({ error: "Question is required" });
//     }

//     // Get all processed files in the folder
//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     const processedFiles = files.filter(f => !f.is_folder && f.status === "processed"); // Changed f.processing_status to f.status
    
//     if (processedFiles.length === 0) {
//       return res.status(404).json({ error: "No processed documents in folder" });
//     }

//     // Generate embedding for the question
//     const questionEmbedding = await generateEmbedding(question);

//     // Get all chunks from all files in the folder
//     let allChunks = [];
//     for (const file of processedFiles) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
//       const chunksWithFileInfo = chunks.map(chunk => ({
//         ...chunk,
//         filename: file.originalname
//       }));
//       allChunks = allChunks.concat(chunksWithFileInfo);
//     }

//     // Get chunk vectors and calculate similarity
//     let relevantChunks = [];
//     for (const chunk of allChunks) {
//       const chunkVector = (await ChunkVector.getVectorsByChunkIds([chunk.id]))[0];
//       if (chunkVector) {
//         // Calculate cosine similarity (you'll need to implement this)
//         const similarity = calculateCosineSimilarity(questionEmbedding, chunkVector.embedding);
//         if (similarity > 0.3) { // Threshold for relevance
//           relevantChunks.push({
//             ...chunk,
//             similarity_score: similarity
//           });
//         }
//       }
//     }

//     // Sort by similarity and take top results
//     relevantChunks = relevantChunks
//       .sort((a, b) => b.similarity_score - a.similarity_score)
//       .slice(0, maxResults);

//     if (relevantChunks.length === 0) {
//       return res.json({
//         answer: "I couldn't find relevant information in the documents to answer your question.",
//         sources: [],
//         sessionId: sessionId || uuidv4()
//       });
//     }

//     // Prepare context for AI
//     const contextText = relevantChunks.map((chunk, index) => 
//       `[Source: ${chunk.filename} - Page ${chunk.page_start}]\n${chunk.content}`
//     ).join("\n\n---\n\n");

//     const prompt = `
//       You are an AI assistant helping to answer questions about a collection of documents in folder "${folderName}".
      
//       QUESTION: ${question}
      
//       CONTEXT FROM DOCUMENTS:
//       ${contextText}
      
//       Please provide a comprehensive answer based on the information from these documents. 
//       If the information spans multiple documents, mention which documents contain relevant information.
//       If you cannot find sufficient information to answer the question, say so clearly.
      
//       Answer:
//     `;

//     const answer = await askGemini(prompt);

//     // Save the chat interaction
//     const savedChat = await FileChat.saveChat(
//       sessionId,
//       userId,
//       question,
//       answer,
//       null,
//       processedFiles.map(f => f.id),
//       false,
//       folderName
//     );

//     // Prepare sources
//     const sources = relevantChunks.map(chunk => ({
//       document: chunk.filename,
//       content: chunk.content.substring(0, 200) + "...",
//       page: chunk.page_start,
//       relevanceScore: Math.round(chunk.similarity_score * 100)
//     }));

//     return res.json({
//       answer,
//       sources,
//       sessionId: savedChat.session_id,
//       folderName,
//       documentsSearched: processedFiles.length,
//       chunksFound: relevantChunks.length
//     });

//   } catch (error) {
//     console.error("❌ queryFolderDocuments error:", error);
//     res.status(500).json({ 
//       error: "Failed to process query", 
//       details: error.message 
//     });
//   }
// };

// /* ----------------- Get Folder Processing Status (NEW) ----------------- */
// exports.getFolderProcessingStatus = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const userId = req.user.id;

//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     const documents = files.filter(f => !f.is_folder);
    
//     if (documents.length === 0) {
//       return res.json({
//         folderName,
//         overallProgress: 100,
//         processingStatus: { total: 0, queued: 0, processing: 0, completed: 0, failed: 0 },
//         documents: []
//       });
//     }

//     const processingStatus = {
//       total: documents.length,
//       queued: documents.filter(f => f.status === "queued" || f.status === "batch_queued").length, // Changed f.processing_status to f.status
//       processing: documents.filter(f => f.status === "batch_processing" || f.status === "processing").length, // Changed f.processing_status to f.status
//       completed: documents.filter(f => f.status === "processed").length, // Changed f.processing_status to f.status
//       failed: documents.filter(f => f.status === "error").length // Changed f.processing_status to f.status
//     };

//     const overallProgress = Math.round((processingStatus.completed / documents.length) * 100);

//     return res.json({
//       folderName,
//       overallProgress,
//       processingStatus,
//       documents: documents.map(doc => ({
//         id: doc.id,
//         name: doc.originalname,
//         status: doc.processing_status,
//         progress: doc.processing_progress
//       }))
//     });

//   } catch (error) {
//     console.error("❌ getFolderProcessingStatus error:", error);
//     res.status(500).json({ 
//       error: "Failed to get folder processing status", 
//       details: error.message 
//     });
//   }
// };

// /* ----------------- Get File Processing Status (Existing) ----------------- */
// exports.getFileProcessingStatus = async (req, res) => {
//   try {
//     const { file_id } = req.params;
//     if (!file_id) {
//       console.error("❌ getFileProcessingStatus Error: file_id is missing from request parameters.");
//       return res.status(400).json({ error: "file_id is required." });
//     }
//     console.log(`[getFileProcessingStatus] Received request for file_id: ${file_id}`);

//     const file = await File.getFileById(file_id);
//     if (!file || String(file.user_id) !== String(req.user.id)) {
//       console.error(`❌ getFileProcessingStatus Error: Access denied for file ${file_id}. File owner: ${file.user_id}, Requesting user: ${req.user.id}`);
//       return res
//         .status(403)
//         .json({ error: "Access denied or file not found." });
//     }

//     const job = await ProcessingJob.getJobByFileId(file_id);

//     if (file.status === "processed") { // Changed file.processing_status to file.status
//       const existingChunks = await FileChunk.getChunksByFileId(file_id);
//       if (existingChunks && existingChunks.length > 0) {
//         const formattedChunks = existingChunks.map((chunk) => ({
//           text: chunk.content,
//           metadata: {
//             page_start: chunk.page_start,
//             page_end: chunk.page_end,
//             heading: chunk.heading,
//           },
//         }));
//         return res.json({
//           file_id: file.id,
//           status: file.status, // Changed file.processing_status to file.status
//           processing_progress: file.processing_progress,
//           job_status: job ? job.status : "completed",
//           job_error: job ? job.error_message : null,
//           last_updated: file.updated_at,
//           chunks: formattedChunks,
//           summary: file.summary,
//         });
//       }
//     }

//     if (!job || !job.document_ai_operation_name) {
//       return res.json({
//         file_id: file.id,
//         status: file.status, // Changed file.processing_status to file.status
//         processing_progress: file.processing_progress,
//         job_status: "not_queued",
//         job_error: null,
//         last_updated: file.updated_at,
//         chunks: [],
//         summary: file.summary,
//       });
//     }

//     console.log(`[getFileProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
//     const status = await getOperationStatus(job.document_ai_operation_name);
//     console.log(`[getFileProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

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

//     if (status.error) {
//       console.error(`[getFileProcessingStatus] Document AI operation failed with error: ${status.error.message}`);
//       await File.updateProcessingStatus(file_id, "error", 0.0);
//       await ProcessingJob.updateJobStatus(
//         job.job_id,
//         "failed",
//         status.error.message
//       );
//       return res.status(500).json({
//         file_id: file.id,
//         status: "error",
//         processing_progress: 0.0,
//         job_status: "failed",
//         job_error: status.error.message,
//         last_updated: new Date().toISOString(),
//       });
//     }

//     const bucketName = fileOutputBucket.name;
//     const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
//     console.log(`[getFileProcessingStatus] Document AI operation completed. Fetching results from GCS. Bucket: ${bucketName}, Prefix: ${prefix}`);
//     const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
//     console.log(`[getFileProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results.`);

//     if (
//       !extractedBatchTexts ||
//       extractedBatchTexts.length === 0 ||
//       extractedBatchTexts.every(
//         (item) => !item || !item.text || item.text.trim() === ""
//       )
//     ) {
//       throw new Error(
//         "Could not extract any meaningful text content from batch document."
//       );
//     }

//     await File.updateProcessingStatus(file_id, "processing", 75.0);
//     console.log(`[getFileProcessingStatus] File ID ${file_id} status updated to 75% (text extracted).`);

//     console.log(`[getFileProcessingStatus] Starting chunking for file ID ${file_id}.`);
//     const chunks = await chunkDocument(extractedBatchTexts, file_id);
//     console.log(`[getFileProcessingStatus] Chunked file ID ${file_id} into ${chunks.length} chunks.`);

//     if (chunks.length === 0) {
//       await File.updateProcessingStatus(file_id, "processed", 100.0);
//       await ProcessingJob.updateJobStatus(job.job_id, "completed");
//       const updatedFile = await File.getFileById(file_id);
//       return res.json({
//         file_id: updatedFile.id,
//         chunks: [],
//         summary: updatedFile.summary,
//       });
//     }

//     const chunkContents = chunks.map((c) => c.content);
//     const embeddings = await generateEmbeddings(chunkContents);

//     if (chunks.length !== embeddings.length) {
//       throw new Error(
//         "Mismatch between number of chunks and embeddings generated for batch document."
//       );
//     }

//     const chunksToSaveBatch = chunks.map((chunk, i) => ({
//       file_id: file_id,
//       chunk_index: i,
//       content: chunk.content,
//       token_count: chunk.token_count,
//       page_start: chunk.metadata.page_start,
//       page_end: chunk.metadata.page_end,
//       heading: chunk.metadata.heading,
//     }));

//     console.log(`[getFileProcessingStatus] Attempting to save ${chunksToSaveBatch.length} chunks for file ID ${file_id}.`);
//     const savedChunksBatch = await FileChunk.saveMultipleChunks(
//       chunksToSaveBatch
//     );
//     console.log(`[getFileProcessingStatus] Saved ${savedChunksBatch.length} chunks for file ID ${file_id}.`);

//     const vectorsToSaveBatch = savedChunksBatch.map((savedChunk) => {
//       const originalChunkIndex = savedChunk.chunk_index;
//       const originalChunk = chunks[originalChunkIndex];
//       const embedding = embeddings[originalChunkIndex];
//       return {
//         chunk_id: savedChunk.id,
//         embedding: embedding,
//         file_id: file_id,
//       };
//     });

//     console.log(`[getFileProcessingStatus] Attempting to save ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);
//     await ChunkVector.saveMultipleChunkVectors(vectorsToSaveBatch);
//     console.log(`[getFileProcessingStatus] Saved ${vectorsToSaveBatch.length} chunk vectors for file ID ${file_id}.`);

//     await File.updateProcessingStatus(file_id, "processed", 100.0);
//     await ProcessingJob.updateJobStatus(job.job_id, "completed");
//     console.log(`[getFileProcessingStatus] File ID ${file_id} processing completed.`);

//     let summary = null;
//     try {
//       const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
//       if (fullTextForSummary.length > 0) {
//         console.log(`[getFileProcessingStatus] Generating summary for file ID ${file_id}.`);
//         summary = await getSummaryFromChunks(fullTextForSummary);
//         await File.updateSummary(file_id, summary);
//         console.log(`[getFileProcessingStatus] Generated summary for file ID ${file_id}.`);
//       }
//     } catch (summaryError) {
//       console.warn(
//         `⚠️ Could not generate summary for batch file ID ${file_id}:`,
//         summaryError.message
//       );
//     }

//     const updatedFile = await File.getFileById(file_id);
//     const fileChunks = await FileChunk.getChunksByFileId(file_id);

//     const formattedChunks = fileChunks.map((chunk) => ({
//       text: chunk.content,
//       metadata: {
//         page_start: chunk.page_start,
//         page_end: chunk.page_end,
//         heading: chunk.heading,
//       },
//     }));

//     return res.json({
//       file_id: updatedFile.id,
//       status: updatedFile.status, // Changed updatedFile.processing_status to updatedFile.status
//       processing_progress: updatedFile.processing_progress,
//       job_status: "completed",
//       job_error: null,
//       last_updated: updatedFile.updated_at,
//       chunks: formattedChunks,
//       summary: updatedFile.summary,
//     });
//   } catch (error) {
//     console.error("❌ getFileProcessingStatus error:", error);
//     return res
//       .status(500)
//       .json({
//         error: "Failed to fetch processing status.",
//         details: error.message,
//       });
//   }
// };

// /* ----------------- Helper function for cosine similarity ----------------- */
// function calculateCosineSimilarity(vectorA, vectorB) {
//   if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
//     return 0;
//   }

//   let dotProduct = 0;
//   let normA = 0;
//   let normB = 0;

//   for (let i = 0; i < vectorA.length; i++) {
//     dotProduct += vectorA[i] * vectorB[i];
//     normA += vectorA[i] * vectorA[i];
//     normB += vectorB[i] * vectorB[i];
//   }

//   normA = Math.sqrt(normA);
//   normB = Math.sqrt(normB);

//   if (normA === 0 || normB === 0) {
//     return 0;
//   }

//   return dotProduct / (normA * normB);
// }


require("dotenv").config();

const mime = require("mime-types");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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
  getSignedUrl,
} = require("../services/gcsService");
const { checkStorageLimit } = require("../utils/storage");
const { bucket } = require("../config/gcs");
const { askGemini, getSummaryFromChunks } = require("../services/aiService");
const { queryFolderWithGemini } = require("../services/folderAiService");
const { extractText } = require("../utils/textExtractor");
const {
  extractTextFromDocument,
  batchProcessDocument,
  getOperationStatus,
  fetchBatchResults,
} = require("../services/documentAiService");
const { chunkDocument } = require("../services/chunkingService");
const { generateEmbedding, generateEmbeddings } = require("../services/embeddingService");
const { fileInputBucket, fileOutputBucket } = require("../config/gcs");

/* ----------------- Helpers ----------------- */
function sanitizeName(name) {
  return String(name).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
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

/* ----------------- Process Document ----------------- */
async function processDocumentWithAI(fileId, fileBuffer, mimetype, userId, originalFilename) {
  const jobId = uuidv4();

  try {
    await ProcessingJob.createJob({
      job_id: jobId,
      file_id: fileId,
      type: "batch",
      document_ai_operation_name: null,
      status: "queued",
    });

    await File.updateProcessingStatus(fileId, "batch_queued", 0);

    const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
    const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
      originalFilename,
      fileBuffer,
      batchUploadFolder,
      true,
      mimetype
    );

    const outputPrefix = `document-ai-results/${userId}/${uuidv4()}/`;
    const gcsOutputUriPrefix = `gs://${fileOutputBucket.name}/${outputPrefix}`;

    const operationName = await batchProcessDocument(
      [gcsInputUri],
      gcsOutputUriPrefix,
      mimetype
    );
    console.log(`📄 Started Document AI batch operation for file ${fileId}: ${operationName}`);

    await ProcessingJob.updateJob(jobId, {
      gcs_input_uri: gcsInputUri,
      gcs_output_uri_prefix: gcsOutputUriPrefix,
      document_ai_operation_name: operationName,
      status: "running",
    });

    await File.updateProcessingStatus(fileId, "batch_processing", 0);

  } catch (err) {
    console.error(`❌ Error processing document ${fileId} in batch:`, err.message);
    await File.updateProcessingStatus(fileId, "error", 0);
    await ProcessingJob.updateJobStatus(jobId, "failed", err.message);
  }
}

/* ----------------- Create Folder ----------------- */
exports.createFolder = async (req, res) => {
  try {
    const { folderName } = req.body;
    const userId = req.user.id;

    if (!folderName) return res.status(400).json({ error: "Folder name is required" });

    const safeFolderName = sanitizeName(folderName);
    const gcsPath = `${userId}/documents/${safeFolderName}/`;

    await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

    const folder = await File.create({
      user_id: userId,
      originalname: safeFolderName,
      gcs_path: gcsPath,
      mimetype: 'folder/x-directory',
      is_folder: true,
      status: "processed",
      processing_progress: 100,
    });

    return res.status(201).json({ message: "Folder created", folder });
  } catch (error) {
    console.error("❌ createFolder error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/* ----------------- Upload Multiple Docs ----------------- */
exports.uploadDocuments = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const safeFolder = sanitizeName(folderName);
    const uploadedFiles = [];

    for (const file of req.files) {
      if (file.size > 50 * 1024 * 1024) {
        return res.status(413).json({ error: `${file.originalname} too large` });
      }

      const ext = mime.extension(file.mimetype) || "";
      const safeName = sanitizeName(path.basename(file.originalname, path.extname(file.originalname))) + (ext ? `.${ext}` : "");

      const basePath = `${userId}/documents/${safeFolder}`;
      const key = path.posix.join(basePath, safeName);
      const uniqueKey = await ensureUniqueKey(key);

      const fileRef = bucket.file(uniqueKey);
      await fileRef.save(file.buffer, {
        resumable: false,
        metadata: { contentType: file.mimetype },
      });

      const savedFile = await File.create({
        user_id: userId,
        originalname: safeName,
        gcs_path: uniqueKey,
        folder_path: safeFolder,
        mimetype: file.mimetype,
        size: file.size,
        is_folder: false,
        status: "queued",
        processing_progress: 0,
      });

      processDocumentWithAI(savedFile.id, file.buffer, file.mimetype, userId, safeName).catch((err) =>
        console.error(`❌ Background processing failed for ${savedFile.id}:`, err.message)
      );

      const previewUrl = await makeSignedReadUrl(uniqueKey, 15);

      uploadedFiles.push({
        ...savedFile,
        previewUrl,
      });
    }

    return res.status(201).json({
      message: "Documents uploaded and processing started",
      documents: uploadedFiles,
    });
  } catch (error) {
    console.error("❌ uploadDocuments error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/* ----------------- Enhanced Folder Summary ----------------- */
exports.getFolderSummary = async (req, res) => {
  try {
    const { folderName } = req.params;
    const userId = req.user.id;

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

    const summary = await getSummaryFromChunks(combinedText);

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

/* ----------------- Query Folder Documents (FIXED) ----------------- */
exports.queryFolderDocuments = async (req, res) => {
  try {
    const { folderName } = req.params;
    const { question, sessionId, maxResults = 10 } = req.body;
    const userId = req.user.id;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`[queryFolderDocuments] Processing query for folder: ${folderName}, user: ${userId}`);
    console.log(`[queryFolderDocuments] Question: ${question}`);

    // Get all processed files in the folder
    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");
    
    console.log(`[queryFolderDocuments] Found ${processedFiles.length} processed files in folder ${folderName}`);
    
    if (processedFiles.length === 0) {
      return res.status(404).json({ 
        error: "No processed documents in folder",
        debug: { totalFiles: files.length, processedFiles: 0 }
      });
    }

    // Get all chunks from all files in the folder
    let allChunks = [];
    for (const file of processedFiles) {
      const chunks = await FileChunk.getChunksByFileId(file.id);
      console.log(`[queryFolderDocuments] File ${file.originalname} has ${chunks.length} chunks`);
      
      const chunksWithFileInfo = chunks.map(chunk => ({
        ...chunk,
        filename: file.originalname,
        file_id: file.id
      }));
      allChunks = allChunks.concat(chunksWithFileInfo);
    }

    console.log(`[queryFolderDocuments] Total chunks found: ${allChunks.length}`);

    if (allChunks.length === 0) {
      return res.json({
        answer: "The documents in this folder don't appear to have any processed content yet. Please wait for processing to complete or check the document processing status.",
        sources: [],
        sessionId: sessionId || uuidv4(),
        debug: { processedFiles: processedFiles.length, totalChunks: 0 }
      });
    }

    // Use keyword-based search for better reliability
    const questionLower = question.toLowerCase();
    const questionWords = questionLower
      .split(/\s+/)
      .filter(word => word.length > 3 && !['what', 'where', 'when', 'how', 'why', 'which', 'this', 'that', 'these', 'those'].includes(word));
    
    console.log(`[queryFolderDocuments] Question keywords:`, questionWords);

    let relevantChunks = [];
    
    if (questionWords.length > 0) {
      // Score chunks based on keyword matches and context
      relevantChunks = allChunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
        
        // Check for exact keyword matches
        for (const word of questionWords) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = (contentLower.match(regex) || []).length;
          score += matches * 2; // Weight exact matches higher
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
      // If no meaningful keywords, use first chunks from each document for context
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

    console.log(`[queryFolderDocuments] Found ${relevantChunks.length} relevant chunks`);

    // Prepare comprehensive context for AI
    const contextText = relevantChunks.map((chunk, index) => 
      `[Document: ${chunk.filename} - Page ${chunk.page_start || 'N/A'}]\n${chunk.content.substring(0, 2000)}`
    ).join("\n\n---\n\n");

    console.log(`[queryFolderDocuments] Context text length: ${contextText.length} characters`);

    // Enhanced prompt for better responses
    const prompt = `
You are an AI assistant analyzing a collection of documents in folder "${folderName}". 

USER QUESTION: "${question}"

DOCUMENT CONTENT:
${contextText}

INSTRUCTIONS:
1. Provide a comprehensive, detailed answer based on the document content
2. If information spans multiple documents, clearly indicate which documents contain what information
3. Use specific details, quotes, and examples from the documents when possible
4. If you can partially answer the question, provide what information is available and note what might be missing
5. Be thorough and helpful - synthesize information across all relevant documents
6. If the question asks about relationships or connections, analyze how the documents relate to each other

Provide your answer:`;

    const answer = await queryFolderWithGemini(prompt);
    console.log(`[queryFolderDocuments] Generated answer length: ${answer.length} characters`);

    // Save the chat interaction
    let savedChat;
    try {
      savedChat = await FolderChat.saveFolderChat(
        userId,
        folderName,
        question,
        answer,
        sessionId,
        processedFiles.map(f => f.id)
      );
    } catch (chatError) {
      console.warn(`[queryFolderDocuments] Failed to save chat:`, chatError.message);
      // Fallback - create a session ID for response continuity
      savedChat = { session_id: sessionId || uuidv4() };
    }

    // Prepare sources with more detail
    const sources = relevantChunks.map(chunk => ({
      document: chunk.filename,
      content: chunk.content.substring(0, 400) + (chunk.content.length > 400 ? "..." : ""),
      page: chunk.page_start || 'N/A',
      relevanceScore: chunk.similarity_score || 0
    }));

    return res.json({
      answer,
      sources,
      sessionId: savedChat.session_id,
      folderName,
      documentsSearched: processedFiles.length,
      chunksFound: relevantChunks.length,
      totalChunks: allChunks.length,
      searchMethod: questionWords.length > 0 ? 'keyword_search' : 'document_sampling'
    });

  } catch (error) {
    console.error("❌ queryFolderDocuments error:", error);
    res.status(500).json({ 
      error: "Failed to process query", 
      details: error.message 
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
    if (!file_id) {
      return res.status(400).json({ error: "file_id is required." });
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

    const bucketName = fileOutputBucket.name;
    const prefix = job.gcs_output_uri_prefix.replace(`gs://${bucketName}/`, "");
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);

    if (!extractedBatchTexts || extractedBatchTexts.length === 0) {
      throw new Error("Could not extract any meaningful text content from batch document.");
    }

    await File.updateProcessingStatus(file_id, "processing", 75.0);

    const chunks = await chunkDocument(extractedBatchTexts, file_id);

    if (chunks.length === 0) {
      await File.updateProcessingStatus(file_id, "processed", 100.0);
      await ProcessingJob.updateJobStatus(job.job_id, "completed");
      const updatedFile = await File.getFileById(file_id);
      return res.json({
        file_id: updatedFile.id,
        chunks: [],
        summary: updatedFile.summary,
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
      const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
      if (fullTextForSummary.length > 0) {
        summary = await getSummaryFromChunks(fullTextForSummary);
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