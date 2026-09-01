const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// In-memory map to track active connections: userId -> socketId
// Ensures only one active connection per user
const activeSockets = new Map();

/**
 * Authenticate socket connection via JWT token
 * Reads token from socket.handshake.auth.token
 * If valid, attaches decoded user id to socket.userId
 * If invalid or missing, rejects the connection
 */
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token is required.'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired authentication token.'));
  }
};

/**
 * Initialize Socket.IO server with all event handlers
 * Called from server.js with the io instance
 */
const initializeSocket = (io) => {
  // Apply authentication middleware to all socket connections
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    try {
      // Check if user already has an active connection
      if (activeSockets.has(userId)) {
        const oldSocketId = activeSockets.get(userId);
        const oldSocket = io.sockets.sockets.get(oldSocketId);

        // Disconnect the old socket to enforce single connection per user
        if (oldSocket) {
          console.log(`[Socket] Disconnecting old connection for user ${userId}: ${oldSocketId}`);
          oldSocket.disconnect(true);
        }
      }

      // Register the new socket connection
      activeSockets.set(userId, socket.id);
      console.log(`[Socket] User ${userId} connected with socket ${socket.id}`);

      // Update user status to 'online' in MongoDB
      await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });

      // Broadcast user is online to all other connected clients
      socket.broadcast.emit('userOnline', { userId });
    } catch (error) {
      console.error(`[Socket] Error during connection for user ${userId}:`, error.message);
    }

    /**
     * Join a conversation room
     * Allows scoping of events to specific conversations
     */
    socket.on('joinConversation', (conversationId) => {
      try {
        socket.join(conversationId);
        console.log(`[Socket] User ${userId} joined conversation ${conversationId}`);
      } catch (error) {
        console.error(`[Socket] Error joining conversation:`, error.message);
      }
    });

    /**
     * Leave a conversation room
     */
    socket.on('leaveConversation', (conversationId) => {
      try {
        socket.leave(conversationId);
        console.log(`[Socket] User ${userId} left conversation ${conversationId}`);
      } catch (error) {
        console.error(`[Socket] Error leaving conversation:`, error.message);
      }
    });

    /**
     * Broadcast that user is typing
     * Only sent to other participants in the conversation
     */
    socket.on('typing', ({ conversationId }) => {
      try {
        socket.broadcast.to(conversationId).emit('userTyping', { userId, conversationId });
      } catch (error) {
        console.error(`[Socket] Error handling typing event:`, error.message);
      }
    });

    /**
     * Broadcast that user stopped typing
     */
    socket.on('stopTyping', ({ conversationId }) => {
      try {
        socket.broadcast.to(conversationId).emit('userStoppedTyping', { userId, conversationId });
      } catch (error) {
        console.error(`[Socket] Error handling stopTyping event:`, error.message);
      }
    });

    /**
     * Send a message in real-time
     * - Saves message to MongoDB
     * - Updates conversation's lastMessage and timestamps
     * - Increments unreadCounts for other participants
     * - Broadcasts to all participants in the conversation room
     * - Emits messageError back to sender on failure
     */
    socket.on('sendMessage', async ({ conversationId, text, messageType = 'text' }) => {
      try {
        // Validate required fields
        if (!conversationId || !text) {
          return socket.emit('messageError', { message: 'Conversation ID and text are required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          return socket.emit('messageError', { message: 'Invalid conversation ID.' });
        }

        // Verify conversation exists and user is a participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit('messageError', { message: 'Conversation not found.' });
        }

        if (!conversation.participants.includes(new mongoose.Types.ObjectId(userId))) {
          return socket.emit('messageError', { message: 'Access denied.' });
        }

        // Create the message
        const newMessage = new Message({
          conversation: conversationId,
          sender: userId,
          text: text.trim(),
          messageType,
          seenBy: [userId] // Sender has already seen their own message
        });

        await newMessage.save();
        await newMessage.populate('sender', 'username profilePicture');

        // Update conversation's lastMessage and timestamps
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();

        // Ensure unreadCounts entries exist for all participants
        const userObjId = new mongoose.Types.ObjectId(userId);
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
              count: participantId.equals(userObjId) ? 0 : 1
            });
          }
        });

        // Increment unreadCounts for all participants except the sender
        conversation.unreadCounts.forEach(unreadEntry => {
          if (unreadEntry.user && !unreadEntry.user.equals(userObjId)) {
            unreadEntry.count += 1;
          }
        });

        await conversation.save();

        // Broadcast the new message to all participants in the conversation
        // (including the sender so all their open tabs/devices stay in sync)
        io.to(conversationId).emit('newMessage', newMessage);
      } catch (error) {
        console.error(`[Socket] Error sending message:`, error.message);
        socket.emit('messageError', { message: 'An error occurred while sending the message.' });
      }
    });

    /**
     * Edit an existing message
     * - Verifies the requester is the original sender
     * - Updates message text and sets editedAt timestamp
     * - Broadcasts messageUpdated event to the conversation room
     */
    socket.on('editMessage', async ({ messageId, newText, conversationId }) => {
      try {
        if (!messageId || !newText || !conversationId) {
          return socket.emit('messageError', { message: 'Message ID, new text, and conversation ID are required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit('messageError', { message: 'Invalid message ID.' });
        }

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('messageError', { message: 'Message not found.' });
        }

        // Verify the requester is the original sender
        if (!message.sender.equals(new mongoose.Types.ObjectId(userId))) {
          return socket.emit('messageError', { message: 'Access denied.' });
        }

        // Update message text and set editedAt
        message.text = newText.trim();
        message.editedAt = new Date();
        await message.save();
        await message.populate('sender', 'username profilePicture');

        // Broadcast the updated message to all participants in the conversation
        io.to(conversationId).emit('messageUpdated', message);
      } catch (error) {
        console.error(`[Socket] Error editing message:`, error.message);
        socket.emit('messageError', { message: 'An error occurred while editing the message.' });
      }
    });

    /**
     * Delete a message
     * - Verifies the requester is the original sender
     * - Deletes the message from database
     * - Broadcasts messageDeleted event with messageId to the conversation room
     */
    socket.on('deleteMessage', async ({ messageId, conversationId }) => {
      try {
        if (!messageId || !conversationId) {
          return socket.emit('messageError', { message: 'Message ID and conversation ID are required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit('messageError', { message: 'Invalid message ID.' });
        }

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('messageError', { message: 'Message not found.' });
        }

        // Verify the requester is the original sender
        if (!message.sender.equals(new mongoose.Types.ObjectId(userId))) {
          return socket.emit('messageError', { message: 'Access denied.' });
        }

        // Delete the message
        await Message.findByIdAndDelete(messageId);

        // Broadcast the deletion to all participants in the conversation
        io.to(conversationId).emit('messageDeleted', { messageId });
      } catch (error) {
        console.error(`[Socket] Error deleting message:`, error.message);
        socket.emit('messageError', { message: 'An error occurred while deleting the message.' });
      }
    });

    /**
     * Mark a message as read by the current user
     * - Adds the userId to the message's seenBy array if not already present
     * - Emits messageRead event specifically to the message's original sender
     *   (not the whole room, so read receipts are direct)
     */
    socket.on('markMessageAsRead', async ({ messageId, conversationId }) => {
      try {
        if (!messageId || !conversationId) {
          return socket.emit('messageError', { message: 'Message ID and conversation ID are required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit('messageError', { message: 'Invalid message ID.' });
        }

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('messageError', { message: 'Message not found.' });
        }

        // Add userId to seenBy array if not already present
        const userObjectId = new mongoose.Types.ObjectId(userId);
        if (!message.seenBy.some(id => id.equals(userObjectId))) {
          message.seenBy.push(userObjectId);
          await message.save();
        }

        // Emit messageRead event to the sender specifically (via their socket)
        const senderSocketId = activeSockets.get(message.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('messageRead', { messageId, userId });
        }
      } catch (error) {
        console.error(`[Socket] Error marking message as read:`, error.message);
      }
    });

    /**
     * Handle socket disconnection
     * - Removes user from activeSockets (only if the socket id matches)
     * - Updates user status to 'offline' and lastSeen in MongoDB
     * - Broadcasts userOffline event to other clients
     * - Logs disconnect reason for debugging
     */
    socket.on('disconnect', async (reason) => {
      try {
        // Only remove from activeSockets if this socket is still the active one for the user
        if (activeSockets.get(userId) === socket.id) {
          activeSockets.delete(userId);

          // Update user status to offline in MongoDB
          await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() });

          // Broadcast user is offline to all other connected clients
          socket.broadcast.emit('userOffline', { userId });
        }

        console.log(`[Socket] User ${userId} disconnected. Reason: ${reason}`);
      } catch (error) {
        console.error(`[Socket] Error during disconnection for user ${userId}:`, error.message);
      }
    });
  });
};

module.exports = { initializeSocket };
