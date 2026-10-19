// Light / dark theme: follows the phone (prefers-color-scheme), manual Light / Dark / System in Settings,
// applied before the first paint, everywhere incl. the workout player and Trail.   NODE_PATH=$(npm root -g) node tools/theme.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const bar = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
  // a product scan as the first visit, phone in light mode
  await page.goto(base + '?p=5176&src=qr'); await page.waitForTimeout(900);
  ok(await theme() === 'light', 'phone in light mode → light theme');
  ok(await bg() === 'rgb(245, 247, 244)', 'light background: ' + await bg());
  ok(await bar() === '#f5f7f4', 'browser bar follows: ' + await bar());
  await page.screenshot({ path: out + '/th0-guide.png' });
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/th1-today.png' });
  await page.evaluate(() => window.__go('shelf')); await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/th2-shelf.png' });
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(400);
  ok((await page.$$('[data-theme-pick]')).length === 3, 'Settings: Light / Dark / System');
  ok(await page.$('[data-theme-pick="system"].on'), 'System is the default');
  const edge = await page.evaluate(() => getComputedStyle(document.querySelector('[data-theme-pick="light"]')).borderTopColor);
  ok(edge === 'rgb(216, 226, 218)', 'chips have a soft hairline, not the browser\'s black outline: ' + edge);
  await page.screenshot({ path: out + '/th3-settings.png', fullPage: true });
  // the player follows the theme too
  await page.evaluate(() => window.__go('player', { key: Object.keys(Program.PLAN || {})[0] })).catch(() => {});
  await page.waitForTimeout(700);
  const pl = await page.$('.player');
  if (pl) {
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.player')).backgroundColor) === 'rgb(245, 247, 244)', 'workout player follows the light theme');
    await page.screenshot({ path: out + '/th4-player.png' });
  }
  // manual Dark wins over the phone, survives a reload, System follows the phone again
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(300);
  await page.click('[data-theme-pick="dark"]'); await page.waitForTimeout(300);
  ok(await theme() === 'dark' && await bg() === 'rgb(5, 10, 7)', 'Dark chosen → dark');
  await page.reload(); await page.waitForTimeout(800);
  ok(await theme() === 'dark', 'choice survives a reload (applied before paint)');
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(300);
  await page.click('[data-theme-pick="system"]'); await page.waitForTimeout(300);
  ok(await theme() === 'light', 'System → follows the phone (light)');
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(300);
  ok(await theme() === 'dark' && await bar() === '#050a07', 'phone switches to dark → app follows live');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.click('[data-theme-pick="light"]'); await page.waitForTimeout(300);
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(300);
  ok(await theme() === 'light', 'Light chosen → stays light on a dark phone');
  await page.evaluate(() => window.__go('scan')); await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/th5-scan.png' });
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
