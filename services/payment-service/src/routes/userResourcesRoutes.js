const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userResourceController = require('../controllers/userResourcesController');

console.log("DEBUG: userResourceController exports:", Object.keys(userResourceController));

router.get('/transactions', protect, userResourceController.getUserTransactions);
router.get('/plan-details', protect, userResourceController.getPlanAndResourceDetails);
router.get('/resource-utilization', protect, userResourceController.getUserResourceUtilization); // Add this new route

module.exports = router;