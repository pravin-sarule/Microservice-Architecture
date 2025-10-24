
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fileController = require("../controllers/FileController");
const authMiddleware = require("../middleware/auth"); // Import auth middleware
const { checkDocumentUploadLimits } = require("../middleware/checkTokenLimits"); // Import the new middleware

const upload = multer({ storage: multer.memoryStorage() });

// Create folder
router.post("/create-folder", authMiddleware.protect, fileController.createFolder);
router.post("/create", authMiddleware.protect, fileController.createCase);
router.delete("/cases/:caseId", authMiddleware.protect, fileController.deleteCase);
router.put("/cases/:caseId", authMiddleware.protect, fileController.updateCase);
router.get("/cases/:caseId", authMiddleware.protect, fileController.getCase);


// Get all folders for a user
router.get("/folders", authMiddleware.protect, fileController.getFolders);

// Get all cases for a user
router.get("/cases", authMiddleware.protect, fileController.getAllCases);

// Upload multiple docs to folder
router.post("/:folderName/upload", authMiddleware.protect, checkDocumentUploadLimits, upload.array("files", 10), fileController.uploadDocuments);

// Generate & store folder summary
router.get("/:folderName/summary", authMiddleware.protect, fileController.getFolderSummary);

// Get file processing status (individual file)
router.get("/status/:file_id", authMiddleware.protect, fileController.getFileProcessingStatus);

// NEW ROUTES - Get folder processing status (all documents in folder)
router.get("/:folderName/status", authMiddleware.protect, fileController.getFolderProcessingStatus);

// NEW ROUTES - Query documents in folder (like Claude AI project modules)
router.post("/:folderName/query", authMiddleware.protect, fileController.queryFolderDocuments);


// ============ NEW CHAT SESSION ROUTES ============
// Get all chat sessions for a folder (with previews and metadata)
router.get("/:folderName/sessions", authMiddleware.protect, fileController.getFolderChatSessions);

// Get specific chat session with complete conversation history (reopen session)
router.get("/:folderName/sessions/:sessionId", authMiddleware.protect, fileController.getFolderChatSessionById);

// Continue conversation in existing chat session (add new message)
router.post("/:folderName/sessions/:sessionId/continue", authMiddleware.protect, fileController.continueFolderChat);

// Delete entire chat session
router.delete("/:folderName/sessions/:sessionId", authMiddleware.protect, fileController.deleteFolderChatSession);

router.get("/:folderName/chats", authMiddleware.protect, fileController.getFolderChatsByFolder);
module.exports = router;