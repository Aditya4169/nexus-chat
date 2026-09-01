const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

/**
 * Send a message (REST fallback; real-time will use Socket.IO later)
 * - Accepts text, messageType, and optional file upload via multer
 * - Validates that either text or file is present
 * - Creates Message document
 * - Updates conversation's lastMessage and updatedAt
 * - Increments unreadCounts for all participants except the sender
 * - Returns created message populated with sender info
 */
const sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    const authenticatedUserId = req.user.id;
    let messageType = req.body.messageType || 'text';
    let fileUrl = '';
    let fileName = '';

    // Validate conversationId is provided and valid
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Valid conversation ID is required.' });
    }

    // Check if conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    if (!conversation.participants.includes(new mongoose.Types.ObjectId(authenticatedUserId))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // If file was uploaded, determine message type and set file details
    if (req.file) {
      fileName = req.file.originalname;
      const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
      const imageMimes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      messageType = imageMimes.includes(fileExtension) ? 'image' : 'file';
      fileUrl = `/uploads/${req.file.filename}`;
    }

    // Validate that either text or file is present
    if (!text && !fileUrl) {
      return res.status(400).json({ message: 'Message must contain either text or a file.' });
    }

    // Create the message
    const newMessage = new Message({
      conversation: conversationId,
      sender: authenticatedUserId,
      text: text || '',
      messageType,
      fileUrl,
      fileName
    });

    await newMessage.save();
    await newMessage.populate('sender', 'username profilePicture');

    // Update conversation's lastMessage and updatedAt
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();

    // Ensure unreadCounts entries exist for all participants
    const authenticatedUserObjId = new mongoose.Types.ObjectId(authenticatedUserId);
    const existingUserIds = new Set(
      conversation.unreadCounts
        .filter(entry => entry.user)
        .map(entry => entry.user.toString())
    );

    // Add missing entries for participants who don't have an unreadCounts entry
    conversation.participants.forEach(participantId => {
      if (!existingUserIds.has(participantId.toString())) {
        conversation.unreadCounts.push({
          user: participantId,
          count: participantId.equals(authenticatedUserObjId) ? 0 : 1
        });
      }
    });

    // Increment unreadCounts for all participants except the sender
    conversation.unreadCounts.forEach(unreadEntry => {
      if (unreadEntry.user && !unreadEntry.user.equals(authenticatedUserObjId)) {
        unreadEntry.count += 1;
      }
    });

    await conversation.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ message: 'An error occurred while sending the message.' });
  }
};

/**
 * Get messages for a conversation with pagination
 * - Accepts conversationId from params
 * - Accepts optional "limit" (default 30) and "before" cursor query params
 * - Returns messages in chronological order (oldest to newest)
 * - Includes { messages, hasMore, nextCursor } for pagination
 */
const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const authenticatedUserId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100); // Max 100 per request
    const before = req.query.before; // Cursor for pagination (message id or timestamp)

    // Validate conversationId is valid
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID.' });
    }

    // Check if conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    if (!conversation.participants.includes(new mongoose.Types.ObjectId(authenticatedUserId))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Build query for messages
    const query = { conversation: conversationId };

    // If cursor is provided, fetch messages before the cursor
    if (before) {
      if (mongoose.Types.ObjectId.isValid(before)) {
        // Cursor is a message ID
        const cursorMessage = await Message.findById(before);
        if (cursorMessage) {
          query.createdAt = { $lt: cursorMessage.createdAt };
        }
      } else {
        // Cursor is a timestamp
        query.createdAt = { $lt: new Date(before) };
      }
    }

    // Fetch limit + 1 messages to determine if there are more
    const messages = await Message.find(query)
      .populate('sender', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    // Determine if there are more messages
    const hasMore = messages.length > limit;
    const paginatedMessages = hasMore ? messages.slice(0, limit) : messages;

    // Calculate next cursor (createdAt of the last message in paginated results)
    let nextCursor = null;
    if (hasMore && paginatedMessages.length > 0) {
      nextCursor = paginatedMessages[paginatedMessages.length - 1].createdAt;
    }

    // Reverse to show in chronological order (oldest to newest)
    paginatedMessages.reverse();

    res.status(200).json({
      messages: paginatedMessages,
      hasMore,
      nextCursor
    });
  } catch (error) {
    console.error('Get conversation messages error:', error.message);
    res.status(500).json({ message: 'An error occurred while retrieving messages.' });
  }
};

module.exports = { sendMessage, getConversationMessages };
