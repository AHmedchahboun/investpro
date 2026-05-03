(function () {
  const TELEGRAM_URL = 'https://t.me/InvestProSupportBot';

  function ensureWidget() {
    if (document.getElementById('ai-chat-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'ai-chat-panel';
    panel.id = 'ai-chat-panel';
    panel.innerHTML = `
      <div class="ai-chat-head">
        <div class="ai-chat-title">
          <i class="fas fa-headset"></i>
          <div>
            <div>مساعد InvestPro</div>
            <div class="ai-chat-sub">دعم ذكي فوري للمستخدمين</div>
          </div>
        </div>
        <button class="ai-chat-close" type="button" id="ai-chat-close" aria-label="إغلاق"><i class="fas fa-times"></i></button>
      </div>
      <div class="ai-chat-messages" id="ai-chat-messages"></div>
      <div class="ai-chat-actions">
        <button class="ai-chip" type="button" data-ai-q="اشرح لي طريقة الشحن في InvestPro">الشحن</button>
        <button class="ai-chip" type="button" data-ai-q="اشرح لي طريقة السحب في InvestPro">السحب</button>
        <button class="ai-chip" type="button" data-ai-q="كيف يعمل نظام VIP والإحالة؟">VIP والإحالة</button>
        <button class="ai-chip" type="button" data-ai-q="ما المعلومات المطلوبة لحل مشكلة في حسابي؟">مشكلة</button>
      </div>
      <form class="ai-chat-form" id="ai-chat-form">
        <input class="ai-chat-input" id="ai-chat-input" maxlength="1200" autocomplete="off" placeholder="اكتب سؤالك هنا...">
        <button class="ai-chat-send" id="ai-chat-send" type="submit" aria-label="إرسال"><i class="fas fa-paper-plane"></i></button>
      </form>
    `;

    const fab = document.createElement('button');
    fab.className = 'ai-chat-fab';
    fab.id = 'ai-chat-fab';
    fab.type = 'button';
    fab.innerHTML = '<i class="fas fa-headset"></i><span>مساعد ذكي</span>';

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    const messages = document.getElementById('ai-chat-messages');
    const input = document.getElementById('ai-chat-input');
    const form = document.getElementById('ai-chat-form');
    const send = document.getElementById('ai-chat-send');

    function addMessage(text, who) {
      const msg = document.createElement('div');
      msg.className = `ai-msg ${who}`;
      msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      return msg;
    }

    function openChat() {
      panel.classList.add('open');
      if (!messages.dataset.ready) {
        addMessage('مرحباً، أنا مساعد InvestPro. اسألني عن الشحن، السحب، VIP، الإحالة، الأرباح أو أي مشكلة داخل حسابك.', 'bot');
        messages.dataset.ready = '1';
      }
      setTimeout(() => input.focus(), 50);
    }

    async function askAi(question) {
      addMessage(question, 'user');
      input.value = '';
      send.disabled = true;
      const loading = addMessage('جاري التفكير...', 'bot');

      try {
        const data = await http.post('/ai-support/chat', { message: question });
        loading.textContent = data.reply || 'تم، لكن لم يصل رد واضح.';
      } catch (err) {
        loading.textContent = `${err.message || 'تعذر تشغيل المساعد الآن.'}\n\nللدعم البشري: ${TELEGRAM_URL}`;
      } finally {
        send.disabled = false;
        input.focus();
      }
    }

    fab.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) openChat();
    });
    document.getElementById('ai-chat-close').addEventListener('click', () => panel.classList.remove('open'));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (question) askAi(question);
    });
    panel.querySelectorAll('[data-ai-q]').forEach((btn) => {
      btn.addEventListener('click', () => askAi(btn.dataset.aiQ));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWidget);
  } else {
    ensureWidget();
  }
})();
