const cron      = require('node-cron');
const User      = require('../models/User');
const { Wallet, Transaction, HourlyProfit } = require('../models/Wallet');
const { VIP_LEVELS, REFERRAL_RATES } = require('../config/vipConfig');

const PROFIT_TZ = 'Africa/Casablanca';
const HOUR_MS = 60 * 60 * 1000;

function hourlyAmount(config) {
  return +(Number(config?.dailyTotal ?? config?.dailyProfit ?? 0) / 24).toFixed(6);
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
  const eligibleAt = new Date(Math.min(start.getTime() + HOUR_MS, expiresAt ? expiresAt.getTime() : start.getTime() + HOUR_MS));
  if (eligibleAt <= start) return null;

  try {
    return await HourlyProfit.create({
      user: user._id,
      userName: user.name,
      vipLevel: user.vipLevel,
      planName: config.name,
      amount: hourlyAmount(config),
      cycleStart: start,
      eligibleAt,
      status: 'frozen',
      timezone: PROFIT_TZ,
    });
  } catch (err) {
    if (err.code === 11000) {
      return HourlyProfit.findOne({ user: user._id, cycleStart: start });
    }
    throw err;
  }
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
      note: `ربح ساعة — ${claimed.planName}`,
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
      { $inc: { balance: commission, totalEarned: commission } }
    );
    await Transaction.create({
      user: userId, type, status: 'approved',
      amount: commission, netAmount: commission,
      note: `عمولة إحالة ${pct}% من إيداع $${depositAmount}`,
    });
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
      const reward = parseFloat(process.env.TRAINING_DAILY || 0.10);

      /*
       * Atomic guard: decrement trainingDaysLeft AND set lastRewardDate
       * only if trainingDaysLeft > 0 AND lastRewardDate is not today.
       */
      const updated = await User.findOneAndUpdate(
        { 
          _id: user._id, 
          vipLevel: 0, 
          trainingDaysLeft: { $gt: 0 },
          lastRewardDate: { $ne: todayStr }
        },
        { 
          $inc: { trainingDaysLeft: -1 },
          $set: { lastRewardDate: todayStr }
        },
        { new: true }
      );
      if (!updated) return { status: 'skipped' };

      if (updated.trainingDaysLeft <= 0) {
        await User.updateOne(
          { _id: updated._id },
          { $set: { trainingCompleted: true, vipLevel: -1, trainingDaysLeft: 0 } }
        );
      }

      await Wallet.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: reward, totalEarned: reward } }
      );

      const completedDay = (parseInt(process.env.TRAINING_DAYS || 5)) - updated.trainingDaysLeft;
      await Transaction.create({
        user: user._id, type: 'training_reward', status: 'approved',
        amount: reward, netAmount: reward,
        note: `مكافأة تدريب يومية — يوم ${completedDay}`,
      });

      return { status: 'rewarded', amount: reward, type: 'training' };
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
  notifyAdmin,
};
