(function () {
  const PLATFORM_NAME = 'InvestPro';

  function closeEntryModal() {
    const modal = document.getElementById('entry-modal');
    if (modal) modal.remove();
    document.body.classList.remove('entry-modal-lock');
  }

  function showDetails() {
    const section = document.getElementById('entry-modal-terms');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitPlatform() {
    if (window.auth && typeof window.auth.logout === 'function') {
      window.auth.logout();
      return;
    }
    window.location.href = 'index.html';
  }

  function showEntryModal() {
    if (document.getElementById('entry-modal')) return;

    document.body.classList.add('entry-modal-lock');

    const overlay = document.createElement('div');
    overlay.id = 'entry-modal';
    overlay.className = 'entry-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'entry-modal-title');

    overlay.innerHTML = `
      <div class="entry-modal-box">
        <div class="entry-modal-header">
          <h2 class="entry-modal-title" id="entry-modal-title"><i class="fas fa-hand"></i> مرحباً بك في ${PLATFORM_NAME}</h2>
          <p class="entry-modal-subtitle">نظام استثمار رقمي ذكي يعتمد على تقنيات متقدمة لتحليل الأسواق وإدارة المحافظ المالية بكفاءة عالية.</p>
        </div>
        <div class="entry-modal-body">
          <section class="entry-modal-section">
            <h3>كيف تبدأ؟</h3>
            <ol>
              <li>اختر خطة الاستثمار المناسبة لك</li>
              <li>قم بالإيداع بسهولة</li>
              <li>تبدأ الأرباح تلقائياً حسب خطتك</li>
            </ol>
          </section>

          <section class="entry-modal-section">
            <h3>مميزات المنصة</h3>
            <ul>
              <li>✔ نظام ذكي يعمل 24/7</li>
              <li>✔ تنفيذ سريع للعمليات</li>
              <li>✔ إدارة احترافية للمحفظة</li>
              <li>✔ تحقيق عوائد مستقرة بشكل مستمر</li>
            </ul>
          </section>

          <section class="entry-modal-section" id="entry-modal-terms">
            <h3>الشروط</h3>
            <ul>
              <li>⚖️ استخدام المنصة يعني الموافقة على جميع الشروط</li>
              <li><i class="fas fa-user-shield"></i> جميع العمليات تتم ضمن نظام آمن ومراقب</li>
              <li><i class="fas fa-sack-dollar"></i> الأرباح تعتمد على أداء النظام والخطة المختارة</li>
              <li><i class="fas fa-xmark"></i> يمنع إنشاء حسابات مزيفة</li>
              <li><i class="fas fa-ban"></i> أي تلاعب يؤدي إلى إيقاف الحساب فوراً</li>
            </ul>
          </section>

          <section class="entry-modal-section entry-modal-note">
            <h3>ملاحظة</h3>
            <p>نسعى لتقديم أفضل أداء واستقرار في النتائج عبر تقنيات متقدمة.</p>
          </section>
        </div>
        <div class="entry-modal-footer">
          <button class="entry-modal-accept" type="button" id="entry-modal-accept">أوافق وأدخل المنصة</button>
          <div class="entry-modal-secondary-actions">
            <button class="entry-modal-secondary" type="button" id="entry-modal-details">قراءة التفاصيل</button>
            <button class="entry-modal-exit" type="button" id="entry-modal-exit">خروج</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.getElementById('entry-modal-accept').focus();
    document.getElementById('entry-modal-accept').addEventListener('click', closeEntryModal);
    document.getElementById('entry-modal-details').addEventListener('click', showDetails);
    document.getElementById('entry-modal-exit').addEventListener('click', exitPlatform);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showEntryModal);
  } else {
    showEntryModal();
  }
})();
