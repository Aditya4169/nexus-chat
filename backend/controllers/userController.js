const User = require('../models/User');

/**
 * Get authenticated user's profile information
 * - Retrieves user from database using id attached by authMiddleware
 * - Returns safe user data (no password hash)
 * - Called after authMiddleware has verified JWT
 */
const getMe = async (req, res) => {
  try {
    // authMiddleware attaches decoded user object to req.user
    const userId = req.user.id;

    // Fetch user by id, explicitly exclude password field
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Return safe user data
    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        status: user.status,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    // Log actual error server-side, return generic message to client
    console.error('Get profile error:', error.message);
    res.status(500).json({ message: 'An error occurred while retrieving user profile.' });
  }
};

/**
 * Search users by username or email for starting conversations.
 * - Empty queries intentionally return no results instead of broad searches
 * - Results exclude the authenticated user and only include safe profile fields
 */
const searchUsers = async (req, res) => {
  try {
    const searchTerm = req.query.q?.trim();

    if (!searchTerm) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .select('username email profilePicture status')
      .limit(10);

    const safeUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      status: user.status
    }));

    return res.status(200).json(safeUsers);
  } catch (error) {
    console.error('Search users error:', error.message);
    return res.status(500).json({ message: 'An error occurred while searching users.' });
  }
};

module.exports = { getMe, searchUsers };
