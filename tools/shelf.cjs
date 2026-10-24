// My shelf: products with supply, one-tap reorder in the market shop, "never run out", the data-based
// complement as a free sample after day 21, Today strip and entry points.   NODE_PATH=$(npm root -g) node tools/shelf.cjs [outdir]
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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  // Bio Detox started 22 days ago (25-day pack → 3 days left), ImunUp today
  await page.goto(base + '?p=5176&src=qr'); await page.waitForTimeout(900);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.waitForTimeout(400);
  await page.evaluate(() => {
    const s = Store.active(), p = s.settings.program, d = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return Health.ymd(x); };
    p.start = d(22); s.settings.routine[0].pack.start = d(22);
    for (let i = 1; i <= 22; i++) { p.days[d(i)] = 'done'; (s.settings.intake = s.settings.intake || {})[d(i)] = { [s.settings.routine[0].id]: new Date().toISOString() }; }
    Health.checkin(s, 'done');
    s.settings.routine.push({ id: 'r2', pid: '5491', name: 'ImunUp', dose: '24 g', slot: 'morning', days: 'daily', pack: { start: Health.ymd(), servings: 5 }, perDay: 1 });
    Store.save();
  });
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(500);
  ok(await page.$('.shelf-card') && (await page.$$('.shelf-pill')).length === 2, 'Today: shelf card with both products');
  ok(await page.$('.shelf-card .sc-scan[data-go="scan"]') && !(await page.$('.scan-hero:not(.first)')), 'Today: scanning lives in the shelf card (no separate scan card)');
  ok(await page.$('.shelf-pill.low'), 'the one running out is highlighted');
  await page.screenshot({ path: out + '/sh0-today.png' });
  await page.click('.shelf-card .sc-head'); await page.waitForTimeout(600);
  ok((await page.$$('.shelf-item')).length === 2, 'shelf lists both products');
  ok(await page.$('.shelf-item img.shelf-img'), 'pack shots from the webshop');
  const low = await page.$('.shelf-item.low');
  ok(low && /Bio Detox/.test(await low.textContent()), 'Bio Detox flagged: 3 days left');
  const href = await page.getAttribute('.shelf-item.low [data-reorder]', 'href');
  ok(/dgwt_wcas=1/.test(href) && /[?&]s=Bio%20Detox&/.test(href), 'reorder search uses the shop search (dgwt_wcas) with the core name: ' + href);
  ok(/naturesfinest\.hu\/\?s=Bio%20Detox/.test(href) && /utm_campaign=shelf/.test(href) && /coupon=FINESTME/.test(href), 'reorder: HU shop + reward code: ' + href);
  ok(await page.$('.shelf-item.low [data-sub]'), '"never run out" offered at the reorder moment');
  await page.click('.shelf-item.low [data-sub]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !!Store.active().settings.program.subInterest['5176']), 'interest in automatic delivery recorded');
  ok(await page.$('.shelf-cross') && /Liver Cleanse/.test(await page.textContent('.shelf-cross')), 'after day 21: Liver Cleanse (what Bio Detox customers add next)');
  const sh = await page.getAttribute('#shSample', 'href');
  ok(/fm_sample=5465/.test(sh), 'free sample link: ' + sh);
  await page.screenshot({ path: out + '/sh1-shelf.png' });
  await page.click('#shNo'); await page.waitForTimeout(400);
  ok(!(await page.$('.shelf-cross')), '"No, thanks" hides it (30 days)');
  // entry points
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(300);
  ok(await page.$('.set-link[data-go="shelf"]'), 'Settings → My shelf');
  await page.evaluate(() => window.__go('program')); await page.waitForTimeout(400);
  ok(await page.$('.shelf-link'), 'My program → My shelf');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
