/* ================================================
   InvestPro — Shared API utilities  (Production-hardened)
   ================================================ */

// BACKEND_URL: set this to your Render/Railway backend URL in production
// e.g. 'https://investpro-api.onrender.com'
// Leave empty to use same-origin (when frontend + backend on same server)
const _BACKEND_ORIGIN = window._BACKEND_URL || '';
const API_URL = _BACKEND_ORIGIN ? _BACKEND_ORIGIN + '/api' : window.location.origin + '/api';

/* ---- localStorage helpers ---- */
const store = {
  get: (k) => {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch { return null; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  remove: (k) => { try { localStorage.removeItem(k); } catch (_) {} },
};

/* ---- HTTP client with timeout + auto-retry ---- */
const http = {
  req: async (method, path, body, _retries = 2) => {
    const token = store.get('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 10-second timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(API_URL + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || 'Server Error');
      }

      if (!res.ok || !result.success) throw new Error(result.message || 'خطأ في الطلب');
      return result;
    } catch (err) {
      clearTimeout(timer);

      // Auto-retry on network errors (not on 4xx auth/validation errors)
      const isNetworkErr = err.name === 'AbortError' || err.name === 'TypeError' || err.message === 'Failed to fetch';
      if (isNetworkErr && _retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return http.req(method, path, body, _retries - 1);
      }

      // Timeout message
      if (err.name === 'AbortError') throw new Error('انتهت مهلة الطلب — تحقق من اتصالك بالإنترنت');

      console.error(`API Error [${method} ${path}]:`, err.message);
      throw err;
    }
  },
  get:    (path)       => http.req('GET',    path),
  post:   (path, body) => http.req('POST',   path, body),
  put:    (path, body) => http.req('PUT',    path, body),
  delete: (path)       => http.req('DELETE', path),
};

/* ---- Auth helpers ---- */
const auth = {
  login: (userData, token) => {
    store.set('token', token);
    store.set('user', userData);
  },
  logout: () => {
    store.remove('token');
    store.remove('user');
    window.location.href = '/index.html';
  },
  user:    () => store.get('user'),
  token:   () => store.get('token'),
  isAdmin: () => { const u = store.get('user'); return u && u.isAdmin; },
  check: () => {
    const token = store.get('token');
    const user  = store.get('user');
    if (!token || !user) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },
  checkGuest: () => {
    const token = store.get('token');
    const user  = store.get('user');
    if (token && user) {
      window.location.href = user.isAdmin ? '/admin.html' : '/dashboard.html';
      return false;
    }
    return true;
  },
};

/* ---- Global unhandled error catcher ---- */
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise]', e.reason);
  // Prevent blank crash — show toast if available
  if (typeof toast === 'function') {
    const msg = e.reason?.message || 'حدث خطأ غير متوقع';
    // Only show for non-auth errors to avoid spamming on logout
    if (!msg.includes('غير مصرح') && !msg.includes('رمز')) {
      toast(msg, 'e');
    }
  }
  e.preventDefault();
});

window.addEventListener('error', (e) => {
  console.error('[Global Error]', e.message, e.filename, e.lineno);
});

/* ---- Toast notifications ---- */
const _toastWrap = (() => {
  const el = document.createElement('div');
  el.className = 'toast-wrap';
  document.body.appendChild(el);
  return el;
})();

function toast(msg, type = 'i', duration = 3500) {
  const typeMap = { s: 'toast-s', e: 'toast-e', i: 'toast-i', w: 'toast-w' };
  const icons   = { s: '✓', e: '✕', i: 'ℹ', w: '⚠' };
  const el = document.createElement('div');
  el.className = `toast ${typeMap[type] || 'toast-i'}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${String(msg || '').substring(0, 200)}</span>`;
  _toastWrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = '.3s';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

/* ---- Clipboard ---- */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('تم النسخ', 's')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('تم النسخ', 's');
  });
}

/* ---- Formatters ---- */
const fmt = {
  usd:  (n) => '$' + (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  date: (d) => d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
  ago:  (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d);
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'الآن';
    if (m < 60) return `منذ ${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    return `منذ ${Math.floor(h / 24)} يوم`;
  },
};

/* ---- Unified Validation ---- */
const val = {
  password: (pwd) => pwd && pwd.length >= 8,
};

/* ---- Status badge ---- */
const statusBadge = {
  approved:  '<span class="badge badge-green">معتمد</span>',
  pending:   '<span class="badge badge-gold">معلق</span>',
  rejected:  '<span class="badge badge-red">مرفوض</span>',
  cancelled: '<span class="badge badge-muted">ملغى</span>',
};

/* ---- Transaction type labels ---- */
const txLabel = {
  deposit:         { icon: '⬇', lbl: 'إيداع',          color: 'var(--green)',  sign: '+' },
  withdraw:        { icon: '⬆', lbl: 'سحب',             color: 'var(--red)',    sign: '-' },
  daily_profit:    { icon: '⭐', lbl: 'ربح يومي',        color: 'var(--gold)',   sign: '+' },
  daily_bonus:     { icon: '🎁', lbl: 'مكافأة يومية',    color: 'var(--teal)',   sign: '+' },
  training_reward: { icon: '📚', lbl: 'مكافأة تدريب',    color: 'var(--teal)',   sign: '+' },
  vip_purchase:    { icon: '👑', lbl: 'شراء VIP',        color: 'var(--purple)', sign: '-' },
  referral_l1:     { icon: '👥', lbl: 'عمولة إحالة L1',  color: 'var(--blue)',   sign: '+' },
  referral_l2:     { icon: '👥', lbl: 'عمولة إحالة L2',  color: 'var(--blue)',   sign: '+' },
  referral_l3:     { icon: '👥', lbl: 'عمولة إحالة L3',  color: 'var(--blue)',   sign: '+' },
  signup_bonus:    { icon: '🎁', lbl: 'مكافأة تسجيل',   color: 'var(--green)',  sign: '+' },
  admin_credit:    { icon: '💰', lbl: 'إضافة إدارية',   color: 'var(--green)',  sign: '+' },
  admin_debit:     { icon: '💸', lbl: 'خصم إداري',      color: 'var(--red)',    sign: '-' },
};

/* ---- XSS-safe HTML escaper ---- */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function txRow(tx, extraCols = '') {
  const lbl = txLabel[tx.type] || { icon: '?', lbl: tx.type, color: 'var(--text2)', sign: '' };
  const positive = lbl.sign === '+';
  return `<tr>
    <td><span style="font-size:1.1rem">${lbl.icon}</span> ${lbl.lbl}</td>
    <td style="color:${positive ? 'var(--green)' : 'var(--red)'}; font-weight:600">${lbl.sign}${fmt.usd(tx.amount)}</td>
    <td>${statusBadge[tx.status] || esc(tx.status)}</td>
    <td class="mono" style="color:var(--text3)">${fmt.date(tx.createdAt)}</td>
    ${extraCols}
  </tr>`;
}

/* ---- SPA navigation ---- */
function navGo(pageId, navPrefix = 'nav-', titles = {}) {
  document.querySelectorAll('[data-page]').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if (target) target.style.display = 'block';

  document.querySelectorAll('[data-nav]').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-nav="${pageId}"]`);
  if (navEl) navEl.classList.add('active');

  const titleEl = document.getElementById('page-title');
  if (titleEl && titles[pageId]) titleEl.textContent = titles[pageId];
}

/* ---- Sidebar ---- */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
}

/* ---- Button loading spinner ---- */
function btnLoad(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite"></span>';
    if (!document.getElementById('spin-style')) {
      const s = document.createElement('style');
      s.id = 'spin-style';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._orig || btn.innerHTML;
  }
}

/* ---- Delay helper ---- */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---- Real connection check (no navigator.onLine) ---- */
async function checkConnection() {
  try {
    await fetch('/api/health', { cache: 'no-store' });
    return true;
  } catch {
    return false;
  }
}

/* ---- Retry wrapper ---- */
async function requestWithRetry(fn, retries = 2) {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      await delay(2000);
      return requestWithRetry(fn, retries - 1);
    }
    throw e;
  }
}

/* ---- Offline / Online detection (real check, not navigator.onLine) ---- */
window.addEventListener('offline', async () => {
  const online = await checkConnection();
  if (!online) toast('انقطع الاتصال بالإنترنت', 'w', 5000);
});
window.addEventListener('online', async () => {
  const online = await checkConnection();
  if (online) toast('عاد الاتصال بالإنترنت', 's', 3000);
});
