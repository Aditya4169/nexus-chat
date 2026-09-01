const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Register a new user
 * - Validates all required fields are provided
 * - Checks for existing user (email or username)
 * - Creates new user with hashed password
 * - Returns JWT token valid for 7 days
 */
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate all fields are provided
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    // Check if user with same email or username already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'Email' : 'Username';
      return res.status(409).json({ message: `${field} is already in use.` });
    }

    // Create new user (password is hashed by User model's pre-save hook)
    const newUser = new User({ username, email: email.toLowerCase(), password });
    await newUser.save();

    // Generate JWT token valid for 7 days
    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and safe user data (no password)
    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePicture: newUser.profilePicture
      }
    });
  } catch (error) {
    // Log actual error server-side, return generic message to client
    console.error('Registration error:', error.message);
    res.status(500).json({ message: 'An error occurred during registration. Please try again later.' });
  }
};

/**
 * Login an existing user
 * - Validates both email and password are provided
 * - Checks user exists by email
 * - Compares provided password with stored hash
 * - Generates JWT and updates user status to 'online'
 * - Returns token and safe user data
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate both fields are provided
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic message for security (don't reveal if email or password is wrong)
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Compare provided password with stored hash using bcryptjs
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Update user status to online
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    // Generate JWT token valid for 7 days
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and safe user data (no password)
    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    // Log actual error server-side, return generic message to client
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'An error occurred during login. Please try again later.' });
  }
};

module.exports = { registerUser, loginUser };
