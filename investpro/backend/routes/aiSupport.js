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
    if (!provider) {
      return res.status(503).json({
        success: false,
        message: 'المساعد الذكي غير مفعل حالياً. أضف OPENAI_API_KEY أو GEMINI_API_KEY في إعدادات السيرفر.',
      });
    }

    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ success: false, message: 'اكتب سؤالك أولاً.' });
    }
    if (message.length > 1200) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً. اختصرها قليلاً.' });
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
    res.status(502).json({ success: false, message: 'تعذر تشغيل المساعد الآن. حاول بعد قليل.' });
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
