const router = require('express').Router();
const { sendMessage, notifyAdmin, setWebhook, getWebhookInfo } = require('../utils/telegram');

const botName = 'InvestPro Support';

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['💰 مشكلة إيداع', '💸 مشكلة سحب'],
      ['👑 خطط VIP', '🔐 تسجيل الدخول'],
      ['💼 الرصيد والأرباح', '👨‍💼 تواصل مع الدعم'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

function senderLabel(from = {}) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  const username = from.username ? `@${from.username}` : 'بدون username';
  return `${name || 'مستخدم'} (${username})`;
}

function isAdminChat(chatId) {
  return String(chatId) === String(process.env.TELEGRAM_ADMIN_CHAT || '');
}

function normalizeText(text = '') {
  return text
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function includesAny(text, words) {
  const t = normalizeText(text);
  return words.some(word => t.includes(normalizeText(word)));
}

function autoReply(text, chatId) {
  if (!text) {
    return {
      handled: true,
      text:
        `تم استلام مرفقك.\n\n` +
        `إذا كان هذا إثبات إيداع، تأكد من إرسال:\n` +
        `1. المبلغ\n2. الشبكة TRC20/BEP20/POLYGON\n3. Hash العملية\n\n` +
        `رقم محادثتك: ${chatId}`,
    };
  }

  if (includesAny(text, ['/start', '/help', 'القائمه', 'menu'])) {
    return {
      handled: true,
      text:
        `مرحباً بك في دعم InvestPro.\n\n` +
        `اختر نوع المشكلة من الأزرار أو اكتب رسالتك مباشرة.\n` +
        `رقم محادثتك: ${chatId}`,
      options: mainKeyboard,
    };
  }

  if (includesAny(text, ['/id', 'chat id', 'رقم المحادثه'])) {
    return { handled: true, text: `رقم محادثتك هو:\n${chatId}` };
  }

  if (includesAny(text, ['ايداع', 'شحن', 'deposit', 'hash', 'txid', 'لم يظهر', 'ما وصل'])) {
    return {
      handled: true,
      text:
        `حل مشكلة الإيداع:\n\n` +
        `1. افتح لوحة المستخدم ثم المحفظة.\n` +
        `2. تأكد أن الإيداع حالته "معلق" أو "معتمد".\n` +
        `3. إذا أرسلت USDT، أرسل هنا Hash العملية.\n` +
        `4. تأكد أنك استخدمت نفس الشبكة المختارة داخل الموقع.\n\n` +
        `إذا كان الإيداع معتمداً ولا يظهر في الرصيد، اكتب:\n` +
        `الإيداع معتمد ولا يظهر + بريد حسابك.`,
    };
  }

  if (includesAny(text, ['سحب', 'withdraw', 'usdt', 'محفظه السحب', 'لم يصل السحب'])) {
    return {
      handled: true,
      text:
        `حل مشكلة السحب:\n\n` +
        `1. الأرباح المجمدة لا يمكن سحبها حتى تصبح متاحة.\n` +
        `2. طلبات السحب تخضع للمراجعة الأمنية.\n` +
        `3. تأكد من عنوان USDT والشبكة قبل الطلب.\n` +
        `4. إذا تأخر السحب، أرسل بريد حسابك ورقم العملية من سجل العمليات.`,
    };
  }

  if (includesAny(text, ['vip', 'خطه', 'خطة', 'شراء', 'تفعيل', 'استثمار'])) {
    return {
      handled: true,
      text:
        `طريقة تفعيل VIP:\n\n` +
        `1. اشحن رصيدك أولاً.\n` +
        `2. انتظر اعتماد الإيداع من الإدارة.\n` +
        `3. افتح صفحة VIP.\n` +
        `4. اختر الخطة ثم اضغط تأكيد التفعيل.\n\n` +
        `إذا كان الرصيد موجوداً والزر لا يعمل، اكتب:\n` +
        `زر VIP لا يعمل + اسم الخطة + بريد حسابك.`,
    };
  }

  if (includesAny(text, ['دخول', 'login', 'كلمه المرور', 'كلمة المرور', 'حساب', 'تسجيل'])) {
    return {
      handled: true,
      text:
        `مساعدة تسجيل الدخول:\n\n` +
        `1. تأكد من كتابة البريد بدون فراغات.\n` +
        `2. تأكد من كلمة المرور.\n` +
        `3. إذا نسيت كلمة المرور، استخدم صفحة الاستعادة إن كانت متاحة.\n` +
        `4. إذا كان الحساب مجمداً، اكتب بريد حسابك وسيتم مراجعته.`,
    };
  }

  if (includesAny(text, ['رصيد', 'ارباح', 'أرباح', 'مجمد', 'profit', 'balance'])) {
    return {
      handled: true,
      text:
        `شرح الرصيد والأرباح:\n\n` +
        `الرصيد = الإيداعات المعتمدة - السحوبات + الأرباح المتاحة.\n` +
        `الأرباح تكون مجمدة لمدة ساعة، ثم تصبح قابلة للسحب تلقائياً حسب خطة VIP.\n\n` +
        `إذا كان الرقم غير صحيح، أرسل بريد حسابك وصورة من المحفظة.`,
    };
  }

  if (includesAny(text, ['دعم بشري', 'ادمن', 'مشرف', 'انسان', 'human', 'support', 'تواصل مع الدعم'])) {
    return {
      handled: false,
      text:
        `تم تحويل طلبك إلى فريق الدعم.\n` +
        `اكتب تفاصيل المشكلة كاملة: البريد، نوع العملية، المبلغ، و Hash إن وجد.`,
    };
  }

  return {
    handled: false,
    text:
      `وصلت رسالتك، وسيتم تحويلها لفريق الدعم.\n\n` +
      `لتسريع الحل، أرسل:\n` +
      `1. بريد حسابك\n2. نوع المشكلة\n3. المبلغ أو اسم الخطة\n4. Hash العملية إن وجدت`,
  };
}

async function handleAdminCommand(message) {
  const text = message.text || '';
  const chatId = message.chat.id;

  if (text === '/help' || text === '/start') {
    await sendMessage(chatId,
      `لوحة دعم ${botName}\n\n` +
      `للرد على مستخدم:\n` +
      `/reply CHAT_ID نص الرد\n\n` +
      `مثال:\n` +
      `/reply 123456789 تم استلام طلبك وسيتم مراجعته.`
    );
    return true;
  }

  const match = text.match(/^\/reply\s+(-?\d+)\s+([\s\S]+)/);
  if (!match) return false;

  const targetChat = match[1];
  const replyText = match[2].trim();
  if (!replyText) {
    await sendMessage(chatId, 'اكتب نص الرد بعد chat id.');
    return true;
  }

  await sendMessage(targetChat, `رسالة من دعم InvestPro:\n\n${replyText}`, mainKeyboard);
  await sendMessage(chatId, `تم إرسال الرد إلى ${targetChat}.`);
  return true;
}

router.get('/status', async (req, res) => {
  try {
    const info = await getWebhookInfo();
    res.json({
      success: true,
      botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      adminChatConfigured: Boolean(process.env.TELEGRAM_ADMIN_CHAT),
      webhook: info,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/setup-webhook', async (req, res) => {
  try {
    const setupKey = process.env.TELEGRAM_SETUP_KEY || process.env.TELEGRAM_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === 'production' && !setupKey) {
      return res.status(400).json({ success: false, message: 'TELEGRAM_SETUP_KEY is required in production' });
    }
    if (setupKey && req.query.key !== setupKey) {
      return res.status(403).json({ success: false, message: 'Invalid setup key' });
    }

    const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
    if (!siteUrl) return res.status(400).json({ success: false, message: 'SITE_URL is required' });

    const webhookUrl = `${siteUrl}/api/telegram/webhook`;
    const result = await setWebhook(webhookUrl);
    res.json({ success: true, webhookUrl, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/webhook', async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    return res.status(403).json({ success: false });
  }

  res.json({ success: true });

  try {
    const message = req.body.message;
    if (!message || !message.chat) return;

    const chatId = message.chat.id;
    const text = (message.text || message.caption || '').trim();

    if (isAdminChat(chatId) && await handleAdminCommand(message)) return;

    const reply = autoReply(text, chatId);
    await sendMessage(chatId, reply.text, reply.options || mainKeyboard);

    const msg = text || '[رسالة بدون نص أو مرفق]';
    await notifyAdmin(
      `${reply.handled ? 'رسالة دعم تمت الإجابة عليها تلقائياً' : 'رسالة دعم تحتاج مراجعة'}\n\n` +
      `المستخدم: ${senderLabel(message.from)}\n` +
      `Chat ID: ${chatId}\n\n` +
      `الرسالة:\n${msg}\n\n` +
      `للرد:\n/reply ${chatId} نص الرد`
    );
  } catch (err) {
    console.error('[Telegram Webhook]', err.message);
  }
});

module.exports = router;
