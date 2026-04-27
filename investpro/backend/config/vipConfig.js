/**
 * VIP Plans — Single source of truth.
 *
 * Financial model (30-day cycle):
 *   dailyProfit = monthlyProfit / 30
 *   totalReturn = price + monthlyProfit
 *   monthlyPct  = (monthlyProfit / price) * 100
 */

const VIP_LEVELS = [
  {
    level:        0,
    name:         'التدريب',
    nameEn:       'Training',
    tier:         'مبتدئ',
    price:        0,
    monthlyPct:   0,
    dailyProfit:  0,
    dailyBonus:   0,
    dailyTotal:   0.10,
    durationDays: 5,
    totalReturn:  0.50,
    isTraining:   true,
    badge:        null,
    description:  'جرّب المنصة مجاناً لمدة 5 أيام واكسب $0.10 يومياً بدون أي مخاطرة.',
    marketing:    'مرحباً بك في InvestPro — ابدأ رحلتك الاستثمارية مجاناً واكتشف كيف تعمل المنصة قبل أي التزام مالي.',
    risk:         'منعدم',
  },
  {
    level:        1,
    name:         'البرونزي',
    nameEn:       'Bronze',
    tier:         'مستوى مبتدئ',
    subscribers:  { base: 214, min: 120, max: 260 },
    price:        10,
    monthlyPct:   150,
    // monthly profit = $10 × 150% = $15 | daily = $15 / 30 = $0.50
    dailyProfit:  0.50,
    dailyBonus:   0,
    dailyTotal:   0.50,
    durationDays: 30,
    totalReturn:  25.00,   // $10 + $15
    get netProfit() { return +(this.totalReturn - this.price).toFixed(2); },
    badge:        null,
    description:  'بداية استثمارك الآمن — عائد 150% خلال 30 يوم.',
    marketing:    'مرحباً بك في المستوى البرونزي — هذا المستوى مثالي للمبتدئين ويمنحك دخلاً يومياً ثابتاً قدره $0.50 لمدة 30 يوماً. سيتم تفعيل عقد استثماري آمن فور الإيداع مع حماية كاملة لرأس المال.',
    risk:         'منخفض',
  },
  {
    level:        2,
    name:         'الفضي',
    nameEn:       'Silver',
    tier:         'مستوى متقدم',
    subscribers:  { base: 287, min: 80, max: 350 },
    price:        30,
    monthlyPct:   150,
    // monthly profit = $30 × 150% = $45 | daily = $45 / 30 = $1.50
    dailyProfit:  1.50,
    dailyBonus:   0,
    dailyTotal:   1.50,
    durationDays: 30,
    totalReturn:  75.00,   // $30 + $45
    get netProfit() { return +(this.totalReturn - this.price).toFixed(2); },
    badge:        '⭐ الأكثر اختياراً',
    description:  'الخيار الأمثل للمستثمر الجاد — عائد 150% مع ربح يومي $1.50.',
    marketing:    'الخطة الفضية هي الأكثر اختياراً بين مستخدمينا — توازن مثالي بين السعر والعائد. استثمارك يُدار باحترافية مع ضمان دخل يومي ثابت $1.50 طوال 30 يوماً.',
    risk:         'منخفض',
  },
  {
    level:        3,
    name:         'الذهبي',
    nameEn:       'Gold',
    tier:         'مستوى احترافي',
    subscribers:  { base: 312, min: 110, max: 411 },
    price:        100,
    monthlyPct:   150,
    // monthly profit = $100 × 150% = $150 | daily = $150 / 30 = $5.00
    dailyProfit:  5.00,
    dailyBonus:   0,
    dailyTotal:   5.00,
    durationDays: 30,
    totalReturn:  250.00,  // $100 + $150
    get netProfit() { return +(this.totalReturn - this.price).toFixed(2); },
    badge:        '🔥 أفضل توازن',
    description:  'للمستثمر الاحترافي — $5.00 يومياً مع إدارة متقدمة للمخاطر.',
    marketing:    'الخطة الذهبية تمنحك أفضل توازن بين العائد والأمان. استثمارك يُدار بطريقة احترافية مع حماية المخاطر وضمان $5.00 يومياً. الخيار المفضل للمستثمرين ذوي الخبرة.',
    risk:         'متوسط',
  },
  {
    level:        4,
    name:         'الماسي',
    nameEn:       'Diamond',
    tier:         'مستوى VIP — أعلى عائد',
    subscribers:  { base: 94, min: 60, max: 130 },
    price:        300,
    monthlyPct:   170,
    // monthly profit = $300 × 170% = $510 | daily = $510 / 30 = $17.00
    dailyProfit:  17.00,
    dailyBonus:   0,
    dailyTotal:   17.00,
    durationDays: 30,
    totalReturn:  810.00,  // $300 + $510
    get netProfit() { return +(this.totalReturn - this.price).toFixed(2); },
    badge:        '💎 أعلى عائد',
    description:  'الحد الأقصى من العوائد — $17.00 يومياً بعائد 170%.',
    marketing:    'الخطة الماسية حصرية للمستثمرين الجادين الذين يسعون لأعلى عائد ممكن. $17.00 يومياً لمدة 30 يوماً مع إدارة VIP كاملة لمحفظتك الاستثمارية وأولوية في خدمة العملاء.',
    risk:         'متوسط',
  },
];

const REFERRAL_RATES = {
  L1: parseFloat(process.env.REFERRAL_L1 || 15),
  L2: parseFloat(process.env.REFERRAL_L2 || 8),
  L3: parseFloat(process.env.REFERRAL_L3 || 4),
};

const PAYMENT_METHODS = [
  { id: 'TRC20',   name: 'USDT (TRC20)',   currency: 'USDT', icon: '₮' },
  { id: 'BEP20',   name: 'USDT (BEP20)',   currency: 'USDT', icon: '💎' },
  { id: 'POLYGON', name: 'USDT (POLYGON)', currency: 'USDT', icon: '💜' },
];

const PLATFORM_WALLETS = {
  TRC20:   process.env.WALLET_USDT_TRC20   || 'TRX_ADDRESS_HERE',
  BEP20:   process.env.WALLET_USDT_BEP20   || 'BEP_ADDRESS_HERE',
  POLYGON: process.env.WALLET_USDT_POLYGON || 'POLYGON_ADDRESS_HERE',
};

module.exports = { VIP_LEVELS, PAYMENT_METHODS, PLATFORM_WALLETS, REFERRAL_RATES };
