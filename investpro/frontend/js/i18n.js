(function () {
  const STORAGE_KEY = 'investpro_language';
  const supported = ['ar', 'en', 'fr'];
  const originalText = new WeakMap();
  let applying = false;

  const translations = {
    en: {
      'أخبار المنصة': 'Platform News',
      'منصة InvestPro تتطور باستمرار لخدمة المستخدمين بشكل أفضل.': 'InvestPro is continuously improving to serve users better.',
      'مع زيادة الإقبال، سنفتح مستويات جديدة ومزايا إضافية للمستخدمين النشطين.': 'As demand grows, new levels and additional features will be opened for active users.',
      'تابع التحديثات القادمة داخل لوحة التحكم ومركز الإشعارات.': 'Follow upcoming updates inside the dashboard and notification center.',
      'السوق': 'Market',
      'الخطط': 'Plans',
      'الإحصائيات': 'Statistics',
      'كيف يعمل': 'How it works',
      'دخول': 'Login',
      'ابدأ مجاناً': 'Start free',
      'تسجيل الدخول': 'Sign in',
      'النظام يعمل 24/7': 'The system runs 24/7',
      'استثمر بذكاء مع': 'Invest smartly with',
      'منصة استثمار رقمية شفافة — تابع أرباحك اليومية، إيداعاتك، وخطة VIP الخاصة بك في مكان واحد.': 'A transparent digital investment platform where you can track daily earnings, deposits, and your VIP plan in one place.',
      'انضم إلى Telegram': 'Join Telegram',
      'مستثمر نشط': 'Active investors',
      'إجمالي الإيداعات': 'Total deposits',
      'أرباح موزّعة': 'Distributed earnings',
      'دولة': 'Countries',
      'مجتمع InvestPro الرسمي': 'Official InvestPro Community',
      '📢 تابع آخر الأخبار عبر Telegram': '📢 Follow the latest news on Telegram',
      'انضم إلى كروب InvestPro باش توصلك تحديثات المنصة، أخبار السوق، تنبيهات الأرباح، وفرص الاستثمار الجديدة في الوقت المناسب.': 'Join the InvestPro group to receive platform updates, market news, earnings alerts, and new investment opportunities on time.',
      'انضم الآن إلى Telegram': 'Join Telegram now',
      'آخر تحديثات المنصة والتنبيهات المهمة': 'Latest platform updates and important alerts',
      'أخبار السوق Crypto / Gold / Stocks': 'Market news: Crypto / Gold / Stocks',
      'شرح الإيداع، السحب، والمحفظة خطوة بخطوة': 'Step-by-step guides for deposits, withdrawals, and wallet use',
      'متابعة الإحالة ونصائح استخدام المنصة': 'Referral updates and platform usage tips',
      'نصائح عند دخول الكروب': 'Tips when joining the group',
      'اقرأ الرسائل المثبتة أولاً لمعرفة آخر التحديثات والقواعد.': 'Read the pinned messages first to understand the latest updates and rules.',
      'لا ترسل كلمة المرور أو رموز التحقق لأي شخص داخل أو خارج الكروب.': 'Do not send your password or verification codes to anyone inside or outside the group.',
      'اعتمد فقط على الروابط الرسمية التي تنشرها إدارة InvestPro.': 'Use only the official links published by InvestPro management.',
      'إذا احتجت مساعدة، اكتب مشكلتك بوضوح مع رقم العملية إن وجد.': 'If you need help, describe your issue clearly and include the transaction number if available.',
      '📊 السوق المباشر': '📊 Live Market',
      'أسعار محدّثة كل 3 ثواني': 'Prices update every 3 seconds',
      'إحصائيات المنصة': 'Platform Statistics',
      'مستثمر مسجّل': 'Registered investors',
      'مسحوبات معتمدة': 'Approved withdrawals',
      'كيف يعمل النظام؟': 'How does the system work?',
      '3 خطوات بسيطة للبدء': 'Simple steps to get started',
      'سجّل حسابك مجاناً': 'Create your account for free',
      'أنشئ حساباً في ثوانٍ بالبريد الإلكتروني — لا رسوم تسجيل.': 'Create an account in seconds using your email — no registration fees.',
      'أودع USDT واختر خطة VIP': 'Deposit USDT and choose a VIP plan',
      'الإيداع عبر USDT TRC-20، BEP-20، Bitcoin، أو PayPal. اختر الخطة التي تناسب ميزانيتك.': 'Deposit via USDT TRC-20, BEP-20, Bitcoin, or PayPal. Choose the plan that fits your budget.',
      'تابع أرباحك يومياً': 'Track your earnings daily',
      'يُضاف ربحك تلقائياً كل 24 ساعة إلى محفظتك داخل لوحة التحكم.': 'Your earnings are added automatically every 24 hours to your dashboard wallet.',
      'اسحب متى تشاء': 'Withdraw when you want',
      'طلب السحب يُراجع خلال 24 ساعة — رسوم السحب 10% فقط.': 'Withdrawal requests are reviewed within 24 hours — withdrawal fee is only 10%.',
      '💎 خطط VIP': '💎 VIP Plans',
      'اختر الخطة المناسبة لبدء رحلتك الاستثمارية': 'Choose the right plan to start your investment journey',
      'تدريب': 'Training',
      'مجاني': 'Free',
      'المدة': 'Duration',
      '5 أيام': '5 days',
      '30 يوم': '30 days',
      'ربح يومي': 'Daily profit',
      'الإجمالي': 'Total',
      'المخاطر': 'Risk',
      'منخفض': 'Low',
      'متوسط': 'Medium',
      'مرتفع': 'High',
      'اختر': 'Choose',
      'برونزي': 'Bronze',
      'فضي': 'Silver',
      'ذهبي': 'Gold',
      'ماسي': 'Diamond',
      '📈 نمو المحفظة (مثال توضيحي)': '📈 Portfolio Growth (Demo Example)',
      'مثال على نمو محفظة بخطة فضية ($30) لمدة 30 يوماً': 'Example of portfolio growth with a Silver plan ($30) for 30 days',
      'من كل أنحاء العالم': 'From around the world',
      'مجتمع مستثمرين من أكثر من 12 دولة': 'A community of investors from more than 12 countries',
      'لماذا InvestPro؟': 'Why InvestPro?',
      'مبني على الشفافية والموثوقية': 'Built on transparency and reliability',
      'أمان متقدم': 'Advanced security',
      'شفافية كاملة': 'Full transparency',
      'نظام آلي 24/7': 'Automated system 24/7',
      'سحب سريع': 'Fast withdrawals',
      'نظام الإحالة': 'Referral system',
      'لوحة تحكم كاملة': 'Complete dashboard',
      '🚀 ابدأ رحلتك اليوم': '🚀 Start your journey today',
      'سجّل مجاناً واستفد من فترة التدريب 5 أيام قبل أي استثمار': 'Register for free and benefit from a 5-day training period before any investment.',
      'ابدأ مجاناً الآن': 'Start free now',
      'الشروط والأحكام': 'Terms and Conditions',
      'الخصوصية': 'Privacy',
      'المخاطر': 'Risks',
      'الدعم': 'Support',
      '© 2026 InvestPro. جميع الحقوق محفوظة.': '© 2026 InvestPro. All rights reserved.',
      'جاري التحميل...': 'Loading...',
      'الإشعارات': 'Notifications',
      'تحديد كمقروء': 'Mark as read',
      'إغلاق': 'Close',
      'مركز الرسائل': 'Message Center',
      'الإشعارات والتنبيهات': 'Notifications and Alerts',
      'تفاصيل الإشعار': 'Notification details',
      'الرئيسية': 'Home',
      'المحفظة': 'Wallet',
      'العمليات': 'Transactions',
      'حسابي': 'Account',
      'إيداع': 'Deposit',
      'سحب': 'Withdraw',
      'ترقية VIP': 'Upgrade VIP',
      'الإحالة': 'Referral',
      'حول المنصة': 'About the platform',
      'الدعم الفني': 'Technical support',
      'فتح الدعم': 'Open support',
      'الأمان والتشفير': 'Security and encryption',
      'كلمة المرور الحالية': 'Current password',
      'كلمة المرور الجديدة': 'New password',
      'تحديث كلمة المرور': 'Update password',
      'انضم الآن وابقَ على اطلاع': 'Join now and stay updated',
      'مجتمع InvestPro الرسمي': 'Official InvestPro community'
    },
    fr: {
      'أخبار المنصة': 'Actualités de la plateforme',
      'منصة InvestPro تتطور باستمرار لخدمة المستخدمين بشكل أفضل.': 'InvestPro évolue continuellement pour mieux servir ses utilisateurs.',
      'مع زيادة الإقبال، سنفتح مستويات جديدة ومزايا إضافية للمستخدمين النشطين.': 'Avec la croissance de la demande, de nouveaux niveaux et avantages seront ajoutés pour les utilisateurs actifs.',
      'تابع التحديثات القادمة داخل لوحة التحكم ومركز الإشعارات.': 'Suivez les prochaines mises à jour dans le tableau de bord et le centre de notifications.',
      'السوق': 'Marché',
      'الخطط': 'Plans',
      'الإحصائيات': 'Statistiques',
      'كيف يعمل': 'Fonctionnement',
      'دخول': 'Connexion',
      'ابدأ مجاناً': 'Commencer gratuitement',
      'تسجيل الدخول': 'Se connecter',
      'النظام يعمل 24/7': 'Le système fonctionne 24/7',
      'استثمر بذكاء مع': 'Investissez intelligemment avec',
      'منصة استثمار رقمية شفافة — تابع أرباحك اليومية، إيداعاتك، وخطة VIP الخاصة بك في مكان واحد.': 'Une plateforme d’investissement numérique transparente pour suivre vos gains quotidiens, dépôts et plan VIP en un seul endroit.',
      'انضم إلى Telegram': 'Rejoindre Telegram',
      'مستثمر نشط': 'Investisseurs actifs',
      'إجمالي الإيداعات': 'Total des dépôts',
      'أرباح موزّعة': 'Gains distribués',
      'دولة': 'Pays',
      'مجتمع InvestPro الرسمي': 'Communauté officielle InvestPro',
      '📢 تابع آخر الأخبار عبر Telegram': '📢 Suivez les dernières nouvelles sur Telegram',
      'انضم إلى كروب InvestPro باش توصلك تحديثات المنصة، أخبار السوق، تنبيهات الأرباح، وفرص الاستثمار الجديدة في الوقت المناسب.': 'Rejoignez le groupe InvestPro pour recevoir les mises à jour, les actualités du marché, les alertes de gains et les nouvelles opportunités à temps.',
      'انضم الآن إلى Telegram': 'Rejoindre Telegram maintenant',
      'آخر تحديثات المنصة والتنبيهات المهمة': 'Dernières mises à jour et alertes importantes',
      'أخبار السوق Crypto / Gold / Stocks': 'Actualités du marché : Crypto / Or / Actions',
      'شرح الإيداع، السحب، والمحفظة خطوة بخطوة': 'Guides étape par étape pour les dépôts, retraits et portefeuille',
      'متابعة الإحالة ونصائح استخدام المنصة': 'Suivi du parrainage et conseils d’utilisation',
      'نصائح عند دخول الكروب': 'Conseils avant de rejoindre le groupe',
      'اقرأ الرسائل المثبتة أولاً لمعرفة آخر التحديثات والقواعد.': 'Lisez d’abord les messages épinglés pour connaître les dernières mises à jour et règles.',
      'لا ترسل كلمة المرور أو رموز التحقق لأي شخص داخل أو خارج الكروب.': 'N’envoyez jamais votre mot de passe ou vos codes de vérification à qui que ce soit.',
      'اعتمد فقط على الروابط الرسمية التي تنشرها إدارة InvestPro.': 'Utilisez uniquement les liens officiels publiés par l’équipe InvestPro.',
      'إذا احتجت مساعدة، اكتب مشكلتك بوضوح مع رقم العملية إن وجد.': 'Si vous avez besoin d’aide, décrivez clairement votre problème avec le numéro de transaction si disponible.',
      '📊 السوق المباشر': '📊 Marché en direct',
      'أسعار محدّثة كل 3 ثواني': 'Prix mis à jour toutes les 3 secondes',
      'إحصائيات المنصة': 'Statistiques de la plateforme',
      'مستثمر مسجّل': 'Investisseurs inscrits',
      'مسحوبات معتمدة': 'Retraits approuvés',
      'كيف يعمل النظام؟': 'Comment fonctionne le système ?',
      '3 خطوات بسيطة للبدء': 'Quelques étapes simples pour commencer',
      'سجّل حسابك مجاناً': 'Créez votre compte gratuitement',
      'أنشئ حساباً في ثوانٍ بالبريد الإلكتروني — لا رسوم تسجيل.': 'Créez un compte en quelques secondes par email — sans frais d’inscription.',
      'أودع USDT واختر خطة VIP': 'Déposez des USDT et choisissez un plan VIP',
      'الإيداع عبر USDT TRC-20، BEP-20، Bitcoin، أو PayPal. اختر الخطة التي تناسب ميزانيتك.': 'Dépôt via USDT TRC-20, BEP-20, Bitcoin ou PayPal. Choisissez le plan adapté à votre budget.',
      'تابع أرباحك يومياً': 'Suivez vos gains chaque jour',
      'يُضاف ربحك تلقائياً كل 24 ساعة إلى محفظتك داخل لوحة التحكم.': 'Vos gains sont ajoutés automatiquement toutes les 24 heures à votre portefeuille.',
      'اسحب متى تشاء': 'Retirez quand vous le souhaitez',
      'طلب السحب يُراجع خلال 24 ساعة — رسوم السحب 10% فقط.': 'Les demandes de retrait sont examinées sous 24 heures — frais de retrait de 10 %.',
      '💎 خطط VIP': '💎 Plans VIP',
      'اختر الخطة المناسبة لبدء رحلتك الاستثمارية': 'Choisissez le plan adapté pour commencer votre parcours d’investissement',
      'تدريب': 'Formation',
      'مجاني': 'Gratuit',
      'المدة': 'Durée',
      '5 أيام': '5 jours',
      '30 يوم': '30 jours',
      'ربح يومي': 'Gain quotidien',
      'الإجمالي': 'Total',
      'المخاطر': 'Risque',
      'منخفض': 'Faible',
      'متوسط': 'Moyen',
      'مرتفع': 'Élevé',
      'اختر': 'Choisir',
      'برونزي': 'Bronze',
      'فضي': 'Argent',
      'ذهبي': 'Or',
      'ماسي': 'Diamant',
      '📈 نمو المحفظة (مثال توضيحي)': '📈 Croissance du portefeuille (exemple démo)',
      'مثال على نمو محفظة بخطة فضية ($30) لمدة 30 يوماً': 'Exemple de croissance avec un plan Argent (30 $) pendant 30 jours',
      'من كل أنحاء العالم': 'Du monde entier',
      'مجتمع مستثمرين من أكثر من 12 دولة': 'Une communauté d’investisseurs dans plus de 12 pays',
      'لماذا InvestPro؟': 'Pourquoi InvestPro ?',
      'مبني على الشفافية والموثوقية': 'Basé sur la transparence et la fiabilité',
      'أمان متقدم': 'Sécurité avancée',
      'شفافية كاملة': 'Transparence totale',
      'نظام آلي 24/7': 'Système automatisé 24/7',
      'سحب سريع': 'Retrait rapide',
      'نظام الإحالة': 'Système de parrainage',
      'لوحة تحكم كاملة': 'Tableau de bord complet',
      '🚀 ابدأ رحلتك اليوم': '🚀 Commencez votre parcours aujourd’hui',
      'سجّل مجاناً واستفد من فترة التدريب 5 أيام قبل أي استثمار': 'Inscrivez-vous gratuitement et profitez d’une période de formation de 5 jours avant tout investissement.',
      'ابدأ مجاناً الآن': 'Commencer gratuitement',
      'الشروط والأحكام': 'Conditions générales',
      'الخصوصية': 'Confidentialité',
      'المخاطر': 'Risques',
      'الدعم': 'Support',
      '© 2026 InvestPro. جميع الحقوق محفوظة.': '© 2026 InvestPro. Tous droits réservés.',
      'جاري التحميل...': 'Chargement...',
      'الإشعارات': 'Notifications',
      'تحديد كمقروء': 'Marquer comme lu',
      'إغلاق': 'Fermer',
      'مركز الرسائل': 'Centre des messages',
      'الإشعارات والتنبيهات': 'Notifications et alertes',
      'تفاصيل الإشعار': 'Détails de la notification',
      'الرئيسية': 'Accueil',
      'المحفظة': 'Portefeuille',
      'العمليات': 'Transactions',
      'حسابي': 'Compte',
      'إيداع': 'Dépôt',
      'سحب': 'Retrait',
      'ترقية VIP': 'Passer VIP',
      'الإحالة': 'Parrainage',
      'حول المنصة': 'À propos de la plateforme',
      'الدعم الفني': 'Support technique',
      'فتح الدعم': 'Ouvrir le support',
      'الأمان والتشفير': 'Sécurité et chiffrement',
      'كلمة المرور الحالية': 'Mot de passe actuel',
      'كلمة المرور الجديدة': 'Nouveau mot de passe',
      'تحديث كلمة المرور': 'Mettre à jour le mot de passe',
      'انضم الآن وابقَ على اطلاع': 'Rejoignez-nous et restez informé',
      'مجتمع InvestPro الرسمي': 'Communauté officielle InvestPro'
    }
  };

  function injectStyles() {
    if (document.getElementById('investpro-i18n-style')) return;
    const style = document.createElement('style');
    style.id = 'investpro-i18n-style';
    style.textContent = `
      .lang-switcher{display:inline-flex;align-items:center;gap:4px;padding:3px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.055);flex:0 0 auto}
      .lang-switcher button{min-width:34px;height:30px;border-radius:999px;background:transparent;color:#94a3b8;font-size:.72rem;font-weight:800;transition:all .2s ease}
      .lang-switcher button.active{background:#0088cc;color:#fff;box-shadow:0 8px 18px rgba(0,136,204,.28)}
      .top-lang-slot{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2}
      html[dir="rtl"] .top-lang-slot{left:50%;right:auto}
      .top-lang-slot .lang-switcher{background:rgba(15,23,42,.92);box-shadow:0 10px 26px rgba(0,0,0,.24)}
      html[dir="ltr"] body{direction:ltr}
      html[dir="ltr"] .nav,html[dir="ltr"] .top-bar,html[dir="ltr"] .hero,html[dir="ltr"] .section,html[dir="ltr"] .footer{text-align:left}
      html[dir="ltr"] .hero,html[dir="ltr"] .footer{text-align:center}
      html[dir="ltr"] .telegram-list div,html[dir="ltr"] .hiw-step,html[dir="ltr"] .trust-card{text-align:left}
      @media(max-width:640px){
        .top-lang-slot{top:43px;left:50%;transform:translateX(-50%)}
        .top-lang-slot .lang-switcher{padding:2px;gap:2px}
        .lang-switcher button{min-width:30px;height:26px;font-size:.65rem}
      }
    `;
    document.head.appendChild(style);
  }

  function currentLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return supported.includes(saved) ? saved : 'ar';
  }

  function addSwitcher() {
    if (document.querySelector('.lang-switcher')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    wrap.setAttribute('aria-label', 'Language selector');
    wrap.innerHTML = `
      <button type="button" data-lang="ar">AR</button>
      <button type="button" data-lang="en">EN</button>
      <button type="button" data-lang="fr">FR</button>
    `;
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('button[data-lang]');
      if (!btn) return;
      setLanguage(btn.dataset.lang);
    });

    const slot = document.getElementById('dashboard-lang-slot');
    const nav = document.querySelector('.nav-btns');
    const top = document.querySelector('.top-bar .flex');
    const target = slot || nav || top || document.body;
    target.prepend(wrap);
  }

  function getOriginal(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    return originalText.get(node);
  }

  function shouldSkip(parent) {
    if (!parent) return true;
    return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'OPTION'].includes(parent.nodeName);
  }

  function translateTextNodes(lang) {
    const dict = translations[lang] || {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const original = getOriginal(node);
      const trimmed = original.trim();
      if (!trimmed) return;
      const leading = original.match(/^\s*/)[0];
      const trailing = original.match(/\s*$/)[0];
      const next = leading + (lang === 'ar' ? trimmed : (dict[trimmed] || trimmed)) + trailing;
      if (node.nodeValue !== next) node.nodeValue = next;
    });
  }

  function setLanguage(lang) {
    if (!supported.includes(lang)) lang = 'ar';
    applying = true;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    translateTextNodes(lang);
    document.querySelectorAll('.lang-switcher button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    applying = false;
  }

  function init() {
    injectStyles();
    addSwitcher();
    setLanguage(currentLang());

    let timer = null;
    const observer = new MutationObserver(() => {
      if (applying) return;
      clearTimeout(timer);
      timer = setTimeout(() => setLanguage(currentLang()), 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
