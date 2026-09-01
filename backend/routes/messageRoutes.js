const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../config/multer');
const { sendMessage, getConversationMessages } = require('../controllers/messageController');

const router = express.Router();

// All routes are protected by authMiddleware

// POST /api/messages -> Send message (with optional file upload)
router.post('/', authMiddleware, upload.single('file'), sendMessage);

// GET /api/messages/:conversationId -> Get messages for a conversation with pagination
router.get('/:conversationId', authMiddleware, getConversationMessages);

module.exports = router;
