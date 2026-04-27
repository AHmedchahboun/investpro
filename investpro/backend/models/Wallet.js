const mongoose = require('mongoose');

// ── Wallet ──────────────────────────────────────────────────────────────────
const walletSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  balance:          { type: Number, default: 0 },
  totalDeposited:   { type: Number, default: 0 },
  totalWithdrawn:   { type: Number, default: 0 },
  totalEarned:      { type: Number, default: 0 },  // profits + bonuses
  totalBonus:       { type: Number, default: 0 },  // daily bonus only
  pendingWithdraw:  { type: Number, default: 0 },
}, { timestamps: true });

// ── Transaction ──────────────────────────────────────────────────────────────
const transactionSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:   {
    type: String,
    enum: [
      'deposit',
      'withdraw',
      'daily_profit',    // main plan return
      'daily_bonus',     // flat daily bonus
      'training_reward', // training plan daily
      'vip_purchase',
      'referral_l1',
      'referral_l2',
      'referral_l3',
      'signup_bonus',
      'admin_credit',
      'admin_debit',
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },
  amount:        { type: Number, required: true },
  fee:           { type: Number, default: 0 },
  netAmount:     { type: Number },
  paymentMethod: { type: String },
  txHash:        { type: String, unique: true, sparse: true },
  toAddress:     { type: String },
  fromAddress:   { type: String },
  adminNote:     { type: String },
  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:    { type: Date },
  note:          { type: String },
}, { timestamps: true });

transactionSchema.index({ user: 1, type: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

// ── AuditLog ─────────────────────────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema({
  admin:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action:   { type: String, required: true },
  details:  { type: mongoose.Schema.Types.Mixed },
  ip:       { type: String },
  severity: { type: String, enum: ['info', 'warn', 'critical'], default: 'info' },
}, { timestamps: true });

const Wallet      = mongoose.model('Wallet',      walletSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const AuditLog    = mongoose.model('AuditLog',    auditLogSchema);

module.exports = { Wallet, Transaction, AuditLog };
