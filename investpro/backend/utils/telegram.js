const fetch = require('node-fetch');
const FormData = require('form-data');

const apiUrl = (method) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return `https://api.telegram.org/bot${token}/${method}`;
};

const telegramRequest = async (method, payload = {}) => {
  const res = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
};

const sendMessage = (chatId, text, options = {}) =>
  telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || undefined,
    disable_web_page_preview: true,
    ...options,
  });

const notifyAdmin = async (message) => {
  const chat = process.env.TELEGRAM_ADMIN_CHAT;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chat) return;
  try {
    await sendMessage(chat, message);
  } catch (_) {}
};

const sendPhoto = async (chatId, photoBuffer, caption = '', contentType = 'image/jpeg') => {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', photoBuffer, {
    filename: 'support-image',
    contentType,
  });
  if (caption) form.append('caption', caption);

  const res = await fetch(apiUrl('sendPhoto'), {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.description || 'Telegram sendPhoto failed');
  }
  return data.result;
};

const notifyAdminWithPhoto = async (message, photoBuffer, contentType) => {
  const chat = process.env.TELEGRAM_ADMIN_CHAT;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chat) return false;
  try {
    await sendMessage(chat, message);
    if (photoBuffer) await sendPhoto(chat, photoBuffer, 'صورة مرفقة مع طلب الدعم', contentType);
    return true;
  } catch (err) {
    console.error('[Telegram Admin Photo]', err.message);
    return false;
  }
};

const setWebhook = async (url) =>
  telegramRequest('setWebhook', {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ['message'],
  });

const getWebhookInfo = async () => telegramRequest('getWebhookInfo');

module.exports = {
  telegramRequest,
  sendMessage,
  sendPhoto,
  notifyAdmin,
  notifyAdminWithPhoto,
  setWebhook,
  getWebhookInfo,
};
