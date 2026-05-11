require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');
const { startRewardsCron } = require('./jobs/rewards');
const { generalLimit }     = require('./middleware');

const app = express();
app.set('trust proxy', 1); // Fix rate limiting when behind a proxy

/* ── Security & Parsing ──────────────────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://kit.fontawesome.com",
        "https://cdn.jsdelivr.net",
      ],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://kit.fontawesome.com",
      ],
      "font-src": [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "https://ka-f.fontawesome.com",
      ],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": [
        "'self'",
        "https://investpro1.onrender.com",
        "https://cdn.jsdelivr.net",
        "https://ka-f.fontawesome.com",
      ],
      "frame-src": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "upgrade-insecure-requests": [],
    },
  },
}));
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map(origin => origin && origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.hostingersite.com');
  } catch {
    return false;
  }
}

// In production, allow configured frontend origins and Hostinger preview domains.
app.use(cors({
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '3mb' }));

// Request logger — dev only
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}
app.use(generalLimit);

/* ── API Routes ──────────────────────────────────────────────────────────── */
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', ts: Date.now() }));
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/vip',    require('./routes/vip'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/system', require('./routes/system'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/ai-support', require('./routes/aiSupport'));

/* ── Serve Frontend ──────────────────────────────────────────────────────── */
const frontendPath = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ── Global Error Handler ────────────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'خطأ في الخادم' });
});

/* ── Startup ─────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  startRewardsCron();
  app.listen(PORT, () => console.log(`✅ InvestPro server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});
