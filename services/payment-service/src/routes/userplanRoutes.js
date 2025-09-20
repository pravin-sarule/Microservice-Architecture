const express = require('express');
const router = express.Router();

// Import the controller function for users
const {
    getAllPlans,
} = require('../controllers/userplanController');

// @route   GET /api/plans
// @desc    Get all public plans (with optional filtering via query params)
// @access  Public

module.exports = router;
