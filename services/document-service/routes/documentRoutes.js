

// backend/routes/documentRoutes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();

const controller = require('../controllers/documentController');
const { protect } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });


// Batch Upload & processing for large documents
router.post('/batch-upload', protect, upload.single('document'), controller.batchUploadDocument);

// Post-processing analytics
router.post('/analyze', protect, controller.analyzeDocument);

// Summarize selected chunks (RAG-efficient)
router.post('/summary', protect, controller.getSummary);

// Chat with the document (RAG)
router.post('/chat', protect, controller.chatWithDocument);

// Save edited (docx + pdf variants)
router.post('/save', protect, controller.saveEditedDocument);

// Download edited variants via signed URL
router.get('/download/:file_id/:format', protect, controller.downloadDocument);

// Chat history for a document
router.get('/chat-history/:file_id', protect, controller.getChatHistory);

// Processing status
router.get('/status/:file_id', protect, controller.getDocumentProcessingStatus);

module.exports = router;
