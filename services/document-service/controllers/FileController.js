

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
  getSignedUrl: getSignedUrlFromGCS, // Renamed to avoid conflict
} = require("../services/gcsService");
const { getSignedUrl } = require("../services/folderService"); // Import from folderService
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
// exports.createFolder = async (req, res) => {
//   try {
//     const { folderName } = req.body;
//     const userId = req.user.id;

//     if (!folderName) return res.status(400).json({ error: "Folder name is required" });

//     const safeFolderName = sanitizeName(folderName);
//     const gcsPath = `${userId}/documents/${safeFolderName}/`;

//     await uploadToGCS(".keep", Buffer.from(""), gcsPath, false, "text/plain");

//     const folder = await File.create({
//       user_id: userId,
//       originalname: safeFolderName,
//       gcs_path: gcsPath,
//       mimetype: 'folder/x-directory',
//       is_folder: true,
//       status: "processed",
//       processing_progress: 100,
//     });

//     return res.status(201).json({ message: "Folder created", folder });
//   } catch (error) {
//     console.error("❌ createFolder error:", error);
//     res.status(500).json({ error: "Internal server error", details: error.message });
//   }
// };
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

/* ----------------- Get All Folders for a User ----------------- */
// exports.getFolders = async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const allFilesAndFolders = await File.findByUserId(userId);
//     const folders = allFilesAndFolders.filter(item => item.is_folder);

//     return res.json({
//       success: true,
//       folders: folders.map(folder => ({
//         id: folder.id,
//         name: folder.originalname,
//         gcsPath: folder.gcs_path,
//         createdAt: folder.created_at,
//       })),
//     });
//   } catch (error) {
//     console.error("❌ getFolders error:", error);
//     res.status(500).json({ error: "Failed to fetch folders", details: error.message });
//   }
// };
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
// exports.queryFolderDocuments = async (req, res) => {
//   try {
//     const { folderName } = req.params;
//     const { question, sessionId, maxResults = 10 } = req.body;
//     const userId = req.user.id;

//     if (!question) {
//       return res.status(400).json({ error: "Question is required" });
//     }

//     console.log(`[queryFolderDocuments] Processing query for folder: ${folderName}, user: ${userId}`);
//     console.log(`[queryFolderDocuments] Question: ${question}`);

//     // Get all processed files in the folder
//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");
    
//     console.log(`[queryFolderDocuments] Found ${processedFiles.length} processed files in folder ${folderName}`);
    
//     if (processedFiles.length === 0) {
//       return res.status(404).json({ 
//         error: "No processed documents in folder",
//         debug: { totalFiles: files.length, processedFiles: 0 }
//       });
//     }

//     // Get all chunks from all files in the folder
//     let allChunks = [];
//     for (const file of processedFiles) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
//       console.log(`[queryFolderDocuments] File ${file.originalname} has ${chunks.length} chunks`);
      
//       const chunksWithFileInfo = chunks.map(chunk => ({
//         ...chunk,
//         filename: file.originalname,
//         file_id: file.id
//       }));
//       allChunks = allChunks.concat(chunksWithFileInfo);
//     }

//     console.log(`[queryFolderDocuments] Total chunks found: ${allChunks.length}`);

//     if (allChunks.length === 0) {
//       return res.json({
//         answer: "The documents in this folder don't appear to have any processed content yet. Please wait for processing to complete or check the document processing status.",
//         sources: [],
//         sessionId: sessionId || uuidv4(),
//         debug: { processedFiles: processedFiles.length, totalChunks: 0 }
//       });
//     }

//     // Use keyword-based search for better reliability
//     const questionLower = question.toLowerCase();
//     const questionWords = questionLower
//       .split(/\s+/)
//       .filter(word => word.length > 3 && !['what', 'where', 'when', 'how', 'why', 'which', 'this', 'that', 'these', 'those'].includes(word));
    
//     console.log(`[queryFolderDocuments] Question keywords:`, questionWords);

//     let relevantChunks = [];
    
//     if (questionWords.length > 0) {
//       // Score chunks based on keyword matches and context
//       relevantChunks = allChunks.map(chunk => {
//         const contentLower = chunk.content.toLowerCase();
//         let score = 0;
        
//         // Check for exact keyword matches
//         for (const word of questionWords) {
//           const escapedWord = escapeRegExp(word);
//           const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
//           const matches = (contentLower.match(regex) || []).length;
//           score += matches * 2; // Weight exact matches higher
//         }
        
//         // Check for partial matches
//         for (const word of questionWords) {
//           if (contentLower.includes(word)) {
//             score += 1;
//           }
//         }
        
//         return {
//           ...chunk,
//           similarity_score: score
//         };
//       })
//       .filter(chunk => chunk.similarity_score > 0)
//       .sort((a, b) => b.similarity_score - a.similarity_score)
//       .slice(0, maxResults);
//     } else {
//       // If no meaningful keywords, use first chunks from each document for context
//       const chunksPerDoc = Math.max(1, Math.floor(maxResults / processedFiles.length));
//       for (const file of processedFiles) {
//         const fileChunks = allChunks.filter(chunk => chunk.file_id === file.id);
//         const topChunks = fileChunks.slice(0, chunksPerDoc).map(chunk => ({
//           ...chunk,
//           similarity_score: 0.5
//         }));
//         relevantChunks = relevantChunks.concat(topChunks);
//       }
//     }

//     console.log(`[queryFolderDocuments] Found ${relevantChunks.length} relevant chunks`);

//     // Prepare comprehensive context for AI
//     const contextText = relevantChunks.map((chunk, index) => 
//       `[Document: ${chunk.filename} - Page ${chunk.page_start || 'N/A'}]\n${chunk.content.substring(0, 2000)}`
//     ).join("\n\n---\n\n");

//     console.log(`[queryFolderDocuments] Context text length: ${contextText.length} characters`);

//     // Enhanced prompt for better responses
//     const prompt = `
// You are an AI assistant analyzing a collection of documents in folder "${folderName}". 

// USER QUESTION: "${question}"

// DOCUMENT CONTENT:
// ${contextText}

// INSTRUCTIONS:
// 1. Provide a comprehensive, detailed answer based on the document content
// 2. If information spans multiple documents, clearly indicate which documents contain what information
// 3. Use specific details, quotes, and examples from the documents when possible
// 4. If you can partially answer the question, provide what information is available and note what might be missing
// 5. Be thorough and helpful - synthesize information across all relevant documents
// 6. If the question asks about relationships or connections, analyze how the documents relate to each other

// Provide your answer:`;

//     const answer = await queryFolderWithGemini(prompt);
//     console.log(`[queryFolderDocuments] Generated answer length: ${answer.length} characters`);

//     // Save the chat interaction
//     let savedChat;
//     try {
//       savedChat = await FolderChat.saveFolderChat(
//         userId,
//         folderName,
//         question,
//         answer,
//         sessionId,
//         processedFiles.map(f => f.id)
//       );
//     } catch (chatError) {
//       console.warn(`[queryFolderDocuments] Failed to save chat:`, chatError.message);
//       // Fallback - create a session ID for response continuity
//       savedChat = { session_id: sessionId || uuidv4() };
//     }

//     // Prepare sources with more detail
//     const sources = relevantChunks.map(chunk => ({
//       document: chunk.filename,
//       content: chunk.content.substring(0, 400) + (chunk.content.length > 400 ? "..." : ""),
//       page: chunk.page_start || 'N/A',
//       relevanceScore: chunk.similarity_score || 0
//     }));

//     return res.json({
//       answer,
//       sources,
//       sessionId: savedChat.session_id,
//       folderName,
//       documentsSearched: processedFiles.length,
//       chunksFound: relevantChunks.length,
//       totalChunks: allChunks.length,
//       searchMethod: questionWords.length > 0 ? 'keyword_search' : 'document_sampling'
//     });

//   } catch (error) {
//     console.error("❌ queryFolderDocuments error:", error);
//     res.status(500).json({ 
//       error: "Failed to process query", 
//       details: error.message 
//     });
//   }
// };
// exports.queryFolderDocuments = async (req, res) => {
//   let chatCost;
//   let userId = null;

//   try {
//     const {
//       folderName,
//     } = req.params;

//     const {
//       question,
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null, // ✅ allow frontend to pass session
//       maxResults = 10,
//     } = req.body;

//     userId = req.user.id;

//     // Validation
//     if (!folderName || !question) {
//       console.error("❌ Chat Error: folderName or question missing.");
//       return res.status(400).json({ error: "folderName and question are required." });
//     }

//     console.log(`[chatWithFolder] Processing query for folder: ${folderName}, user: ${userId}`);
//     console.log(`[chatWithFolder] Question: ${question}`);

//     // Get processed files in folder
//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");
//     if (processedFiles.length === 0) {
//       return res.status(404).json({
//         error: "No processed documents in folder",
//         debug: { totalFiles: files.length, processedFiles: 0 }
//       });
//     }

//     // Collect chunks
//     let allChunks = [];
//     for (const file of processedFiles) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
//       const chunksWithFileInfo = chunks.map(chunk => ({
//         ...chunk,
//         filename: file.originalname,
//         file_id: file.id
//       }));
//       allChunks = allChunks.concat(chunksWithFileInfo);
//     }

//     if (allChunks.length === 0) {
//       return res.status(400).json({
//         error: "The documents in this folder have no processed content yet."
//       });
//     }

//     // Token cost
//     const chatContentLength = question.length + allChunks.reduce((sum, c) => sum + c.content.length, 0);
//     chatCost = Math.ceil(chatContentLength / 100);

//     console.warn(`⚠️ Token reservation bypassed for user ${userId}.`);

//     // Find relevant chunks (very simplified keyword search)
//     const questionEmbedding = await generateEmbedding(question);
//     const relevantChunks = await ChunkVector.findNearestChunksAcrossFiles(
//       questionEmbedding,
//       maxResults,
//       processedFiles.map(f => f.id)
//     );

//     const relevantChunkContents = relevantChunks.map((chunk) => chunk.content);
//     const usedChunkIds = relevantChunks.map((chunk) => chunk.chunk_id);

//     let answer;
//     if (relevantChunkContents.length === 0) {
//       answer = await askGemini(
//         "No relevant context found in the folder documents.",
//         question
//       );
//     } else {
//       const context = relevantChunkContents.join("\n\n");
//       answer = await askGemini(context, question);
//     }

//     // Store chat
//     const storedQuestion = used_secret_prompt
//       ? `[${prompt_label || "Secret Prompt"}]`
//       : question;

//     const savedChat = await FolderChat.saveFolderChat(
//       userId,
//       folderName,
//       storedQuestion,
//       answer,
//       session_id, // ✅ if null, new session is created
//       processedFiles.map(f => f.id), // summarized_file_ids
//       usedChunkIds,
//       used_secret_prompt,
//       used_secret_prompt ? prompt_label : null
//     );

//     console.warn(`⚠️ Token commitment bypassed for user ${userId}.`);

//     // ✅ Fetch full session history
//     const history = await FolderChat.getFolderChatHistory(userId, folderName, savedChat.session_id);

//     return res.json({
//       session_id: savedChat.session_id,
//       answer,
//       history, // ✅ return full conversation thread
//     });
//   } catch (error) {
//     console.error("❌ Error chatting with folder:", error);
//     if (chatCost && userId) {
//       console.warn(`⚠️ Token rollback bypassed for user ${userId}.`);
//     }
//     return res.status(500).json({
//       error: "Failed to get AI answer.",
//       details: error.message,
//     });
//   }
// };


// exports.queryFolderDocuments = async (req, res) => {
//   let chatCost;
//   let userId = null;

//   try {
//     const {
//       folderName,
//     } = req.params;

//     const {
//       question,
//       used_secret_prompt = false,
//       prompt_label = null,
//       session_id = null, // ✅ allow frontend to pass session
//       maxResults = 10,
//     } = req.body;

//     userId = req.user.id;

//     // Validation
//     if (!folderName || !question) {
//       console.error("❌ Chat Error: folderName or question missing.");
//       return res
//         .status(400)
//         .json({ error: "folderName and question are required." });
//     }

//     console.log(`[chatWithFolder] Processing query for folder: ${folderName}, user: ${userId}`);
//     console.log(`[chatWithFolder] Question: ${question}`);

//     // Get processed files in folder
//     const files = await File.findByUserIdAndFolderPath(userId, folderName);
//     const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");

//     if (processedFiles.length === 0) {
//       return res.status(404).json({
//         error: "No processed documents in folder",
//         debug: { totalFiles: files.length, processedFiles: 0 }
//       });
//     }

//     // Collect chunks across all files
//     let allChunks = [];
//     for (const file of processedFiles) {
//       const chunks = await FileChunk.getChunksByFileId(file.id);
//       const chunksWithFileInfo = chunks.map(chunk => ({
//         ...chunk,
//         filename: file.originalname,
//         file_id: file.id
//       }));
//       allChunks = allChunks.concat(chunksWithFileInfo);
//     }

//     if (allChunks.length === 0) {
//       return res.status(400).json({
//         error: "The documents in this folder have no processed content yet."
//       });
//     }

//     // Token cost (rough estimate)
//     const chatContentLength = question.length + allChunks.reduce((sum, c) => sum + c.content.length, 0);
//     chatCost = Math.ceil(chatContentLength / 100);

//     // 🚨 Token reservation bypassed
//     console.warn(`⚠️ Token reservation bypassed for user ${userId}.`);

//     // Find context
//     const questionEmbedding = await generateEmbedding(question);
//     const relevantChunks = await ChunkVector.findNearestChunksAcrossFiles(
//       questionEmbedding,
//       maxResults,
//       processedFiles.map(f => f.id)
//     );

//     const relevantChunkContents = relevantChunks.map((chunk) => chunk.content);
//     const usedChunkIds = relevantChunks.map((chunk) => chunk.chunk_id);

//     let answer;
//     if (relevantChunkContents.length === 0) {
//       answer = await askGemini(
//         "No relevant context found in the folder documents.",
//         question
//       );
//     } else {
//       const context = relevantChunkContents.join("\n\n");
//       answer = await askGemini(context, question);
//     }

//     // Store chat
//     const storedQuestion = used_secret_prompt
//       ? `[${prompt_label || "Secret Prompt"}]`
//       : question;

//     const savedChat = await FolderChat.saveFolderChat(
//       userId,
//       folderName,
//       storedQuestion,
//       answer,
//       session_id, // ✅ if null, new session is created
//       processedFiles.map(f => f.id), // summarized_file_ids
//       usedChunkIds,
//       used_secret_prompt,
//       used_secret_prompt ? prompt_label : null
//     );

//     // 🚨 Token commit bypassed
//     console.warn(`⚠️ Token commitment bypassed for user ${userId}.`);

//     // ✅ Fetch full session history so frontend gets all messages live
//     const history = await FolderChat.getFolderChatHistory(userId, folderName, savedChat.session_id);

//     return res.json({
//       session_id: savedChat.session_id,
//       answer,
//       history, // ✅ full conversation thread
//     });
//   } catch (error) {
//     console.error("❌ Error chatting with folder:", error);
//     if (chatCost && userId) {
//       console.warn(`⚠️ Token rollback bypassed for user ${userId}.`);
//     }
//     return res
//       .status(500)
//       .json({ error: "Failed to get AI answer.", details: error.message });
//   }
// };


exports.queryFolderDocuments = async (req, res) => {
  let chatCost;
  let userId = null;

  try {
    const { folderName } = req.params;

    const {
      question,                    // This is the FULL prompt text (for AI processing)
      used_secret_prompt = false,  // Boolean flag
      prompt_label = null,         // This is the SHORT label (for display)
      session_id = null,
      maxResults = 10,
    } = req.body;

    userId = req.user.id;

    // Validation
    if (!folderName || !question) {
      console.error("❌ Chat Error: folderName or question missing.");
      return res
        .status(400)
        .json({ error: "folderName and question are required." });
    }

    console.log(`[chatWithFolder] Processing query for folder: ${folderName}, user: ${userId}`);
    console.log(`[chatWithFolder] Question length: ${question.length}`);
    console.log(`[chatWithFolder] Used secret prompt: ${used_secret_prompt}`);
    console.log(`[chatWithFolder] Prompt label: ${prompt_label}`);

    // Get processed files in folder
    const files = await File.findByUserIdAndFolderPath(userId, folderName);
    const processedFiles = files.filter(f => !f.is_folder && f.status === "processed");

    if (processedFiles.length === 0) {
      return res.status(404).json({
        error: "No processed documents in folder",
        debug: { totalFiles: files.length, processedFiles: 0 }
      });
    }

    // Collect chunks across all files
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

    if (allChunks.length === 0) {
      return res.status(400).json({
        error: "The documents in this folder have no processed content yet."
      });
    }

    // Token cost (rough estimate)
    const chatContentLength = question.length + allChunks.reduce((sum, c) => sum + c.content.length, 0);
    chatCost = Math.ceil(chatContentLength / 100);
    console.warn(`⚠️ Token reservation bypassed for user ${userId}.`);

    // Find context using the FULL question (even if it's a secret prompt)
    const questionEmbedding = await generateEmbedding(question);
    const relevantChunks = await ChunkVector.findNearestChunksAcrossFiles(
      questionEmbedding,
      maxResults,
      processedFiles.map(f => f.id)
    );

    const relevantChunkContents = relevantChunks.map((chunk) => chunk.content);
    const usedChunkIds = relevantChunks.map((chunk) => chunk.chunk_id);

    // Generate AI answer using the FULL question
    let answer;
    if (relevantChunkContents.length === 0) {
      answer = await askGemini(
        "No relevant context found in the folder documents.",
        question  // Use full question for AI
      );
    } else {
      const context = relevantChunkContents.join("\n\n");
      answer = await askGemini(context, question);  // Use full question for AI
    }

    // ============ CRITICAL FIX ============
    // Determine what to store in the database:
    // - If secret prompt: store the SHORT label
    // - If regular question: store the full question
    const questionToStore = used_secret_prompt ? prompt_label : question;
    
    console.log(`[chatWithFolder] Storing in DB: "${questionToStore}"`);
    // =====================================

    const savedChat = await FolderChat.saveFolderChat(
      userId,
      folderName,
      questionToStore,              // ✅ Store ONLY the label if secret prompt
      answer,
      session_id,
      processedFiles.map(f => f.id)
    );

    console.warn(`⚠️ Token commitment bypassed for user ${userId}.`);

    // Fetch full session history
    const history = await FolderChat.getFolderChatHistory(
      userId, 
      folderName, 
      savedChat.session_id
    );

    // ============ CRITICAL FIX ============
    // Map history to ensure proper field names for frontend
    const mappedHistory = history.map(chat => ({
      id: chat.id,
      question: chat.question,              // This will be the label if secret prompt
      displayQuestion: chat.used_secret_prompt ? chat.prompt_label : chat.question,
      response: chat.answer,                // ✅ Add 'response' field
      answer: chat.answer,                  // ✅ Keep 'answer' field
      message: chat.answer,                 // ✅ Add 'message' field for fallback
      timestamp: chat.created_at,
      session_id: chat.session_id,
      used_secret_prompt: chat.used_secret_prompt,
      prompt_label: chat.prompt_label,
      used_chunk_ids: chat.used_chunk_ids,
      summarized_file_ids: chat.summarized_file_ids
    }));
    // =====================================

    console.log(`[chatWithFolder] ✅ Response prepared with ${mappedHistory.length} messages`);

    return res.json({
      sessionId: savedChat.session_id,      // ✅ Use camelCase
      session_id: savedChat.session_id,     // ✅ Also keep snake_case for compatibility
      answer,                                // ✅ Latest answer
      response: answer,                      // ✅ Also as 'response'
      chatHistory: mappedHistory,            // ✅ Use camelCase
      history: mappedHistory                 // ✅ Also keep 'history' for compatibility
    });

  } catch (error) {
    console.error("❌ Error chatting with folder:", error);
    if (chatCost && userId) {
      console.warn(`⚠️ Token rollback bypassed for user ${userId}.`);
    }
    return res
      .status(500)
      .json({ error: "Failed to get AI answer.", details: error.message });
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
        question: chat.question,
        response: chat.answer, // Changed from chat.response to chat.answer
        timestamp: chat.created_at,
        documentIds: chat.summarized_file_ids || [] // Changed from chat.document_ids to chat.summarized_file_ids
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
    const userId = req.user?.id; // ✅ comes from auth middleware

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: No user found in token" });
    }

    // Get all chat sessions for this folder
    const chatHistory = await FolderChat.findAll({
      where: {
        user_id: userId,
        folder_name: folderName
      },
      order: [["created_at", "ASC"]],
    });

    // If no chat history, return an empty sessions array instead of 404
    if (!chatHistory.length) {
      return res.status(200).json({
        success: true,
        folderName,
        sessions: [],
        documentsInFolder: [], // No documents if no chats
        totalSessions: 0,
        totalMessages: 0
      });
    }

    // Group messages by session_id
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
        question: chat.question,
        response: chat.answer, // Changed from chat.response to chat.answer
        timestamp: chat.created_at,
        documentIds: chat.summarized_file_ids || [] // Changed from chat.document_ids to chat.summarized_file_ids
      });
    });

    // Get all processed files in this folder
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
  try {
    const { folderName, sessionId } = req.params;
    const { question, maxResults = 10 } = req.body;
    const userId = req.user.id;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log(`[continueFolderChat] Continuing session ${sessionId} for folder: ${folderName}`);
    console.log(`[continueFolderChat] New question: ${question}`);

    // Verify session exists and get chat history
    const existingChats = await FolderChat.findAll({
      where: {
        user_id: userId,
        folder_name: folderName, // Changed from folder_id to folder_name
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
        processedFiles.map(f => f.id)
      );

      return res.json({
        answer,
        sources: [],
        sessionId,
        chatHistory: [...existingChats, savedChat].map(chat => ({
          question: chat.question,
          response: chat.response,
          timestamp: chat.created_at || chat.created_at
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
      .map(chat => `Q: ${chat.question}\nA: ${chat.response}`)
      .join('\n\n---\n\n');

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

    const answer = await queryFolderWithGemini(prompt);
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
      response: chat.response,
      timestamp: chat.created_at
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