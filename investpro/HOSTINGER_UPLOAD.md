# Hostinger upload

Upload the contents of the prepared `public_html` package to Hostinger.

## What goes to Hostinger

Only upload files from `frontend/` to Hostinger `public_html`.

The backend stays on Render:

```text
https://investpro1.onrender.com
```

The frontend already uses that backend in `frontend/js/config.js`.

## Upload steps

1. Open Hostinger hPanel.
2. Go to File Manager.
3. Open `public_html`.
4. Delete old website files if you want a clean upload.
5. Upload `outputs/hostinger-public_html.zip`.
6. Extract it inside `public_html`.
7. Make sure `index.html` is directly inside `public_html`, not inside an extra folder.

## After upload

Open your domain and test:

- `/`
- `/dashboard.html`
- `/support.html`
- `/admin.html`

If login or API calls fail, confirm Render is running:

```text
https://investpro1.onrender.com/api/health
```
