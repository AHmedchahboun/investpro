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
  balance: 546,
  totalDeposited: 100,
  dailyProfit: 5,
};

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
        totalWithdrawn: 0,
        totalEarned: DEMO.balance,
        availableProfit: DEMO.balance,
        frozenProfit: 0,
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
    {
      user: user._id,
      type: 'daily_profit',
      amount: DEMO.balance,
      status: 'approved',
      note: `${DEMO.marker}: withdrawable demo balance`,
      createdAt: now,
      approvedAt: now,
    },
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
