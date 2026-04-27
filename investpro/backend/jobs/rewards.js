const cron      = require('node-cron');
const User      = require('../models/User');
const { Wallet, Transaction } = require('../models/Wallet');
const { VIP_LEVELS, REFERRAL_RATES } = require('../config/vipConfig');

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

/* -- Cron -- midnight Morocco time -- */
const startRewardsCron = () => {
  // '0 23 * * *' UTC = 00:00 Morocco winter (UTC+1)
  const schedule = process.env.DAILY_CRON || '0 23 * * *';
  cron.schedule(schedule, runDailyRewards, { timezone: 'UTC' });
  console.log('[Rewards] Cron scheduled: ' + schedule + ' UTC (Morocco midnight)');
};

module.exports = { startRewardsCron, runDailyRewards, addReferralCommissions, notifyAdmin };
