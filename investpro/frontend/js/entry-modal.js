(function () {
  const OFFER_KEY = 'investpro_limited_profit_offer_end_at';
  const OFFER_LENGTH_MS = 24 * 60 * 60 * 1000;

  let countdownTimer = null;

  function money(value) {
    const amount = Number(value) || 0;
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getStoredUser() {
    try {
      return window.store?.get?.('user') || JSON.parse(localStorage.getItem('user') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function getStoredWallet() {
    try {
      return window.store?.get?.('wallet') || JSON.parse(localStorage.getItem('wallet') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function getOfferEndAt() {
    const now = Date.now();
    try {
      const saved = Number(localStorage.getItem(OFFER_KEY));
      if (saved && saved > now) return saved;
      const endAt = now + OFFER_LENGTH_MS;
      localStorage.setItem(OFFER_KEY, String(endAt));
      return endAt;
    } catch (_) {
      return now + OFFER_LENGTH_MS;
    }
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
  }

  function supportForBalance(balance) {
    const amount = Number(balance) || 0;
    if (amount < 50) return { rate: 50, label: 'دعم قوي للحسابات الصغيرة' };
    if (amount < 100) return { rate: 35, label: 'دعم نمو سريع' };
    if (amount < 300) return { rate: 20, label: 'دعم متوسط' };
    if (amount < 500) return { rate: 10, label: 'دعم ترقية' };
    return { rate: 5, label: 'دعم استمرارية' };
  }

  function nextReferralGoal(count) {
    const direct = Number(count) || 0;
    const goals = [
      { target: 10, reward: '$5' },
      { target: 50, reward: '$25' },
      { target: 100, reward: 'ترقية VIP' },
    ];
    return goals.find(goal => direct < goal.target) || goals[goals.length - 1];
  }

  function updateReferralProgress(directCount) {
    const count = Number(directCount) || 0;
    const goal = nextReferralGoal(count);
    const pct = Math.min(100, Math.round((count / goal.target) * 100));
    const countEl = document.getElementById('offer-ref-count');
    const goalEl = document.getElementById('offer-ref-goal');
    const pctEl = document.getElementById('offer-ref-pct');
    const fillEl = document.getElementById('offer-ref-fill');
    const rewardEl = document.getElementById('offer-current-reward');

    if (countEl) countEl.textContent = count;
    if (goalEl) goalEl.textContent = goal.target;
    if (pctEl) pctEl.textContent = pct + '%';
    if (fillEl) fillEl.style.width = pct + '%';
    if (rewardEl) rewardEl.textContent = goal.reward;
  }

  function playOfferSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => ctx.close?.(), 320);
    } catch (_) {}
  }

  function armOfferSound() {
    const playOnce = () => {
      document.removeEventListener('pointerdown', playOnce, true);
      document.removeEventListener('keydown', playOnce, true);
      playOfferSound();
    };
    const options = { once: true, passive: true, capture: true };
    document.addEventListener('pointerdown', playOnce, options);
    document.addEventListener('keydown', playOnce, { once: true, capture: true });
  }

  function closeEntryModal(event) {
    const modal = document.getElementById('entry-modal');
    if (modal) modal.remove();
    document.body.classList.remove('entry-modal-lock');
    if (countdownTimer) clearInterval(countdownTimer);
  }

  function goToDeposit() {
    if (Date.now() >= Number(document.getElementById('entry-modal')?.dataset.endAt || 0)) return;
    closeEntryModal();
    if (typeof window.go === 'function') window.go('pg-wal');
    if (typeof window.switchWalletTab === 'function') {
      setTimeout(() => window.switchWalletTab('deposit'), 120);
    }
  }

  function expireOffer() {
    const claimBtn = document.getElementById('entry-modal-claim');
    const timer = document.getElementById('entry-modal-countdown');
    const state = document.getElementById('entry-modal-state');
    if (timer) timer.textContent = '00:00:00';
    if (state) state.textContent = 'انتهى العرض';
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.innerHTML = '<i class="fas fa-lock"></i><span>انتهى العرض</span>';
      claimBtn.classList.add('is-expired');
    }
  }

  function startCountdown(endAt) {
    const tick = () => {
      const remaining = endAt - Date.now();
      const timer = document.getElementById('entry-modal-countdown');
      const hours = document.getElementById('offer-hours-left');
      if (timer) timer.textContent = formatCountdown(remaining);
      if (hours) hours.textContent = Math.max(0, Math.ceil(remaining / 3600000));
      if (remaining <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        expireOffer();
      }
    };

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  async function hydrateLiveData() {
    const wallet = getStoredWallet();
    const user = getStoredUser();
    const balance = Number(wallet.balance ?? wallet.totalDeposited ?? 0) || 0;
    const support = supportForBalance(balance);

    const balanceEl = document.getElementById('offer-balance');
    const supportEl = document.getElementById('offer-support-rate');
    const supportLabelEl = document.getElementById('offer-support-label');
    if (balanceEl) balanceEl.textContent = money(balance);
    if (supportEl) supportEl.textContent = support.rate + '%';
    if (supportLabelEl) supportLabelEl.textContent = support.label;

    const directFallback = Number(user.directReferrals ?? user.referralsCount ?? user.referralCount ?? 0) || 0;
    updateReferralProgress(directFallback);

    if (!window.http?.get || !window.store?.get?.('token')) return;
    try {
      const stats = await window.http.get('/auth/referral-stats');
      updateReferralProgress(stats.directCount || 0);
    } catch (_) {}
  }

  function buildSupportRows() {
    return [
      ['أقل من $50', '50%', 'strong'],
      ['أقل من $100', '35%', 'strong'],
      ['أقل من $300', '20%', 'medium'],
      ['أقل من $500', '10%', 'warm'],
      ['أكثر من $500', '5%', 'blue'],
    ].map(row => `
      <div class="entry-support-row ${row[2]}">
        <span>${row[0]}</span>
        <strong>${row[1]}</strong>
      </div>`).join('');
  }

  function showEntryModal() {
    if (document.getElementById('entry-modal')) return;

    const endAt = getOfferEndAt();
    document.body.classList.add('entry-modal-lock');

    const overlay = document.createElement('div');
    overlay.id = 'entry-modal';
    overlay.className = 'entry-modal-overlay';
    overlay.dataset.endAt = String(endAt);
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'entry-modal-title');

    overlay.innerHTML = `
      <div class="entry-modal-box">
        <div class="entry-modal-aura entry-modal-aura-blue"></div>
        <div class="entry-modal-aura entry-modal-aura-green"></div>

        <div class="entry-modal-topline">
          <span id="entry-modal-state"><i class="fas fa-bolt"></i> عرض نشط الآن</span>
          <button class="entry-modal-close" type="button" id="entry-modal-close" aria-label="إغلاق">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="entry-modal-header">
          <div class="entry-modal-mark"><i class="fas fa-chart-line"></i></div>
          <div>
            <p class="entry-modal-kicker">InvestPro Rewards</p>
            <h2 class="entry-modal-title" id="entry-modal-title">🚀 عرض مضاعفة الأرباح لفترة محدودة</h2>
            <p class="entry-modal-subtitle">
              مرحباً بك في InvestPro. لفترة محدودة فقط يمكنك الحصول على دعم إضافي للأرباح ومكافآت شحن تلقائية حسب مستوى رأس مالك.
            </p>
          </div>
        </div>

        <div class="entry-countdown-card">
          <div>
            <span>العرض ينتهي خلال</span>
            <strong id="entry-modal-countdown">24:00:00</strong>
          </div>
          <div class="entry-countdown-ring"><i class="fas fa-hourglass-half"></i></div>
        </div>

        <div class="entry-modal-body">
          <section class="entry-modal-section entry-benefits">
            <h3>عند تنفيذ أي إيداع أو شحن</h3>
            <div class="entry-benefit-grid">
              <div><i class="fas fa-gift"></i><span>مكافأة فورية تصل إلى $5</span></div>
              <div><i class="fas fa-arrow-trend-up"></i><span>رفع نسبة الأرباح اليومية</span></div>
              <div><i class="fas fa-crown"></i><span>تفعيل مزايا VIP تدريجياً</span></div>
              <div><i class="fas fa-seedling"></i><span>دعم إضافي لأصحاب الحسابات الصغيرة</span></div>
              <div><i class="fas fa-gauge-high"></i><span>زيادة سرعة نمو الحساب</span></div>
            </div>
          </section>

          <section class="entry-modal-section">
            <div class="entry-section-head">
              <h3>نظام الدعم التنازلي الذكي</h3>
              <span id="offer-support-label">يتم احتسابه تلقائياً</span>
            </div>
            <div class="entry-live-stats">
              <div>
                <span>رصيدك الحالي</span>
                <strong id="offer-balance">$0.00</strong>
              </div>
              <div>
                <span>نسبة الدعم المتوقعة</span>
                <strong id="offer-support-rate">50%</strong>
              </div>
            </div>
            <div class="entry-support-table">
              ${buildSupportRows()}
            </div>
            <p class="entry-muted">يتم احتساب الدعم تلقائياً داخل النظام بدون تدخل يدوي.</p>
          </section>

          <section class="entry-modal-section">
            <div class="entry-section-head">
              <h3>نظام الإحالات والمكافآت</h3>
              <span>Real-Time</span>
            </div>
            <div class="entry-ref-card">
              <div class="entry-ref-top">
                <div>
                  <span>تقدم هدف الإحالات</span>
                  <strong><bdi id="offer-ref-count">0</bdi> / <bdi id="offer-ref-goal">10</bdi></strong>
                </div>
                <div class="entry-ref-pct" id="offer-ref-pct">0%</div>
              </div>
              <div class="entry-progress">
                <div class="entry-progress-fill" id="offer-ref-fill" style="width:0%"></div>
              </div>
              <div class="entry-ref-meta">
                <span>المكافأة الحالية</span>
                <strong id="offer-current-reward">$5</strong>
              </div>
            </div>
            <div class="entry-goals-grid">
              <div><span>10 إحالات</span><strong>$5</strong></div>
              <div><span>50 إحالة</span><strong>$25</strong></div>
              <div><span>100 إحالة</span><strong>VIP مجاني</strong></div>
            </div>
          </section>

          <section class="entry-modal-section entry-logs">
            <h3>تفاصيل أرباح الإحالة</h3>
            <ul>
              <li><i class="fas fa-circle-check"></i> يتم احتساب الأرباح تلقائياً</li>
              <li><i class="fas fa-circle-check"></i> أي عملية شحن من الإحالات تضيف ربحاً مباشراً لحسابك</li>
              <li><i class="fas fa-shield-halved"></i> النظام آمن وشفاف مع تسجيل العمليات داخل Logs النظام</li>
              <li><i class="fas fa-rotate"></i> تحديث الأرباح Real-Time</li>
            </ul>
          </section>
        </div>

        <div class="entry-modal-footer">
          <div class="entry-mini-metrics">
            <div><span>الساعات المتبقية</span><strong id="offer-hours-left">24</strong></div>
            <div><span>المكافأة</span><strong>$5</strong></div>
            <div><span>VIP</span><strong>مفتوح</strong></div>
          </div>
          <button class="entry-modal-accept" type="button" id="entry-modal-claim">
            <i class="fas fa-rocket"></i><span>ابدأ الشحن الآن</span>
          </button>
          <button class="entry-modal-secondary" type="button" id="entry-modal-later">لاحقاً</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.getElementById('entry-modal-claim')?.addEventListener('click', goToDeposit);
    document.getElementById('entry-modal-later')?.addEventListener('click', closeEntryModal);
    document.getElementById('entry-modal-close')?.addEventListener('click', closeEntryModal);
    overlay.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeEntryModal();
    });

    startCountdown(endAt);
    hydrateLiveData();
    armOfferSound();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showEntryModal);
  } else {
    showEntryModal();
  }
})();
