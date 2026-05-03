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

Object.assign(VIP_CONFIG, {
  '-1': { name: 'غير نشط', dailyProfit: 0, dailyBonus: 0, monthlyPct: 0 },
  '0':  { name: 'التدريب', dailyProfit: 0.10, dailyBonus: 0, monthlyPct: 0 },
  '1':  { name: 'البرونزي', dailyProfit: 0.50, dailyBonus: 0, monthlyPct: 0 },
  '2':  { name: 'الفضي', dailyProfit: 1.50, dailyBonus: 0, monthlyPct: 0 },
  '3':  { name: 'الذهبي', dailyProfit: 5.00, dailyBonus: 0, monthlyPct: 0 },
  '4':  { name: 'الماسي', dailyProfit: 17.00, dailyBonus: 0, monthlyPct: 0 },
});

/* ────────────────────────────────────────────────────────────
   STATE — single source of truth, set once from API
──────────────────────────────────────────────────────────── */
const CARD_LEVELS = {
  '-1': { name: 'Starter',  className: '',              boost: 0,  perks: '+0%',  next: 'فعّل خطة VIP لفتح بطاقة خاصة وزيادة أرباح الإحالة.' },
  '0':  { name: 'Training', className: 'card-training', boost: 2,  perks: '+2%',  next: 'أكمل التدريب أو فعّل خطة شهرية لتحصل على بطاقة VIP كاملة.' },
  '1':  { name: 'Bronze',   className: 'card-training', boost: 5,  perks: '+5%',  next: 'بعد نهاية الشهر يمكنك ترقية البطاقة ورفع أرباح الإحالة.' },
  '2':  { name: 'Silver',   className: 'card-silver',   boost: 8,  perks: '+8%',  next: 'بطاقة Silver نشطة مع حدود ومميزات إحالة أفضل.' },
  '3':  { name: 'Gold',     className: 'card-gold',     boost: 12, perks: '+12%', next: 'بطاقة Gold تفتح مستويات أعلى وربح إحالة أقوى.' },
  '4':  { name: 'Black',    className: 'card-black',    boost: 18, perks: '+18%', next: 'أعلى بطاقة VIP: أولوية ومميزات إحالة قصوى.' },
};

const _state = {
  wallet:       null,   // { balance, totalDeposited, totalWithdrawn, totalEarned }
  vip:          null,   // { vipLevel, dailyProfit, dailyBonus, isActive, daysLeft }
  hourlyProfit: null,
  transactions: [],     // all tx records
  ready:        false,
};

/* ────────────────────────────────────────────────────────────
   1. DATA LOADING — sequential to avoid 429 errors
──────────────────────────────────────────────────────────── */
async function loadFintechData() {
  _showSkeletons();
  try {
    // Try unified dashboard endpoint first (1 request instead of 3)
    const dashRes = await requestWithRetry(() => http.get('/system/dashboard'));
    _state.wallet       = dashRes.wallet;
    _state.vip          = dashRes.vip;
    _state.hourlyProfit = dashRes.hourlyProfit || dashRes.vip?.hourlyProfit || null;
    _state.transactions = dashRes.transactions || [];
    _state.ready        = true;
    _applyAllCalculations();
  } catch (err) {
    // Fallback: sequential individual requests with delays
    console.warn('[Fintech] Dashboard endpoint failed, falling back:', err.message);
    try {
      const walletRes = await requestWithRetry(() => http.get('/wallet'));
      _state.wallet = walletRes.wallet;
      await delay(300);

      const vipRes = await requestWithRetry(() => http.get('/vip/status'));
      _state.vip = vipRes;
      _state.hourlyProfit = vipRes.hourlyProfit || null;
      await delay(300);

      const txRes = await requestWithRetry(() => http.get('/wallet/transactions?limit=100'));
      _state.transactions = txRes.transactions || [];

      _state.ready = true;
      _applyAllCalculations();
    } catch (fallbackErr) {
      console.warn('[Fintech] All API calls failed — using cache:', fallbackErr.message);
      _tryFromCache();
    }
  }
}

function _showSkeletons() {
  // Show skeleton state for chart values instead of "—" or "جاري الحساب"
  const portfolioVal  = document.getElementById('portfolio-val');
  const portfolioGain = document.getElementById('portfolio-gain');
  const profitWeekVal = document.getElementById('profit-week-val');
  const profitWeekSub = document.getElementById('profit-week-sub');
  if (portfolioVal)  portfolioVal.innerHTML  = '<span class="skeleton-text" style="width:80px;height:20px;display:inline-block;border-radius:6px;background:rgba(255,255,255,0.08);animation:pulse 1.5s ease-in-out infinite"></span>';
  if (portfolioGain) portfolioGain.innerHTML = '<span class="skeleton-text" style="width:120px;height:14px;display:inline-block;border-radius:6px;background:rgba(255,255,255,0.06);animation:pulse 1.5s ease-in-out infinite"></span>';
  if (profitWeekVal) profitWeekVal.innerHTML = '<span class="skeleton-text" style="width:70px;height:20px;display:inline-block;border-radius:6px;background:rgba(255,255,255,0.08);animation:pulse 1.5s ease-in-out infinite"></span>';
  if (profitWeekSub) profitWeekSub.innerHTML = '<span class="skeleton-text" style="width:100px;height:14px;display:inline-block;border-radius:6px;background:rgba(255,255,255,0.06);animation:pulse 1.5s ease-in-out infinite"></span>';
  if (!document.getElementById('pulse-style')) {
    const s = document.createElement('style');
    s.id = 'pulse-style';
    s.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}';
    document.head.appendChild(s);
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
  _state.wallet = _normalizeWallet(_state.wallet, _state.transactions);
  _syncWalletSummary();
  _renderVisaCardStatus();
  _buildProfitStrip();
  _renderHourlyProfitCard();
  _buildNotificationsFromTx();
  _loadServerNotifications();
  _renderNotifBadge();
  _renderDashStateBanner();
  if (typeof Chart !== 'undefined') {
    _initPortfolioChart(30);
    _initProfitChart();
  }
}

function _syncWalletSummary() {
  const w = _state.wallet;
  if (!w) return;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt.usd(value);
  };
  setText('d-balance', w.balance || 0);
  setText('d-deposited', w.totalDeposited || 0);
  setText('d-earned', w.totalEarned || 0);
  setText('w-balance', w.availableProfit || 0);
  setText('wd-available-profit', w.availableProfit || 0);
  setText('wd-frozen-profit', w.frozenProfit || 0);
  setText('wallet-card-balance', w.balance || 0);
  setText('wallet-card-earned', w.totalEarned || 0);
  setText('wallet-card-deposited', w.totalDeposited || 0);
}

function _formatCardValidThru(dateValue) {
  const d = dateValue ? new Date(dateValue) : null;
  if (!d || Number.isNaN(d.getTime())) return '--/--';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

function _renderVisaCardStatus(userOverride = null) {
  const user = userOverride || store.get('user') || {};
  const vip = _state.vip || user || {};
  const level = String(vip.vipLevel ?? user.vipLevel ?? -1);
  const card = document.getElementById('visa-card');
  const cfg = CARD_LEVELS[level] || CARD_LEVELS['-1'];
  const expiresAt = vip.vipExpiresAt || user.vipExpiresAt;
  const daysLeft = Number(vip.daysLeft ?? user.daysLeft ?? 0);
  const isPaidVip = Number(level) >= 1;
  const isTraining = level === '0';
  const inferredActive = isTraining || (isPaidVip && expiresAt && new Date(expiresAt) > new Date());
  const isActive = Boolean(vip.isActive ?? inferredActive);
  const isExpiring = isPaidVip && isActive && daysLeft > 0 && daysLeft <= 3;

  if (card) {
    card.classList.remove('card-training', 'card-silver', 'card-gold', 'card-black', 'card-expired');
    if (cfg.className) card.classList.add(cfg.className);
    card.classList.toggle('card-expired', isPaidVip && !isActive);
  }

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set('visa-card-level', cfg.name);
  set('visa-valid-thru', _formatCardValidThru(expiresAt));
  set('visa-ref-boost', `+${cfg.boost}%`);
  set('visa-card-state', isActive ? 'نشطة' : (isPaidVip ? 'انتهت' : 'جاهزة'));
  set('d-frozen', cfg.perks);

  const title = document.getElementById('visa-upgrade-title');
  const text = document.getElementById('visa-upgrade-text');
  const btn = document.querySelector('.visa-upgrade-btn');

  if (title && text) {
    if (isExpiring) {
      title.textContent = 'خطتك قريبة تنتهي';
      text.textContent = `متبقي ${daysLeft} يوم. جدّد الخطة للحفاظ على بطاقة ${cfg.name} ومميزات الإحالة.`;
    } else if (isPaidVip && !isActive) {
      title.textContent = 'انتهت صلاحية البطاقة';
      text.textContent = 'جدّد أو رقّي خطتك لإعادة تفعيل البطاقة وفتح مستويات أعلى وزيادة أرباح الإحالة.';
    } else if (isActive) {
      title.textContent = `بطاقة ${cfg.name} مفعّلة`;
      text.textContent = cfg.next;
    } else {
      title.textContent = 'بطاقتك الخاصة جاهزة';
      text.textContent = cfg.next;
    }
  }
  if (btn) btn.textContent = isActive && !isExpiring ? 'المستويات' : 'تفعيل';
}

function _fmtCountdown(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function _renderHourlyProfitCard() {
  const hp = _state.hourlyProfit;
  const card = document.getElementById('hourly-profit-card');
  if (!card || !hp || !hp.active) {
    if (card) card.style.display = 'none';
    const wdBtn = document.getElementById('wd-btn');
    if (wdBtn) wdBtn.disabled = true;
    return;
  }

  card.style.display = 'block';
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const statusEl = document.getElementById('hp-status');
  set('hp-plan', hp.planName || '—');
  set('hp-daily', fmt.usd(hp.dailyProfit || 0));
  set('hp-hourly', '$' + Number(hp.cycleProfit || hp.dailyProfit || 0).toFixed(4));
  set('hp-countdown', _fmtCountdown(hp.msRemaining));
  set('hp-frozen', '$' + Number(hp.frozenProfit || 0).toFixed(4));
  set('hp-available', '$' + Number(hp.availableProfit || 0).toFixed(4));
  if (statusEl) {
    statusEl.textContent = hp.status || 'الربح في مرحلة المعالجة';
    statusEl.classList.toggle('available', !!hp.canWithdraw);
  }
  const wdBtn = document.getElementById('wd-btn');
  if (wdBtn) wdBtn.disabled = !hp.canWithdraw;
  const wdAvail = document.getElementById('wd-available-profit');
  const wdFrozen = document.getElementById('wd-frozen-profit');
  const wdBalance = document.getElementById('w-balance');
  if (wdAvail) wdAvail.textContent = '$' + Number(hp.availableProfit || 0).toFixed(4);
  if (wdFrozen) wdFrozen.textContent = '$' + Number(hp.frozenProfit || 0).toFixed(4);
  if (wdBalance) wdBalance.textContent = '$' + Number(hp.availableProfit || 0).toFixed(4);
}

setInterval(() => {
  if (!_state.hourlyProfit || !_state.hourlyProfit.active) return;
  _state.hourlyProfit.msRemaining = Math.max(0, Number(_state.hourlyProfit.msRemaining || 0) - 1000);
  _renderHourlyProfitCard();
}, 1000);

setInterval(async () => {
  if (!store.get('token')) return;
  try {
    const res = await http.get('/vip/hourly-profit');
    _state.hourlyProfit = res.hourlyProfit;
    _renderHourlyProfitCard();
  } catch (_) {}
}, 60000);

function _normalizeWallet(wallet = {}, transactions = []) {
  const approvedOrReserved = transactions.filter(tx =>
    tx.status === 'approved' || (tx.type === 'withdraw' && tx.status === 'pending')
  );
  const sum = (types) => approvedOrReserved
    .filter(tx => types.includes(tx.type))
    .reduce((total, tx) => total + (Number(tx.amount) || 0), 0);

  const deposits = sum(['deposit', 'admin_credit']);
  const profits = sum([
    'daily_profit', 'daily_bonus', 'training_reward',
    'referral_l1', 'referral_l2', 'referral_l3', 'signup_bonus'
  ]);
  const withdrawals = sum(['withdraw', 'vip_purchase', 'admin_debit']);
  const balance = Math.max(0, deposits - withdrawals + profits);

  return {
    ...wallet,
    balance,
    totalDeposited: deposits,
    totalWithdrawn: sum(['withdraw']),
    totalEarned: profits,
  };
}

/* ── Smart dashboard state banner ───────────────────────── */
function _renderDashStateBanner() {
  const el = document.getElementById('dash-state-banner');
  if (!el || !_state.wallet) return;

  const balance  = _state.wallet.balance || 0;
  const vipLevel = _state.vip?.vipLevel ?? -1;
  const isActive = vipLevel >= 1;

  if (balance === 0) {
    // New user — no deposit yet
    el.className = 'dash-state-banner new-user';
    el.innerHTML = `
      <div class="dash-state-banner-icon">🚀</div>
      <div class="dash-state-banner-text">
        <div class="dash-state-banner-title">ابدأ رحلتك الاستثمارية</div>
        <div class="dash-state-banner-sub">أودع أول مبلغ لتفعيل حسابك</div>
      </div>
      <button class="dash-state-banner-btn" onclick="go('pg-wal')">إيداع الآن</button>`;
  } else if (!isActive) {
    // Has balance but no VIP
    el.className = 'dash-state-banner has-balance';
    el.innerHTML = `
      <div class="dash-state-banner-icon">👑</div>
      <div class="dash-state-banner-text">
        <div class="dash-state-banner-title">فعّل خطة VIP</div>
        <div class="dash-state-banner-sub">رصيدك جاهز — ابدأ تحقيق أرباح يومية</div>
      </div>
      <button class="dash-state-banner-btn" onclick="go('pg-vip')">ترقية VIP</button>`;
  } else {
    // Active investor
    const daily = _dailyProfit();
    el.className = 'dash-state-banner active-vip';
    el.innerHTML = `
      <div class="dash-state-banner-icon">📈</div>
      <div class="dash-state-banner-text">
        <div class="dash-state-banner-title">حسابك نشط</div>
        <div class="dash-state-banner-sub">ربح يومي متوقع: +$${daily.toFixed(2)}</div>
      </div>
      <button class="dash-state-banner-btn" onclick="go('pg-hist')">العمليات</button>`;
  }
  el.style.display = 'flex';
}

/* ────────────────────────────────────────────────────────────
   2. WALLET CALCULATIONS
   All derived from _state — no random()
──────────────────────────────────────────────────────────── */

/** Daily profit for current VIP level */
function _dailyProfit() {
  const level = String(_state.vip?.vipLevel ?? -1);
  const cfg   = VIP_CONFIG[level] || VIP_CONFIG['-1'];
  if (_state.hourlyProfit?.dailyProfit !== undefined) {
    return +Number(_state.hourlyProfit.dailyProfit || 0).toFixed(4);
  }
  return +(Number(cfg.dailyProfit || 0) + Number(cfg.dailyBonus || 0)).toFixed(4);
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
  if (valEl) {
    if (total > 0) { valEl.textContent = `+$${total.toFixed(2)}`; }
    else if (daily > 0) { valEl.textContent = `~+$${(daily*7).toFixed(2)}`; }
    else { valEl.textContent = 'فعّل خطة VIP لبدء الأرباح'; }
  }
  if (subEl) {
    if (total > 0 || daily > 0) { subEl.textContent = `متوسط يومي: $${(total > 0 ? total/7 : daily).toFixed(2)}`; }
    else { subEl.textContent = 'لا توجد أرباح بعد'; }
  }
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

function _notifEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[ch]));
}

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

const SERVER_NOTIF_MAP = {
  system:   { icon: '⚙️', type: 'info' },
  profit:   { icon: '📈', type: 'info' },
  deposit:  { icon: '💳', type: 'success' },
  withdraw: { icon: '💸', type: 'warning' },
  referral: { icon: '👥', type: 'success' },
  vip:      { icon: '👑', type: 'success' },
  support:  { icon: '💬', type: 'info' },
};

async function _loadServerNotifications() {
  if (!store.get('token')) return;
  try {
    const data = await http.get('/system/notifications');
    const serverNotifs = (data.notifications || []).map(n => {
      const meta = SERVER_NOTIF_MAP[n.category] || SERVER_NOTIF_MAP.system;
      return {
        id: `srv-${n._id}`,
        serverId: n._id,
        type: n.priority === 'danger' ? 'danger' : (n.priority === 'warning' ? 'warning' : meta.type),
        icon: meta.icon,
        title: n.title,
        msg: n.message,
        time: fmt.ago(n.createdAt),
        unread: !n.readAt,
      };
    });
    _notifs = [...serverNotifs, ..._notifs].slice(0, 30);
    _renderNotifBadge();
    _renderOpenNotificationViews();
  } catch (e) {
    console.warn('[Notifications] failed:', e.message);
  }
}

function _unreadCount() { return _notifs.filter(n => n.unread).length; }

function _renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const count = _unreadCount();
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function _renderNotifList(targetId = 'notif-list') {
  const list = document.getElementById(targetId);
  if (!list) return;
  if (!_notifs.length) {
    list.innerHTML = '<div class="notif-empty">🔔 لا توجد إشعارات</div>';
    return;
  }
  list.innerHTML = _notifs.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="openNotifDetail('${n.id}')">
      <div class="notif-icon ${n.type}">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-title">${_notifEscape(n.title)}</div>
        <div class="notif-msg">${_notifEscape(n.msg)}</div>
        <div class="notif-time">${_notifEscape(n.time)}</div>
      </div>
    </div>`).join('');
}

function toggleNotifications() {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  const isPhoneViewport = window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches;
  if (!isPhoneViewport) {
    openNotificationWindow();
    return;
  }
  dd.classList.toggle('show');
  if (dd.classList.contains('show')) _renderNotifList();
}

function initNotificationBell() {
  const bell = document.getElementById('notif-bell');
  if (!bell || bell.dataset.bound === '1') return;
  bell.dataset.bound = '1';
  bell.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleNotifications();
  });
}

function openNotificationWindow() {
  const overlay = document.getElementById('notif-modal-overlay');
  const dd = document.getElementById('notif-dropdown');
  if (!overlay) return;
  dd?.classList.remove('show');
  _renderNotifList('notif-modal-list');
  overlay.classList.add('show');
  document.body.classList.add('notif-modal-open');
}

function closeNotificationWindow(event) {
  if (event && event.target !== event.currentTarget) return;
  const overlay = document.getElementById('notif-modal-overlay');
  overlay?.classList.remove('show');
  document.body.classList.remove('notif-modal-open');
}

function openNotifDetail(id) {
  const n = _notifs.find(x => String(x.id) === String(id));
  if (!n) return;
  const wasUnread = Boolean(n.unread);
  n.unread = false;
  if (n.serverId) http.post('/system/notifications/read', { id: n.serverId }).catch(() => {});

  const detail = document.getElementById('notif-detail-overlay');
  if (!detail) return;
  document.getElementById('notif-detail-icon').textContent = n.icon || '🔔';
  document.getElementById('notif-detail-icon').className = `notif-detail-icon ${n.type || 'info'}`;
  document.getElementById('notif-detail-kicker').textContent = wasUnread ? 'إشعار جديد' : 'إشعار';
  document.getElementById('notif-detail-title').textContent = n.title || 'تفاصيل الإشعار';
  document.getElementById('notif-detail-body').textContent = n.msg || '';
  document.getElementById('notif-detail-time').textContent = n.time || 'الآن';

  document.getElementById('notif-dropdown')?.classList.remove('show');
  detail.classList.add('show');
  document.body.classList.add('notif-detail-open');
  _renderNotifBadge();
  _renderOpenNotificationViews();
}

function closeNotifDetail(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('notif-detail-overlay')?.classList.remove('show');
  document.body.classList.remove('notif-detail-open');
}

function _renderOpenNotificationViews() {
  const dd = document.getElementById('notif-dropdown');
  const overlay = document.getElementById('notif-modal-overlay');
  if (dd?.classList.contains('show')) _renderNotifList();
  if (overlay?.classList.contains('show')) _renderNotifList('notif-modal-list');
}

function markNotifRead(id) {
  const n = _notifs.find(x => String(x.id) === String(id));
  if (n) n.unread = false;
  if (n?.serverId) http.post('/system/notifications/read', { id: n.serverId }).catch(() => {});
  _renderNotifBadge();
  _renderOpenNotificationViews();
}

function markAllRead() {
  _notifs.forEach(n => n.unread = false);
  http.post('/system/notifications/read', { all: true }).catch(() => {});
  _renderNotifBadge();
  _renderOpenNotificationViews();
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationBell);
} else {
  initNotificationBell();
}

/* ────────────────────────────────────────────────────────────
   6. LIVE PRICE TICKER — 6 assets, clean display
──────────────────────────────────────────────────────────── */
const TICKER_ASSETS = [
  { symbol:'BTC',  price:67420.50, vol:0.0018 },
  { symbol:'ETH',  price:3521.80,  vol:0.0025 },
  { symbol:'USDT', price:1.0001,   vol:0.0001 },
  { symbol:'GOLD', price:2345.70,  vol:0.0008 },
  { symbol:'AAPL', price:187.40,   vol:0.0015 },
  { symbol:'TSLA', price:176.50,   vol:0.0030 },
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
  wrap.innerHTML = _tickerState.map(a => _tickerItemHtml(a)).join('');
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
  if (window._investproTickerTimer) clearInterval(window._investproTickerTimer);
  window._investproTickerTimer = setInterval(_updateTicker, 3500);
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
