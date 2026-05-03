const router = require('express').Router();
const User = require('../models/User');
const { Wallet, Transaction, Notification } = require('../models/Wallet');
const { PLATFORM_WALLETS, PAYMENT_METHODS } = require('../config/vipConfig');
const { generalLimit, protect } = require('../middleware');
const { getHourlyProfitStatus } = require('../jobs/rewards');

function buildWalletSummary(wallet, txs = []) {
  const counted = txs.filter(tx =>
    tx.status === 'approved' || (tx.type === 'withdraw' && tx.status === 'pending')
  );
  const sum = (types) => counted
    .filter(tx => types.includes(tx.type))
    .reduce((total, tx) => total + (Number(tx.amount) || 0), 0);

  const totalDeposited = sum(['deposit', 'admin_credit']);
  const totalEarned = sum([
    'daily_profit', 'daily_bonus', 'training_reward',
    'referral_l1', 'referral_l2', 'referral_l3', 'signup_bonus',
  ]);
  const totalWithdrawn = sum(['withdraw']);
  const totalDebits = sum(['withdraw', 'vip_purchase', 'admin_debit']);
  const balance = Math.max(0, totalDeposited - totalDebits + totalEarned);

  return {
    ...(wallet ? wallet.toObject() : {}),
    balance,
    totalDeposited,
    totalWithdrawn,
    totalEarned,
    availableProfit: wallet?.availableProfit || 0,
    frozenProfit: wallet?.frozenProfit || 0,
  };
}

/* GET /api/health — lightweight connection check (no DB) */
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', ts: Date.now() });
});

router.get('/notifications', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    const unreadCount = await Notification.countDocuments({ user: req.user._id, readAt: null });
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/notifications/read', protect, async (req, res) => {
  try {
    const { id, all } = req.body || {};
    const filter = { user: req.user._id, readAt: null };
    if (!all) {
      if (!id) return res.status(400).json({ success: false, message: 'معرف الإشعار مطلوب' });
      filter._id = id;
    }
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/system/dashboard — unified dashboard data (reduces 4 requests → 1) */
router.get('/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const hourlyProfit = await getHourlyProfitStatus(userId);
    const [wallet, vipStatus, txs] = await Promise.all([
      Wallet.findOne({ user: userId }),
      require('../models/User').findById(userId).select('vipLevel vipActivatedAt vipExpiresAt vipLastHourlyRewardAt trainingDaysLeft isActive'),
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(100),
    ]);

    res.json({
      success: true,
      wallet: buildWalletSummary(wallet, txs),
      vip: {
        vipLevel:        vipStatus?.vipLevel ?? -1,
        vipExpiresAt:    vipStatus?.vipExpiresAt,
        daysLeft:        typeof vipStatus?.vipDaysLeft === 'function' ? vipStatus.vipDaysLeft() : 0,
        trainingDaysLeft: vipStatus?.trainingDaysLeft ?? 0,
        isActive:        typeof vipStatus?.isVipActive === 'function' ? vipStatus.isVipActive() : false,
        hourlyProfit,
      },
      hourlyProfit,
      transactions: txs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/system/wallets — official deposit addresses */
router.get('/wallets', generalLimit, (req, res) => {
  res.json({ success: true, wallets: PLATFORM_WALLETS, methods: PAYMENT_METHODS });
});

/* GET /api/system/stats — public platform statistics */
router.get('/stats', generalLimit, async (req, res) => {
  try {
    // Input validation: stats endpoint doesn't accept query parameters
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }

    const [
      totalUsers,
      activeVips,
      totalDepositResult,
      totalWithdrawResult,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ vipLevel: { $gte: 1 }, vipExpiresAt: { $gt: new Date() } }),
      Transaction.aggregate([
        { $match: { type: 'deposit', status: 'approved' } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdraw', status: 'approved' } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
    ]);

    // Helper to handle empty aggregation results gracefully
    const getSum = (result) => (result && result.length > 0) ? result[0].sum : 0;

    res.json({
      success: true,
      totalUsers,
      activeInvestors: activeVips,
      totalDeposits:   getSum(totalDepositResult),
      totalWithdrawals: getSum(totalWithdrawResult),
      status: 'Online',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/system/activity — anonymized recent transactions */
router.get('/activity', generalLimit, async (req, res) => {
  try {
    // Input validation: activity endpoint doesn't accept query parameters
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }
    const txs = await Transaction.find({
      type: { $in: ['deposit', 'withdraw'] },
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name');

    const feed = txs.map(t => {
      const name = t.user?.name || 'مستخدم';
      // Anonymize: show first + last char only
      const anon = name.length > 2
        ? name[0] + '*'.repeat(Math.min(name.length - 2, 4)) + name[name.length - 1]
        : name[0] + '*';
      return {
        type:      t.type,
        amount:    t.amount,
        username:  anon,
        createdAt: t.createdAt,
      };
    });

    res.json({ success: true, activities: feed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
