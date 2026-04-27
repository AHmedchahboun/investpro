const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false, minlength: 8 },

  // VIP state
  vipLevel:          { type: Number, default: -1 },  // -1=none, 0=training, 1-4=paid
  vipActivatedAt:    { type: Date },
  vipExpiresAt:      { type: Date },
  trainingDaysLeft:  { type: Number, default: 0 },
  trainingCompleted: { type: Boolean, default: false },

  // Referral chain (L1 + L2 + L3)
  referralCode: { type: String, unique: true, uppercase: true },
  referredBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // L1
  referredByL2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // L2
  referredByL3: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // L3

  isAdmin:      { type: Boolean, default: false },
  isFrozen:     { type: Boolean, default: false },
  frozenReason: { type: String },

  // Password reset (token stored server-side, never sent to client)
  resetToken:       { type: String, select: false },
  resetTokenExpiry: { type: Date,   select: false },

  // Bonus Steps (Total $1.50)
  bonusSteps: {
    registered: { type: Boolean, default: true }, // Always true on creation
    joinedTelegram: { type: Boolean, default: false },
    completedFirstTask: { type: Boolean, default: false }
  },
  lastRewardDate: { type: String }, // Format: YYYY-MM-DD
}, { timestamps: true });

// Auto-generate referral code + hash password
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (await mongoose.model('User').exists({ referralCode: code }));
    this.referralCode = code;
  }
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.isVipActive = function () {
  if (this.vipLevel === 0) return this.trainingDaysLeft > 0;
  if (this.vipLevel >= 1) return this.vipExpiresAt && this.vipExpiresAt > new Date();
  return false;
};

userSchema.methods.vipDaysLeft = function () {
  if (this.vipLevel === 0) return this.trainingDaysLeft;
  if (this.vipLevel >= 1 && this.vipExpiresAt) {
    return Math.max(0, Math.ceil((this.vipExpiresAt - Date.now()) / 86400000));
  }
  return 0;
};

module.exports = mongoose.model('User', userSchema);
