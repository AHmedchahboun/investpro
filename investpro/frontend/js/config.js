/*
 * InvestPro — Runtime Config
 *
 * PRODUCTION: Use the Render backend URL.
 * DEVELOPMENT: Keep same-origin for localhost.
 *
 * This file is safe to commit. Never put secrets here.
 */
window._BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://investpro1.onrender.com';
