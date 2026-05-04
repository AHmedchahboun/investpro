# Deployment Guide

Recommended deployment:

- Backend on Render.
- Frontend on a static host.
- Database on MongoDB Atlas.

## 1. Deploy Backend on Render

Create or update a Render Web Service:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

Add all required environment variables from:

```text
docs/deployment/ENVIRONMENT.md
```

After deploy, test:

```text
https://YOUR_RENDER_APP.onrender.com/api/health
```

Expected:

```json
{"success":true,"status":"ok"}
```

## 2. Deploy Frontend

Create the frontend package:

```powershell
npm run package:frontend
```

Upload contents of:

```text
outputs/hosting-public_html/
```

to your hosting root:

- Hostinger: `public_html`
- InfinityFree: `htdocs`
- cPanel hosting: `public_html`

## 3. Set SITE_URL

In Render environment variables, set:

```text
SITE_URL=https://your-frontend-domain.com
```

Do not add a trailing slash.

Then redeploy Render.

## 4. Telegram Webhook

After Render redeploy, run:

```text
https://YOUR_RENDER_APP.onrender.com/api/telegram/setup-webhook?key=YOUR_TELEGRAM_SETUP_KEY
```

Check:

```text
https://YOUR_RENDER_APP.onrender.com/api/telegram/status
```

