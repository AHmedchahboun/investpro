# 💎 InvestPro — منصة الاستثمار الرقمي

منصة استثمار رقمية متكاملة تتيح للمستخدمين إيداع USDT، اختيار خطط VIP، ومتابعة الأرباح اليومية مع نظام إحالة متعدد المستويات.

---

## 🛠 التقنيات المستخدمة

| الطبقة | التقنية |
|--------|---------|
| Frontend | HTML5 · CSS3 · Vanilla JS · PWA |
| Backend | Node.js · Express.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT (jsonwebtoken) |
| Hosting | Render (backend) · Netlify (frontend) |

---

## 📁 هيكل المشروع

```
investpro/
├── backend/
│   ├── config/          # DB connection, VIP config, seed
│   ├── jobs/            # Cron jobs (hourly rewards, referral commissions)
│   ├── middleware/       # Auth, rate limiting, validation
│   ├── models/          # User, Wallet, Transaction (Mongoose)
│   ├── routes/          # auth, wallet, vip, admin, system
│   ├── utils/           # Validation helpers
│   ├── server.js        # Express entry point
│   ├── .env.example     # Environment variables template
│   └── package.json
├── frontend/
│   ├── css/             # Modular stylesheets
│   ├── js/              # api.js, fintech-pro.js, config.js
│   ├── index.html       # Landing page
│   ├── dashboard.html   # Main app (SPA-style)
│   ├── admin.html       # Admin panel
│   ├── sw.js            # Service Worker (PWA)
│   └── manifest.json    # PWA manifest
├── netlify.toml         # Netlify frontend config
├── render.yaml          # Render backend config
├── .gitignore
└── README.md
```

---

## ⚡ التشغيل المحلي

### المتطلبات
- Node.js 18+
- MongoDB (local أو Atlas)

### 1. استنساخ المشروع
```bash
git clone https://github.com/YOUR_USERNAME/investpro.git
cd investpro
```

### 2. إعداد Backend
```bash
cd backend
cp .env.example .env
# عدّل .env بقيمك الحقيقية
npm install
npm run dev
```

### 3. إنشاء حساب Admin (مرة واحدة)
```bash
npm run seed
```

### 4. فتح الموقع
```
http://localhost:5000
```

---

## 🚀 النشر على الاستضافة

### Backend → Render

1. أنشئ Web Service جديد على [render.com](https://render.com)
2. اربطه بـ GitHub repo
3. اضبط:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. أضف متغيرات البيئة من `.env.example`

### Frontend → Netlify

1. اربط الـ repo على [netlify.com](https://netlify.com)
2. اضبط:
   - **Base directory:** `investpro`
   - **Publish directory:** `frontend`
3. عدّل `frontend/js/config.js`:
   ```js
   window._BACKEND_URL = 'https://your-render-app.onrender.com';
   ```

---

## 🔐 متغيرات البيئة المطلوبة

انظر [`backend/.env.example`](backend/.env.example) للقائمة الكاملة.

المتغيرات الأساسية:

| المتغير | الوصف |
|---------|-------|
| `MONGODB_URI` | رابط قاعدة البيانات |
| `JWT_SECRET` | مفتاح تشفير 64 حرف عشوائي |
| `ADMIN_EMAIL` | إيميل حساب الأدمن |
| `ADMIN_PASSWORD` | كلمة مرور الأدمن |
| `SITE_URL` | رابط الموقع الكامل |

---

## 📊 الميزات الرئيسية

- ✅ تسجيل / دخول بـ JWT
- ✅ خطط VIP (تدريب / برونزي / فضي / ذهبي / ماسي)
- ✅ أرباح ساعية تلقائية (Cron)
- ✅ نظام إحالة 3 مستويات (15% / 10% / 5%)
- ✅ إيداع وسحب USDT (TRC20 / BEP20 / Polygon)
- ✅ لوحة أدمن كاملة
- ✅ PWA (قابل للتثبيت على الهاتف)
- ✅ Dark Mode

---

## 📄 الترخيص

© 2026 InvestPro. جميع الحقوق محفوظة.
