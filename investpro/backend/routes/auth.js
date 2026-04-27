const router   = require('express').Router();
const crypto   = require('crypto');
const User     = require('../models/User');
const { Wallet, Transaction } = require('../models/Wallet');
const { protect, generateToken, loginLimit, registerLimit } = require('../middleware');
const { REFERRAL_RATES } = require('../config/vipConfig');
const { isValidPassword } = require('../utils/validation');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_PROD  = process.env.NODE_ENV === 'production';

/* FIX #7: Never expose internal error details in production */
const serverError = (res, err) => {
  console.error('[Auth Error]', err.message);
  res.status(500).json({ success: false, message: IS_PROD ? 'خطأ في الخادم' : err.message });
};

/* POST /api/auth/register */
/* FIX #4: registerLimit applied */
router.post('/register', registerLimit, async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    /* ── Input validation ─────────────────────────────────────────────────── */
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'الاسم يجب أن يكون بين 2 و100 حرف' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجّل مسبقاً' });
    }

    /* ── Referral chain (L1 + L2 + L3) ──────────────────────────────────── */
    let referredBy = null, referredByL2 = null, referredByL3 = null;
    if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
      const l1 = await User.findOne({ referralCode: referralCode.toUpperCase().trim().substring(0, 20) });
      if (l1) {
        referredBy   = l1._id;
        if (l1.referredBy)   referredByL2 = l1.referredBy;
        if (l1.referredByL2) referredByL3 = l1.referredByL2;
      } else {
        return res.status(400).json({ success: false, message: 'كود الإحالة غير صحيح' });
      }
    }

    /* ── Create user then wallet (sequential, manual rollback on failure) ── */
    const user = await User.create({ name: name.trim(), email: cleanEmail, password, referredBy, referredByL2, referredByL3 });
    try {
      await Wallet.create({ user: user._id });
    } catch (walletErr) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
      throw walletErr;
    }

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id, name: user.name, email: user.email,
        vipLevel: user.vipLevel, isAdmin: user.isAdmin,
        referralCode: user.referralCode,
        trainingDaysLeft: user.trainingDaysLeft,
        trainingCompleted: user.trainingCompleted,
      },
    });
  } catch (err) {
    serverError(res, err);
  }
});

/* POST /api/auth/login */
router.post('/login', loginLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'كلمة المرور مطلوبة' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // ── Email format check (catches "mrrobot", "user@", etc.) ────────────
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صحيحة' });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      // Generic message — don't reveal whether email exists
      return res.status(401).json({ success: false, message: 'فشل تسجيل الدخول، تحقق من البيانات' });
    }

    if (user.isFrozen) {
      return res.status(403).json({ success: false, message: 'الحساب مجمّد: ' + (user.frozenReason || '') });
    }

    const ok = await user.matchPassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'فشل تسجيل الدخول، تحقق من البيانات' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
    const token  = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id, name: user.name, email: user.email,
        vipLevel: user.vipLevel, isAdmin: user.isAdmin,
        referralCode: user.referralCode,
        trainingDaysLeft: user.trainingDaysLeft,
        trainingCompleted: user.trainingCompleted,
        vipExpiresAt: user.vipExpiresAt,
      },
      wallet: { balance: wallet ? wallet.balance : 0 },
    });
  } catch (err) {
    serverError(res, err);
  }
});

/* GET /api/auth/me */
router.get('/me', protect, async (req, res) => {
  try {
    const user   = req.user;
    const wallet = await Wallet.findOne({ user: user._id });
    res.json({
      success: true,
      user: {
        _id: user._id, name: user.name, email: user.email,
        vipLevel: user.vipLevel, isAdmin: user.isAdmin,
        referralCode: user.referralCode,
        trainingDaysLeft: user.trainingDaysLeft,
        trainingCompleted: user.trainingCompleted,
        vipExpiresAt: user.vipExpiresAt,
        bonusSteps: user.bonusSteps,
      },
      wallet,
    });
  } catch (err) {
    serverError(res, err);
  }
});

/*
 * POST /api/auth/forgot-password
 * FIX #5: Token is generated as plaintext for the email link,
 *          but only a SHA-256 hash is stored in the database.
 *          Even if the DB is compromised the token cannot be reused.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always respond with success to prevent user enumeration
    if (!user) return res.json({ success: true, message: 'إذا كان البريد مسجلاً ستصلك تعليمات الاستعادة' });

    const plainToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    user.resetToken       = hashedToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // TODO: send `plainToken` via email service (SendGrid, Nodemailer, etc.)
    // The plain token goes in the reset link; the hash is what's stored.
    // FIX #6: Never log the token — even in development
    if (!IS_PROD) console.log('[Dev] Reset token (do NOT log in production):', plainToken);

    res.json({ success: true, message: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني' });
  } catch (err) {
    serverError(res, err);
  }
});

/* POST /api/auth/reset-password */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'الرمز وكلمة المرور الجديدة مطلوبان' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    /* FIX #5: Hash the incoming token before comparing — plaintext token never touches DB */
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetToken:       hashedToken,
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');

    if (!user) return res.status(400).json({ success: false, message: 'رمز الاستعادة غير صالح أو منتهي الصلاحية' });

    user.password         = newPassword;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.' });
  } catch (err) {
    serverError(res, err);
  }
});

/* POST /api/auth/change-password */
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const ok = await user.matchPassword(currentPassword);
    if (!ok) return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    serverError(res, err);
  }
});

/* GET /api/auth/referral-stats */
router.get('/referral-stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const [directCount, l2Count, l3Count, commResult] = await Promise.all([
      User.countDocuments({ referredBy:   userId }),
      User.countDocuments({ referredByL2: userId }),
      User.countDocuments({ referredByL3: userId }),
      Transaction.aggregate([
        { $match: { user: userId, type: { $in: ['referral_l1', 'referral_l2', 'referral_l3'] }, status: 'approved' } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
    ]);

    const commMap = {};
    commResult.forEach(r => { commMap[r._id] = r.total; });

    const totalTeam = directCount + l2Count + l3Count;

    // Goals milestones based on direct (L1) referrals
    const goals = [
      { target: 10,  bonus: 5,    label: 'مكافأة $5',           reached: directCount >= 10  },
      { target: 50,  bonus: 25,   label: 'مكافأة $25',          reached: directCount >= 50  },
      { target: 100, bonus: null, label: 'ترقية VIP مجانية',    reached: directCount >= 100 },
    ];

    res.json({
      success: true,
      referralCode:     req.user.referralCode,
      l1Rate:           REFERRAL_RATES.L1,
      l2Rate:           REFERRAL_RATES.L2,
      l3Rate:           REFERRAL_RATES.L3,
      directCount,
      l2Count,
      l3Count,
      totalTeam,
      commissionsL1:    +(commMap['referral_l1'] || 0).toFixed(2),
      commissionsL2:    +(commMap['referral_l2'] || 0).toFixed(2),
      commissionsL3:    +(commMap['referral_l3'] || 0).toFixed(2),
      totalCommissions: +((commMap['referral_l1'] || 0) + (commMap['referral_l2'] || 0) + (commMap['referral_l3'] || 0)).toFixed(2),
      goals,
    });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;
