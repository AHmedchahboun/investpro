(function () {
  const TELEGRAM_URL = 'https://t.me/InvestProSupportBot';
  let selectedImage = null;
  let selectedImageName = '';
  let supportMode = false;

  function cleanReply(text) {
    return String(text || '')
      .replace(/\*\*/g, '')
      .replace(/#{1,6}\s*/g, '')
      .trim();
  }

  function ensureWidget() {
    if (document.getElementById('ai-chat-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'ai-chat-panel';
    panel.id = 'ai-chat-panel';
    panel.innerHTML = `
      <div class="ai-chat-head">
        <div class="ai-chat-title">
          <span class="ai-chat-logo"><i class="fas fa-headset"></i></span>
          <div>
            <div>مساعد InvestPro</div>
            <div class="ai-chat-sub">شرح سريع + إرسال مشاكل للدعم</div>
          </div>
        </div>
        <button class="ai-chat-close" type="button" id="ai-chat-close" aria-label="إغلاق"><i class="fas fa-times"></i></button>
      </div>
      <div class="ai-chat-messages" id="ai-chat-messages"></div>
      <div class="ai-chat-actions">
        <button class="ai-chip" type="button" data-ai-q="اشرح لي طريقة الشحن في InvestPro">الشحن</button>
        <button class="ai-chip" type="button" data-ai-q="اشرح لي طريقة السحب في InvestPro">السحب</button>
        <button class="ai-chip" type="button" data-ai-q="كيف يعمل نظام VIP والإحالة؟">VIP والإحالة</button>
        <button class="ai-chip ai-chip-alert" type="button" id="ai-human-ticket">إرسال للدعم</button>
      </div>
      <div class="ai-attachment" id="ai-attachment" hidden>
        <span><i class="fas fa-image"></i> <b id="ai-attachment-name"></b></span>
        <button type="button" id="ai-remove-image" aria-label="حذف الصورة"><i class="fas fa-times"></i></button>
      </div>
      <form class="ai-chat-form" id="ai-chat-form">
        <input type="file" id="ai-image-input" accept="image/png,image/jpeg,image/webp" hidden>
        <button class="ai-chat-tool" type="button" id="ai-attach-image" title="إرفاق صورة"><i class="fas fa-paperclip"></i></button>
        <input class="ai-chat-input" id="ai-chat-input" maxlength="1500" autocomplete="off" placeholder="اكتب سؤالك أو مشكلتك...">
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
    const fileInput = document.getElementById('ai-image-input');
    const attachment = document.getElementById('ai-attachment');
    const attachmentName = document.getElementById('ai-attachment-name');

    function addMessage(text, who) {
      const msg = document.createElement('div');
      msg.className = `ai-msg ${who}`;
      msg.textContent = cleanReply(text);
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      return msg;
    }

    function setBusy(isBusy) {
      send.disabled = isBusy;
      input.disabled = isBusy;
      document.getElementById('ai-attach-image').disabled = isBusy;
    }

    function resetAttachment() {
      selectedImage = null;
      selectedImageName = '';
      fileInput.value = '';
      attachment.hidden = true;
      attachmentName.textContent = '';
    }

    function showAttachment(name) {
      attachment.hidden = false;
      attachmentName.textContent = name;
    }

    function openChat() {
      panel.classList.add('open');
      if (!messages.dataset.ready) {
        addMessage('أهلاً بك. أقدر أشرح لك الشحن، السحب، VIP والإحالة. وإذا عندك مشكلة، أرفق صورة واكتب التفاصيل وسأرسلها للدعم.', 'bot');
        messages.dataset.ready = '1';
      }
      setTimeout(() => input.focus(), 50);
    }

    async function askAi(question) {
      addMessage(question, 'user');
      input.value = '';
      setBusy(true);
      const loading = addMessage('ثواني فقط، أراجع لك الموضوع...', 'bot');

      try {
        const data = await http.post('/ai-support/chat', { message: question });
        loading.textContent = cleanReply(data.reply || 'تم، لكن لم يصل رد واضح.');
      } catch (err) {
        loading.textContent = cleanReply(`${err.message || 'تعذر تشغيل المساعد الآن.'}\nللدعم البشري: ${TELEGRAM_URL}`);
      } finally {
        setBusy(false);
        input.focus();
      }
    }

    async function sendTicket(message) {
      addMessage(message || 'طلب دعم مع صورة', 'user');
      input.value = '';
      setBusy(true);
      const loading = addMessage('جاري إرسال طلبك للدعم...', 'bot');

      try {
        const data = await http.post('/ai-support/ticket', {
          message,
          image: selectedImage,
        });
        loading.textContent = cleanReply(data.message || 'تم إرسال طلبك للدعم.');
        supportMode = false;
        resetAttachment();
      } catch (err) {
        loading.textContent = cleanReply(`${err.message || 'تعذر إرسال طلب الدعم.'}\nيمكنك التواصل مباشرة: ${TELEGRAM_URL}`);
      } finally {
        setBusy(false);
        input.focus();
      }
    }

    fab.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) openChat();
    });

    document.getElementById('ai-chat-close').addEventListener('click', () => panel.classList.remove('open'));
    document.getElementById('ai-attach-image').addEventListener('click', () => fileInput.click());
    document.getElementById('ai-remove-image').addEventListener('click', resetAttachment);
    document.getElementById('ai-human-ticket').addEventListener('click', () => {
      supportMode = true;
      addMessage('تمام. اكتب المشكلة وأرفق صورة إن وجدت. الأفضل تذكر بريد الحساب، رقم العملية، المبلغ، الشبكة و Hash التحويل.', 'bot');
      input.focus();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
        addMessage('الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP.', 'bot');
        resetAttachment();
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        addMessage('حجم الصورة كبير. اختر صورة أقل من 2MB.', 'bot');
        resetAttachment();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        selectedImage = reader.result;
        selectedImageName = file.name;
        supportMode = true;
        showAttachment(selectedImageName);
        addMessage('تم إرفاق الصورة. اكتب شرحاً قصيراً للمشكلة ثم اضغط إرسال.', 'bot');
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question && !selectedImage) return;
      if (selectedImage || supportMode) sendTicket(question);
      else askAi(question);
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
