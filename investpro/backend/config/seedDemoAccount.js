require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { Wallet, Transaction, HourlyProfit, Notification } = require('../models/Wallet');

const DEMO = {
  marker: 'DEMO_AHMED_MOUJDOBE',
  name: 'Ahmed Moujdobe',
  email: 'ahmed.moujdobe.demo@gmail.com',
  passwordHash: '$2a$12$8oOSVGq29SDq0xAn0YmwJuMt1k4SAHsXnxvsLq6zqo3MfrZSe3mAG',
  vipLevel: 3,
  totalDeposited: 100,
  dailyProfit: 5,
  profitDays: 30,
  approvedWithdrawals: [66, 22, 10],
  rejectedWithdrawals: [211],
};

DEMO.totalEarned = DEMO.dailyProfit * DEMO.profitDays;
DEMO.totalWithdrawn = DEMO.approvedWithdrawals.reduce((sum, amount) => sum + amount, 0);
DEMO.balance = DEMO.totalEarned - DEMO.totalWithdrawn;

async function upsertDemoUser(now, expiresAt) {
  let user = await User.findOne({ email: DEMO.email });

  if (!user) {
    user = await User.create({
      name: DEMO.name,
      email: DEMO.email,
      password: 'TemporaryDemoPassword91!',
      vipLevel: DEMO.vipLevel,
      vipActivatedAt: now,
      vipExpiresAt: expiresAt,
      vipLastHourlyRewardAt: now,
      trainingDaysLeft: 0,
      trainingCompleted: true,
      isAdmin: false,
      isFrozen: false,
    });
  }

  await User.collection.updateOne(
    { _id: user._id },
    {
      $set: {
        name: DEMO.name,
        email: DEMO.email,
        password: DEMO.passwordHash,
        vipLevel: DEMO.vipLevel,
        vipActivatedAt: now,
        vipExpiresAt: expiresAt,
        vipLastHourlyRewardAt: now,
        trainingDaysLeft: 0,
        trainingCompleted: true,
        isAdmin: false,
        isFrozen: false,
        frozenReason: '',
        updatedAt: now,
      },
    }
  );

  return User.findById(user._id);
}

async function seedDemoAccount() {
  if (process.env.SEED_DEMO_ACCOUNT === 'false') {
    console.log('Demo account seed skipped');
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for demo account seed');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const withdrawalDates = [
    new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  ];
  const rejectedWithdrawalDates = [
    new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  ];
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const cycleStart = new Date(now);
  cycleStart.setMinutes(0, 0, 0);

  const user = await upsertDemoUser(now, expiresAt);

  await Wallet.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        balance: DEMO.balance,
        totalDeposited: DEMO.totalDeposited,
        totalWithdrawn: DEMO.totalWithdrawn,
        totalEarned: DEMO.totalEarned,
        availableProfit: DEMO.balance,
        frozenProfit: 0,
        pendingWithdraw: 0,
        lastDepositAt: oneMonthAgo,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Transaction.deleteMany({
    $or: [
      { user: user._id, note: new RegExp('^' + DEMO.marker + ':') },
      { txHash: new RegExp('^' + DEMO.marker + '_') },
    ],
  });

  await Transaction.insertMany([
    {
      user: user._id,
      type: 'deposit',
      amount: DEMO.totalDeposited,
      status: 'approved',
      txHash: `${DEMO.marker}_DEPOSIT_100_${user._id}`,
      note: `${DEMO.marker}: last deposit one month ago`,
      createdAt: oneMonthAgo,
      approvedAt: oneMonthAgo,
    },
    {
      user: user._id,
      type: 'vip_purchase',
      amount: DEMO.totalDeposited,
      status: 'approved',
      note: `${DEMO.marker}: professional VIP plan active`,
      createdAt: now,
      approvedAt: now,
    },
    ...Array.from({ length: DEMO.profitDays }, (_, index) => {
      const createdAt = new Date(oneMonthAgo.getTime() + (index + 1) * 24 * 60 * 60 * 1000);

      return {
        user: user._id,
        type: 'daily_profit',
        amount: DEMO.dailyProfit,
        status: 'approved',
        note: `${DEMO.marker}: VIP Gold daily profit day ${index + 1}`,
        createdAt,
        approvedAt: createdAt,
      };
    }),
    ...DEMO.approvedWithdrawals.map((amount, index) => {
      const fee = +(amount * 0.1).toFixed(2);
      const netAmount = +(amount - fee).toFixed(2);
      const createdAt = withdrawalDates[index] || now;

      return {
        user: user._id,
        type: 'withdraw',
        amount,
        fee,
        netAmount,
        status: 'approved',
        paymentMethod: 'TRC20',
        toAddress: `DEMO-${index + 1}-WITHDRAW-ADDRESS`,
        txHash: `${DEMO.marker}_WITHDRAW_${index + 1}_${amount}_${user._id}`,
        note: `${DEMO.marker}: approved VIP profit withdrawal ${amount}`,
        createdAt,
        approvedAt: createdAt,
      };
    }),
    ...DEMO.rejectedWithdrawals.map((amount, index) => {
      const createdAt = rejectedWithdrawalDates[index] || now;

      return {
        user: user._id,
        type: 'withdraw',
        amount,
        fee: 0,
        netAmount: 0,
        status: 'rejected',
        paymentMethod: 'TRC20',
        toAddress: `DEMO-REJECTED-${index + 1}-WITHDRAW-ADDRESS`,
        txHash: `${DEMO.marker}_REJECTED_WITHDRAW_${index + 1}_${amount}_${user._id}`,
        note: `${DEMO.marker}: rejected because it exceeds available VIP profit`,
        adminNote: 'Insufficient available VIP profit for this withdrawal amount.',
        createdAt,
      };
    }),
  ]);

  await HourlyProfit.deleteMany({ user: user._id, planName: new RegExp('^' + DEMO.marker + ':') });
  await HourlyProfit.create({
    user: user._id,
    userName: user.name,
    vipLevel: DEMO.vipLevel,
    planName: `${DEMO.marker}: professional level`,
    amount: DEMO.dailyProfit,
    cycleStart,
    eligibleAt: now,
    status: 'available',
    timezone: 'Africa/Casablanca',
  });

  await Notification.deleteMany({ user: user._id, title: `${DEMO.marker}: VIP ACTIVE` });
  await Notification.create({
    user: user._id,
    title: `${DEMO.marker}: VIP ACTIVE`,
    message: 'Demo account is now VIP ACTIVE on the professional plan.',
    type: 'success',
  });

  console.log('Demo account seeded:', DEMO.email);
}

seedDemoAccount()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Demo account seed error:', err.message);
    if (mongoose.connection.readyState) await mongoose.disconnect();
    process.exit(1);
  });
