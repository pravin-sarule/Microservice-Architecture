const express = require('express');
const router = express.Router();
const InfographicController = require('../controllers/infographicController');
const { protect } = require('../middlewares/auth');

/**
 * Infographic Generation Routes
 * All routes require authentication via JWT token
 */

// Generate infographic asynchronously (recommended for production)
// Returns job_id immediately, poll /status/:job_id for progress
router.post('/generate', protect, InfographicController.generateInfographic);

// Generate infographic synchronously (for testing)
// Waits for completion before responding (15-30 seconds)
router.post('/generate-sync', protect, InfographicController.generateInfographicSync);

// Get job status
// Poll this endpoint every 2-3 seconds to check progress
router.get('/status/:job_id', protect, InfographicController.getJobStatus);

module.exports = router;


