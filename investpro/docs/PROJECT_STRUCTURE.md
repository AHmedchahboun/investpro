# Project Structure

This project is intentionally split into two main parts.

## Backend

Path:

```text
backend/
```

Purpose:

- Runs the Express API.
- Connects to MongoDB.
- Handles users, wallets, VIP, admin, notifications, Telegram, and AI support.

Important files:

```text
backend/server.js
backend/.env.example
backend/package.json
backend/routes/
backend/models/
backend/config/
```

## Frontend

Path:

```text
frontend/
```

Purpose:

- Static HTML/CSS/JS website.
- Can be uploaded to any static hosting.
- Calls the backend through `frontend/js/config.js`.

Important files:

```text
frontend/index.html
frontend/dashboard.html
frontend/admin.html
frontend/support.html
frontend/js/config.js
frontend/js/api.js
frontend/.htaccess
```

## Docs

Path:

```text
docs/
```

Purpose:

- Deployment instructions.
- Environment variable reference.
- Hosting notes.
- Telegram bot setup.

## Scripts

Path:

```text
scripts/
```

Purpose:

- Local project automation.
- Packaging static frontend for hosting.

