require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { Wallet } = require('../models/Wallet');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (existing) {
      console.log('Admin already exists:', process.env.ADMIN_EMAIL);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      isAdmin: true,
      vipLevel: -1,
    });

    try {
      await Wallet.create({ user: admin._id });
    } catch (e) {
      await User.deleteOne({ _id: admin._id }).catch(() => {});
      throw e;
    }

    console.log('Admin created:', process.env.ADMIN_EMAIL);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seed();
