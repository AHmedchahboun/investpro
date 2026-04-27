/* ═══════════════════════════════════════════════════════════
   InvestPro — Fintech Pro: Ticker + Charts + Notifications
═══════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   1. LIVE PRICE TICKER
──────────────────────────────────────────────────────────── */
const TICKER_ASSETS = [
  { symbol: 'BTC',   name: 'Bitcoin',      price: 67420.50, vol: 0.0018 },
  { symbol: 'ETH',   name: 'Ethereum',     price: 3521.80,  vol: 0.0025 },
  { symbol: 'USDT',  name: 'Tether',       price: 1.0001,   vol: 0.0001 },
  { symbol: 'BNB',   name: 'BNB',          price: 598.40,   vol: 0.0020 },
  { symbol: 'SOL',   name: 'Solana',       price: 172.30,   vol: 0.0035 },
  { symbol: 'XRP',   name: 'XRP',          price: 0.6182,   vol: 0.0028 },
  { symbol: 'GOLD',  name: 'Gold/oz',      price: 2345.70,  vol: 0.0008 },
  { symbol: 'AAPL',  name: 'Apple',        price: 187.40,   vol: 0.0015 },
  { symbol: 'TSLA',  name: 'Tesla',        price: 176.50,   vol: 0.0030 },
  { symbol: 'NVDA',  name: 'NVIDIA',       price: 875.20,   vol: 0.0022 },
  { symbol: 'OIL',   name: 'Crude Oil',    price: 82.45,    vol: 0.0012 },
  { symbol: 'DOW',   name: 'Dow Jones',    price: 39420.00, vol: 0.0006 },
];

const _tickerState = TICKER_ASSETS.map(a => ({
  ...a,
  prev: a.price,
  change: (Math.random() * 4 - 2).toFixed(2),
}));

function _buildTicker() {
  const wrap = document.getElementById('ticker-track');
  if (!wrap) return;
  const items = _tickerState.map((a, i) => _tickerItemHtml(a, i)).join('');
  // Duplicate for infinite scroll
  wrap.innerHTML = items + items;
}

function _tickerItemHtml(a) {
  const sign = parseFloat(a.change) >= 0 ? '+' : '';
  const cls  = parseFloat(a.change) >= 0 ? 'ticker-up' : 'ticker-down';
  const arrow = parseFloat(a.change) >= 0 ? '▲' : '▼';
  const priceStr = a.price < 10
    ? a.price.toFixed(4)
    : a.price < 1000
    ? a.price.toFixed(2)
    : a.price.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<div class="ticker-item" data-ticker="${a.symbol}">
    <span class="ticker-symbol">${a.symbol}</span>
    <span class="ticker-price">$${priceStr}</span>
    <span class="ticker-change ${cls}">${arrow} ${sign}${a.change}%</span>
  </div>`;
}

function _updateTicker() {
  _tickerState.forEach((a, i) => {
    const delta = a.price * a.vol * (Math.random() * 2 - 1);
    a.prev  = a.price;
    a.price = Math.max(0.001, a.price + delta);
    const pct = ((a.price - a.prev) / a.prev * 100);
    a.change = pct.toFixed(2);
  });

  document.querySelectorAll('.ticker-item').forEach(el => {
    const sym   = el.dataset.ticker;
    const asset = _tickerState.find(a => a.symbol === sym);
    if (!asset) return;

    const sign = parseFloat(asset.change) >= 0 ? '+' : '';
    const cls  = parseFloat(asset.change) >= 0 ? 'ticker-up' : 'ticker-down';
    const arrow = parseFloat(asset.change) >= 0 ? '▲' : '▼';

    const priceEl  = el.querySelector('.ticker-price');
    const changeEl = el.querySelector('.ticker-change');

    const priceStr = asset.price < 10
      ? asset.price.toFixed(4)
      : asset.price < 1000
      ? asset.price.toFixed(2)
      : asset.price.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (priceEl)  priceEl.textContent  = `$${priceStr}`;
    if (changeEl) {
      changeEl.textContent  = `${arrow} ${sign}${asset.change}%`;
      changeEl.className    = `ticker-change ${cls}`;
    }
  });
}

function initTicker() {
  _buildTicker();
  setInterval(_updateTicker, 3000);
}

/* ────────────────────────────────────────────────────────────
   2. CHARTS
──────────────────────────────────────────────────────────── */
let _portfolioChart = null;
let _profitChart    = null;

function _genPortfolioData(days = 30) {
  const labels = [];
  const data   = [];
  let val = 100;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));
    val += val * (Math.random() * 0.04 - 0.01);
    data.push(+val.toFixed(2));
  }
  return { labels, data };
}

function _genProfitData(days = 7) {
  const labels = [];
  const data   = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('ar-EG', { weekday: 'short' }));
    data.push(+(Math.random() * 5 + 0.5).toFixed(2));
  }
  return { labels, data };
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: '#1e293b',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    titleColor: '#e2e8f0',
    bodyColor: '#94a3b8',
    padding: 10,
    cornerRadius: 10,
  }},
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#6e7681', font: { size: 10 }, maxTicksLimit: 7 },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#6e7681', font: { size: 10 } },
      position: 'right',
    },
  },
};

function initCharts() {
  _initPortfolioChart();
  _initProfitChart();
}

function _initPortfolioChart(days = 30) {
  const ctx = document.getElementById('portfolio-chart');
  if (!ctx) return;

  const { labels, data } = _genPortfolioData(days);

  if (_portfolioChart) _portfolioChart.destroy();

  const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 140);
  grad.addColorStop(0, 'rgba(56,189,248,0.3)');
  grad.addColorStop(1, 'rgba(56,189,248,0)');

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
        backgroundColor: grad,
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
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
    },
  });

  const last = data[data.length - 1];
  const first = data[0];
  const gain = ((last - first) / first * 100).toFixed(2);
  const el = document.getElementById('portfolio-val');
  const el2 = document.getElementById('portfolio-gain');
  if (el)  el.textContent  = `$${last.toFixed(2)}`;
  if (el2) {
    el2.textContent  = `${gain >= 0 ? '+' : ''}${gain}% هذا الشهر`;
    el2.style.color  = gain >= 0 ? '#22c55e' : '#ef4444';
  }
}

function _initProfitChart() {
  const ctx = document.getElementById('profit-chart');
  if (!ctx) return;

  const { labels, data } = _genProfitData(7);
  const total = data.reduce((a, b) => a + b, 0).toFixed(2);

  if (_profitChart) _profitChart.destroy();

  _profitChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map(() => 'rgba(34,197,94,0.6)'),
        hoverBackgroundColor: 'rgba(34,197,94,0.9)',
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
          callbacks: { label: (ctx) => ` +$${ctx.parsed.y.toFixed(2)}` },
        },
      },
    },
  });

  const el  = document.getElementById('profit-week-val');
  const el2 = document.getElementById('profit-week-sub');
  if (el)  el.textContent  = `+$${total}`;
  if (el2) el2.textContent = `متوسط يومي: $${(total / 7).toFixed(2)}`;
}

function refreshCharts(period) {
  document.querySelectorAll('.chart-period-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.period === String(period))
  );
  _initPortfolioChart(parseInt(period));
}

/* ────────────────────────────────────────────────────────────
   3. NOTIFICATIONS SYSTEM
──────────────────────────────────────────────────────────── */
const _MOCK_NOTIFS = [
  { id: 1, type: 'success', icon: '✅', title: 'إيداع مقبول',        msg: 'تم اعتماد إيداعك بمبلغ $50.00',               time: 'منذ 2 دقيقة',   unread: true  },
  { id: 2, type: 'info',    icon: '⭐', title: 'ربح يومي',            msg: 'تم إضافة ربحك اليومي $1.40 إلى محفظتك',       time: 'منذ 1 ساعة',    unread: true  },
  { id: 3, type: 'warning', icon: '⏳', title: 'سحب قيد المراجعة',   msg: 'طلب السحب $30.00 قيد المراجعة من المشرف',    time: 'منذ 3 ساعات',   unread: true  },
  { id: 4, type: 'success', icon: '👑', title: 'ترقية VIP',           msg: 'تهانينا! تمت ترقيتك إلى المستوى الفضي',      time: 'البارحة',        unread: false },
  { id: 5, type: 'info',    icon: '👥', title: 'إحالة جديدة',         msg: 'انضم صديق جديد عبر رابط إحالتك',             time: 'منذ يومين',      unread: false },
];

let _notifs = [..._MOCK_NOTIFS];

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
  const isOpen = dd.classList.contains('show');
  dd.classList.toggle('show', !isOpen);
  if (!isOpen) _renderNotifList();
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
  const id = Date.now();
  _notifs.unshift({ id, type, icon: type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️', title, msg, time: 'الآن', unread: true });
  _renderNotifBadge();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('notif-wrapper');
  const dd = document.getElementById('notif-dropdown');
  if (dd && wrapper && !wrapper.contains(e.target)) {
    dd.classList.remove('show');
  }
});

/* ────────────────────────────────────────────────────────────
   4. DARK MODE
──────────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  applyTheme(isDark ? 'light' : 'dark');
}

/* ────────────────────────────────────────────────────────────
   5. PROFIT STRIP (mini stats)
──────────────────────────────────────────────────────────── */
function initProfitStrip() {
  const el = document.getElementById('profit-strip');
  if (!el) return;

  const stats = [
    { label: 'ربح اليوم',      val: `+$${(Math.random()*2+0.5).toFixed(2)}`,  cls: 'up'   },
    { label: 'ربح هذا الأسبوع', val: `+$${(Math.random()*12+3).toFixed(2)}`, cls: 'up'   },
    { label: 'ربح هذا الشهر',  val: `+$${(Math.random()*40+15).toFixed(2)}`, cls: 'up'   },
    { label: 'أرباح الإحالة',   val: `+$${(Math.random()*8+1).toFixed(2)}`,  cls: 'neut' },
    { label: 'عائد المحفظة',    val: `${(Math.random()*5+18).toFixed(1)}%`,   cls: 'neut' },
  ];

  el.innerHTML = stats.map(s => `
    <div class="profit-chip">
      <div class="profit-chip-lbl">${s.label}</div>
      <div class="profit-chip-val ${s.cls}">${s.val}</div>
    </div>`).join('');
}

/* ────────────────────────────────────────────────────────────
   BOOT
──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTicker();
  initProfitStrip();
  _renderNotifBadge();

  if (typeof Chart !== 'undefined') {
    setTimeout(initCharts, 400);
  }
});
