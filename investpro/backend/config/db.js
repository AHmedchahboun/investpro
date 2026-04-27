const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in .env');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
};

mongoose.connection.on('disconnected', () => console.warn('[DB] MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('[DB] MongoDB error:', err.message));

module.exports = connectDB;
