const router   = require('express').Router();
const User     = require('../models/User');
const { Wallet, Transaction } = require('../models/Wallet');
const { protect } = require('../middleware');
const { VIP_LEVELS } = require('../config/vipConfig');
const { addReferralCommissions, processUserHourlyRewards, getHourlyProfitStatus } = require('../jobs/rewards');

/* GET /api/vip — plans + user status */
router.get('/', protect, async (req, res) => {
  try {
    const user   = req.user;
    const wallet = await Wallet.findOne({ user: user._id });

    const levels = VIP_LEVELS.map(v => ({
      level:        v.level,
      name:         v.name,
      nameEn:       v.nameEn,
      tier:         v.tier         || '',
      badge:        v.badge        || null,
      price:        v.price,
      monthlyPct:   v.monthlyPct,
      dailyProfit:  v.dailyProfit,
      dailyBonus:   v.dailyBonus   || 0,
      dailyTotal:   +(v.dailyTotal || v.dailyProfit + v.dailyBonus).toFixed(2),
      durationDays: v.durationDays,
      totalReturn:  v.totalReturn,
      netProfit:    +(v.totalReturn - v.price).toFixed(2),
      monthlyProfit:+(v.totalReturn - v.price).toFixed(2),
      isTraining:   v.isTraining   || false,
      description:  v.description  || '',
      marketing:    v.marketing    || '',
      planLevel:    v.planLevel    || v.tier || '',
      followType:   v.followType   || '',
      planStatus:   v.planStatus   || '',
      demandRate:   v.demandRate   || null,
      suitableFor:  v.suitableFor  || '',
      activationText: v.activationText || (v.isTraining ? 'فوري بعد التسجيل' : 'فوري بعد تأكيد الإيداع'),
      detailBullets: Array.isArray(v.detailBullets) ? v.detailBullets : [],
      subscribers:  v.subscribers  || null,
    }));

    const currentCfg = VIP_LEVELS.find(v => v.level === user.vipLevel);
    const hourlyProfit = await getHourlyProfitStatus(user._id);

    res.json({
      success: true,
      levels,
      userStatus: {
        currentLevel:      user.vipLevel,
        currentLevelName:  currentCfg ? currentCfg.name : 'غير نشط',
        isActive:          user.isVipActive(),
        vipExpiresAt:      user.vipExpiresAt,
        daysLeft:          user.vipDaysLeft(),
        trainingDaysLeft:  user.trainingDaysLeft,
        trainingCompleted: user.trainingCompleted,
        balance:           wallet ? wallet.balance : 0,
        hourlyProfit,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/vip/start-training — optional onboarding */
router.post('/start-training', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.vipLevel !== -1) {
      return res.status(400).json({ success: false, message: 'لقد بدأت التدريب مسبقاً' });
    }
    const trainingCfg = VIP_LEVELS.find(v => v.level === 0);
    user.vipLevel         = 0;
    user.trainingDaysLeft = trainingCfg?.durationDays ?? 5;
    user.vipActivatedAt   = new Date();
    user.vipLastHourlyRewardAt = user.vipActivatedAt;
    user.vipExpiresAt     = new Date(user.vipActivatedAt.getTime() + user.trainingDaysLeft * 86400000);
    await user.save();
    await processUserHourlyRewards(user._id);
    res.json({ success: true, message: `تم تفعيل فترة التدريب المجانية (${user.trainingDaysLeft} أيام)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/*
 * POST /api/vip/activate — instant VIP purchase
 * Training is OPTIONAL — any user with sufficient balance can buy directly.
 * Referral commissions are paid to the referral chain on every VIP purchase.
 */
router.post('/activate', protect, async (req, res) => {
  try {
    const { level } = req.body;
    const lvl = parseInt(level);

    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 5) {
      return res.status(400).json({ success: false, message: 'مستوى VIP غير صالح (1–5)' });
    }

    const config = VIP_LEVELS.find(v => v.level === lvl);
    if (!config) {
      return res.status(400).json({ success: false, message: 'خطة غير موجودة' });
    }

    const user = await User.findById(req.user._id);

    // Block only if same/lower level is still active
    if (lvl <= user.vipLevel && user.isVipActive()) {
      return res.status(400).json({ success: false, message: 'لا يمكن تفعيل مستوى أقل أو مساوٍ للخطة النشطة حالياً' });
    }

    // Atomic balance deduction
    const wallet = await Wallet.findOneAndUpdate(
      { user: user._id, balance: { $gte: config.price } },
      { $inc: { balance: -config.price } },
      { new: true }
    );
    if (!wallet) {
      return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `\u0631\u0635\u064A\u062F \u063A\u064A\u0631 \u0643\u0627\u0641\u064D. \u0627\u0644\u0645\u0637\u0644\u0648\u0628: $${config.price}`, required: config.price });
    }

    const now     = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + config.durationDays);

    try {
      // Atomic user update — no race condition
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            vipLevel:          lvl,
            vipActivatedAt:    now,
            vipExpiresAt:      expires,
            vipLastHourlyRewardAt: now,
            trainingCompleted: true,  // auto-complete training if skipped
            lastRewardDate:    null,  // reset so profit runs on next cron
          },
        },
        { new: true }
      );
      if (!updatedUser) throw new Error('فشل تحديث بيانات المستخدم');

      await Transaction.create({
        user:       user._id,
        type:       'vip_purchase',
        status:     'approved',
        amount:     config.price,
        netAmount:  config.price,
        note:       `تفعيل خطة ${config.name} — ${config.monthlyPct}% لمدة ${config.durationDays} يوم`,
        approvedBy: user._id,
        approvedAt: now,
      });

      // Pay referral commissions on VIP purchase price
      await addReferralCommissions(user._id, config.price).catch(e =>
        console.error('[VIP] Referral commission error:', e.message)
      );
      await processUserHourlyRewards(user._id);

    } catch (saveErr) {
      // Rollback wallet deduction on any failure
      await Wallet.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: config.price } }
      ).catch(() => {});
      throw saveErr;
    }

    res.json({
      success: true,
      message: `✅ تم تفعيل خطة ${config.name} بنجاح!`,
      balance: wallet.balance,
      plan: {
        level:       lvl,
        name:        config.name,
        expiresAt:   expires,
        daysLeft:    config.durationDays,
        dailyProfit: config.dailyProfit,
        dailyBonus:  config.dailyBonus,
        dailyTotal:  +(config.dailyTotal ?? (config.dailyProfit + config.dailyBonus)).toFixed(4),
        totalReturn: config.totalReturn,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/vip/status */
router.get('/status', protect, async (req, res) => {
  try {
    const user   = req.user;
    const config = VIP_LEVELS.find(v => v.level === user.vipLevel);
    const hourly = await getHourlyProfitStatus(user._id);
    res.json({
      success:           true,
      vipLevel:          user.vipLevel,
      vipName:           config ? config.name : 'غير نشط',
      isActive:          user.isVipActive(),
      daysLeft:          user.vipDaysLeft(),
      trainingDaysLeft:  user.trainingDaysLeft,
      trainingCompleted: user.trainingCompleted,
      vipExpiresAt:      user.vipExpiresAt,
      dailyProfit:       config ? config.dailyProfit : 0,
      dailyBonus:        config ? config.dailyBonus  : 0,
      dailyTotal:        config ? +(config.dailyTotal ?? (config.dailyProfit + config.dailyBonus)).toFixed(4) : 0,
      hourlyProfit:      hourly,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/vip/hourly-profit */
router.get('/hourly-profit', protect, async (req, res) => {
  try {
    const hourlyProfit = await getHourlyProfitStatus(req.user._id);
    res.json({ success: true, hourlyProfit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
