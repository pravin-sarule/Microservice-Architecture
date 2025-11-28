const File = require('../models/File');
const { uploadFileToGCS } = require('../services/gcsService');
const { askLLMWithGCS } = require('../services/llmService');
const UserProfileService = require('../services/userProfileService');
const pool = require('../config/db');

/**
 * Upload document to GCS and store URL in database
 * POST /api/chat/upload-document
 */
exports.uploadDocumentAndGetURI = async (req, res) => {
  try {
    const userId = req.user.id;
    const authorizationHeader = req.headers.authorization;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    console.log(`📤 Uploading document for user ${userId}: ${req.file.originalname}`);

    // Fetch user profile from auth service
    const userProfile = await UserProfileService.getUserProfile(userId, authorizationHeader);
    if (!userProfile) {
      console.warn(`⚠️ Could not fetch user profile for user ${userId}`);
    }

    // Get GCS bucket name from environment
    const bucketName = process.env.GCS_BUCKET_NAME;
    
    if (!bucketName) {
      return res.status(500).json({
        success: false,
        message: 'GCS configuration missing. Please set GCS_BUCKET_NAME in .env'
      });
    }

    // Generate GCS file path
    const timestamp = Date.now();
    const safeFilename = req.file.originalname.replace(/\s+/g, '_');
    const gcsFilePath = `chat-uploads/${userId}/${timestamp}_${safeFilename}`;

    // Upload file to GCS using buffer directly (more reliable)
    const gcsUri = await uploadFileToGCS(
      bucketName,
      gcsFilePath,
      req.file.buffer,
      req.file.mimetype
    );

    console.log(`✅ File uploaded to GCS: ${gcsUri}`);

    // Store file metadata in database
    const savedFile = await File.create({
      user_id: userId,
      originalname: req.file.originalname,
      gcs_path: gcsFilePath,
      mimetype: req.file.mimetype,
      size: req.file.size,
      status: 'uploaded'
    });

    console.log(`✅ File metadata saved to database: ${savedFile.id}`);

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        file_id: savedFile.id,
        filename: req.file.originalname,
        gcs_uri: gcsUri,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('❌ Error uploading document:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

/**
 * Ask question to LLM with document context
 * POST /api/chat/ask
 */
exports.askQuestion = async (req, res) => {
  try {
    const userId = req.user.id;
    const authorizationHeader = req.headers.authorization;
    const { question, file_id } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    if (!file_id) {
      return res.status(400).json({
        success: false,
        message: 'file_id is required'
      });
    }

    // Sanitize file_id: remove curly braces if present (template variable issue)
    let sanitizedFileId = file_id.trim();
    // Remove any leading/trailing curly braces (handles {{...}}, {...}, or plain UUID)
    sanitizedFileId = sanitizedFileId.replace(/^\{+\s*|\s*\}+$/g, '').trim();
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sanitizedFileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file_id format. file_id must be a valid UUID.',
        error: `Received: ${file_id}`
      });
    }

    console.log(`💬 User ${userId} asking question about file ${sanitizedFileId}`);

    // Fetch file from database
    const file = await File.findById(sanitizedFileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Debug: Print permission details
    console.log('🔐 Permission Check Details:');
    console.log('  - File ID:', file.id);
    console.log('  - File user_id:', file.user_id, '(type:', typeof file.user_id, ')');
    console.log('  - Request userId:', userId, '(type:', typeof userId, ')');
    console.log('  - String comparison:', String(file.user_id) === String(userId));

    // Verify file belongs to user (convert both to strings to handle type mismatch)
    if (String(file.user_id) !== String(userId)) {
      console.log('❌ Permission denied: user_id mismatch');
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this file'
      });
    }
    
    console.log('✅ Permission granted: user_id matches');

    // Construct GCS URI from gcs_path
    if (!file.gcs_path) {
      return res.status(400).json({
        success: false,
        message: 'GCS path not found for this file'
      });
    }
    
    const bucketName = process.env.GCS_BUCKET_NAME;
    const gcsUri = `gs://${bucketName}/${file.gcs_path}`;

    // Fetch user profile for context
    const userProfile = await UserProfileService.getUserProfile(userId, authorizationHeader);
    let userContext = '';
    if (userProfile) {
      userContext = `User: ${userProfile.username || userProfile.email || 'User'}`;
      if (userProfile.professional_profile) {
        userContext += `\nProfessional Profile: ${JSON.stringify(userProfile.professional_profile)}`;
      }
    }

    // Ask LLM with document
    console.log(`🤖 Asking LLM question with document context...`);
    const answer = await askLLMWithGCS(question.trim(), gcsUri, userContext);

    // Store chat history (optional - you can create a chat_history table)
    // For now, we'll just return the answer

    return res.status(200).json({
      success: true,
      data: {
        question: question.trim(),
        answer: answer,
        file_id: sanitizedFileId,
        filename: file.originalname
      }
    });

  } catch (error) {
    console.error('❌ Error asking question:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to get answer from LLM',
      error: error.message
    });
  }
};

/**
 * Get user's uploaded files
 * GET /api/chat/files
 */
exports.getUserFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const files = await File.findByUserId(userId);

    return res.status(200).json({
      success: true,
      data: {
        files: files.map(file => ({
          id: file.id,
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          status: file.status,
          created_at: file.created_at
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user files:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: error.message
    });
  }
};

