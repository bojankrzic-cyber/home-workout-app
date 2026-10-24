// Weigh-in is stored on the LOCAL day (also just after midnight, before UTC midnight), and a logged weight ticks
// "Log your first weight" on Progress.   NODE_PATH=$(npm root -g) node tools/weight.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Ljubljana' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-10-26T00:30:00+01:00') });   // Monday 00:30 local = Sunday 23:30 UTC
  await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.clock.runFor(1500);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.clock.runFor(300);
  await page.evaluate(() => window.__go('history')); await page.clock.runFor(500);
  ok(!(await page.$('#fsWeight.done')), 'first weight not ticked before logging');
  await page.click('#wlSave'); await page.clock.runFor(800);
  ok(await page.$('#fsWeight.done'), 'first weight ticked after logging');
  await page.evaluate(() => window.__go('home')); await page.clock.runFor(800);
  const wi = await page.evaluate(() => { const b = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /kg logged/.test(e.textContent)); return b ? b.textContent : null; });
  ok(wi, 'Today: weigh-in shows as done on the local day');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
