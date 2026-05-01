const router = require('express').Router();
const { sendMessage, notifyAdmin, setWebhook, getWebhookInfo } = require('../utils/telegram');

const botName = 'InvestPro Support';

function senderLabel(from = {}) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  const username = from.username ? `@${from.username}` : 'بدون username';
  return `${name || 'مستخدم'} (${username})`;
}

function isAdminChat(chatId) {
  return String(chatId) === String(process.env.TELEGRAM_ADMIN_CHAT || '');
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

  await sendMessage(targetChat, `رسالة من دعم InvestPro:\n\n${replyText}`);
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

    if (text === '/start' || text === '/help' || text === '/id') {
      await sendMessage(chatId,
        `مرحباً بك في دعم InvestPro.\n\n` +
        `أرسل مشكلتك هنا وسيتم تحويلها لفريق الدعم.\n` +
        `رقم المحادثة الخاص بك: ${chatId}`
      );

      if (!process.env.TELEGRAM_ADMIN_CHAT) {
        await sendMessage(chatId,
          `ملاحظة للإدارة: ضع هذا الرقم في Render:\n` +
          `TELEGRAM_ADMIN_CHAT=${chatId}`
        );
      }
      return;
    }

    const msg = text || '[رسالة بدون نص أو مرفق]';
    await notifyAdmin(
      `رسالة دعم جديدة\n\n` +
      `المستخدم: ${senderLabel(message.from)}\n` +
      `Chat ID: ${chatId}\n\n` +
      `الرسالة:\n${msg}\n\n` +
      `للرد:\n/reply ${chatId} نص الرد`
    );

    await sendMessage(chatId,
      `تم استلام رسالتك بنجاح.\n` +
      `فريق الدعم سيرد عليك في أقرب وقت.`
    );
  } catch (err) {
    console.error('[Telegram Webhook]', err.message);
  }
});

module.exports = router;
