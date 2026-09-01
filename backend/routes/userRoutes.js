const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getMe, searchUsers } = require('../controllers/userController');

const router = express.Router();

// GET /api/users/search - Search users for new conversations
// Keep this before any future /:id route so "search" is not treated like an id.
router.get('/search', authMiddleware, searchUsers);

// GET /api/users/me - Get authenticated user's profile (protected by authMiddleware)
router.get('/me', authMiddleware, getMe);

module.exports = router;
