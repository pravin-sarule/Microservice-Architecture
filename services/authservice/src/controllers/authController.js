

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const { generateToken } = require('../utils/jwt');

/**
 * @description Registers a new user in the system.
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      auth_type: 'manual',
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
      },
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Logs in a user with provided email and password.
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AuthController] Attempting login for email: ${email}`);

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      console.log(`[AuthController] User not found for email: ${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log(`[AuthController] User found: ${user.email}`);

    if (user.is_blocked === true) {
      return res.status(403).json({ message: 'You are blocked for policy violations.' });
    }

    if (!user.password) {
      console.log(`[AuthController] User ${user.email} has no password (social login).`);
      return res.status(400).json({ message: 'Invalid credentials or account created via social login' });
    }
    console.log(`[AuthController] Comparing password for user: ${user.email}`);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[AuthController] Password mismatch for user: ${user.email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    console.log(`[AuthController] Password matched for user: ${user.email}`);

    const token = generateToken(user);

    console.log(`[AuthController] Creating session for user: ${user.id}`);
    await Session.create({ user_id: user.id, token });
    console.log(`[AuthController] Session created for user: ${user.id}`);

    res.status(200).json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
      },
    });
  } catch (error) {
    console.error('[AuthController] Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Updates the profile information for the authenticated user.
 * @route PUT /api/auth/update
 */
const updateProfile = async (req, res) => {
  const { fullname, email, password, phone, location } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateFields = {};
    if (fullname) updateFields.username = fullname;
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      updateFields.email = email;
    }
    if (password) {
      updateFields.password = await bcrypt.hash(password, 10);
    }
    if (phone) updateFields.phone = phone;
    if (location) updateFields.location = location;

    const updatedUser = await User.update(userId, updateFields);

    res.status(200).json({ message: 'Profile updated successfully', user: { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, role: updatedUser.role, is_blocked: updatedUser.is_blocked, phone: updatedUser.phone, location: updatedUser.location } });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Deletes the authenticated user's account.
 * @route DELETE /api/auth/delete
 */
const deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.delete();

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Logs out the authenticated user by deleting their session token.
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    if (token) {
      await Session.deleteByToken(token);
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Fetches the profile details of the authenticated user.
 * @route GET /api/auth/profile
 */
const fetchProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User profile fetched successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        phone: user.phone,
        location: user.location,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Fetches a user by their ID.
 * @route GET /api/users/:userId
 */
const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User fetched successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        phone: user.phone,
        location: user.location,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * @description Updates the Razorpay customer ID for a user.
 * @route PUT /api/users/:id/razorpay-customer-id
 */
const updateRazorpayCustomerId = async (req, res) => {
  const { id } = req.params;
  const { razorpay_customer_id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.update(id, { razorpay_customer_id });

    res.status(200).json({
      message: 'Razorpay customer ID updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        is_blocked: updatedUser.is_blocked,
        phone: updatedUser.phone,
        location: updatedUser.location,
        razorpay_customer_id: updatedUser.razorpay_customer_id,
      },
    });
  } catch (error) {
    console.error('Error updating Razorpay customer ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, login, updateProfile, deleteAccount, logout, fetchProfile, getUserById, updateRazorpayCustomerId };
