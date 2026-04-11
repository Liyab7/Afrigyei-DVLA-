const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Record = require('../models/Record');
const adminAuth = require('../middleware/adminAuth');
const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and PIN are required.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Not an admin account.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Verify admin token
router.get('/verify', adminAuth, (req, res) => {
  res.json({ username: req.user.username, role: 'admin' });
});

// Get all pending users
router.get('/users/pending', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ isApproved: false, role: 'user' }, 'username createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching pending users.' });
  }
});

// Get all approved users
router.get('/users/approved', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ isApproved: true, role: 'user' }, 'username createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching approved users.' });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }, 'username isApproved createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// Approve a user
router.patch('/users/:id/approve', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: `User "${user.username}" approved successfully.`, user: { _id: user._id, username: user.username, isApproved: user.isApproved } });
  } catch (err) {
    res.status(500).json({ message: 'Server error approving user.' });
  }
});

// Reject (delete) a user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin accounts.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: `User "${user.username}" has been removed.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error removing user.' });
  }
});

// Revoke user approval
router.patch('/users/:id/revoke', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: `User "${user.username}" access revoked.`, user: { _id: user._id, username: user.username, isApproved: user.isApproved } });
  } catch (err) {
    res.status(500).json({ message: 'Server error revoking user.' });
  }
});

// Dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalUsers, pendingUsers, approvedUsers, totalRecords, activeRecords] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ isApproved: false, role: 'user' }),
      User.countDocuments({ isApproved: true, role: 'user' }),
      Record.countDocuments(),
      Record.countDocuments({ status: 'active' })
    ]);

    // Expiring within 7 days
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const threshold = new Date(today);
    threshold.setDate(today.getDate() + 7);
    const thresholdStr = threshold.toISOString().slice(0, 10);

    const expiringCount = await Record.countDocuments({
      status: 'active',
      expiryDate: { $gte: todayStr, $lte: thresholdStr }
    });

    res.json({
      totalUsers,
      pendingUsers,
      approvedUsers,
      totalRecords,
      activeRecords,
      expiringCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
});

// Get expiring records for admin
router.get('/expiring', adminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const threshold = new Date(today);
    threshold.setDate(today.getDate() + days);
    const thresholdStr = threshold.toISOString().slice(0, 10);

    const records = await Record.find({
      status: 'active',
      expiryDate: { $gte: todayStr, $lte: thresholdStr }
    }).sort({ expiryDate: 1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching expiring records.' });
  }
});

module.exports = router;
