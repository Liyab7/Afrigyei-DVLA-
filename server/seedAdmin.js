/**
 * Admin Seed Script
 * Run: node seedAdmin.js
 * Creates a default admin user if one doesn't exist.
 */
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const User = require('./models/User');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
      serverSelectionTimeoutMS: 15000
    });
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ username: ADMIN_USERNAME, role: 'admin' });
    if (existing) {
      console.log(`Admin user "${ADMIN_USERNAME}" already exists.`);
    } else {
      const admin = new User({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        role: 'admin',
        isApproved: true
      });
      await admin.save();
      console.log(`Admin user "${ADMIN_USERNAME}" created successfully!`);
      console.log(`Login at /admin with username: ${ADMIN_USERNAME} and PIN: ${ADMIN_PASSWORD}`);
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
