# InvestPro

InvestPro is a Node.js + static frontend platform with:

- User registration and login.
- Wallet, deposit, withdraw, VIP plans, and referral flow.
- Admin dashboard.
- Telegram support bot.
- AI support assistant with Gemini/OpenAI support and local fallback replies.
- Static frontend that can be hosted on Netlify, Hostinger, InfinityFree, or any basic web hosting.

## Recommended Production Setup

Use this split:

- Backend: Render
- Database: MongoDB Atlas
- Frontend: Netlify, Hostinger, InfinityFree, or Cloudflare Pages
- Telegram bot webhook: Render backend

## Project Structure

```text
investpro/
  backend/                  Node.js Express API
    config/                 Database and platform configuration
    jobs/                   Scheduled reward jobs
    middleware/             Auth, validation, rate limiting
    models/                 Mongoose models
    routes/                 API routes
    scripts/                Local helper scripts
    utils/                  Shared backend helpers
    server.js               API entrypoint
    .env.example            Backend environment template

  frontend/                 Static website files
    css/                    Stylesheets
    js/                     Browser scripts and API client
    index.html              Landing page
    dashboard.html          User dashboard
    admin.html              Admin panel
    support.html            AI/support page
    .htaccess               Apache hosting fallback

  docs/                     Deployment and maintenance docs
  scripts/                  Project packaging scripts
  render.yaml               Render backend blueprint
  netlify.toml              Netlify static frontend config
  package.json              Convenience commands
```

## Local Development

Requirements:

- Node.js 18+
- MongoDB local or Atlas

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Open:

```text
http://localhost:5000
```

## Production Backend

Render settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

Required environment variables are documented in:

```text
docs/deployment/ENVIRONMENT.md
```

## Static Frontend Hosting

The frontend is static. To create a clean upload package:

```powershell
npm run package:frontend
```

Output:

```text
outputs/hosting-public_html/
outputs/hosting-public_html.zip
```

Upload the contents of `hosting-public_html` to:

- `public_html` on Hostinger.
- `htdocs` on InfinityFree.
- Publish directory on any static host.

Important: `index.html` must be directly inside the hosting root.

## Documentation

- `docs/PROJECT_STRUCTURE.md`
- `docs/deployment/DEPLOYMENT.md`
- `docs/deployment/ENVIRONMENT.md`
- `docs/deployment/STATIC_HOSTING.md`
- `docs/deployment/TELEGRAM_SUPPORT_BOT.md`

## Security Notes

- Never commit `.env`.
- Never expose Telegram, Gemini, OpenAI, MongoDB, or JWT secrets in frontend files.
- Put secrets only in Render environment variables.
- If any secret was shared publicly, revoke it and create a new one.

