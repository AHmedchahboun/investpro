require('dotenv').config();

const fetch = require('node-fetch');

const token = process.env.TELEGRAM_BOT_TOKEN;
const port = process.env.PORT || 5000;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const localWebhookUrl = process.env.TELEGRAM_LOCAL_WEBHOOK_URL || `http://localhost:${port}/api/telegram/webhook`;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is missing. Add it to backend/.env first.');
  process.exit(1);
}

const telegramApi = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function telegramRequest(method, payload = {}) {
  const response = await fetch(telegramApi(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

async function forwardUpdate(update) {
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['x-telegram-bot-api-secret-token'] = secret;

  const response = await fetch(localWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Local webhook failed: ${response.status} ${body}`);
  }
}

async function main() {
  let offset = 0;
  console.log(`Telegram polling is running. Forwarding updates to ${localWebhookUrl}`);
  console.log('Keep your backend server running in another terminal.');

  while (true) {
    try {
      const updates = await telegramRequest('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message'],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await forwardUpdate(update);
      }
    } catch (err) {
      console.error(`[telegram:poll] ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main();
