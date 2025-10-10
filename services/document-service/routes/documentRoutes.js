

// backend/routes/documentRoutes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();

const controller = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const { checkDocumentUploadLimits } = require('../middleware/checkTokenLimits'); // Middleware enforces plan limits automatically

const upload = multer({ storage: multer.memoryStorage() });

// =========================
// Document Routes
// =========================

// Batch Upload & processing for large documents
// router.post(
//     '/batch-upload',
//     protect,
//     checkDocumentUploadLimits, // Dynamically enforces limits from DB/plan
//     upload.any('document'),
//     controller.batchUploadDocument
// );

router.post(
  "/batch-upload",
  protect,
  checkDocumentUploadLimits,
  upload.array("document", 10), // up to 10 files at once
  controller.batchUploadDocuments
);


// Post-processing analytics
router.post(
    '/analyze',
    protect,
    checkDocumentUploadLimits, // Middleware checks plan limits
    controller.analyzeDocument
);

// Summarize selected chunks (RAG-efficient)
router.post(
    '/summary',
    protect,
    checkDocumentUploadLimits,
    controller.getSummary
);

// Chat with the document (RAG)
router.post(
    '/chat',
    protect,
    checkDocumentUploadLimits,
    controller.chatWithDocument
);

// Save edited (docx + pdf variants)
router.post(
    '/save',
    protect,
    checkDocumentUploadLimits,
    controller.saveEditedDocument
);

// Download edited variants via signed URL (read-only, no token used)
router.get(
    '/download/:file_id/:format',
    protect,
    controller.downloadDocument
);

// Chat history for a document (read-only)
router.get(
    '/chat-history/:file_id',
    protect,
    controller.getChatHistory
);

// Processing status (read-only)
router.get(
    '/status/:file_id',
    protect,
    controller.getDocumentProcessingStatus
);

// Fetch user usage and plan info (read-only)
router.get(
    '/user-usage-and-plan/:userId',
    protect,
    controller.getUserUsageAndPlan
);

module.exports = router;
