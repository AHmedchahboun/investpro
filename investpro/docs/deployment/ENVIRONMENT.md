# Environment Variables

Set these in Render, not in frontend files.

## Required

```env
NODE_ENV=production
PORT=10000
SITE_URL=https://your-frontend-domain.com

MONGODB_URI=mongodb+srv://...
JWT_SECRET=long_random_secret
JWT_EXPIRES=30d

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong_password
```

## Wallet and Limits

```env
MIN_DEPOSIT=10
MAX_DEPOSIT=50000
MIN_WITHDRAW=10
MAX_WITHDRAW=10000
WITHDRAWAL_FEE=10

WALLET_USDT_TRC20=your_trc20_wallet
WALLET_USDT_BEP20=your_bep20_wallet
WALLET_USDT_POLYGON=your_polygon_wallet
```

## VIP and Referrals

```env
TRAINING_DAYS=30
TRAINING_DAILY=0.10

REFERRAL_L1=15
REFERRAL_L2=10
REFERRAL_L3=5

HOURLY_CRON=0 * * * *
```

## Telegram Support

```env
TELEGRAM_BOT_TOKEN=bot_token_from_botfather
TELEGRAM_ADMIN_CHAT=your_admin_chat_id
TELEGRAM_WEBHOOK_SECRET=random_secret
TELEGRAM_SETUP_KEY=random_private_setup_key
```

## AI Support

Use Gemini or OpenAI. Gemini is enough.

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

Optional:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
```

## Security

- Never put these values in `frontend/`.
- Never commit `.env`.
- Revoke and regenerate any key that was shared publicly.

