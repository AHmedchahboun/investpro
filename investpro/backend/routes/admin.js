const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const { Wallet, Transaction, AuditLog, HourlyProfit, Notification } = require('../models/Wallet');
const { protect, adminOnly } = require('../middleware');
const { addReferralCommissions, addActivityDepositBonus, runHourlyRewards, getHourlyProfitStatus, notifyAdmin } = require('../jobs/rewards');

router.use(protect, adminOnly);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
/** Escape regex metacharacters to prevent ReDoS attacks */
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cap pagination limit — never return more than MAX_LIMIT rows */
const MAX_LIMIT = 100;
const safeLimit = val => Math.min(Math.max(parseInt(val) || 20, 1), MAX_LIMIT);

/** Validate MongoDB ObjectId */
const isValidId = id => mongoose.Types.ObjectId.isValid(id);

const log = async (admin, action, target, details, req, severity = 'info') => {
  try {
    await AuditLog.create({
      admin: admin._id, target: target || null, action, details,
      ip: req.ip || req.connection.remoteAddress, severity,
    });
  } catch (_) {}
};

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [
      totalUsers, frozenUsers, newToday,
      pendingDeposits, pendingWithdraws,
      totalDepositResult, totalWithdrawResult,
      totalTransactions, activeVips, trainingUsers,
      vipDistribution, refResult, rewardResult,
      nextProfit, dueProfitCount, expiringPlans,
      notificationCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isFrozen: true }),
      User.countDocuments({ createdAt: { $gte: today } }),
      Transaction.countDocuments({ type: 'deposit',  status: 'pending' }),
      Transaction.countDocuments({ type: 'withdraw', status: 'pending' }),
      Transaction.aggregate([{ $match: { type: 'deposit',  status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: 'withdraw', status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      Transaction.countDocuments(),
      User.countDocuments({ vipLevel: { $gte: 1 }, vipExpiresAt: { $gt: new Date() } }),
      User.countDocuments({ vipLevel: 0 }),
      User.aggregate([{ $group: { _id: '$vipLevel', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Transaction.aggregate([{ $match: { type: { $in: ['referral_l1','referral_l2'] } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: { $in: ['daily_profit','daily_bonus','activity_bonus','training_reward'] } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]),
      HourlyProfit.findOne({ status: 'frozen' }).sort({ eligibleAt: 1 }).select('eligibleAt amount userName planName timezone').lean(),
      HourlyProfit.countDocuments({ status: 'frozen', eligibleAt: { $lte: new Date() } }),
      User.countDocuments({ vipLevel: { $gte: 1 }, vipExpiresAt: { $gt: new Date(), $lte: new Date(Date.now() + 3 * 86400000) } }),
      Notification.countDocuments({ createdAt: { $gte: today } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers, frozenUsers, newToday,
        pendingDeposits, pendingWithdraws,
        totalDeposits: totalDepositResult[0]?.sum || 0,
        totalWithdraws: totalWithdrawResult[0]?.sum || 0,
        totalTransactions, activeVips, trainingUsers,
        vipDistribution,
        totalReferralCommissions: refResult[0]?.sum || 0,
        totalRewardsPaid: rewardResult[0]?.sum || 0,
        nextProfit,
        dueProfitCount,
        expiringPlans,
        notificationCount,
        timezone: 'Africa/Casablanca',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/deposits', async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const filter = { type: 'deposit' };
    if (status !== 'all') filter.status = status;
    const total = await Transaction.countDocuments(filter);
    const deposits = await Transaction.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);
    res.json({ success: true, deposits, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/deposits/:id/approve', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    // Atomic update to ensure only one admin can approve this transaction
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, type: 'deposit', status: 'pending' },
      { 
        $set: { 
          status: 'approved', 
          approvedBy: req.user._id, 
          approvedAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!tx) return res.status(400).json({ success: false, message: 'الإيداع غير موجود أو تم معالجته مسبقاً' });

    try {
      let wallet = await Wallet.findOneAndUpdate(
        { user: tx.user },
        {
          $setOnInsert: { user: tx.user },
          $inc: { balance: tx.amount, totalDeposited: tx.amount },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      await addReferralCommissions(tx.user, tx.amount);
      let bonus = { credited: false, amount: 0, reason: 'not_checked' };
      try {
        bonus = await addActivityDepositBonus(tx.user, tx.amount, req.user._id, tx._id, tx.createdAt);
      } catch (bonusErr) {
        console.error('[ActivityBonus] failed:', bonusErr.message);
        bonus = { credited: false, amount: 0, reason: 'error' };
      }
      if (bonus.credited && bonus.wallet) wallet = bonus.wallet;
      const bonusResult = {
        credited: Boolean(bonus.credited),
        amount: bonus.amount || 0,
        reason: bonus.reason,
        transactionId: bonus.transactionId,
      };

      await log(req.user, 'APPROVE_DEPOSIT', tx.user, { txId: tx._id, amount: tx.amount, activityBonus: bonusResult }, req);
      notifyAdmin(`✅ إيداع معتمد\nالمبلغ: $${tx.amount}\nبونص النشاط: ${bonusResult.credited ? '$' + bonusResult.amount : 'غير مؤهل'}\nID: ${tx._id}`).catch(() => {});

      res.json({
        success: true,
        message: bonusResult.credited ? `تم اعتماد الإيداع وإضافة بونص $${bonusResult.amount}` : 'تم اعتماد الإيداع',
        wallet,
        activityBonus: bonusResult,
      });
    } catch (err) {
      // Rollback transaction status if wallet update fails
      await Transaction.updateOne({ _id: tx._id }, { $set: { status: 'pending' } }).catch(() => {});
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/deposits/:id/reject', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const { reason } = req.body;
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.type !== 'deposit') return res.status(404).json({ success: false, message: 'الإيداع غير موجود' });
    if (tx.status !== 'pending') return res.status(400).json({ success: false, message: 'الإيداع ليس معلقاً' });
    tx.status = 'rejected';
    tx.adminNote = reason || 'رُفض من المشرف';
    await tx.save();
    await log(req.user, 'REJECT_DEPOSIT', tx.user, { txId: tx._id, reason }, req, 'warn');
    res.json({ success: true, message: 'تم رفض الإيداع' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/withdraws', async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const filter = { type: 'withdraw' };
    if (status !== 'all') filter.status = status;
    const total = await Transaction.countDocuments(filter);
    const withdraws = await Transaction.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);
    res.json({ success: true, withdraws, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/withdraws/:id/approve', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const { txHash } = req.body;

    // Atomic update to ensure only one admin can approve this transaction
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, type: 'withdraw', status: 'pending' },
      { 
        $set: { 
          status: 'approved', 
          approvedBy: req.user._id, 
          approvedAt: new Date(),
          txHash: txHash || undefined
        } 
      },
      { new: true }
    );

    if (!tx) return res.status(400).json({ success: false, message: 'السحب غير موجود أو تم معالجته مسبقاً' });

    try {
      // FIX #2: credit totalWithdrawn only on actual approval
      await Wallet.findOneAndUpdate(
        { user: tx.user },
        { $inc: { pendingWithdraw: -tx.amount, totalWithdrawn: tx.amount } }
      );
      await log(req.user, 'APPROVE_WITHDRAW', tx.user, { txId: tx._id, amount: tx.amount }, req);
      res.json({ success: true, message: 'تم اعتماد السحب' });
    } catch (err) {
      // Rollback transaction status if wallet update fails
      await Transaction.updateOne({ _id: tx._id }, { $set: { status: 'pending' } }).catch(() => {});
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/withdraws/:id/reject', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const { reason } = req.body;

    // Atomic update to ensure only one admin can reject and restore balance
    const tx = await Transaction.findOneAndUpdate(
      { _id: req.params.id, type: 'withdraw', status: 'pending' },
      { 
        $set: { 
          status: 'rejected', 
          adminNote: reason || 'رُفض من المشرف' 
        } 
      },
      { new: true }
    );

    if (!tx) return res.status(400).json({ success: false, message: 'السحب غير موجود أو تم معالجته مسبقاً' });

    try {
      // Restore balance and clear pending
      await Wallet.findOneAndUpdate(
        { user: tx.user },
        { $inc: { balance: tx.amount, availableProfit: tx.amount, pendingWithdraw: -tx.amount } }
      );
      await HourlyProfit.updateMany(
        { user: tx.user, withdrawTx: tx._id, status: 'withdrawn' },
        { $set: { status: 'available' }, $unset: { withdrawTx: '' } }
      );
      await log(req.user, 'REJECT_WITHDRAW', tx.user, { txId: tx._id, reason }, req, 'warn');
      res.json({ success: true, message: 'تم رفض السحب وإعادة الرصيد' });
    } catch (err) {
      // Rollback transaction status if wallet update fails
      await Transaction.updateOne({ _id: tx._id }, { $set: { status: 'pending' } }).catch(() => {});
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { search, vipLevel, isFrozen, page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const filter = {};
    if (search) {
      // Escape regex metacharacters to prevent ReDoS
      const safe = escapeRegex(search.trim().substring(0, 100));
      filter.$or = [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }];
    }
    if (vipLevel !== undefined && vipLevel !== '') filter.vipLevel = parseInt(vipLevel);
    if (isFrozen !== undefined && isFrozen !== '') filter.isFrozen = isFrozen === 'true';

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);

    const userIds = users.map(u => u._id);
    const wallets = await Wallet.find({ user: { $in: userIds } });
    const walletMap = {};
    wallets.forEach(w => { walletMap[w.user.toString()] = w; });

    const result = await Promise.all(users.map(async u => {
      const [profitStatus, directReferrals] = await Promise.all([
        getHourlyProfitStatus(u._id).catch(() => null),
        User.countDocuments({ referredBy: u._id }).catch(() => 0),
      ]);
      return {
        ...u.toObject(),
        wallet: walletMap[u._id.toString()] || null,
        vipDaysLeft: typeof u.vipDaysLeft === 'function' ? u.vipDaysLeft() : 0,
        profitStatus,
        directReferrals,
      };
    }));

    res.json({ success: true, users: result, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users/:id/summary', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    const [wallet, profitStatus, directReferrals, l2Referrals, txs, refEarnings] = await Promise.all([
      Wallet.findOne({ user: target._id }),
      getHourlyProfitStatus(target._id).catch(() => null),
      User.countDocuments({ referredBy: target._id }),
      User.countDocuments({ referredByL2: target._id }),
      Transaction.find({ user: target._id }).sort({ createdAt: -1 }).limit(12).lean(),
      Transaction.aggregate([
        { $match: { user: target._id, type: { $in: ['referral_l1', 'referral_l2', 'referral_l3'] }, status: 'approved' } },
        { $group: { _id: '$type', sum: { $sum: '$amount' } } },
      ]),
    ]);

    const referralEarnings = {};
    refEarnings.forEach(r => { referralEarnings[r._id] = r.sum; });

    res.json({
      success: true,
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
        vipLevel: target.vipLevel,
        vipExpiresAt: target.vipExpiresAt,
        vipDaysLeft: target.vipDaysLeft(),
        referralCode: target.referralCode,
        isFrozen: target.isFrozen,
        frozenReason: target.frozenReason,
        createdAt: target.createdAt,
      },
      wallet,
      profitStatus,
      referrals: { direct: directReferrals, level2: l2Referrals, earnings: referralEarnings },
      transactions: txs,
      timezone: 'Africa/Casablanca',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:id/freeze', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const { reason } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    if (target.isAdmin) return res.status(403).json({ success: false, message: 'لا يمكن تجميد حساب مشرف' });

    target.isFrozen = !target.isFrozen;
    target.frozenReason = target.isFrozen ? (reason || 'تم التجميد من المشرف') : '';
    await target.save();

    const action = target.isFrozen ? 'FREEZE_USER' : 'UNFREEZE_USER';
    await log(req.user, action, target._id, { reason }, req, 'warn');

    res.json({ success: true, message: target.isFrozen ? 'تم تجميد الحساب' : 'تم إلغاء التجميد', isFrozen: target.isFrozen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:id/password', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    }

    const target = await User.findById(req.params.id).select('+password');
    if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    if (target.isAdmin && String(target._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'لا يمكن تغيير كلمة مرور مشرف آخر' });
    }

    target.password = String(newPassword);
    await target.save();
    await log(req.user, 'RESET_USER_PASSWORD', target._id, { email: target.email }, req, 'critical');
    res.json({ success: true, message: 'تم تحديث كلمة المرور. لا يتم عرض كلمات المرور داخل النظام.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'معرف غير صالح' });
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    if (target.isAdmin) return res.status(403).json({ success: false, message: 'لا يمكن حذف حساب مشرف' });

    await Promise.all([
      User.deleteOne({ _id: target._id }),
      Wallet.deleteOne({ user: target._id }),
      Transaction.deleteMany({ user: target._id }),
    ]);

    await log(req.user, 'DELETE_USER', null, { deletedId: target._id, email: target.email, name: target.name }, req, 'critical');
    res.json({ success: true, message: `تم حذف المستخدم "${target.name}" نهائياً` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { type, status, userId, page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    if (userId) {
      if (!isValidId(userId)) return res.status(400).json({ success: false, message: 'معرف مستخدم غير صالح' });
      filter.user = userId;
    }

    const total = await Transaction.countDocuments(filter);
    const txs = await Transaction.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);

    res.json({ success: true, transactions: txs, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/adjust-balance', async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || amount === undefined || !reason) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم غير صالح' });
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون رقماً صحيحاً غير صفر' });
    }
    if (Math.abs(amt) > 100000) {
      return res.status(400).json({ success: false, message: 'المبلغ يتجاوز الحد المسموح ($100,000)' });
    }

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    const type = amt > 0 ? 'admin_credit' : 'admin_debit';
    const absAmt = Math.abs(amt);

    const wallet = await Wallet.findOneAndUpdate(
      amt < 0
        ? { user: userId, balance: { $gte: absAmt } }
        : { user: userId },
      { $inc: { balance: amt, totalEarned: amt > 0 ? amt : 0 } },
      { new: true }
    );
    if (!wallet) return res.status(400).json({ success: false, message: 'رصيد غير كافٍ' });

    await Transaction.create({
      user: userId, type, status: 'approved',
      amount: absAmt, netAmount: absAmt, note: reason,
      approvedBy: req.user._id, approvedAt: new Date(),
    });

    await log(req.user, 'ADJUST_BALANCE', userId, { amount: amt, reason, newBalance: wallet.balance }, req, 'critical');

    res.json({ success: true, message: `تم تعديل الرصيد: ${amt > 0 ? '+' : ''}$${amt}`, wallet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const { severity, page = 1, limit = 30 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const VALID_SEVERITIES = ['info', 'warn', 'critical'];
    const filter = {};
    if (severity && VALID_SEVERITIES.includes(severity)) filter.severity = severity;
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('admin', 'name email')
      .populate('target', 'name email')
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);
    res.json({ success: true, logs, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/run-rewards', async (req, res) => {
  try {
    await log(req.user, 'MANUAL_REWARDS_RUN', null, {}, req, 'warn');
    runHourlyRewards().catch(err => console.error('[Rewards] Manual run error:', err));
    res.json({ success: true, message: 'تم فحص المكافآت. سيتم صرف الأرباح التي أكملت 24 ساعة فقط.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function notificationFilterForAudience(audience, userId) {
  const now = new Date();
  if (audience === 'all') return {};
  if (audience === 'active_vip') return { vipLevel: { $gte: 1 }, vipExpiresAt: { $gt: now }, isFrozen: false };
  if (audience === 'expiring') return { vipLevel: { $gte: 1 }, vipExpiresAt: { $gt: now, $lte: new Date(Date.now() + 3 * 86400000) }, isFrozen: false };
  if (audience === 'no_vip') return { vipLevel: { $lt: 1 }, isFrozen: false };
  if (audience === 'frozen') return { isFrozen: true };
  if (audience === 'single' && userId && isValidId(userId)) return { _id: userId };
  return null;
}

router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg = Math.max(parseInt(page) || 1, 1);
    const total = await Notification.countDocuments();
    const notifications = await Notification.find()
      .populate('user', 'name email')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);
    res.json({ success: true, notifications, pagination: { total, page: pg, pages: Math.ceil(total / lim) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { audience = 'all', userId, title, message, category = 'system', priority = 'info' } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'العنوان والرسالة مطلوبان' });
    if (String(title).trim().length > 120 || String(message).trim().length > 800) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً' });
    }

    const filter = notificationFilterForAudience(audience, userId);
    if (!filter) return res.status(400).json({ success: false, message: 'اختيار الجمهور غير صالح' });

    const users = await User.find(filter).select('_id').limit(5000);
    if (!users.length) return res.status(400).json({ success: false, message: 'لا يوجد مستخدمون مطابقون لهذا الاختيار' });

    const docs = users.map(u => ({
      user: u._id,
      createdBy: req.user._id,
      title: String(title).trim(),
      message: String(message).trim(),
      category,
      priority,
      audience,
    }));
    await Notification.insertMany(docs, { ordered: false });
    await log(req.user, 'SEND_NOTIFICATION', null, { audience, count: docs.length, title }, req, 'info');
    res.status(201).json({ success: true, message: `تم إرسال التنبيه إلى ${docs.length} مستخدم`, sent: docs.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
