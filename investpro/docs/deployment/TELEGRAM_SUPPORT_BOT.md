# Telegram Support Bot

The backend includes Telegram support routes:

```text
backend/routes/telegram.js
backend/utils/telegram.js
```

## Bot Setup

1. Open Telegram.
2. Message `@BotFather`.
3. Create or select your bot.
4. Copy the API token.

Render variable:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
```

## Admin Chat ID

1. Temporarily delete webhook if needed:

```text
https://api.telegram.org/botTOKEN/deleteWebhook
```

2. Send `/start` to your bot.
3. Open:

```text
https://api.telegram.org/botTOKEN/getUpdates
```

4. Find:

```json
"chat":{"id":123456789}
```

Render variable:

```env
TELEGRAM_ADMIN_CHAT=123456789
```

## Webhook Setup

Set:

```env
TELEGRAM_WEBHOOK_SECRET=random_secret
TELEGRAM_SETUP_KEY=random_private_setup_key
```

Then open:

```text
https://YOUR_RENDER_APP.onrender.com/api/telegram/setup-webhook?key=YOUR_TELEGRAM_SETUP_KEY
```

Check:

```text
https://YOUR_RENDER_APP.onrender.com/api/telegram/status
```

## Admin Reply

From admin Telegram chat:

```text
/reply CHAT_ID message text
```

