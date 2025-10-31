

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
} = require("../services/gcsService");
const { getSignedUrl } = require("../services/folderService"); // Import from folderService
const { checkStorageLimit } = require("../utils/storage");
const { bucket } = require("../config/gcs");
const { askGemini, getSummaryFromChunks, askLLM, getAvailableProviders, resolveProviderName } = require("../services/aiService");
const { askLLM: askFolderLLMService } = require("../services/folderAiService"); // Import askLLM from folderAiService and alias it
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

/* ----------------- Process Document ----------------- */
async function processDocumentWithAI(fileId, fileBuffer, mimetype, userId, originalFilename, secretId = null) {
  const jobId = uuidv4();
  console.log(`[processDocumentWithAI] Starting processing for fileId: ${fileId}, jobId: ${jobId}`);

  try {
    await ProcessingJob.createJob({
      job_id: jobId,
      file_id: fileId,
      type: "batch",
      document_ai_operation_name: null,
      status: "queued",
      secret_id: secretId, // Pass secretId to the job
    });
    console.log(`[processDocumentWithAI] Job ${jobId} created for file ${fileId}.`);

    await File.updateProcessingStatus(fileId, "batch_queued", 0);
    console.log(`[processDocumentWithAI] File ${fileId} status updated to batch_queued.`);

    const batchUploadFolder = `batch-uploads/${userId}/${uuidv4()}`;
    const { gsUri: gcsInputUri, gcsPath: folderPath } = await uploadToGCS(
      originalFilename,
      fileBuffer,
      batchUploadFolder,
      true,
      mimetype
    );
    console.log(`[processDocumentWithAI] File ${fileId} uploaded to GCS: ${gcsInputUri}`);

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
    console.log(`[processDocumentWithAI] Job ${jobId} updated with Document AI operation name: ${operationName}.`);

    await File.updateProcessingStatus(fileId, "batch_processing", 0);
    console.log(`[processDocumentWithAI] File ${fileId} status updated to batch_processing.`);

  } catch (err) {
    console.error(`❌ Error processing document ${fileId} in batch:`, err.message);
    await File.updateProcessingStatus(fileId, "error", 0);
    await ProcessingJob.updateJobStatus(jobId, "failed", err.message);
    console.error(`[processDocumentWithAI] File ${fileId} status updated to error, job ${jobId} failed.`);
  }
}

exports.getFileProcessingStatus = async (req, res) => {
  try {
    const { file_id } = req.params;
    console.log(`[getFileProcessingStatus] Received request for file_id: ${file_id}`);

    if (!file_id) {
      console.warn(`[getFileProcessingStatus] file_id is missing.`);
      return res.status(400).json({ error: "file_id is required." });
    }

    const file = await File.getFileById(file_id);
    if (!file || String(file.user_id) !== String(req.user.id)) {
      console.warn(`[getFileProcessingStatus] Access denied or file not found for file_id: ${file_id}`);
      return res.status(403).json({ error: "Access denied or file not found." });
    }
    console.log(`[getFileProcessingStatus] File ${file_id} found. Status: ${file.status}, Progress: ${file.processing_progress}`);

    const job = await ProcessingJob.getJobByFileId(file_id);
    console.log(`[getFileProcessingStatus] Job for file ${file_id}: ${job ? job.status : 'No job found'}`);

    if (file.status === "processed") {
      const existingChunks = await FileChunk.getChunksByFileId(file_id);
      if (existingChunks && existingChunks.length > 0) {
        console.log(`[getFileProcessingStatus] File ${file_id} already processed with ${existingChunks.length} chunks.`);
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
      } else {
        console.warn(`[getFileProcessingStatus] File ${file_id} is 'processed' but no chunks found in DB.`);
      }
    }

    if (!job || !job.document_ai_operation_name) {
      console.log(`[getFileProcessingStatus] No Document AI job or operation name for file ${file_id}.`);
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

    console.log(`[getFileProcessingStatus] Checking Document AI operation status for job: ${job.document_ai_operation_name}`);
    const status = await getOperationStatus(job.document_ai_operation_name);
    console.log(`[getFileProcessingStatus] Document AI operation status: ${JSON.stringify(status)}`);

    if (!status.done) {
      console.log(`[getFileProcessingStatus] Document AI operation for file ${file_id} is still running.`);
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
      console.error(`[getFileProcessingStatus] Document AI operation for file ${file_id} failed with error: ${status.error.message}`);
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
    console.log(`[getFileProcessingStatus] Fetching batch results from GCS bucket: ${bucketName}, prefix: ${prefix}`);
    const extractedBatchTexts = await fetchBatchResults(bucketName, prefix);
    console.log(`[getFileProcessingStatus] Extracted ${extractedBatchTexts.length} text items from batch results for file ${file_id}.`);

    if (!extractedBatchTexts || extractedBatchTexts.length === 0) {
      console.error(`[getFileProcessingStatus] No meaningful text extracted from batch document for file ${file_id}.`);
      throw new Error("Could not extract any meaningful text content from batch document.");
    }

    await File.updateProcessingStatus(file_id, "processing", 75.0);
    console.log(`[getFileProcessingStatus] File ${file_id} status updated to processing (75%).`);

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
      const result = await pool.query(chunkMethodQuery, [file_id]);

      if (result.rows.length > 0) {
        batchChunkingMethod = result.rows[0].method_name;
        console.log(`[getFileProcessingStatus] ✅ Using chunking method from DB: ${batchChunkingMethod} for file ${file_id}.`);
      } else {
        console.log(`[getFileProcessingStatus] No secret_id found for file ${file_id}, using default chunking method: ${batchChunkingMethod}.`);
      }
    } catch (err) {
      console.error(`[getFileProcessingStatus] Error fetching chunking method for file ${file_id}: ${err.message}`);
      console.log(`[getFileProcessingStatus] Falling back to default chunking method: recursive for file ${file_id}.`);
    }

    console.log(`[getFileProcessingStatus] Starting chunking for file ID ${file_id} using method: ${batchChunkingMethod}`);
    const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);
    console.log(`[getFileProcessingStatus] Generated ${chunks.length} chunks for file ${file_id}.`);

    if (chunks.length === 0) {
      console.warn(`[getFileProcessingStatus] No chunks generated for file ${file_id}. Marking as processed.`);
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
    console.log(`[getFileProcessingStatus] Generating embeddings for ${chunkContents.length} chunks for file ${file_id}.`);
    const embeddings = await generateEmbeddings(chunkContents);
    console.log(`[getFileProcessingStatus] Generated ${embeddings.length} embeddings for file ${file_id}.`);

    const chunksToSaveBatch = chunks.map((chunk, i) => ({
      file_id: file_id,
      chunk_index: i,
      content: chunk.content,
      token_count: chunk.token_count,
      page_start: chunk.metadata.page_start,
      page_end: chunk.metadata.page_end,
      heading: chunk.metadata.heading,
    }));

    console.log(`[getFileProcessingStatus] Saving ${chunksToSaveBatch.length} chunks to DB for file ${file_id}.`);
    const savedChunksBatch = await FileChunk.saveMultipleChunks(chunksToSaveBatch);
    console.log(`[getFileProcessingStatus] Successfully saved ${savedChunksBatch.length} chunks to DB for file ${file_id}.`);

    const vectorsToSaveBatch = savedChunksBatch.map((savedChunk) => {
      const originalChunkIndex = savedChunk.chunk_index;
      const embedding = embeddings[originalChunkIndex];
      return {
        chunk_id: savedChunk.id,
        embedding: embedding,
        file_id: file_id,
      };
    });

    console.log(`[getFileProcessingStatus] Saving ${vectorsToSaveBatch.length} chunk vectors to DB for file ${file_id}.`);
    await ChunkVector.saveMultipleChunkVectors(vectorsToSaveBatch);
    console.log(`[getFileProcessingStatus] Successfully saved ${vectorsToSaveBatch.length} chunk vectors to DB for file ${file_id}.`);

    await File.updateProcessingStatus(file_id, "processed", 100.0);
    await ProcessingJob.updateJobStatus(job.job_id, "completed");
    console.log(`[getFileProcessingStatus] File ${file_id} fully processed and job completed.`);

    let summary = null;
    try {
      const fullTextForSummary = chunks.map((c) => c.content).join("\n\n");
      if (fullTextForSummary.length > 0) {
        console.log(`[getFileProcessingStatus] Generating summary for file ${file_id}.`);
        summary = await getSummaryFromChunks(fullTextForSummary);
        await File.updateSummary(file_id, summary);
        console.log(`[getFileProcessingStatus] Summary generated and saved for file ${file_id}.`);
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

    console.log(`[getFileProcessingStatus] Returning final status for file ${file_id}.`);
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
      maxResults = 10,
      secret_id,
      llm_name,
      additional_input = "",
    } = req.body;

    // Dynamically determine if a secret prompt is being used
    let used_secret_prompt = !!secret_id; // If secret_id is present, it's a secret prompt

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

    // 3️⃣ Collect all chunks across all files
    let allChunks = [];
    for (const file of files) {
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

    console.log(`🧩 Total chunks aggregated: ${allChunks.length}`);

    // 4️⃣ Initialize variables
    let answer;
    let usedChunkIds = [];
    let storedQuestion; // This will be what we store in the DB
    let displayQuestion; // This will be what we show to the user
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
     
      // ✅ FIX: Store only the secret name, not the actual secret content
      finalPromptLabel = secretName;
      storedQuestion = secretName; // Store the prompt name in DB
      displayQuestion = `Analysis: ${secretName}`; // Display format for frontend

      provider = resolveProviderName(llm_name || dbLlmName || "gemini");

      // Fetch secret value securely from GCP Secret Manager
      const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
      const secretClient = new SecretManagerServiceClient();
      const GCLOUD_PROJECT_ID = process.env.GCLOUD_PROJECT_ID;

      const gcpSecretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
      const [accessResponse] = await secretClient.accessSecretVersion({ name: gcpSecretName });
      const secretValue = accessResponse.payload.data.toString("utf8");

      if (!secretValue?.trim()) {
        return res.status(500).json({ error: "Secret value is empty." });
      }

      // Combine all files' text into one context
      const combinedContent = allChunks
        .map((c) => `📄 [${c.filename}]\n${c.content}`)
        .join("\n\n");

      // Construct final LLM prompt (this is NOT stored in DB)
      let finalPrompt = `You are an expert AI legal assistant using the ${provider.toUpperCase()} model.\n\n`;
      finalPrompt += `${secretValue}\n\n=== DOCUMENTS TO ANALYZE (FOLDER: "${folderName}") ===\n${combinedContent}`;

      if (additional_input?.trim()) {
        finalPrompt += `\n\n=== ADDITIONAL USER INPUT ===\n${additional_input.trim()}`;
      }

      // Call model
      answer = await askFolderLLMService(provider, finalPrompt);
      usedChunkIds = allChunks.map((c) => c.id);
     
      console.log(`✅ Secret prompt processed: "${secretName}"`);
    }

    // ================================
    // CASE 2: CUSTOM QUESTION
    // ================================
    else {
      if (!question?.trim())
        return res.status(400).json({ error: "question is required for custom queries." });

      console.log(`💬 Handling custom question: "${question.substring(0, 50)}..."`);

      // ✅ FIX: Store the actual user question for custom queries
      storedQuestion = question;
      displayQuestion = question;
      finalPromptLabel = null; // No prompt label for custom questions

      provider = "gemini"; // default
     
      // Calculate token cost
      chatCost = Math.ceil(question.length / 100) +
                 Math.ceil(allChunks.reduce((sum, c) => sum + c.content.length, 0) / 200);

      // Check token limits
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

      // Use vector search for relevant chunks
      const questionEmbedding = await generateEmbedding(question);
      const allRelevantChunks = [];
     
      for (const file of files) {
        const relevant = await ChunkVector.findNearestChunksAcrossFiles(
          questionEmbedding,
          maxResults,
          [file.id]
        );
        if (relevant.length) {
          allRelevantChunks.push(
            ...relevant.map((r) => ({ ...r, filename: file.originalname }))
          );
        }
      }

      const finalChunks = allRelevantChunks.length > 0 ? allRelevantChunks : allChunks;
      usedChunkIds = finalChunks.map((c) => c.chunk_id || c.id);

      const combinedContext = finalChunks
        .map((c) => `📄 [${c.filename}]\n${c.content}`)
        .join("\n\n");

      answer = await askFolderLLMService(provider, question, combinedContext);
     
      console.log(`✅ Custom question processed`);
    }

    // Validate AI output
    if (!answer?.trim()) {
      return res.status(500).json({ error: "Empty response from AI." });
    }

    console.log(`✅ Folder query successful | Answer length: ${answer.length}`);

    // 5️⃣ ✅ FIX: Save chat with correct question format
    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      storedQuestion, // ✅ This is the prompt name (for secret) or actual question (for custom)
      answer,
      finalSessionId,
      files.map((f) => f.id), // summarizedFileIds
      used_secret_prompt, // Boolean flag
      finalPromptLabel, // Prompt label (only for secret prompts)
      secret_id // Secret ID (only for secret prompts)
    );

    // Increment token usage for custom queries
    if (chatCost && !used_secret_prompt) {
      await TokenUsageService.incrementUsage(userId, { tokens: chatCost, ai_analysis: 1 });
    }

    // 6️⃣ ✅ FIX: Return response with proper display format
    return res.json({
      success: true,
      session_id: finalSessionId,
      answer,
      response: answer,
      llm_provider: provider,
      used_secret_prompt, // ✅ Include flag
      prompt_label: finalPromptLabel, // ✅ Include label (null for custom queries)
      secret_id: used_secret_prompt ? secret_id : null, // ✅ Include secret_id only if used
      used_chunk_ids: usedChunkIds,
      files_queried: files.map((f) => f.originalname),
      total_files: files.length,
      timestamp: new Date().toISOString(),
      displayQuestion: displayQuestion, // ✅ Frontend should use this for display
      storedQuestion: storedQuestion, // ✅ What's stored in DB (for debugging)
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

    const chunks = await chunkDocument(extractedBatchTexts, file_id, batchChunkingMethod);

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
 
    const answer = await askFolderLLM(provider, question, contextText, existingChats.map(chat => ({ question: chat.question, answer: chat.answer }))); // Use askFolderLLM
    console.log(`[continueFolderChat] Generated answer length: ${answer.length} characters`);

    // Save the new chat message
    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      question,
      answer,
      sessionId,
      processedFiles.map(f => f.id)
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

/* ---------------------- Get All Cases for User ---------------------- */
// exports.getAllCases = async (req, res) => {
//   try {
//     const userId = parseInt(req.user?.id);
//     if (!userId) {
//       return res.status(401).json({ error: "Unauthorized user" });
//     }

//     const getAllCasesQuery = `
//       SELECT
//         c.*,
//         ct.name as case_type_name,
//         st.name as sub_type_name,
//         co.name as court_name_name
//       FROM cases c
//       LEFT JOIN case_types ct ON c.case_type::integer = ct.id
//       LEFT JOIN sub_types st ON c.sub_type::integer = st.id
//       LEFT JOIN courts co ON c.court_name::integer = co.id
//       WHERE c.user_id = $1
//       ORDER BY c.created_at DESC;
//     `;
//     const { rows: cases } = await pool.query(getAllCasesQuery, [userId]);

//     // Parse JSON fields for each case
//     const formattedCases = cases.map(caseData => {
//       // Replace IDs with names
//       caseData.case_type = caseData.case_type_name;
//       caseData.sub_type = caseData.sub_type_name;
//       caseData.court_name = caseData.court_name_name;

//       // Remove the now redundant name fields
//       delete caseData.case_type_name;
//       delete caseData.sub_type_name;
//       delete caseData.court_name_name;

//       try {
//         if (typeof caseData.judges === 'string' && caseData.judges.trim() !== '') {
//           caseData.judges = JSON.parse(caseData.judges);
//         } else if (caseData.judges === null) {
//           caseData.judges = []; // Default to empty array if null
//         }
//       } catch (e) {
//         console.warn(`⚠️ Could not parse judges JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.judges}`);
//         caseData.judges = []; // Fallback to empty array on error
//       }
//       try {
//         if (typeof caseData.petitioners === 'string' && caseData.petitioners.trim() !== '') {
//           caseData.petitioners = JSON.parse(caseData.petitioners);
//         } else if (caseData.petitioners === null) {
//           caseData.petitioners = []; // Default to empty array if null
//         }
//       } catch (e) {
//         console.warn(`⚠️ Could not parse petitioners JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.petitioners}`);
//         caseData.petitioners = []; // Fallback to empty array on error
//       }
//       try {
//         if (typeof caseData.respondents === 'string' && caseData.respondents.trim() !== '') {
//           caseData.respondents = JSON.parse(caseData.respondents);
//         } else if (caseData.respondents === null) {
//           caseData.respondents = []; // Default to empty array if null
//         }
//       } catch (e) {
//         console.warn(`⚠️ Could not parse respondents JSON for case ${caseData.id}: ${e.message}. Value: ${caseData.respondents}`);
//         caseData.respondents = []; // Fallback to empty array on error
//       }
//       return caseData;
//     });

//     return res.status(200).json({
//       message: "Cases fetched successfully.",
//       cases: formattedCases,
//       totalCases: formattedCases.length,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching all cases:", error);
//     res.status(500).json({
//       error: "Internal server error",
//       details: error.message,
//     });
//   }
// };

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
        return { ...file, previewUrl };
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

