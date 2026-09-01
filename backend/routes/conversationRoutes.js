const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createOrGetDirectConversation,
  createGroupConversation,
  getUserConversations,
  markConversationAsRead
} = require('../controllers/conversationController');

const router = express.Router();

// All routes are protected by authMiddleware

// POST /api/conversations/direct -> Create or get direct conversation
router.post('/direct', authMiddleware, createOrGetDirectConversation);

// POST /api/conversations/group -> Create group conversation
router.post('/group', authMiddleware, createGroupConversation);

// GET /api/conversations -> Get all conversations for authenticated user
router.get('/', authMiddleware, getUserConversations);

// PATCH /api/conversations/:conversationId/read -> Mark conversation as read
router.patch('/:conversationId/read', authMiddleware, markConversationAsRead);

module.exports = router;
