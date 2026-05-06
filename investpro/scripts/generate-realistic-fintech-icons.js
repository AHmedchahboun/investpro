const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'frontend', 'assets', 'icons', 'investpro-realistic');
const svgDir = path.join(outDir, 'svg');
const pngDir = path.join(outDir, 'png');

const ICONS = [
  { id: 'wallet', title: 'Wallet', a: '#38bdf8', b: '#fbbf24', kind: 'wallet' },
  { id: 'deposit', title: 'Deposit', a: '#22c55e', b: '#fbbf24', kind: 'deposit' },
  { id: 'withdraw', title: 'Withdraw', a: '#f59e0b', b: '#38bdf8', kind: 'withdraw' },
  { id: 'vip-crown', title: 'VIP Crown', a: '#fbbf24', b: '#38bdf8', kind: 'crown' },
  { id: 'daily-profit', title: 'Daily Profit', a: '#22c55e', b: '#fbbf24', kind: 'profit' },
  { id: 'referral-bonus', title: 'Referral Bonus', a: '#38bdf8', b: '#22c55e', kind: 'referral' },
  { id: 'team-members', title: 'Team Members', a: '#60a5fa', b: '#fbbf24', kind: 'team' },
  { id: 'ai-trading', title: 'AI Trading', a: '#38bdf8', b: '#a855f7', kind: 'robot' },
  { id: 'security-shield', title: 'Security Shield', a: '#22d3ee', b: '#fbbf24', kind: 'shield' },
  { id: 'verification-badge', title: 'Verification Badge', a: '#22c55e', b: '#fbbf24', kind: 'verify' },
  { id: 'locked-balance', title: 'Locked Balance', a: '#f59e0b', b: '#38bdf8', kind: 'lock' },
  { id: 'statistics', title: 'Statistics', a: '#38bdf8', b: '#22c55e', kind: 'stats' },
  { id: 'notifications', title: 'Notifications', a: '#fbbf24', b: '#f97316', kind: 'bell' },
  { id: 'telegram-community', title: 'Telegram Community', a: '#38bdf8', b: '#0ea5e9', kind: 'telegram' },
  { id: 'customer-support', title: 'Customer Support', a: '#60a5fa', b: '#22c55e', kind: 'support' },
  { id: 'investment-plans', title: 'Investment Plans', a: '#fbbf24', b: '#38bdf8', kind: 'plans' },
  { id: 'market-analytics', title: 'Market Analytics', a: '#22c55e', b: '#38bdf8', kind: 'market' },
  { id: 'smart-automation', title: 'Smart Automation', a: '#38bdf8', b: '#fbbf24', kind: 'chip' },
];

function ensureDirs() {
  fs.mkdirSync(svgDir, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });
}

function svg(icon) {
  const glyph = glyphs[icon.kind](icon);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768" fill="none">
  <defs>
    <linearGradient id="metal" x1="158" y1="104" x2="604" y2="650" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2d4058"/>
      <stop offset="0.28" stop-color="#0c1728"/>
      <stop offset="0.72" stop-color="#08111e"/>
      <stop offset="1" stop-color="#17263a"/>
    </linearGradient>
    <linearGradient id="edge" x1="180" y1="110" x2="590" y2="624" gradientUnits="userSpaceOnUse">
      <stop stop-color="${icon.a}"/>
      <stop offset="0.38" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="0.72" stop-color="${icon.b}" stop-opacity="0.78"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="gold" x1="245" y1="165" x2="530" y2="560" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff7ad"/>
      <stop offset="0.25" stop-color="#fbbf24"/>
      <stop offset="0.58" stop-color="#c78010"/>
      <stop offset="1" stop-color="#5d3604"/>
    </linearGradient>
    <linearGradient id="cyan" x1="180" y1="140" x2="570" y2="570" gradientUnits="userSpaceOnUse">
      <stop stop-color="#e0faff"/>
      <stop offset="0.22" stop-color="${icon.a}"/>
      <stop offset="0.72" stop-color="${icon.b}"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <radialGradient id="halo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(384 386) rotate(90) scale(292)">
      <stop stop-color="${icon.a}" stop-opacity="0.34"/>
      <stop offset="0.52" stop-color="${icon.b}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${icon.a}" stop-opacity="0"/>
    </radialGradient>
    <filter id="heavyShadow" x="54" y="56" width="660" height="666" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="35" stdDeviation="36" flood-color="#000000" flood-opacity="0.62"/>
      <feDropShadow dx="0" dy="0" stdDeviation="22" flood-color="${icon.a}" flood-opacity="0.18"/>
    </filter>
    <filter id="objectShadow" x="118" y="110" width="532" height="540" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.44"/>
      <feDropShadow dx="0" dy="0" stdDeviation="13" flood-color="${icon.a}" flood-opacity="0.28"/>
    </filter>
  </defs>
  <g filter="url(#heavyShadow)">
    <ellipse cx="384" cy="610" rx="220" ry="36" fill="#000000" fill-opacity="0.38"/>
    <rect x="110" y="96" width="548" height="548" rx="138" fill="url(#metal)"/>
    <rect x="114" y="100" width="540" height="540" rx="134" stroke="url(#edge)" stroke-width="8"/>
    <path d="M172 229C205 138 309 122 384 122C506 122 587 183 612 276" stroke="#ffffff" stroke-opacity="0.12" stroke-width="28" stroke-linecap="round"/>
    <circle cx="384" cy="374" r="248" fill="url(#halo)"/>
    <path d="M166 506C240 611 510 614 596 490" stroke="#ffffff" stroke-opacity="0.055" stroke-width="24" stroke-linecap="round"/>
  </g>
  <g filter="url(#objectShadow)">
    ${glyph}
  </g>
</svg>`;
}

function baseBox(x, y, w, h, rx = 38) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#metal)" stroke="url(#edge)" stroke-width="10"/>
  <path d="M${x + 28} ${y + 34}C${x + 92} ${y + 8} ${x + w - 92} ${y + 8} ${x + w - 28} ${y + 34}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="12" stroke-linecap="round"/>`;
}

function coin(cx, cy, r = 38) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gold)" stroke="#ffe58a" stroke-width="7"/>
  <ellipse cx="${cx - r * 0.18}" cy="${cy - r * 0.25}" rx="${r * 0.32}" ry="${r * 0.16}" fill="#ffffff" fill-opacity="0.34"/>
  <path d="M${cx - r * 0.42} ${cy + r * 0.08}H${cx + r * 0.42}" stroke="#5d3604" stroke-opacity="0.48" stroke-width="7" stroke-linecap="round"/>`;
}

const glyphs = {
  wallet: () => `${baseBox(188, 254, 378, 214, 48)}
    <path d="M219 304H528C563 304 588 329 588 364V424C588 458 563 482 528 482H219" fill="#07111f" fill-opacity=".62" stroke="url(#cyan)" stroke-width="10"/>
    ${coin(282, 239, 44)}${coin(337, 238, 38)}${coin(392, 246, 32)}
    <circle cx="514" cy="394" r="22" fill="url(#cyan)"/>`,
  deposit: () => `${baseBox(220, 250, 328, 242, 52)}
    <path d="M384 165V385M306 303L384 385L462 303" stroke="url(#cyan)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    ${coin(285, 502, 36)}${coin(350, 507, 31)}${coin(430, 504, 37)}`,
  withdraw: () => `${baseBox(220, 276, 328, 216, 52)}
    <path d="M384 445V210M306 292L384 210L462 292" stroke="url(#gold)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    ${coin(284, 513, 35)}${coin(432, 512, 34)}`,
  crown: () => `<path d="M204 445L238 236L324 331L384 196L444 331L530 236L564 445H204Z" fill="url(#gold)" stroke="#ffe58a" stroke-width="10" stroke-linejoin="round"/>
    <rect x="218" y="444" width="332" height="70" rx="28" fill="url(#metal)" stroke="url(#gold)" stroke-width="10"/>
    <circle cx="384" cy="192" r="24" fill="url(#cyan)"/>
    <circle cx="238" cy="232" r="20" fill="url(#gold)"/>
    <circle cx="530" cy="232" r="20" fill="url(#gold)"/>`,
  profit: () => `${baseBox(186, 300, 396, 190, 48)}
    <path d="M225 426L306 347L374 386L506 244" stroke="url(#cyan)" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M452 244H506V300" stroke="url(#cyan)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
    ${coin(240, 502, 31)}${coin(300, 510, 28)}${coin(514, 505, 34)}`,
  referral: () => `${baseBox(218, 274, 332, 198, 48)}
    ${coin(384, 226, 52)}
    <circle cx="296" cy="396" r="48" fill="url(#cyan)" stroke="#b8f7ff" stroke-width="9"/>
    <circle cx="472" cy="396" r="48" fill="url(#cyan)" stroke="#b8f7ff" stroke-width="9"/>
    <path d="M352 266L315 350M416 266L453 350" stroke="#e0faff" stroke-width="20" stroke-linecap="round"/>`,
  team: () => `<circle cx="384" cy="260" r="66" fill="url(#gold)" stroke="#fff0a6" stroke-width="10"/>
    <circle cx="278" cy="326" r="52" fill="url(#cyan)" stroke="#b8f7ff" stroke-width="9"/>
    <circle cx="490" cy="326" r="52" fill="url(#cyan)" stroke="#b8f7ff" stroke-width="9"/>
    <path d="M222 514C246 426 306 386 384 386C462 386 522 426 546 514" fill="url(#metal)" stroke="url(#edge)" stroke-width="11"/>
    <path d="M174 508C188 446 224 414 274 410M594 508C580 446 544 414 494 410" stroke="url(#cyan)" stroke-width="16" stroke-linecap="round"/>`,
  robot: () => `${baseBox(222, 258, 324, 210, 68)}
    <rect x="258" y="302" width="252" height="120" rx="52" fill="#07111f" stroke="url(#cyan)" stroke-width="12"/>
    <circle cx="326" cy="362" r="24" fill="#38bdf8"/>
    <circle cx="442" cy="362" r="24" fill="#38bdf8"/>
    <path d="M334 424H434M384 258V206" stroke="#e0faff" stroke-width="18" stroke-linecap="round"/>
    <circle cx="384" cy="190" r="21" fill="url(#gold)"/>`,
  shield: () => `<path d="M384 167L542 230V346C542 456 479 520 384 560C289 520 226 456 226 346V230L384 167Z" fill="url(#metal)" stroke="url(#cyan)" stroke-width="12"/>
    <path d="M384 282V388M384 446H386" stroke="url(#gold)" stroke-width="42" stroke-linecap="round"/>`,
  verify: () => `<path d="M384 167L542 230V346C542 456 479 520 384 560C289 520 226 456 226 346V230L384 167Z" fill="url(#metal)" stroke="url(#gold)" stroke-width="12"/>
    <path d="M302 370L360 428L474 300" stroke="url(#cyan)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: () => `${baseBox(226, 304, 316, 190, 52)}
    <path d="M274 304V254C274 188 321 154 384 154C447 154 494 188 494 254V304" stroke="url(#gold)" stroke-width="30" stroke-linecap="round"/>
    <circle cx="384" cy="386" r="25" fill="url(#cyan)"/>
    <path d="M384 410V456" stroke="#e0faff" stroke-width="20" stroke-linecap="round"/>`,
  stats: () => `${baseBox(196, 216, 376, 292, 54)}
    <path d="M262 438V364M384 438V292M506 438V330" stroke="url(#cyan)" stroke-width="38" stroke-linecap="round"/>
    <path d="M242 274H526M242 484H526" stroke="#ffffff" stroke-opacity=".18" stroke-width="14" stroke-linecap="round"/>`,
  bell: () => `<path d="M256 444H512L482 396V316C482 248 438 192 384 192C330 192 286 248 286 316V396L256 444Z" fill="url(#metal)" stroke="url(#gold)" stroke-width="12"/>
    <path d="M344 486C357 524 411 524 424 486" stroke="url(#cyan)" stroke-width="24" stroke-linecap="round"/>
    <path d="M506 220C545 254 558 306 544 362" stroke="url(#gold)" stroke-width="18" stroke-linecap="round"/>`,
  telegram: () => `<path d="M570 190L186 340C158 351 160 390 190 398L293 428L337 546C349 579 389 584 408 556L570 190Z" fill="url(#cyan)" stroke="#b8f7ff" stroke-width="10"/>
    <path d="M294 428L460 300M337 546L361 448" stroke="#07111f" stroke-opacity=".72" stroke-width="20" stroke-linecap="round"/>`,
  support: () => `<path d="M230 386V342C230 245 296 194 384 194C472 194 538 245 538 342V386" stroke="url(#cyan)" stroke-width="32" stroke-linecap="round"/>
    <rect x="190" y="366" width="82" height="126" rx="34" fill="url(#metal)" stroke="url(#edge)" stroke-width="10"/>
    <rect x="496" y="366" width="82" height="126" rx="34" fill="url(#metal)" stroke="url(#edge)" stroke-width="10"/>
    <path d="M536 492C510 550 454 570 382 570" stroke="url(#gold)" stroke-width="18" stroke-linecap="round"/>`,
  plans: () => `<path d="M384 170L550 266V460L384 558L218 460V266L384 170Z" fill="url(#metal)" stroke="url(#edge)" stroke-width="11"/>
    <path d="M218 266L384 366L550 266M384 366V558" stroke="url(#cyan)" stroke-width="16" stroke-linecap="round"/>
    ${coin(384, 250, 44)}
    <path d="M316 214L452 296M452 214L316 296" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>`,
  market: () => `${baseBox(185, 292, 398, 210, 48)}
    <path d="M230 446L310 378L376 410L518 270" stroke="url(#cyan)" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M468 270H518V322" stroke="url(#gold)" stroke-width="31" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="522" cy="246" r="42" fill="url(#gold)" stroke="#fff0a6" stroke-width="8"/>`,
  chip: () => `<rect x="254" y="218" width="260" height="260" rx="56" fill="url(#metal)" stroke="url(#cyan)" stroke-width="12"/>
    <circle cx="384" cy="348" r="62" fill="url(#cyan)" stroke="#e0faff" stroke-width="8"/>
    <path d="M384 286V410M322 348H446M244 284H202M244 348H202M244 412H202M524 284H566M524 348H566M524 412H566" stroke="url(#gold)" stroke-width="18" stroke-linecap="round"/>
    <path d="M320 208V166M384 208V166M448 208V166M320 488V530M384 488V530M448 488V530" stroke="url(#gold)" stroke-width="18" stroke-linecap="round"/>`,
};

function previewHtml() {
  const cards = ICONS.map(icon => `<figure><img src="png/${icon.id}.png" alt="${icon.title}"><figcaption>${icon.title}</figcaption></figure>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>InvestPro Realistic Icons</title><style>
  body{margin:0;background:#030712;color:#e5edf7;font-family:Inter,Segoe UI,Arial,sans-serif}
  main{max-width:1240px;margin:auto;padding:42px 24px}h1{margin:0 0 8px}p{margin:0 0 30px;color:#94a3b8}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(154px,1fr));gap:22px}
  figure{margin:0;padding:16px;border-radius:24px;background:linear-gradient(180deg,rgba(15,23,42,.72),rgba(2,6,23,.78));border:1px solid rgba(148,163,184,.16);box-shadow:0 24px 60px rgba(0,0,0,.32)}
  img{display:block;width:100%}figcaption{text-align:center;font-size:12px;color:#cbd5e1;margin-top:10px}
  </style></head><body><main><h1>InvestPro Realistic Fintech Icon System</h1><p>Premium 3D banking icons, transparent PNG + SVG.</p><section class="grid">${cards}</section></main></body></html>`;
}

async function exportPngs() {
  const { chromium } = require('playwright');
  const executablePath = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(p => p && fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 768, height: 768 }, deviceScaleFactor: 1 });
  for (const icon of ICONS) {
    const raw = fs.readFileSync(path.join(svgDir, `${icon.id}.svg`), 'utf8');
    const encoded = Buffer.from(raw).toString('base64');
    await page.setContent(`<style>html,body{margin:0;width:768px;height:768px;background:transparent;overflow:hidden}img{width:768px;height:768px;display:block}</style><img src="data:image/svg+xml;base64,${encoded}">`);
    await page.waitForFunction(() => {
      const img = document.querySelector('img');
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.screenshot({ path: path.join(pngDir, `${icon.id}.png`), omitBackground: true });
  }
  await browser.close();
}

async function main() {
  ensureDirs();
  for (const icon of ICONS) {
    fs.writeFileSync(path.join(svgDir, `${icon.id}.svg`), svg(icon));
  }
  fs.writeFileSync(path.join(outDir, 'preview.html'), previewHtml());
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    name: 'InvestPro Realistic Premium Fintech Icon System',
    size: 768,
    transparentPng: true,
    visualDirection: 'realistic premium banking, semi-3D, dark navy, metallic glass, cyan emerald and gold accents',
    icons: ICONS.map(({ id, title }) => ({ id, title, svg: `svg/${id}.svg`, png: `png/${id}.png` })),
  }, null, 2));
  await exportPngs();
  console.log(`Generated ${ICONS.length} realistic icons in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
