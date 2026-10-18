// Render exercise contact sheet to PNG:  NODE_PATH=$(npm root -g) node tools/snap.cjs out.png [ids]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'contact.png';
  const ids = process.argv[3] || '';
  const extra = process.argv[4] || '';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, 'contact.html') + (ids ? '?ids=' + ids : '?') + extra);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out, fullPage: true });
  if (errs.length) console.log('ERRORS:', errs.join('\n'));
  await browser.close();
})();
