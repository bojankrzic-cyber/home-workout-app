// QR → app → home screen on an iPhone: the 3-step guide (Safari), "open in Safari" for in-app browsers, and
// the routine travelling into the home-screen app (separate storage on iOS) via the transfer code.
//   NODE_PATH=$(npm root -g) node tools/install.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const port = 8400 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`, origin = `http://127.0.0.1:${port}`;
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  // 1) Safari on iPhone: scan → start → "Add to home screen" → 3-step guide, routine copied
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS, locale: 'en-GB', serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  let page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '?p=5634&src=qr'); await page.waitForTimeout(900);
  await page.click('#qrStart'); await page.click('[data-anchor="coffee"]'); await page.waitForTimeout(500);
  ok(await page.$('#qrInstall'), 'day-1 screen: "Add to home screen" button on iPhone');
  await page.click('#qrInstall'); await page.waitForTimeout(400);
  ok((await page.$$('.inst-steps li')).length === 3 && await page.$('.inst-arrow'), 'iPhone: 3 steps + arrow to Safari’s Share button');
  await page.screenshot({ path: out + '/n1-ios-guide.png' });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(/^FINESTME1:/.test(clip), 'routine copied as a transfer code');
  // 2) first start from the home screen: empty storage → "Continue my routine"
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS, locale: 'en-GB', serviceWorkers: 'block' });
  await ctx2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await ctx2.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(base); await p2.evaluate((c) => navigator.clipboard.writeText(c), clip); await p2.reload(); await p2.waitForTimeout(1200);
  ok(await p2.$('#trGo'), 'home-screen app offers to continue the routine');
  await p2.screenshot({ path: out + '/n2-continue.png' });
  await p2.click('#trGo'); await p2.waitForTimeout(800);
  ok(await p2.evaluate(() => { const s = Store.active(); return s && s.settings.routine && s.settings.routine[0].pid === '5634' && Health.count(s) === 1; }), 'routine and day 1 arrived in the home-screen app');
  ok(await p2.$('.hp-card, .hp-check'), 'Today shows the routine');
  // 3) Instagram / Chrome on iPhone: can't install → open in Safari
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IOS.replace('Safari/604.1', 'Instagram 300.0'), locale: 'en-GB', serviceWorkers: 'block' });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base); await page.click('[data-wl="train"]'); await page.waitForTimeout(300);   // first visit: "Training & movement"
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(300);
  await page.click('#setInstall'); await page.waitForTimeout(300);
  ok(await page.$('#instCopy') && !(await page.$('.inst-steps')), 'in-app browser → "open in Safari" with the link to copy');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
