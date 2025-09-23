
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fileController = require("../controllers/FileController");
const authMiddleware = require("../middleware/auth"); // Import auth middleware

const upload = multer({ storage: multer.memoryStorage() });

// Create folder
router.post("/create-folder", authMiddleware.protect, fileController.createFolder);

// Upload multiple docs to folder
router.post("/:folderName/upload", authMiddleware.protect, upload.array("files", 10), fileController.uploadDocuments);

// Generate & store folder summary
router.get("/:folderName/summary", authMiddleware.protect, fileController.getFolderSummary);

// Get file processing status (individual file)
router.get("/status/:file_id", authMiddleware.protect, fileController.getFileProcessingStatus);

// NEW ROUTES - Get folder processing status (all documents in folder)
router.get("/:folderName/status", authMiddleware.protect, fileController.getFolderProcessingStatus);

// NEW ROUTES - Query documents in folder (like Claude AI project modules)
router.post("/:folderName/query", authMiddleware.protect, fileController.queryFolderDocuments);

module.exports = router;