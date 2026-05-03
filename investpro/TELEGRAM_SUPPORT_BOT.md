# Telegram support bot setup

This project already includes an InvestPro Telegram support bot at:

- `backend/routes/telegram.js`
- `backend/utils/telegram.js`

The bot can:

- Reply automatically to common support questions.
- Forward customer messages to the admin Telegram chat.
- Let the admin reply with `/reply CHAT_ID message`.

## 1. Create the bot

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a name, for example `InvestPro Support`.
4. Choose a username ending in `bot`.
5. Copy the bot token.

## 2. Get your admin chat id

1. Add the bot token in `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

2. Start the backend:

```bash
cd backend
npm run dev
```

3. In another terminal, start local polling:

```bash
cd backend
npm run telegram:poll
```

4. Send `/id` to your bot in Telegram.
5. Copy the chat id that the bot replies with.
6. Put it in `backend/.env`:

```env
TELEGRAM_ADMIN_CHAT=your_chat_id_here
TELEGRAM_WEBHOOK_SECRET=any_long_random_secret
TELEGRAM_SETUP_KEY=any_private_setup_key
```

Restart both terminals after editing `.env`.

## 3. Local testing

Use two terminals:

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd backend
npm run telegram:poll
```

Now send `/start` to the bot. Messages should be answered automatically and copied to the admin chat.

To reply as admin:

```text
/reply CHAT_ID your reply text
```

Example:

```text
/reply 123456789 تم استلام طلبك وسيتم مراجعته.
```

## 4. Production webhook

For Render or any public HTTPS server:

1. Add these environment variables in the hosting dashboard:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT=your_chat_id_here
TELEGRAM_WEBHOOK_SECRET=any_long_random_secret
TELEGRAM_SETUP_KEY=any_private_setup_key
SITE_URL=https://your-domain.com
```

2. Deploy the backend.
3. Open this URL once in your browser:

```text
https://your-domain.com/api/telegram/setup-webhook?key=your_private_setup_key
```

4. Check status:

```text
https://your-domain.com/api/telegram/status
```

When `webhook.url` points to `/api/telegram/webhook`, the bot is connected.

## Notes

- Do not share `TELEGRAM_BOT_TOKEN`.
- Do not commit `backend/.env`.
- Local polling is only for development. In production, use the webhook.
