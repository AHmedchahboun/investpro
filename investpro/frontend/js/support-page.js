(function () {
  const TELEGRAM_URL = 'https://t.me/InvestProSupportBot';
  let selectedImage = null;
  let supportMode = false;

  const messages = document.getElementById('support-messages');
  const input = document.getElementById('support-input');
  const form = document.getElementById('support-form');
  const send = document.getElementById('support-send');
  const fileInput = document.getElementById('support-image-input');
  const attachment = document.getElementById('support-attachment');
  const attachmentName = document.getElementById('support-attachment-name');
  const attachButton = document.getElementById('support-attach-image');

  function cleanReply(text) {
    return String(text || '').replace(/\*\*/g, '').replace(/#{1,6}\s*/g, '').trim();
  }

  function addMessage(text, who) {
    const msg = document.createElement('div');
    msg.className = `support-msg ${who}`;
    msg.textContent = cleanReply(text);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function setBusy(isBusy) {
    send.disabled = isBusy;
    input.disabled = isBusy;
    attachButton.disabled = isBusy;
  }

  function resetAttachment() {
    selectedImage = null;
    fileInput.value = '';
    attachment.hidden = true;
    attachmentName.textContent = '';
  }

  function showAttachment(name) {
    attachment.hidden = false;
    attachmentName.textContent = name;
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
      const data = await http.post('/ai-support/ticket', { message, image: selectedImage });
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

  document.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => askAi(button.dataset.question));
  });

  document.getElementById('support-ticket-mode').addEventListener('click', () => {
    supportMode = true;
    addMessage('تمام. اكتب المشكلة وأرفق صورة إن وجدت. الأفضل تذكر بريد الحساب، رقم العملية، المبلغ، الشبكة و Hash التحويل.', 'bot');
    input.focus();
  });

  attachButton.addEventListener('click', () => fileInput.click());
  document.getElementById('support-remove-image').addEventListener('click', resetAttachment);

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
      supportMode = true;
      showAttachment(file.name);
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

  addMessage('أهلاً بك. هذه صفحة الدعم الخاصة بك. اسألني عن الشحن، السحب، VIP والإحالة، أو أرسل مشكلة مع صورة لتصل مباشرة إلى الإدارة.', 'bot');
})();
