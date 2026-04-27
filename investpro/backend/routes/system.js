const router = require('express').Router();
const User = require('../models/User');
const { Transaction } = require('../models/Wallet');
const { PLATFORM_WALLETS, PAYMENT_METHODS } = require('../config/vipConfig');
const { generalLimit } = require('../middleware');

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
