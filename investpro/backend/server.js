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
app.use(helmet({ contentSecurityPolicy: false }));
// In production, restrict to the configured SITE_URL; block all other origins.
// In development (NODE_ENV !== 'production'), allow any origin for convenience.
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.SITE_URL : true,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(generalLimit);

/* ── API Routes ──────────────────────────────────────────────────────────── */
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/vip',    require('./routes/vip'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/system', require('./routes/system'));

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
