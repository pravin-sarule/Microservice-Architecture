

const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth'); // Import auth middleware
const { protect } = require('../middleware/auth');

const { register, login, updateProfile, deleteAccount, logout, fetchProfile } = require('../controllers/authController');

// Register a new user
router.post('/register', register);

// Login with email & password
router.post('/login', login);



// Update user profile
router.put('/update', protect, updateProfile);

// Delete user account
router.delete('/delete', protect, deleteAccount);

// Logout user
router.post('/logout', protect, logout);

// Fetch user profile
router.get('/profile', protect, fetchProfile);

module.exports = router;
