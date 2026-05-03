const mongoose = require('mongoose');

// ── Wallet ──────────────────────────────────────────────────────────────────
const walletSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  balance:          { type: Number, default: 0 },
  totalDeposited:   { type: Number, default: 0 },
  totalWithdrawn:   { type: Number, default: 0 },
  totalEarned:      { type: Number, default: 0 },  // profits + bonuses
  totalBonus:       { type: Number, default: 0 },  // daily bonus only
  availableProfit:  { type: Number, default: 0 },
  frozenProfit:     { type: Number, default: 0 },
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

const hourlyProfitSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName:   { type: String },
  vipLevel:   { type: Number, required: true },
  planName:   { type: String, required: true },
  amount:     { type: Number, required: true },
  cycleStart: { type: Date, required: true },
  eligibleAt: { type: Date, required: true, index: true },
  status:     { type: String, enum: ['frozen', 'available', 'withdrawn'], default: 'frozen', index: true },
  transaction:{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  withdrawTx: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  timezone:   { type: String, default: 'Africa/Casablanca' },
}, { timestamps: true });

hourlyProfitSchema.index({ user: 1, cycleStart: 1 }, { unique: true });
hourlyProfitSchema.index({ user: 1, status: 1, eligibleAt: -1 });

const notificationSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:      { type: String, required: true, trim: true, maxlength: 120 },
  message:    { type: String, required: true, trim: true, maxlength: 800 },
  category:   {
    type: String,
    enum: ['system', 'profit', 'deposit', 'withdraw', 'referral', 'vip', 'support'],
    default: 'system',
  },
  priority:   { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
  audience:   { type: String, default: 'custom' },
  readAt:     { type: Date },
}, { timestamps: true });

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

const Wallet      = mongoose.model('Wallet',      walletSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const AuditLog    = mongoose.model('AuditLog',    auditLogSchema);
const HourlyProfit = mongoose.model('HourlyProfit', hourlyProfitSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Wallet, Transaction, AuditLog, HourlyProfit, Notification };
