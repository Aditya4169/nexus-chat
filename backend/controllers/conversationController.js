const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * Create a new direct conversation or return existing one
 * - Checks if a direct conversation already exists between the two users
 * - If yes, returns it (200)
 * - If no, creates a new direct conversation with both participants
 */
const createOrGetDirectConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const authenticatedUserId = req.user.id;

    // Validate participantId is provided
    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required.' });
    }

    // Validate that participantId is not the same as authenticated user
    if (participantId === authenticatedUserId) {
      return res.status(400).json({ message: 'Cannot create a conversation with yourself.' });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found.' });
    }

    // Check if direct conversation already exists between both users
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [authenticatedUserId, participantId] }
    }).populate('participants', 'username profilePicture status').populate('lastMessage');

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    // Create new direct conversation
    const newConversation = new Conversation({
      type: 'direct',
      participants: [authenticatedUserId, participantId],
      unreadCounts: [
        { user: authenticatedUserId, count: 0 },
        { user: participantId, count: 0 }
      ]
    });

    await newConversation.save();
    await newConversation.populate('participants', 'username profilePicture status');

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create or get direct conversation error:', error.message);
    res.status(500).json({ message: 'An error occurred while creating or retrieving the conversation.' });
  }
};

/**
 * Create a new group conversation
 * - Validates groupName and participantIds are provided
 * - Ensures at least 2 other members (besides authenticated user) are included
 * - Creates conversation with authenticated user as groupAdmin
 * - Initializes unreadCounts for all participants
 */
const createGroupConversation = async (req, res) => {
  try {
    const { groupName, participantIds } = req.body;
    const authenticatedUserId = req.user.id;

    // Validate groupName is provided
    if (!groupName || groupName.trim() === '') {
      return res.status(400).json({ message: 'Group name is required.' });
    }

    // Validate participantIds is an array with at least 2 members (besides authenticated user)
    if (!Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({ message: 'At least 2 participants (besides you) are required to create a group.' });
    }

    // Ensure authenticated user is not in participantIds (will be added separately)
    const filteredParticipantIds = participantIds.filter(id => id !== authenticatedUserId);
    if (filteredParticipantIds.length !== participantIds.length) {
      return res.status(400).json({ message: 'You cannot be included in the participantIds list.' });
    }

    // Verify all participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      return res.status(404).json({ message: 'One or more participants not found.' });
    }

    // Create conversation with authenticated user + all participantIds
    const allParticipants = [authenticatedUserId, ...participantIds];
    const unreadCounts = allParticipants.map(userId => ({
      user: userId,
      count: 0
    }));

    const newConversation = new Conversation({
      type: 'group',
      groupName: groupName.trim(),
      groupAdmin: authenticatedUserId,
      participants: allParticipants,
      unreadCounts
    });

    await newConversation.save();
    await newConversation.populate('participants', 'username profilePicture status');

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create group conversation error:', error.message);
    res.status(500).json({ message: 'An error occurred while creating the group conversation.' });
  }
};

/**
 * Get all conversations for the authenticated user
 * - Finds all conversations where user is a participant
 * - Populates participant details (username, profilePicture, status)
 * - Populates last message details
 * - Sorts by most recently updated first
 */
const getUserConversations = async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;

    // Find all conversations where user is a participant, sorted by most recent first
    const conversations = await Conversation.find({
      participants: authenticatedUserId
    })
      .populate('participants', 'username profilePicture status')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username' }
      })
      .sort({ updatedAt: -1 });

    console.log('[DEBUG Backend] getUserConversations for user', authenticatedUserId, ':', conversations.map(c => ({
      id: c._id,
      type: c.type,
      name: c.type === 'group' ? c.groupName : 'DM',
      unreadCounts: c.unreadCounts
    })));

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Get user conversations error:', error.message);
    res.status(500).json({ message: 'An error occurred while retrieving conversations.' });
  }
};

/**
 * Mark a conversation as read for the authenticated user
 * - Resets the unreadCount for the authenticated user to 0
 * - Returns the updated conversation with all details
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const authenticatedUserId = req.user.id;

    console.log('[DEBUG Backend] markConversationAsRead called:', { conversationId, authenticatedUserId });

    // Validate conversationId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversation ID.' });
    }

    // Find conversation and check if user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    console.log('[DEBUG Backend] Before update, conversation unreadCounts:', conversation.unreadCounts);

    if (!conversation.participants.includes(new mongoose.Types.ObjectId(authenticatedUserId))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Reset unread count for authenticated user
    const authenticatedUserObjId = new mongoose.Types.ObjectId(authenticatedUserId);
    let unreadEntry = conversation.unreadCounts.find(entry =>
      entry.user && entry.user.equals(authenticatedUserObjId)
    );

    // If entry doesn't exist, create it (defensive coding for edge case)
    if (!unreadEntry) {
      console.log('[DEBUG Backend] unreadEntry not found, creating new one');
      conversation.unreadCounts.push({
        user: authenticatedUserObjId,
        count: 0
      });
    } else {
      console.log('[DEBUG Backend] unreadEntry found, setting count to 0');
      unreadEntry.count = 0;
    }

    await conversation.save();

    // Re-fetch with proper population after save
    const updatedConversation = await Conversation.findById(conversationId)
      .populate('participants', 'username profilePicture status')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username' }
      });

    console.log('[DEBUG Backend] After update, conversation unreadCounts:', updatedConversation.unreadCounts);

    res.status(200).json(updatedConversation);
  } catch (error) {
    console.error('Mark conversation as read error:', error.message);
    res.status(500).json({ message: 'An error occurred while marking the conversation as read.' });
  }
};

module.exports = {
  createOrGetDirectConversation,
  createGroupConversation,
  getUserConversations,
  markConversationAsRead
};
