const router   = require('express').Router();
const { Wallet, Transaction } = require('../models/Wallet');
const { protect, depositLimit, withdrawLimit } = require('../middleware');
const { PAYMENT_METHODS, PLATFORM_WALLETS } = require('../config/vipConfig');

const MIN_DEPOSIT  = parseFloat(process.env.MIN_DEPOSIT  || 10);
const MAX_DEPOSIT  = parseFloat(process.env.MAX_DEPOSIT  || 50000);
const MIN_WITHDRAW = parseFloat(process.env.MIN_WITHDRAW || 10);
const MAX_WITHDRAW = parseFloat(process.env.MAX_WITHDRAW || 10000);
const FEE_PCT      = parseFloat(process.env.WITHDRAWAL_FEE || 10);

const MAX_LIMIT = 100;
const safeLimit = val => Math.min(Math.max(parseInt(val) || 20, 1), MAX_LIMIT);

// Network-specific transaction hash validation
function isValidTxHash(network, hash) {
  const h = hash.trim();
  if (network === 'TRC20') return /^[a-fA-F0-9]{64}$/.test(h);
  // BEP20 and Polygon both use Ethereum-style hashes (0x + 64 hex chars)
  return /^0x[a-fA-F0-9]{64}$/.test(h);
}

// Network-specific wallet address validation
function isValidCryptoAddress(network, addr) {
  const a = addr.trim();
  if (network === 'TRC20') return /^T[a-zA-Z0-9]{33}$/.test(a);
  // BEP20 and Polygon: EVM address (0x + 40 hex chars)
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

const VALID_TX_TYPES = [
  'deposit','withdraw','daily_profit','daily_bonus','activity_bonus','training_reward',
  'vip_purchase','referral_l1','referral_l2','signup_bonus','admin_credit','admin_debit',
];
const VALID_TX_STATUSES = ['pending','approved','rejected','cancelled'];

/* GET /api/wallet — wallet info + payment methods */
router.get('/', protect, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    res.json({
      success: true,
      wallet,
      paymentMethods: PAYMENT_METHODS,
      platformWallets: PLATFORM_WALLETS,
      rules: { minDeposit: MIN_DEPOSIT, maxDeposit: MAX_DEPOSIT, minWithdraw: MIN_WITHDRAW, maxWithdraw: MAX_WITHDRAW, withdrawFee: FEE_PCT },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/wallet/transactions */
router.get('/transactions', protect, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const lim = safeLimit(limit);
    const pg  = Math.max(parseInt(page) || 1, 1);
    const filter = { user: req.user._id };
    if (type   && VALID_TX_TYPES.includes(type))     filter.type   = type;
    if (status && VALID_TX_STATUSES.includes(status)) filter.status = status;

    const total = await Transaction.countDocuments(filter);
    const txs   = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim);

    res.json({
      success: true,
      transactions: txs,
      pagination: { total, page: pg, pages: Math.ceil(total / lim), limit: lim },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/wallet/deposit */
router.post('/deposit', protect, depositLimit, async (req, res) => {
  try {
    const { amount, paymentMethod, txHash, fromAddress } = req.body;

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt < MIN_DEPOSIT) {
      return res.status(400).json({ success: false, message: `الحد الأدنى للإيداع $${MIN_DEPOSIT}` });
    }
    if (amt > MAX_DEPOSIT) {
      return res.status(400).json({ success: false, message: `الحد الأقصى للإيداع $${MAX_DEPOSIT}` });
    }
    if (!paymentMethod || !PAYMENT_METHODS.find(p => p.id === paymentMethod)) {
      return res.status(400).json({ success: false, message: 'طريقة دفع غير صالحة' });
    }
    if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'رقم العملية (txHash) مطلوب' });
    }
    if (!isValidTxHash(paymentMethod, txHash)) {
      const expected = paymentMethod === 'TRC20'
        ? 'TRC20: 64 حرف هيكساديسيمال'
        : 'BEP20/Polygon: تبدأ بـ 0x + 64 حرف هيكساديسيمال';
      return res.status(400).json({ success: false, message: `صيغة رقم العملية غير صحيحة (${expected})` });
    }

    // Prevent duplicate tx hashes
    const dupHash = await Transaction.findOne({ txHash: txHash.trim() });
    if (dupHash) {
      return res.status(400).json({ success: false, message: 'رقم العملية مستخدم مسبقاً' });
    }

    // Prevent multiple pending deposits
    const pending = await Transaction.findOne({ user: req.user._id, type: 'deposit', status: 'pending' });
    if (pending) {
      return res.status(400).json({ success: false, message: 'لديك إيداع معلق بالفعل' });
    }

    const tx = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      status: 'pending',
      amount: amt,
      netAmount: amt,
      paymentMethod,
      txHash: txHash.trim(),
      fromAddress: fromAddress ? String(fromAddress).trim().substring(0, 200) : '',
    });

    const { notifyAdmin } = require('../jobs/rewards');
    notifyAdmin(`💰 إيداع جديد\nالمستخدم: ${req.user.name}\nالمبلغ: $${amt}\nالطريقة: ${paymentMethod}`).catch(() => {});

    res.status(201).json({ success: true, message: 'تم إرسال طلب الإيداع بنجاح، في انتظار الموافقة', deposit: tx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/wallet/withdraw */
router.post('/withdraw', protect, withdrawLimit, async (req, res) => {
  try {
    const { amount, paymentMethod, toAddress } = req.body;

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt < MIN_WITHDRAW) {
      return res.status(400).json({ success: false, message: `الحد الأدنى للسحب $${MIN_WITHDRAW}` });
    }
    if (amt > MAX_WITHDRAW) {
      return res.status(400).json({ success: false, message: `الحد الأقصى للسحب $${MAX_WITHDRAW}` });
    }
    if (!paymentMethod || !PAYMENT_METHODS.find(p => p.id === paymentMethod)) {
      return res.status(400).json({ success: false, message: 'طريقة استلام غير صالحة' });
    }
    if (!toAddress || typeof toAddress !== 'string' || toAddress.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'عنوان الاستلام مطلوب' });
    }
    if (!isValidCryptoAddress(paymentMethod, toAddress)) {
      const expected = paymentMethod === 'TRC20'
        ? 'TRC20: يبدأ بـ T ويتكون من 34 حرفًا'
        : 'BEP20/Polygon: يبدأ بـ 0x ويتكون من 42 حرفًا';
      return res.status(400).json({ success: false, message: `صيغة عنوان المحفظة غير صحيحة (${expected})` });
    }

    const fee       = +(amt * FEE_PCT / 100).toFixed(2);
    const netAmount = +(amt - fee).toFixed(2);

    // Atomic: deduct balance + reserve pendingWithdraw.
    // FIX #2: totalWithdrawn is only incremented when the withdrawal is
    //         approved by admin — not at request time — so it always
    //         reflects actually-completed withdrawals.
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user._id, balance: { $gte: amt }, availableProfit: { $gte: amt }, pendingWithdraw: 0 },
      { $inc: { balance: -amt, availableProfit: -amt, pendingWithdraw: amt } },
      { new: true }
    );
    if (!wallet) {
      return res.status(400).json({ success: false, message: 'لا يمكن سحب الربح المجمد. المبلغ المتاح للسحب غير كافٍ أو يوجد سحب معلق بالفعل' });
    }

    let tx;
    try {
      tx = await Transaction.create({
        user: req.user._id,
        type: 'withdraw',
        status: 'pending',
        amount: amt,
        fee,
        netAmount,
        paymentMethod,
        toAddress: toAddress.trim().substring(0, 200),
        note: 'سحب أرباح متاحة',
      });
      const { markAvailableProfitWithdrawn } = require('../jobs/rewards');
      await markAvailableProfitWithdrawn(req.user._id, amt, tx._id);
    } catch (txErr) {
      // Rollback wallet deduction if transaction record fails
      await Wallet.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { balance: amt, availableProfit: amt, pendingWithdraw: -amt } }
      ).catch(() => {});
      throw txErr;
    }

    const { notifyAdmin } = require('../jobs/rewards');
    notifyAdmin(`💸 سحب جديد\nالمستخدم: ${req.user.name}\nالمبلغ: $${amt} (صافي: $${netAmount})\nالعنوان: ${toAddress}`).catch(() => {});

    res.status(201).json({ success: true, message: 'تم إرسال طلب السحب، سيتم المعالجة خلال 24 ساعة', withdraw: tx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/wallet/pending */
router.get('/pending', protect, async (req, res) => {
  try {
    const txs = await Transaction.find({ user: req.user._id, status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
