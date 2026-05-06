const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'frontend', 'assets', 'icons', 'investpro-premium');
const svgDir = path.join(outDir, 'svg');
const pngDir = path.join(outDir, 'png');

const ICONS = [
  { id: 'wallet-balance', title: 'Wallet / Balance', accent: '#38bdf8', glow: '#0ea5e9', glyph: walletGlyph() },
  { id: 'deposit', title: 'Deposit', accent: '#22c55e', glow: '#10b981', glyph: arrowGlyph('down') },
  { id: 'withdraw', title: 'Withdraw', accent: '#f59e0b', glow: '#f97316', glyph: arrowGlyph('up') },
  { id: 'vip-plans', title: 'VIP Plans', accent: '#fbbf24', glow: '#f59e0b', glyph: crownGlyph() },
  { id: 'daily-profit', title: 'Daily Profit', accent: '#22c55e', glow: '#16a34a', glyph: profitGlyph() },
  { id: 'referral-rewards', title: 'Referral Rewards', accent: '#38bdf8', glow: '#8b5cf6', glyph: referralGlyph() },
  { id: 'team-users', title: 'Team / Users', accent: '#60a5fa', glow: '#2563eb', glyph: teamGlyph() },
  { id: 'security-shield', title: 'Security Shield', accent: '#22d3ee', glow: '#0891b2', glyph: shieldGlyph(false) },
  { id: 'verification', title: 'Verification', accent: '#22c55e', glow: '#16a34a', glyph: shieldGlyph(true) },
  { id: 'notifications', title: 'Notifications', accent: '#fbbf24', glow: '#f97316', glyph: bellGlyph() },
  { id: 'trading-growth-chart', title: 'Trading / Growth Chart', accent: '#38bdf8', glow: '#22c55e', glyph: chartGlyph() },
  { id: 'ai-robot-assistant', title: 'AI Robot Assistant', accent: '#38bdf8', glow: '#a855f7', glyph: robotGlyph() },
  { id: 'telegram-community', title: 'Telegram Community', accent: '#38bdf8', glow: '#0284c7', glyph: telegramGlyph() },
  { id: 'support-center', title: 'Support Center', accent: '#60a5fa', glow: '#22c55e', glyph: headsetGlyph() },
  { id: 'statistics-dashboard', title: 'Statistics Dashboard', accent: '#38bdf8', glow: '#06b6d4', glyph: dashboardGlyph() },
  { id: 'locked-funds', title: 'Locked Funds', accent: '#f59e0b', glow: '#64748b', glyph: lockGlyph() },
  { id: 'completed-tasks', title: 'Completed Tasks', accent: '#22c55e', glow: '#10b981', glyph: tasksGlyph() },
  { id: 'investment-packages', title: 'Investment Packages', accent: '#fbbf24', glow: '#38bdf8', glyph: packageGlyph() },
];

function ensureDirs() {
  fs.mkdirSync(svgDir, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });
}

function iconSvg(icon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="tile" x1="72" y1="60" x2="438" y2="452" gradientUnits="userSpaceOnUse">
      <stop stop-color="#12243D"/>
      <stop offset="0.48" stop-color="#07111F"/>
      <stop offset="1" stop-color="#02060D"/>
    </linearGradient>
    <linearGradient id="rim" x1="90" y1="72" x2="424" y2="430" gradientUnits="userSpaceOnUse">
      <stop stop-color="${icon.accent}" stop-opacity="0.88"/>
      <stop offset="0.52" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${icon.glow}" stop-opacity="0.38"/>
    </linearGradient>
    <linearGradient id="accent" x1="145" y1="120" x2="365" y2="386" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff"/>
      <stop offset="0.28" stop-color="${icon.accent}"/>
      <stop offset="1" stop-color="${icon.glow}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(258 250) rotate(90) scale(196)">
      <stop stop-color="${icon.glow}" stop-opacity="0.28"/>
      <stop offset="0.62" stop-color="${icon.glow}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${icon.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="28" y="34" width="456" height="456" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="0.50"/>
      <feDropShadow dx="0" dy="0" stdDeviation="13" flood-color="${icon.glow}" flood-opacity="0.20"/>
    </filter>
    <filter id="soft" x="102" y="96" width="310" height="318" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="9" stdDeviation="10" flood-color="${icon.glow}" flood-opacity="0.30"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="58" y="54" width="396" height="396" rx="98" fill="url(#tile)"/>
    <rect x="60.5" y="56.5" width="391" height="391" rx="95.5" stroke="url(#rim)" stroke-width="5"/>
    <path d="M94 151C113 91 193 78 255 78C342 78 401 122 423 186" stroke="#ffffff" stroke-opacity="0.11" stroke-width="18" stroke-linecap="round"/>
    <circle cx="256" cy="252" r="182" fill="url(#halo)"/>
    <rect x="98" y="93" width="316" height="316" rx="78" fill="#ffffff" fill-opacity="0.035"/>
  </g>
  <g filter="url(#soft)" stroke-linecap="round" stroke-linejoin="round">
    ${icon.glyph}
  </g>
</svg>`;
}

function strokeAttrs(width = 20) {
  return `stroke="url(#accent)" stroke-width="${width}"`;
}

function walletGlyph() {
  return `<rect x="144" y="172" width="230" height="166" rx="36" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(16)}/>
  <path d="M154 211H358C381 211 396 226 396 248V310C396 332 381 348 358 348H154" ${strokeAttrs(16)}/>
  <circle cx="342" cy="279" r="15" fill="url(#accent)"/>
  <path d="M186 204H286" ${strokeAttrs(14)}/>`;
}

function arrowGlyph(dir) {
  const isUp = dir === 'up';
  return `<circle cx="256" cy="256" r="105" fill="#07111F" fill-opacity="0.66" ${strokeAttrs(16)}/>
  <path d="${isUp ? 'M256 328V184M198 242L256 184L314 242' : 'M256 184V328M198 270L256 328L314 270'}" ${strokeAttrs(24)}/>
  <path d="M191 356H321" ${strokeAttrs(16)}/>`;
}

function crownGlyph() {
  return `<path d="M150 322L168 186L222 246L258 166L294 246L346 186L364 322H150Z" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(16)}/>
  <path d="M178 352H336" ${strokeAttrs(18)}/>
  <circle cx="258" cy="161" r="13" fill="url(#accent)"/>`;
}

function profitGlyph() {
  return `<path d="M151 334H365" ${strokeAttrs(16)}/>
  <path d="M178 308L226 260L269 285L337 198" ${strokeAttrs(23)}/>
  <path d="M298 198H337V237" ${strokeAttrs(20)}/>
  <circle cx="178" cy="308" r="13" fill="url(#accent)"/>
  <circle cx="226" cy="260" r="13" fill="url(#accent)"/>`;
}

function referralGlyph() {
  return `<circle cx="256" cy="184" r="42" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <circle cx="178" cy="326" r="36" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <circle cx="334" cy="326" r="36" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M236 221L196 292M276 221L316 292" ${strokeAttrs(14)}/>`;
}

function teamGlyph() {
  return `<circle cx="256" cy="190" r="42" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M184 354C195 306 224 280 256 280C288 280 317 306 328 354" ${strokeAttrs(17)}/>
  <circle cx="166" cy="232" r="29" ${strokeAttrs(12)}/>
  <circle cx="346" cy="232" r="29" ${strokeAttrs(12)}/>
  <path d="M126 340C132 302 150 284 174 282M386 340C380 302 362 284 338 282" ${strokeAttrs(13)}/>`;
}

function shieldGlyph(check) {
  return `<path d="M256 144L356 184V253C356 321 317 361 256 386C195 361 156 321 156 253V184L256 144Z" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(16)}/>
  ${check ? `<path d="M208 262L241 296L309 224" ${strokeAttrs(23)}/>` : `<path d="M256 211V275M256 317H257" ${strokeAttrs(22)}/>`}`;
}

function bellGlyph() {
  return `<path d="M184 314H328L312 290V242C312 208 292 178 256 178C220 178 200 208 200 242V290L184 314Z" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(15)}/>
  <path d="M231 342C238 358 274 358 281 342" ${strokeAttrs(15)}/>
  <path d="M328 192C350 212 358 239 352 268" ${strokeAttrs(12)}/>`;
}

function chartGlyph() {
  return `<rect x="150" y="165" width="214" height="182" rx="34" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M187 304L230 261L270 283L326 216" ${strokeAttrs(20)}/>
  <path d="M293 216H326V249" ${strokeAttrs(16)}/>
  <path d="M188 338H326" ${strokeAttrs(12)}/>`;
}

function robotGlyph() {
  return `<rect x="170" y="192" width="172" height="132" rx="38" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(15)}/>
  <path d="M256 192V160" ${strokeAttrs(13)}/>
  <circle cx="256" cy="149" r="12" fill="url(#accent)"/>
  <circle cx="221" cy="255" r="13" fill="url(#accent)"/>
  <circle cx="291" cy="255" r="13" fill="url(#accent)"/>
  <path d="M226 300H286M144 248H170M342 248H368" ${strokeAttrs(12)}/>`;
}

function telegramGlyph() {
  return `<path d="M367 158L148 245C132 251 133 274 150 279L206 296L230 360C236 376 258 379 268 364L367 158Z" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M211 295L303 220M230 360L243 307" ${strokeAttrs(13)}/>`;
}

function headsetGlyph() {
  return `<path d="M166 274V250C166 199 205 166 256 166C307 166 346 199 346 250V274" ${strokeAttrs(16)}/>
  <rect x="146" y="260" width="46" height="72" rx="18" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(12)}/>
  <rect x="320" y="260" width="46" height="72" rx="18" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(12)}/>
  <path d="M346 330C332 362 302 374 260 374" ${strokeAttrs(12)}/>`;
}

function dashboardGlyph() {
  return `<rect x="152" y="164" width="208" height="190" rx="34" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M190 218H322M190 268H322" ${strokeAttrs(11)}/>
  <path d="M206 322V295M256 322V246M306 322V274" ${strokeAttrs(17)}/>`;
}

function lockGlyph() {
  return `<rect x="166" y="232" width="180" height="130" rx="34" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(15)}/>
  <path d="M198 232V202C198 168 222 148 256 148C290 148 314 168 314 202V232" ${strokeAttrs(16)}/>
  <path d="M256 280V316" ${strokeAttrs(17)}/>
  <circle cx="256" cy="270" r="12" fill="url(#accent)"/>`;
}

function tasksGlyph() {
  return `<rect x="165" y="154" width="182" height="222" rx="35" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M208 220L231 243L281 193M208 298L231 321L288 263" ${strokeAttrs(18)}/>
  <path d="M300 222H315M300 300H315" ${strokeAttrs(12)}/>`;
}

function packageGlyph() {
  return `<path d="M256 145L358 205V314L256 374L154 314V205L256 145Z" fill="#07111F" fill-opacity="0.72" ${strokeAttrs(14)}/>
  <path d="M154 205L256 266L358 205M256 266V374M205 176L306 237" ${strokeAttrs(12)}/>
  <path d="M305 176L204 237" ${strokeAttrs(12)}/>`;
}

function previewHtml() {
  const cards = ICONS.map(icon => `<figure>
    <img src="png/${icon.id}.png" alt="${icon.title}">
    <figcaption>${icon.title}</figcaption>
  </figure>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>InvestPro Premium Icon Pack</title>
  <style>
    body{margin:0;background:#030712;color:#e5edf7;font-family:Inter,Segoe UI,Arial,sans-serif}
    main{max-width:1180px;margin:auto;padding:42px 24px}
    h1{font-size:32px;margin:0 0 8px}
    p{margin:0 0 32px;color:#8ea1b5}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:22px}
    figure{margin:0;padding:18px;border:1px solid rgba(148,163,184,.14);border-radius:22px;background:rgba(15,23,42,.58);box-shadow:0 18px 50px rgba(0,0,0,.28)}
    img{width:100%;display:block}
    figcaption{font-size:12px;color:#b8c5d5;text-align:center;margin-top:10px}
  </style>
</head>
<body>
  <main>
    <h1>InvestPro Premium Icon Pack</h1>
    <p>Transparent PNG + SVG assets for fintech dashboard UI.</p>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;
}

async function exportPngs() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    console.warn('PNG export skipped: Playwright is not available. SVG files were generated.');
    return false;
  }

  const executablePath = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find(Boolean);

  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath && fs.existsSync(executablePath) ? executablePath : undefined,
  });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

  for (const icon of ICONS) {
    const svgPath = path.join(svgDir, `${icon.id}.svg`);
    const svg = fs.readFileSync(svgPath, 'utf8');
    const encoded = Buffer.from(svg).toString('base64');
    await page.setContent(`<style>html,body{margin:0;width:512px;height:512px;background:transparent;overflow:hidden}img{width:512px;height:512px;display:block}</style><img src="data:image/svg+xml;base64,${encoded}">`);
    await page.waitForFunction(() => {
      const img = document.querySelector('img');
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.screenshot({ path: path.join(pngDir, `${icon.id}.png`), omitBackground: true });
  }

  await browser.close();
  return true;
}

async function main() {
  ensureDirs();

  for (const icon of ICONS) {
    fs.writeFileSync(path.join(svgDir, `${icon.id}.svg`), iconSvg(icon));
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    name: 'InvestPro Premium Fintech Icon Pack',
    version: '1.0.0',
    style: 'premium 3D fintech, dark navy, gold, electric blue, emerald, glassmorphism',
    size: 512,
    transparentPng: true,
    icons: ICONS.map(({ id, title }) => ({
      id,
      title,
      svg: `svg/${id}.svg`,
      png: `png/${id}.png`,
    })),
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'preview.html'), previewHtml());

  const exported = await exportPngs();
  console.log(`Generated ${ICONS.length} SVG icons${exported ? ' and PNG exports' : ''} in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
