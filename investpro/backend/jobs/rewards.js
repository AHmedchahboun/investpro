const cron      = require('node-cron');
const User      = require('../models/User');
const { Wallet, Transaction, HourlyProfit } = require('../models/Wallet');
const { VIP_LEVELS, REFERRAL_RATES } = require('../config/vipConfig');

const PROFIT_TZ = 'Africa/Casablanca';
const DAY_MS = 24 * 60 * 60 * 1000;
const TRAINING_DAILY_CENTS = 10;
const TRAINING_DAYS = 5;
const TRAINING_CAP_CENTS = TRAINING_DAILY_CENTS * TRAINING_DAYS;
const ACTIVITY_BONUS_PROMO_CODE = 'new_activity_bonus';

function hourlyAmount(config) {
  return +(Number(config?.dailyTotal ?? config?.dailyProfit ?? 0) / 24).toFixed(6);
}

function dailyAmount(config) {
  return +(Number(config?.dailyTotal ?? config?.dailyProfit ?? 0)).toFixed(6);
}

function moneyFromCents(cents) {
  return +(cents / 100).toFixed(2);
}

function toCents(value) {
  return Math.round((Number(value) || 0) * 100);
}

function getActivityDepositBonus(amount) {
  const value = Number(amount) || 0;
  if (value >= 100) return 10;
  if (value >= 50) return 5;
  if (value >= 30) return 3;
  if (value >= 10) return 1;
  return 0;
}

function isWithinActivityBonusWindow(date, now = new Date()) {
  const createdAt = new Date(date || now);
  const createdAtMs = createdAt.getTime();
  return Number.isFinite(createdAtMs) && now.getTime() - createdAtMs <= DAY_MS;
}

function trainingDateKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: PROFIT_TZ });
}

function getTrainingActivation(user) {
  if (!user?.vipActivatedAt) return null;
  const activatedAt = new Date(user.vipActivatedAt);
  return Number.isNaN(activatedAt.getTime()) ? null : activatedAt;
}

function trainingCycleStart(activatedAt, paidDays) {
  return new Date(activatedAt.getTime() + paidDays * DAY_MS);
}

function trainingDueAt(activatedAt, paidDays) {
  return new Date(activatedAt.getTime() + (paidDays + 1) * DAY_MS);
}

async function getTrainingRewardStats(userId) {
  const [sumResult, count] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: userId, type: 'training_reward', status: 'approved' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]),
    Transaction.countDocuments({ user: userId, type: 'training_reward', status: 'approved' }),
  ]);
  const totalCents = toCents(sumResult[0]?.sum || 0);
  return {
    count,
    totalCents,
    paidDays: Math.min(
      TRAINING_DAYS,
      Math.max(count, Math.floor(totalCents / TRAINING_DAILY_CENTS))
    ),
  };
}

async function hasTrainingRewardForDate(userId, dateKey) {
  return Boolean(await Transaction.findOne({
    user: userId,
    type: 'training_reward',
    status: 'approved',
    $or: [
      { rewardDate: dateKey },
      {
        $expr: {
          $eq: [
            { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: PROFIT_TZ } },
            dateKey,
          ],
        },
      },
    ],
  }).select('_id'));
}

async function completeTraining(userId) {
  await User.updateOne(
    { _id: userId, vipLevel: 0 },
    { $set: { trainingCompleted: true, trainingDaysLeft: 0, vipLevel: -1 } }
  );
}

async function ensureTrainingFrozenCycle(user, paidDays, dueAt) {
  if (paidDays >= TRAINING_DAYS) return null;
  const activatedAt = getTrainingActivation(user);
  if (!activatedAt) return null;
  const cycleStart = trainingCycleStart(activatedAt, paidDays);
  const existingFrozen = await HourlyProfit.findOne({
    user: user._id,
    vipLevel: 0,
    status: 'frozen',
  }).sort({ eligibleAt: 1 });

  if (existingFrozen) {
    existingFrozen.userName = user.name;
    existingFrozen.planName = 'التدريب';
    existingFrozen.amount = moneyFromCents(TRAINING_DAILY_CENTS);
    existingFrozen.cycleStart = cycleStart;
    existingFrozen.eligibleAt = dueAt;
    existingFrozen.timezone = PROFIT_TZ;
    return existingFrozen.save();
  }

  try {
    return await HourlyProfit.create({
      user: user._id,
      userName: user.name,
      vipLevel: 0,
      planName: 'التدريب',
      amount: moneyFromCents(TRAINING_DAILY_CENTS),
      cycleStart,
      eligibleAt: dueAt,
      status: 'frozen',
      timezone: PROFIT_TZ,
    });
  } catch (err) {
    if (err.code === 11000) {
      return HourlyProfit.findOne({ user: user._id, cycleStart });
    }
    throw err;
  }
}

async function markTrainingCycleAvailable(user, paidDays, dueAt, transactionId) {
  const activatedAt = getTrainingActivation(user);
  if (!activatedAt) return null;
  const cycleStart = trainingCycleStart(activatedAt, paidDays);
  const update = {
    userName: user.name,
    vipLevel: 0,
    planName: 'التدريب',
    amount: moneyFromCents(TRAINING_DAILY_CENTS),
    cycleStart,
    eligibleAt: dueAt,
    status: 'available',
    transaction: transactionId,
    timezone: PROFIT_TZ,
  };

  const existing = await HourlyProfit.findOneAndUpdate(
    { user: user._id, cycleStart },
    { $set: update },
    { new: true }
  );
  if (existing) return existing;

  try {
    return await HourlyProfit.create({ user: user._id, ...update });
  } catch (err) {
    if (err.code === 11000) {
      return HourlyProfit.findOneAndUpdate(
        { user: user._id, cycleStart },
        { $set: update },
        { new: true }
      );
    }
    throw err;
  }
}

async function processTrainingReward(user, now = new Date()) {
  if (!user || user.isFrozen || user.vipLevel !== 0 || user.trainingCompleted) {
    return { status: 'inactive', credited: 0, amount: 0 };
  }

  const activatedAt = getTrainingActivation(user);
  if (!activatedAt) return { status: 'skipped', credited: 0, amount: 0 };

  const stats = await getTrainingRewardStats(user._id);
  if (stats.totalCents >= TRAINING_CAP_CENTS || stats.paidDays >= TRAINING_DAYS) {
    await completeTraining(user._id);
    return { status: 'completed', credited: 0, amount: 0 };
  }

  const dueAt = trainingDueAt(activatedAt, stats.paidDays);
  await ensureTrainingFrozenCycle(user, stats.paidDays, dueAt);

  if (now < dueAt) {
    return { status: 'waiting', credited: 0, amount: 0 };
  }

  const rewardDate = trainingDateKey(now);
  if (await hasTrainingRewardForDate(user._id, rewardDate)) {
    return { status: 'skipped', credited: 0, amount: 0 };
  }

  if (stats.totalCents + TRAINING_DAILY_CENTS > TRAINING_CAP_CENTS) {
    await completeTraining(user._id);
    return { status: 'completed', credited: 0, amount: 0 };
  }

  const paidDaysAfter = stats.paidDays + 1;
  const remainingDays = Math.max(0, TRAINING_DAYS - paidDaysAfter);
  const setFields = {
    lastRewardDate: rewardDate,
    vipLastHourlyRewardAt: dueAt,
    trainingDaysLeft: remainingDays,
  };
  if (remainingDays === 0) {
    setFields.trainingCompleted = true;
    setFields.vipLevel = -1;
  }

  const locked = await User.findOneAndUpdate(
    {
      _id: user._id,
      vipLevel: 0,
      isFrozen: { $ne: true },
      trainingCompleted: { $ne: true },
      lastRewardDate: { $ne: rewardDate },
      $or: [
        { vipLastHourlyRewardAt: { $exists: false } },
        { vipLastHourlyRewardAt: { $lt: dueAt } },
      ],
    },
    { $set: setFields },
    { new: true }
  );
  if (!locked) return { status: 'skipped', credited: 0, amount: 0 };

  let tx;
  try {
    tx = await Transaction.create({
      user: user._id,
      type: 'training_reward',
      status: 'approved',
      amount: moneyFromCents(TRAINING_DAILY_CENTS),
      netAmount: moneyFromCents(TRAINING_DAILY_CENTS),
      note: 'ربح 24 ساعة — التدريب',
      rewardDate,
      approvedBy: user._id,
      approvedAt: dueAt,
    });
  } catch (err) {
    if (err.code === 11000) return { status: 'skipped', credited: 0, amount: 0 };
    throw err;
  }

  await Promise.all([
    Wallet.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: { user: user._id },
        $inc: {
          balance: moneyFromCents(TRAINING_DAILY_CENTS),
          totalEarned: moneyFromCents(TRAINING_DAILY_CENTS),
          availableProfit: moneyFromCents(TRAINING_DAILY_CENTS),
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    ),
    markTrainingCycleAvailable(user, stats.paidDays, dueAt, tx._id),
  ]);

  if (remainingDays > 0) {
    await ensureTrainingFrozenCycle(locked, paidDaysAfter, trainingDueAt(activatedAt, paidDaysAfter));
  }

  return {
    status: 'credited',
    credited: 1,
    amount: moneyFromCents(TRAINING_DAILY_CENTS),
  };
}

function planStatus(user, now = new Date()) {
  if (!user || user.isFrozen) return { active: false };
  const config = VIP_LEVELS.find(v => v.level === user.vipLevel);
  if (!config || user.vipLevel < 0) return { active: false };
  if (user.vipLevel === 0 && user.vipExpiresAt && user.vipExpiresAt <= now) return { active: false, config };
  if (user.vipLevel >= 1 && (!user.vipExpiresAt || user.vipExpiresAt <= now)) return { active: false, config };
  return { active: true, config };
}

async function createFrozenCycle(user, config, cycleStart) {
  const expiresAt = user.vipExpiresAt ? new Date(user.vipExpiresAt) : null;
  const start = new Date(cycleStart);
  if (expiresAt && start >= expiresAt) return null;
  const eligibleAt = new Date(Math.min(start.getTime() + DAY_MS, expiresAt ? expiresAt.getTime() : start.getTime() + DAY_MS));
  if (eligibleAt <= start) return null;

  try {
    return await HourlyProfit.create({
      user: user._id,
      userName: user.name,
      vipLevel: user.vipLevel,
      planName: config.name,
      amount: dailyAmount(config),
      cycleStart: start,
      eligibleAt,
      status: 'frozen',
      timezone: PROFIT_TZ,
    });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await HourlyProfit.findOne({ user: user._id, cycleStart: start });
      if (existing?.status === 'frozen') {
        await normalizeDailyCycle(user, config, existing);
      }
      return existing;
    }
    throw err;
  }
}

async function normalizeDailyCycle(user, config, cycle) {
  if (!cycle || cycle.status !== 'frozen') return cycle;
  const start = new Date(cycle.cycleStart);
  const expiresAt = user.vipExpiresAt ? new Date(user.vipExpiresAt) : null;
  const expectedEligibleAt = new Date(Math.min(start.getTime() + DAY_MS, expiresAt ? expiresAt.getTime() : start.getTime() + DAY_MS));
  const expectedAmount = dailyAmount(config);
  const cycleMs = new Date(cycle.eligibleAt).getTime() - start.getTime();
  const looksHourly = cycleMs > 0 && cycleMs < DAY_MS - 60000;
  const tooLarge = Number(cycle.amount || 0) > expectedAmount + 0.000001;

  if (looksHourly || tooLarge) {
    if (tooLarge) cycle.amount = expectedAmount;
    cycle.eligibleAt = expectedEligibleAt;
    cycle.timezone = PROFIT_TZ;
    await cycle.save();
  }
  return cycle;
}

async function ensureHourlyCycle(user, config) {
  const existingFrozen = await HourlyProfit.findOne({ user: user._id, status: 'frozen' }).sort({ cycleStart: -1 });
  if (existingFrozen) return existingFrozen;

  const lastLog = await HourlyProfit.findOne({ user: user._id }).sort({ eligibleAt: -1 });
  const nextStart = lastLog?.eligibleAt || user.vipLastHourlyRewardAt || user.vipActivatedAt || new Date();
  return createFrozenCycle(user, config, nextStart);
}

async function processUserHourlyRewards(userOrId, now = new Date()) {
  const user = typeof userOrId === 'object' && userOrId._id
    ? userOrId
    : await User.findById(userOrId);
  if (user?.vipLevel === 0) {
    return processTrainingReward(user, now);
  }
  const { active, config } = planStatus(user, now);
  if (!active) return { status: 'inactive', credited: 0, amount: 0 };

  await ensureHourlyCycle(user, config);

  let credited = 0;
  let amount = 0;

  for (let i = 0; i < 24 * 31; i++) {
    const frozen = await HourlyProfit.findOne({
      user: user._id,
      status: 'frozen',
      eligibleAt: { $lte: now },
    }).sort({ eligibleAt: 1 });
    if (!frozen) break;
    await normalizeDailyCycle(user, config, frozen);
    if (new Date(frozen.eligibleAt) > now) break;

    const claimed = await HourlyProfit.findOneAndUpdate(
      { _id: frozen._id, status: 'frozen' },
      { $set: { status: 'available' } },
      { new: true }
    );
    if (!claimed) continue;

    const txType = user.vipLevel === 0 ? 'training_reward' : 'daily_profit';
    const tx = await Transaction.create({
      user: user._id,
      type: txType,
      status: 'approved',
      amount: claimed.amount,
      netAmount: claimed.amount,
      note: `ربح 24 ساعة — ${claimed.planName}`,
      approvedBy: user._id,
      approvedAt: claimed.eligibleAt,
    });

    await HourlyProfit.updateOne({ _id: claimed._id }, { $set: { transaction: tx._id } });
    await Wallet.findOneAndUpdate(
      { user: user._id },
      {
        $inc: {
          balance: claimed.amount,
          totalEarned: claimed.amount,
          availableProfit: claimed.amount,
        },
      },
      { upsert: true }
    );
    await User.updateOne({ _id: user._id }, { $set: { vipLastHourlyRewardAt: claimed.eligibleAt } });

    credited += 1;
    amount += claimed.amount;

    if (!user.vipExpiresAt || claimed.eligibleAt < user.vipExpiresAt) {
      await createFrozenCycle(user, config, claimed.eligibleAt);
    }
  }

  await ensureHourlyCycle(await User.findById(user._id), config);
  return { status: credited ? 'credited' : 'waiting', credited, amount: +amount.toFixed(6) };
}

async function getHourlyProfitStatus(userOrId) {
  const user = typeof userOrId === 'object' && userOrId._id
    ? userOrId
    : await User.findById(userOrId);
  await processUserHourlyRewards(user);
  const freshUser = await User.findById(user._id);
  const { active, config } = planStatus(freshUser);
  const frozen = await HourlyProfit.findOne({ user: freshUser._id, status: 'frozen' }).sort({ eligibleAt: 1 });
  await normalizeDailyCycle(freshUser, config, frozen);
  const [availableResult, withdrawnResult, recent] = await Promise.all([
    HourlyProfit.aggregate([
      { $match: { user: freshUser._id, status: 'available' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]),
    HourlyProfit.aggregate([
      { $match: { user: freshUser._id, status: 'withdrawn' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]),
    HourlyProfit.find({ user: freshUser._id }).sort({ eligibleAt: -1 }).limit(12).lean(),
  ]);

  const now = Date.now();
  const frozenProfit = frozen ? frozen.amount : 0;
  const nextEligibleAt = frozen?.eligibleAt || null;
  const msRemaining = nextEligibleAt ? Math.max(0, new Date(nextEligibleAt).getTime() - now) : 0;
  const availableProfit = +(availableResult[0]?.sum || 0).toFixed(6);

  return {
    active,
    planName: config ? config.name : 'غير نشط',
    vipLevel: freshUser.vipLevel,
    dailyProfit: config ? +(config.dailyTotal ?? config.dailyProfit ?? 0).toFixed(2) : 0,
    hourlyProfit: config ? hourlyAmount(config) : 0,
    cycleProfit: config ? dailyAmount(config) : 0,
    nextEligibleAt,
    msRemaining,
    secondsRemaining: Math.ceil(msRemaining / 1000),
    frozenProfit,
    availableProfit,
    withdrawnProfit: +(withdrawnResult[0]?.sum || 0).toFixed(6),
    status: !active ? 'الخطة غير نشطة' : availableProfit > 0 ? 'الربح متاح للسحب' : 'الربح في مرحلة المعالجة',
    canWithdraw: active && availableProfit > 0,
    timezone: PROFIT_TZ,
    logs: recent,
  };
}

async function markAvailableProfitWithdrawn(userId, amount, withdrawTxId) {
  let remaining = Number(amount);
  const logs = await HourlyProfit.find({ user: userId, status: 'available' }).sort({ eligibleAt: 1 });
  for (const log of logs) {
    if (remaining <= 0) break;
    if (log.amount <= remaining + 0.000001) {
      log.status = 'withdrawn';
      log.withdrawTx = withdrawTxId;
      await log.save();
      remaining = +(remaining - log.amount).toFixed(6);
    } else {
      const withdrawnPart = +remaining.toFixed(6);
      log.amount = +(log.amount - withdrawnPart).toFixed(6);
      await log.save();
      await HourlyProfit.create({
        user: log.user,
        userName: log.userName,
        vipLevel: log.vipLevel,
        planName: log.planName,
        amount: withdrawnPart,
        cycleStart: new Date(log.cycleStart.getTime() + (Date.now() % 100000)),
        eligibleAt: log.eligibleAt,
        status: 'withdrawn',
        transaction: log.transaction,
        withdrawTx: withdrawTxId,
        timezone: log.timezone || PROFIT_TZ,
      });
      remaining = 0;
    }
  }
}

/* ── Telegram notification ───────────────────────────────────────────────── */
const notifyAdmin = async (message) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_ADMIN_CHAT;
  if (!token || !chat) return;
  try {
    const fetch = require('node-fetch');
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: message }),
    });
  } catch (_) {}
};

/* ── Referral commissions (on deposit approval only) ────────────────────── */
const addReferralCommissions = async (depositUserId, depositAmount) => {
  const user = await User.findById(depositUserId);
  if (!user) return;

  const refs = [
    { userId: user.referredBy,   pct: REFERRAL_RATES.L1, type: 'referral_l1' },
    { userId: user.referredByL2, pct: REFERRAL_RATES.L2, type: 'referral_l2' },
    { userId: user.referredByL3, pct: REFERRAL_RATES.L3, type: 'referral_l3' },
  ];

  for (const { userId, pct, type } of refs) {
    if (!userId) continue;
    const commission = +(depositAmount * pct / 100).toFixed(2);
    if (commission <= 0) continue;

    await Wallet.findOneAndUpdate(
      { user: userId },
      {
        $setOnInsert: { user: userId },
        $inc: { balance: commission, totalEarned: commission },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await Transaction.create({
      user: userId, type, status: 'approved',
      amount: commission, netAmount: commission,
      note: `عمولة إحالة ${pct}% من إيداع $${depositAmount}`,
    });
  }
};

const addActivityDepositBonus = async (depositUserId, depositAmount, adminId, depositTxId, depositCreatedAt) => {
  const bonus = getActivityDepositBonus(depositAmount);
  if (bonus <= 0) return { credited: false, amount: 0, reason: 'below_threshold' };
  if (!isWithinActivityBonusWindow(depositCreatedAt)) {
    return { credited: false, amount: 0, reason: 'expired' };
  }

  const user = await User.findById(depositUserId).select('_id name isFrozen');
  if (!user || user.isFrozen) return { credited: false, amount: 0, reason: 'inactive' };

  const existing = await Transaction.findOne({
    user: depositUserId,
    type: 'activity_bonus',
    promoCode: ACTIVITY_BONUS_PROMO_CODE,
  }).select('_id amount');
  if (existing) return { credited: false, amount: existing.amount || 0, reason: 'already_claimed' };

  let bonusTx;
  try {
    bonusTx = await Transaction.create({
      user: depositUserId,
      type: 'activity_bonus',
      status: 'approved',
      amount: bonus,
      netAmount: bonus,
      promoCode: ACTIVITY_BONUS_PROMO_CODE,
      relatedTransaction: depositTxId,
      note: 'بونص النشاط الجديد - يضاف مرة واحدة بعد اعتماد الإيداع',
      approvedBy: adminId,
      approvedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) return { credited: false, amount: 0, reason: 'already_claimed' };
    throw err;
  }

  try {
    const wallet = await Wallet.findOneAndUpdate(
      { user: depositUserId },
      {
        $setOnInsert: { user: depositUserId },
        $inc: { balance: bonus, totalEarned: bonus, totalBonus: bonus },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return { credited: true, amount: bonus, transactionId: bonusTx._id, wallet };
  } catch (err) {
    await Transaction.deleteOne({ _id: bonusTx._id }).catch(() => {});
    throw err;
  }
};

/*
 * FIX #1: Race-condition-safe reward processor.
 *
 * Previous version fetched `user` outside any lock then mutated it inside
 * a session — two concurrent runs could both observe trainingDaysLeft > 0,
 * both decrement, and both credit the wallet.
 *
 * Fix: sessions removed (require replica-set, unavailable here).
 *      Instead we use MongoDB's document-level atomic `findOneAndUpdate`
 *      with a strict condition as a compare-and-swap gate.
 *      The idempotency check (existing reward transaction today) is the
 *      fast path; the atomic user update is the race-condition guard.
 */
const processUserReward = async (user, todayStr) => {
  try {
    const dayStart = new Date(todayStr);
    const dayEnd   = new Date(todayStr);
    dayEnd.setHours(23, 59, 59, 999);

    /* ── Idempotency fast-path ───────────────────────────────────────────── */
    const alreadyRewarded = await Transaction.findOne({
      user: user._id,
      type: { $in: ['daily_profit', 'daily_bonus', 'training_reward'] },
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });
    if (alreadyRewarded) return { status: 'skipped' };

    /* ── Training plan ──────────────────────────────────────────────────── */
    if (user.vipLevel === 0 && user.trainingDaysLeft > 0) {
      const trainingResult = await processTrainingReward(user, new Date());
      return {
        status: trainingResult.credited ? 'rewarded' : 'skipped',
        amount: trainingResult.amount,
        type: 'training',
      };
    }

    /* ── Paid VIP plan ──────────────────────────────────────────────────── */
    if (user.vipLevel >= 1 && user.isVipActive()) {
      const config = VIP_LEVELS.find(v => v.level === user.vipLevel);
      if (!config) return { status: 'skipped' };

      const profit = +config.dailyProfit.toFixed(2);
      const bonus  = config.dailyBonus > 0 ? config.dailyBonus : 0;
      const total  = +(config.dailyTotal || profit + bonus).toFixed(2);

      /*
       * Atomic guard: update lastRewardDate to today only if it hasn't been set.
       * This prevents multiple rewards if the job runs twice.
       */
      const updated = await User.findOneAndUpdate(
        { _id: user._id, lastRewardDate: { $ne: todayStr } },
        { $set: { lastRewardDate: todayStr } },
        { new: true }
      );
      if (!updated) return { status: 'skipped' };

      await Wallet.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: total, totalEarned: total, totalBonus: bonus } }
      );

      const txDocs = [{
        user: user._id, type: 'daily_profit', status: 'approved',
        amount: profit, netAmount: profit,
        note: `ربح يومي — ${config.name} (${config.monthlyPct}% شهرياً)`,
      }];
      if (bonus > 0) {
        txDocs.push({
          user: user._id, type: 'daily_bonus', status: 'approved',
          amount: bonus, netAmount: bonus,
          note: `مكافأة يومية ثابتة — ${config.name}`,
        });
      }
      await Transaction.insertMany(txDocs);

      return { status: 'rewarded', amount: total, type: 'vip' };
    }

    return { status: 'skipped' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
};

/* -- Main daily runner -- */
const runDailyRewards = async () => {
  // Morocco timezone (Africa/Casablanca) -- UTC+1 winter / UTC+0 summer
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });
  console.log('[Rewards] Running daily rewards for ' + todayStr + ' (Africa/Casablanca)...');

  let rewarded = 0, skipped = 0, errors = 0, totalPaid = 0;

  try {
    const users = await User.find({ vipLevel: { $gte: 0 }, isFrozen: false });
    for (const user of users) {
      const r = await processUserReward(user, todayStr);
      if (r.status === 'rewarded') { rewarded++; totalPaid += r.amount || 0; }
      else if (r.status === 'skipped') skipped++;
      else { errors++; console.error('[Rewards] Error for user', user._id, r.error); }
    }
  } catch (err) {
    console.error('[Rewards] Fatal:', err.message);
    errors++;
  }

  console.log('[Rewards] Done -- rewarded:' + rewarded + ' skipped:' + skipped + ' errors:' + errors + ' total:$' + totalPaid.toFixed(2));
  const arabicSummary = '\u{1F4CA} \u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629\n\u0645\u064F\u0643\u0627\u0641\u0623: ' + rewarded + ' | \u062A\u062E\u0637\u0649: ' + skipped + ' | \u0623\u062E\u0637\u0627\u0621: ' + errors + '\n\u0625\u062C\u0645\u0627\u0644\u064A: $' + totalPaid.toFixed(2);
  await notifyAdmin(arabicSummary).catch(() => {});
};

const runHourlyRewards = async () => {
  const stamp = new Date().toLocaleString('en-GB', { timeZone: PROFIT_TZ });
  console.log('[Rewards] Running hourly rewards at ' + stamp + ' (' + PROFIT_TZ + ')...');

  let creditedUsers = 0, totalCycles = 0, errors = 0, totalPaid = 0;
  try {
    const users = await User.find({ vipLevel: { $gte: 0 }, isFrozen: false });
    for (const user of users) {
      try {
        const r = await processUserHourlyRewards(user);
        if (r.credited > 0) {
          creditedUsers++;
          totalCycles += r.credited;
          totalPaid += r.amount || 0;
        }
      } catch (err) {
        errors++;
        console.error('[Rewards] Hourly error for user', user._id, err.message);
      }
    }
  } catch (err) {
    errors++;
    console.error('[Rewards] Hourly fatal:', err.message);
  }

  console.log('[Rewards] Hourly done -- users:' + creditedUsers + ' cycles:' + totalCycles + ' errors:' + errors + ' total:$' + totalPaid.toFixed(4));
};

/* -- Cron -- midnight Morocco time -- */
const startRewardsCron = () => {
  const schedule = process.env.HOURLY_CRON || '0 * * * *';
  cron.schedule(schedule, runHourlyRewards, { timezone: PROFIT_TZ });
  console.log('[Rewards] Cron scheduled: ' + schedule + ' ' + PROFIT_TZ + ' (hourly)');
};

module.exports = {
  startRewardsCron,
  runDailyRewards,
  runHourlyRewards,
  processUserHourlyRewards,
  getHourlyProfitStatus,
  markAvailableProfitWithdrawn,
  addReferralCommissions,
  addActivityDepositBonus,
  getActivityDepositBonus,
  notifyAdmin,
};
