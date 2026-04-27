/* ═══════════════════════════════════════════════════════════
   InvestPro — Fintech Pro v2
   Wallet-driven: all numbers computed from real API data
═══════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   VIP CONFIG (mirrors backend/config/vipConfig.js)
   Source of truth for rate calculations
──────────────────────────────────────────────────────────── */
const VIP_CONFIG = {
  '-1': { name: 'غير نشط',  dailyProfit: 0,     dailyBonus: 0,    monthlyPct: 0  },
   '0': { name: 'تدريب',    dailyProfit: 0.10,  dailyBonus: 0,    monthlyPct: 0  },
   '1': { name: 'برونزي',   dailyProfit: 0.40,  dailyBonus: 0.10, monthlyPct: 20 },
   '2': { name: 'فضي',      dailyProfit: 1.25,  dailyBonus: 0.20, monthlyPct: 25 },
   '3': { name: 'ذهبي',     dailyProfit: 4.33,  dailyBonus: 0.30, monthlyPct: 30 },
   '4': { name: 'ماسي',     dailyProfit: 13.50, dailyBonus: 0,    monthlyPct: 35 },
};

/* ────────────────────────────────────────────────────────────
   STATE — single source of truth, set once from API
──────────────────────────────────────────────────────────── */
const _state = {
  wallet:       null,   // { balance, totalDeposited, totalWithdrawn, totalEarned }
  vip:          null,   // { vipLevel, dailyProfit, dailyBonus, isActive, daysLeft }
  transactions: [],     // all tx records
  ready:        false,
};

/* ────────────────────────────────────────────────────────────
   1. DATA LOADING
──────────────────────────────────────────────────────────── */
async function loadFintechData() {
  try {
    const [walletRes, vipRes, txRes] = await Promise.all([
      http.get('/wallet'),
      http.get('/vip/status'),
      http.get('/wallet/transactions?limit=100'),
    ]);

    _state.wallet       = walletRes.wallet;
    _state.vip          = vipRes;
    _state.transactions = txRes.transactions || [];
    _state.ready        = true;

    _applyAllCalculations();
  } catch (err) {
    console.warn('[Fintech] API load failed — using wallet cache:', err.message);
    _tryFromCache();
  }
}

function _tryFromCache() {
  const cached = store.get('wallet');
  const cachedUser = store.get('user');
  if (cached) {
    _state.wallet = cached;
    _state.vip    = { vipLevel: cachedUser?.vipLevel ?? -1 };
    _state.ready  = true;
    _applyAllCalculations();
  }
}

function _applyAllCalculations() {
  _buildProfitStrip();
  _buildNotificationsFromTx();
  _renderNotifBadge();
  if (typeof Chart !== 'undefined') {
    _initPortfolioChart(30);
    _initProfitChart();
  }
}

/* ────────────────────────────────────────────────────────────
   2. WALLET CALCULATIONS
   All derived from _state — no random()
──────────────────────────────────────────────────────────── */

/** Daily profit for current VIP level */
function _dailyProfit() {
  const level = String(_state.vip?.vipLevel ?? -1);
  const cfg   = VIP_CONFIG[level] || VIP_CONFIG['-1'];
  return cfg.dailyProfit + cfg.dailyBonus;
}

/** Sum of a tx type in the last N days */
function _txSum(types, days = null) {
  const typeArr = Array.isArray(types) ? types : [types];
  const cutoff  = days ? Date.now() - days * 86400000 : 0;
  return _state.transactions
    .filter(tx => typeArr.includes(tx.type) && tx.status === 'approved')
    .filter(tx => !days || new Date(tx.createdAt).getTime() >= cutoff)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/** Build balance-by-day timeline from transactions */
function _buildBalanceTimeline(days) {
  const now    = Date.now();
  const labels = [];
  const data   = [];

  // Walk backwards: compute running balance for each day
  const approved = _state.transactions.filter(tx => tx.status === 'approved');

  for (let i = days; i >= 0; i--) {
    const dayEnd = now - i * 86400000;
    const d = new Date(dayEnd);
    labels.push(d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));

    // Sum all transactions up to this day
    let bal = 0;
    approved.forEach(tx => {
      if (new Date(tx.createdAt).getTime() > dayEnd) return;
      const CREDIT = ['deposit','daily_profit','daily_bonus','training_reward',
                      'referral_l1','referral_l2','signup_bonus','admin_credit'];
      const DEBIT  = ['withdraw','vip_purchase','admin_debit'];
      if (CREDIT.includes(tx.type)) bal += tx.amount;
      if (DEBIT.includes(tx.type))  bal -= tx.amount;
    });
    data.push(Math.max(0, +bal.toFixed(2)));
  }

  return { labels, data };
}

/** Build daily profit per day for last N days */
function _buildDailyProfitTimeline(days = 7) {
  const now    = Date.now();
  const labels = [];
  const data   = [];

  const PROFIT_TYPES = ['daily_profit','daily_bonus','training_reward'];
  const approved = _state.transactions.filter(
    tx => PROFIT_TYPES.includes(tx.type) && tx.status === 'approved'
  );

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now - (i + 1) * 86400000);
    const dayEnd   = new Date(now - i * 86400000);
    dayStart.setHours(0, 0, 0, 0);
    dayEnd.setHours(0, 0, 0, 0);

    labels.push(dayEnd.toLocaleDateString('ar-EG', { weekday: 'short' }));

    const dayProfit = approved
      .filter(tx => {
        const t = new Date(tx.createdAt);
        return t >= dayStart && t < dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    // If no real profit recorded yet for this day, estimate from VIP rate
    const estimated = dayProfit > 0 ? dayProfit : (i < 1 ? _dailyProfit() : 0);
    data.push(+estimated.toFixed(4));
  }

  return { labels, data };
}

/* ────────────────────────────────────────────────────────────
   3. PROFIT STRIP — computed from wallet
──────────────────────────────────────────────────────────── */
function _buildProfitStrip() {
  const el = document.getElementById('profit-strip');
  if (!el || !_state.wallet) return;

  const w      = _state.wallet;
  const daily  = _dailyProfit();
  const weekly = _txSum(['daily_profit','daily_bonus','training_reward'], 7);
  const monthly = _txSum(['daily_profit','daily_bonus','training_reward'], 30);
  const referral = _txSum(['referral_l1','referral_l2','signup_bonus']);
  const level    = String(_state.vip?.vipLevel ?? -1);
  const rate     = VIP_CONFIG[level]?.monthlyPct || 0;

  const stats = [
    { label: 'ربح يومي متوقع', val: `+$${daily.toFixed(2)}`,   cls: daily  > 0 ? 'up' : 'neut' },
    { label: 'ربح الأسبوع',     val: `+$${weekly.toFixed(2)}`,  cls: weekly > 0 ? 'up' : 'neut' },
    { label: 'ربح الشهر',       val: `+$${monthly.toFixed(2)}`, cls: monthly> 0 ? 'up' : 'neut' },
    { label: 'أرباح الإحالة',   val: `+$${referral.toFixed(2)}`,cls: referral>0 ? 'up' : 'neut' },
    { label: 'عائد المحفظة',    val: rate > 0 ? `${rate}%/شهر` : '—',cls: rate > 0 ? 'neut' : 'neut' },
  ];

  el.innerHTML = stats.map(s => `
    <div class="profit-chip">
      <div class="profit-chip-lbl">${s.label}</div>
      <div class="profit-chip-val ${s.cls}">${s.val}</div>
    </div>`).join('');
}

/* ────────────────────────────────────────────────────────────
   4. CHARTS — driven by real transaction history
──────────────────────────────────────────────────────────── */
let _portfolioChart = null;
let _profitChart    = null;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      padding: 10,
      cornerRadius: 10,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#6e7681', font: { size: 10 }, maxTicksLimit: 7 },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: {
        color: '#6e7681',
        font: { size: 10 },
        callback: v => `$${v.toFixed(v < 10 ? 2 : 0)}`,
      },
      position: 'right',
    },
  },
};

function _initPortfolioChart(days = 30) {
  const ctx = document.getElementById('portfolio-chart');
  if (!ctx) return;

  const { labels, data } = _buildBalanceTimeline(days);

  if (_portfolioChart) _portfolioChart.destroy();

  const grd = ctx.getContext('2d').createLinearGradient(0, 0, 0, 140);
  grd.addColorStop(0, 'rgba(56,189,248,0.28)');
  grd.addColorStop(1, 'rgba(56,189,248,0)');

  _portfolioChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#38bdf8',
        fill: true,
        backgroundColor: grd,
        tension: 0.4,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: c => ` $${c.parsed.y.toFixed(2)}` },
        },
      },
    },
  });

  // Header values
  const current = _state.wallet?.balance ?? 0;
  const first   = data.find(v => v > 0) || 0;
  const gain    = first > 0 ? ((current - first) / first * 100).toFixed(2) : '0.00';

  const valEl  = document.getElementById('portfolio-val');
  const gainEl = document.getElementById('portfolio-gain');
  if (valEl)  valEl.textContent  = `$${current.toFixed(2)}`;
  if (gainEl) {
    gainEl.textContent = `${gain >= 0 ? '+' : ''}${gain}% (${days} يوم)`;
    gainEl.style.color = gain >= 0 ? '#22c55e' : '#ef4444';
  }
}

function _initProfitChart() {
  const ctx = document.getElementById('profit-chart');
  if (!ctx) return;

  const { labels, data } = _buildDailyProfitTimeline(7);
  const total = data.reduce((a, b) => a + b, 0);

  if (_profitChart) _profitChart.destroy();

  _profitChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(v => v > 0 ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.4)'),
        hoverBackgroundColor: data.map(v => v > 0 ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: c => ` +$${c.parsed.y.toFixed(4)}` },
        },
      },
    },
  });

  const valEl  = document.getElementById('profit-week-val');
  const subEl  = document.getElementById('profit-week-sub');
  const daily  = _dailyProfit();
  if (valEl) valEl.textContent = total > 0 ? `+$${total.toFixed(2)}` : `~+$${(daily*7).toFixed(2)}`;
  if (subEl) subEl.textContent = `متوسط يومي: $${(total > 0 ? total/7 : daily).toFixed(2)}`;
}

function refreshCharts(period) {
  document.querySelectorAll('.chart-period-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.period === String(period))
  );
  _initPortfolioChart(parseInt(period));
}

/* ────────────────────────────────────────────────────────────
   5. NOTIFICATIONS — derived from real transactions
──────────────────────────────────────────────────────────── */
let _notifs = [];

const TX_NOTIF_MAP = {
  deposit:          { type: 'success', icon: '✅', title: 'إيداع معتمد'      },
  withdraw:         { type: 'warning', icon: '💸', title: 'سحب معتمد'        },
  daily_profit:     { type: 'info',    icon: '⭐', title: 'ربح يومي'          },
  daily_bonus:      { type: 'info',    icon: '🎁', title: 'مكافأة يومية'      },
  training_reward:  { type: 'info',    icon: '📚', title: 'مكافأة تدريب'      },
  vip_purchase:     { type: 'success', icon: '👑', title: 'تفعيل VIP'         },
  referral_l1:      { type: 'success', icon: '👥', title: 'عمولة إحالة L1'    },
  referral_l2:      { type: 'success', icon: '🔗', title: 'عمولة إحالة L2'    },
  signup_bonus:     { type: 'success', icon: '🎉', title: 'مكافأة تسجيل'      },
  admin_credit:     { type: 'success', icon: '💰', title: 'إضافة إدارية'      },
  admin_debit:      { type: 'danger',  icon: '⚠️', title: 'خصم إداري'        },
};

function _buildNotificationsFromTx() {
  const recent = _state.transactions.slice(0, 8);
  _notifs = recent.map((tx, i) => {
    const map  = TX_NOTIF_MAP[tx.type] || { type:'info', icon:'🔔', title: tx.type };
    const sign = ['deposit','daily_profit','daily_bonus','training_reward',
                  'referral_l1','referral_l2','signup_bonus','admin_credit'].includes(tx.type) ? '+' : '-';
    return {
      id:     i + 1,
      type:   map.type,
      icon:   map.icon,
      title:  map.title,
      msg:    `${sign}$${tx.amount.toFixed(2)} — ${tx.note || ''}`.trim(),
      time:   fmt.ago(tx.createdAt),
      unread: i < 3,
    };
  });

  if (!_notifs.length) {
    _notifs = [{
      id: 1, type: 'info', icon: '👋', title: 'مرحباً بك!',
      msg: 'قم بإيداع أول مبلغ لبدء رحلتك الاستثمارية',
      time: 'الآن', unread: true,
    }];
  }

  _renderNotifBadge();
}

function _unreadCount() { return _notifs.filter(n => n.unread).length; }

function _renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const count = _unreadCount();
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function _renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifs.length) {
    list.innerHTML = '<div class="notif-empty">🔔 لا توجد إشعارات</div>';
    return;
  }
  list.innerHTML = _notifs.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
      <div class="notif-icon ${n.type}">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

function toggleNotifications() {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  dd.classList.toggle('show');
  if (dd.classList.contains('show')) _renderNotifList();
}

function markNotifRead(id) {
  const n = _notifs.find(x => x.id === id);
  if (n) n.unread = false;
  _renderNotifBadge();
  _renderNotifList();
}

function markAllRead() {
  _notifs.forEach(n => n.unread = false);
  _renderNotifBadge();
  _renderNotifList();
}

function pushNotif(type, title, msg) {
  const icons = { success:'✅', warning:'⚠️', danger:'❌', info:'ℹ️' };
  _notifs.unshift({ id: Date.now(), type, icon: icons[type]||'🔔', title, msg, time: 'الآن', unread: true });
  _renderNotifBadge();
}

document.addEventListener('click', e => {
  const wrapper = document.getElementById('notif-wrapper');
  const dd = document.getElementById('notif-dropdown');
  if (dd && wrapper && !wrapper.contains(e.target)) dd.classList.remove('show');
});

/* ────────────────────────────────────────────────────────────
   6. LIVE PRICE TICKER
   Market prices are always simulated (standard on all fintech demos)
   Volatility is deterministic per asset — no arbitrary randomness
──────────────────────────────────────────────────────────── */
const TICKER_ASSETS = [
  { symbol:'BTC',  price:67420.50, vol:0.0018 },
  { symbol:'ETH',  price:3521.80,  vol:0.0025 },
  { symbol:'USDT', price:1.0001,   vol:0.0001 },
  { symbol:'BNB',  price:598.40,   vol:0.0020 },
  { symbol:'SOL',  price:172.30,   vol:0.0035 },
  { symbol:'XRP',  price:0.6182,   vol:0.0028 },
  { symbol:'GOLD', price:2345.70,  vol:0.0008 },
  { symbol:'AAPL', price:187.40,   vol:0.0015 },
  { symbol:'TSLA', price:176.50,   vol:0.0030 },
  { symbol:'NVDA', price:875.20,   vol:0.0022 },
];

// Deterministic pseudo-random using seed (asset index + tick count)
let _tick = 0;
function _seededNoise(seed) {
  const x = Math.sin(seed + _tick * 0.7319) * 43758.5453;
  return x - Math.floor(x);
}

const _tickerState = TICKER_ASSETS.map((a, i) => ({
  ...a, i, prev: a.price,
  change: ((_seededNoise(i) * 4) - 2).toFixed(2),
}));

function _buildTicker() {
  const wrap = document.getElementById('ticker-track');
  if (!wrap) return;
  const html = _tickerState.map(a => _tickerItemHtml(a)).join('');
  wrap.innerHTML = html + html;
}

function _tickerItemHtml(a) {
  const val   = parseFloat(a.change);
  const sign  = val >= 0 ? '+' : '';
  const cls   = val >= 0 ? 'ticker-up' : 'ticker-down';
  const arrow = val >= 0 ? '▲' : '▼';
  const price = a.price < 10 ? a.price.toFixed(4)
    : a.price < 1000 ? a.price.toFixed(2)
    : a.price.toLocaleString('en', { minimumFractionDigits:2, maximumFractionDigits:2 });
  return `<div class="ticker-item" data-ticker="${a.symbol}">
    <span class="ticker-symbol">${a.symbol}</span>
    <span class="ticker-price">$${price}</span>
    <span class="ticker-change ${cls}">${arrow} ${sign}${a.change}%</span>
  </div>`;
}

function _updateTicker() {
  _tick++;
  _tickerState.forEach((a, i) => {
    const noise = _seededNoise(i) * 2 - 1;
    const delta = a.price * a.vol * noise;
    a.prev  = a.price;
    a.price = Math.max(0.001, a.price + delta);
    a.change = ((a.price - a.prev) / a.prev * 100).toFixed(2);
  });
  document.querySelectorAll('.ticker-item').forEach(el => {
    const asset = _tickerState.find(a => a.symbol === el.dataset.ticker);
    if (!asset) return;
    const val   = parseFloat(asset.change);
    const sign  = val >= 0 ? '+' : '';
    const cls   = val >= 0 ? 'ticker-up' : 'ticker-down';
    const arrow = val >= 0 ? '▲' : '▼';
    const price = asset.price < 10 ? asset.price.toFixed(4)
      : asset.price < 1000 ? asset.price.toFixed(2)
      : asset.price.toLocaleString('en', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const pe = el.querySelector('.ticker-price');
    const ce = el.querySelector('.ticker-change');
    if (pe) pe.textContent = `$${price}`;
    if (ce) { ce.textContent = `${arrow} ${sign}${asset.change}%`; ce.className = `ticker-change ${cls}`; }
  });
}

function initTicker() {
  _buildTicker();
  setInterval(_updateTicker, 3000);
}

/* ────────────────────────────────────────────────────────────
   7. DARK MODE
──────────────────────────────────────────────────────────── */
function initTheme() {
  applyTheme(localStorage.getItem('theme') || 'dark');
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  applyTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
}

/* ────────────────────────────────────────────────────────────
   BOOT
──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTicker();

  // Load real wallet data after page init
  setTimeout(() => {
    if (store.get('token')) {
      loadFintechData();
    }
  }, 600);
});
