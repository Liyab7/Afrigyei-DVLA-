const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and PIN are required.' });
    }
    if (username.trim().length < 4) {
      return res.status(400).json({ message: 'Username must be at least 4 characters.' });
    }
    if (!/^\d{4}$/.test(password)) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const user = new User({ username: username.trim(), password, isApproved: false });
    await user.save();

    res.status(201).json({ message: 'Registration successful! Your account is pending admin approval.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and PIN are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or PIN.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or PIN.' });
    }

    if (!user.isApproved && user.role !== 'admin') {
      return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for the admin to approve your access.' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new PIN are required.' });
    }
    if (!/^\d{4}$/.test(newPassword)) {
      return res.status(400).json({ message: 'New PIN must be exactly 4 digits.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(404).json({ message: 'Username not found.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'PIN reset successfully!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error during password reset.' });
  }
});

// Get all usernames (for forgot username)
router.get('/usernames', async (req, res) => {
  try {
    const users = await User.find({}, 'username');
    res.json(users.map(u => u.username));
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Verify token
router.get('/verify', auth, (req, res) => {
  res.json({ username: req.user.username });
});

module.exports = router;
