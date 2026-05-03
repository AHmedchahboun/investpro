const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { notifyAdminWithPhoto } = require('../utils/telegram');

const aiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { success: false, message: 'طلبات كثيرة، حاول بعد دقيقة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const openaiModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function optionalUser(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ') && process.env.JWT_SECRET) {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('name email isAdmin');
    }
  } catch (_) {}
  next();
}

function supportInstructions(userContext) {
  return (
    'أنت مساعد دعم داخل موقع InvestPro. أجب بالعربية الفصحى البسيطة أو الدارجة الخفيفة حسب لغة المستخدم. ' +
    'اجعل الرد واضحا وبسيطا ولطيفا. استخدم جمل قصيرة وخطوات مرقمة عند الشرح. لا تستخدم Markdown مثل ** أو عناوين طويلة. ' +
    'ساعد في التسجيل، تسجيل الدخول، الإيداع، السحب، خطط VIP، الإحالات، واستخدام لوحة التحكم. ' +
    'معلومات المنصة: ' +
    'الشحن يتم من صفحة المحفظة عبر اختيار إيداع، تحديد شبكة USDT المناسبة TRC20 أو BEP20 أو Polygon، نسخ عنوان المحفظة، إرسال المبلغ، ثم إرسال Hash العملية أو إثبات الدفع وانتظار اعتماد الإدارة. ' +
    'السحب يتم من صفحة المحفظة عبر اختيار سحب، إدخال المبلغ، عنوان محفظة المستخدم، والشبكة الصحيحة، ثم تأكيد الطلب. طلبات السحب تخضع لمراجعة أمنية ولا يمكن عكس التحويل إذا كان العنوان خاطئا. ' +
    'VIP يعمل بعد شحن الرصيد واعتماد الإيداع، ثم يفتح المستخدم صفحة VIP ويختار الخطة ويؤكد التفعيل، ويمكنه متابعة الرصيد والأرباح من لوحة التحكم وسجل العمليات. ' +
    'نظام الإحالة يعتمد على رابط الإحالة الموجود في صفحة حسابي. عند تسجيل مستخدم جديد من الرابط وقيامه بإيداع، تظهر عمولة الإحالة حسب نظام المنصة في إحصائيات الإحالة وسجل العمليات. ' +
    'عند وجود مشكلة اطلب من المستخدم: بريد الحساب، نوع المشكلة، رقم العملية، المبلغ، الشبكة، Hash التحويل إن وجد، وصورة الإثبات عند الحاجة. ' +
    'لا تعد بأرباح مضمونة، ولا تقدم نصيحة مالية شخصية، ولا تطلب كلمات مرور أو مفاتيح خاصة أو رموز تحقق. ' +
    'إذا كانت المشكلة تحتاج مراجعة بشرية، اطلب من المستخدم إرسال التفاصيل إلى دعم Telegram الرسمي. ' +
    `سياق المستخدم: ${userContext}`
  );
}

function dataUrlToImageBuffer(imageData) {
  if (!imageData) return null;
  const match = String(imageData).match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const err = new Error('صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP.');
    err.status = 400;
    throw err;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
    const err = new Error('حجم الصورة كبير. الحد الأقصى 2MB.');
    err.status = 400;
    throw err;
  }
  const ext = match[1] === 'jpg' ? 'jpeg' : match[1];
  return { buffer, contentType: `image/${ext}` };
}

function userLabel(user) {
  if (!user) return 'زائر غير مسجل';
  return [
    `الاسم: ${user.name || 'غير محدد'}`,
    `البريد: ${user.email || 'غير محدد'}`,
    `User ID: ${user._id}`,
  ].join('\n');
}

function normalizeArabic(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .trim();
}

function includesAny(text, words) {
  const value = normalizeArabic(text);
  return words.some((word) => value.includes(normalizeArabic(word)));
}

function localSupportReply(message) {
  if (includesAny(message, ['شحن', 'ايداع', 'إيداع', 'deposit', 'hash', 'txid'])) {
    return [
      'طريقة الشحن في InvestPro بسيطة:',
      '',
      '1. افتح صفحة المحفظة.',
      '2. اختر إيداع.',
      '3. اختر شبكة USDT المناسبة: TRC20 أو BEP20 أو Polygon.',
      '4. انسخ عنوان المحفظة وأرسل المبلغ.',
      '5. أرسل Hash العملية أو صورة إثبات الدفع.',
      '6. انتظر مراجعة الإدارة واعتماد الإيداع.',
      '',
      'مهم: استخدم نفس الشبكة المختارة داخل الموقع حتى لا يتأخر الإيداع.',
    ].join('\n');
  }

  if (includesAny(message, ['سحب', 'withdraw', 'محفظة السحب', 'لم يصل السحب'])) {
    return [
      'طريقة السحب:',
      '',
      '1. افتح صفحة المحفظة.',
      '2. اختر سحب.',
      '3. اكتب المبلغ المطلوب.',
      '4. أدخل عنوان محفظتك واختر الشبكة الصحيحة.',
      '5. راجع البيانات جيداً ثم أكد الطلب.',
      '',
      'طلبات السحب تمر بمراجعة أمنية. تأكد من العنوان لأن التحويل لا يمكن عكسه إذا كان خاطئاً.',
    ].join('\n');
  }

  if (includesAny(message, ['ربح', 'ارباح', 'نظام ربح', 'profit', 'كيف اربح', 'مستويات', 'vip'])) {
    return [
      'نظام الربح داخل InvestPro يعمل عبر مستويات VIP:',
      '',
      '1. تشحن رصيدك أولاً.',
      '2. بعد اعتماد الإيداع تختار مستوى VIP.',
      '3. كل مستوى له مدة وربح يومي مختلف.',
      '4. يمكنك متابعة الرصيد والأرباح من لوحة التحكم وسجل العمليات.',
      '',
      'إذا زاد الإقبال على المستويات الحالية، قد تفتح المنصة مستويات جديدة بميزات أقوى.',
      '',
      'تنبيه مهم: لا تعتبر هذه نصيحة مالية، ولا يوجد ربح مضمون. راجع مستوى المخاطر قبل أي قرار.',
    ].join('\n');
  }

  if (includesAny(message, ['احالة', 'إحالة', 'referral', 'دعوة', 'رابط'])) {
    return [
      'نظام الإحالة:',
      '',
      '1. افتح صفحة حسابي.',
      '2. انسخ رابط الإحالة الخاص بك.',
      '3. شاركه مع شخص جديد.',
      '4. عند تسجيله وإيداعه، تظهر عمولة الإحالة حسب نظام المنصة.',
      '',
      'يمكنك متابعة عدد المدعوين وأرباح الإحالة من قسم الإحالات.',
    ].join('\n');
  }

  if (includesAny(message, ['مشكلة', 'دعم', 'خطا', 'خطأ', 'لا يعمل', 'مساعدة'])) {
    return [
      'أكيد، أرسل التفاصيل التالية حتى نساعدك بسرعة:',
      '',
      '1. بريد حسابك.',
      '2. نوع المشكلة.',
      '3. رقم العملية إن وجد.',
      '4. المبلغ والشبكة.',
      '5. Hash التحويل أو صورة الإثبات.',
      '',
      'لا ترسل كلمة المرور أو رموز التحقق لأي شخص.',
    ].join('\n');
  }

  return [
    'مرحباً بك في مساعد InvestPro.',
    '',
    'أقدر أساعدك في:',
    '1. طريقة الشحن.',
    '2. طريقة السحب.',
    '3. نظام VIP والربح.',
    '4. نظام الإحالة.',
    '5. إرسال مشكلة للدعم مع صورة.',
    '',
    'اكتب سؤالك بشكل بسيط وسأرشدك خطوة بخطوة.',
  ].join('\n');
}

function openaiText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function geminiText(data) {
  const parts = [];
  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) parts.push(part.text);
    }
  }
  return parts.join('\n').trim();
}

async function askOpenAI(message, instructions) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      max_output_tokens: 450,
      instructions,
      input: message,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `OpenAI request failed: ${response.status}`);
  }
  return openaiText(data);
}

async function askGemini(message, instructions) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: instructions }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 450,
        temperature: 0.4,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Gemini request failed: ${response.status}`);
  }
  return geminiText(data);
}

router.post('/chat', aiLimit, optionalUser, async (req, res) => {
  try {
    const provider = process.env.OPENAI_API_KEY ? 'openai' : process.env.GEMINI_API_KEY ? 'gemini' : null;
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, message: 'اكتب سؤالك أولاً.' });
    }
    if (message.length > 1200) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً. اختصرها قليلاً.' });
    }

    if (!provider) {
      return res.json({ success: true, provider: 'local', reply: localSupportReply(message) });
    }

    const user = req.user;
    const userContext = user
      ? `المستخدم مسجل. الاسم: ${user.name || 'غير محدد'}. البريد: ${user.email || 'غير محدد'}.`
      : 'الزائر غير مسجل الدخول.';

    const instructions = supportInstructions(userContext);
    const reply = provider === 'openai'
      ? await askOpenAI(message, instructions)
      : await askGemini(message, instructions);

    res.json({
      success: true,
      provider,
      reply: reply || 'لم أستطع تكوين رد واضح. أعد صياغة السؤال من فضلك.',
    });
  } catch (err) {
    console.error('[AI Support]', err.message);
    const message = String(req.body?.message || '').trim();
    res.json({ success: true, provider: 'local', reply: localSupportReply(message) });
  }
});

router.post('/ticket', aiLimit, optionalUser, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const image = dataUrlToImageBuffer(req.body?.image);

    if (!message && !image) {
      return res.status(400).json({ success: false, message: 'اكتب المشكلة أو أرفق صورة.' });
    }

    if (message.length > 1500) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً. اختصرها قليلاً.' });
    }

    const details = [
      'طلب دعم جديد من مساعد الموقع',
      '',
      userLabel(req.user),
      '',
      `وقت الإرسال: ${new Date().toISOString()}`,
      '',
      'رسالة المستخدم:',
      message || '[صورة بدون نص]',
      '',
      'ملاحظة: للرد على المستخدم من تيليجرام يحتاج المستخدم يرسل للبوت أولاً أو أضف له إشعارا من لوحة الإدارة.',
    ].join('\n');

    const sent = await notifyAdminWithPhoto(details, image?.buffer, image?.contentType);
    if (!sent) {
      return res.status(503).json({
        success: false,
        message: 'الدعم البشري غير متصل حالياً. تأكد من إعداد TELEGRAM_BOT_TOKEN و TELEGRAM_ADMIN_CHAT.',
      });
    }

    res.json({
      success: true,
      message: 'تم إرسال طلبك للدعم. سنراجعه في أقرب وقت، ويمكنك إضافة بريد حسابك ورقم العملية لتسريع الحل.',
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'تعذر إرسال طلب الدعم الآن.',
    });
  }
});

module.exports = router;
