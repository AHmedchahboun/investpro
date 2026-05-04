# Static Hosting Upload

The frontend is static. It can run on Hostinger, InfinityFree, Netlify, Cloudflare Pages, GitHub Pages, or any Apache/cPanel host.

## Build Package

From the project root:

```powershell
npm run package:frontend
```

This creates:

```text
outputs/hosting-public_html/
outputs/hosting-public_html.zip
```

## Upload Rules

Upload the contents of `hosting-public_html`, not the folder itself.

Correct:

```text
public_html/
  index.html
  dashboard.html
  support.html
  admin.html
  css/
  js/
  .htaccess
```

Wrong:

```text
public_html/hosting-public_html/index.html
```

## Backend Link

The frontend calls the backend through:

```text
frontend/js/config.js
```

Production backend:

```text
https://investpro1.onrender.com
```

If you change the backend domain, update `frontend/js/config.js`, then rebuild the hosting package.

## Common 403 Fix

If you see `403 Forbidden`:

1. Make sure `index.html` is directly in the hosting root.
2. Make sure `css/` and `js/` are also directly in the hosting root.
3. Do not upload an extra wrapper folder.
4. Check `.htaccess` exists.

## Common JS Error Fix

If browser console says:

```text
Unexpected token '<'
```

Then a JavaScript file is returning HTML. Check:

```text
https://your-domain.com/js/api.js
```

It must show JavaScript code, not an HTML page.

