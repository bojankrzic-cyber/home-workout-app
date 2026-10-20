// Phone workout player: Timer / How-to rhythm per step – 15 s How-to only, then Timer 3 s / How-to 6 s,
// and the last 3 s of a timed step always How-to.   NODE_PATH=$(npm root -g) node tools/views.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.clock.runFor(1500);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.clock.runFor(500);
  await page.evaluate(() => window.__go('train')); await page.clock.runFor(500);
  await page.click('.hero-card .btn.primary'); await page.clock.runFor(100);   // first step: 6 min bike warm-up (timed)
  const v = () => page.evaluate(() => document.querySelector('.player').classList.contains('v-form') ? 'form' : 'timer');
  const at = async (t, want) => { const now = await page.evaluate(() => Date.now()); await page.clock.runFor(Math.max(0, t0 + t * 1000 - now)); const got = await v(); ok(got === want, `t=${t}s: ${got}, expected ${want}`); };
  const t0 = await page.evaluate(() => Date.now());
  await at(1, 'form'); await at(14.5, 'form');
  await at(16, 'timer'); await at(17.6, 'timer');
  await at(18.6, 'form'); await at(23.5, 'form');
  await at(24.6, 'timer'); await at(27.6, 'form');
  await at(330.6, 'timer');  // still the same 6:00 step, regular Timer slot
  await at(358.2, 'form');   // ~2 s left: would be a Timer slot, the end stays How-to
  // a tab tap takes over
  await page.click('[data-view="timer"]'); await page.clock.runFor(1000);
  ok(await v() === 'timer', 'tapping Timer shows the timer');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
