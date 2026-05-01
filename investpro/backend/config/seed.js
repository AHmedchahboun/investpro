require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { Wallet } = require('../models/Wallet');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
    }

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      existing.email = adminEmail;
      existing.password = adminPassword;
      existing.isAdmin = true;
      existing.isFrozen = false;
      existing.frozenReason = '';
      await existing.save();
      await Wallet.findOneAndUpdate(
        { user: existing._id },
        { $setOnInsert: { user: existing._id } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      console.log('Admin updated:', adminEmail);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: adminPassword,
      isAdmin: true,
      vipLevel: -1,
    });

    try {
      await Wallet.create({ user: admin._id });
    } catch (e) {
      await User.deleteOne({ _id: admin._id }).catch(() => {});
      throw e;
    }

    console.log('Admin created:', adminEmail);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seed();
