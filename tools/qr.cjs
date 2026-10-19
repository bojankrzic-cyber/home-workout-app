// QR on the pack → localized product guide from the label → day 1 → asks. Served over http (labels are fetched).
//   NODE_PATH=$(npm root -g) node tools/qr.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const port = 8700 + Math.floor(Math.random() * 200);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const ok = (c, m) => { if (!c) errs.push(m); };
  async function phone(locale) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(locale + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(locale + ': ' + m.text()); });
    return page;
  }
  // Hungarian customer scans Detox Belly Burn (the most-scanned code) – first visit ever
  let page = await phone('hu-HU');
  await page.goto(base + '?p=5634&src=qr'); await page.waitForTimeout(900);
  ok(await page.$('.qr-hero'), 'guide opens straight away – no profile form, no sign-up');
  ok(!/p=5634/.test(page.url()), 'QR params removed');
  ok(await page.evaluate(() => I18N.lang === 'hu') && !/How to use|Daily amount/.test(await page.textContent('.qr-hero')), 'UI in the customer language (hu)');
  ok(/5 g/.test(await page.textContent('.qr-hero')) && /25 nap/.test(await page.textContent('.qr-hero')), 'dose + days per pack from the label');
  await page.waitForSelector('.qr-use', { timeout: 4000 }).catch(() => {});
  ok(/5 g/.test(await page.textContent('#qrLabel')) && /vízben|pohár/.test(await page.textContent('#qrLabel')), 'approved label usage text in Hungarian');
  ok(await page.$('#qrWarn:not([hidden])'), 'warnings from the label');
  ok(/25/.test(await page.textContent('#qrStart')) && !/Start my/.test(await page.textContent('#qrStart')), 'CTA names the pack length (translated)');
  await page.screenshot({ path: out + '/q1-guide-hu.png' });
  await page.click('#qrStart'); await page.waitForTimeout(300);
  ok(await page.$$('[data-anchor]').then(a => a.length === 4), 'one question: the anchor moment');
  await page.screenshot({ path: out + '/q2-anchor.png' });
  await page.click('[data-anchor="coffee"]'); await page.waitForTimeout(500);
  ok(await page.$('.qr-done'), 'welcome screen');
  ok(await page.evaluate(() => { const s = Store.active(); return Health.count(s) === 1 && s.settings.program.checkinTime === 'coffee' && s.settings.routine[0].pid === '5634' && s.settings.routine[0].pack.servings === 25; }), 'day 1 already ticked, pack of 25 days, anchor saved');
  ok(/24/.test(await page.textContent('.qr-done')), 'days left in the pack');
  ok(await page.$('.qr-save') && await page.$('.qr-inst'), 'asks: save to account + home screen');
  await page.screenshot({ path: out + '/q3-day1.png' });
  await page.click('#qrHome'); await page.waitForTimeout(500);
  ok(await page.$('.hp-card, .hp-check'), 'Today shows the routine');
  // reorder goes to the customer's own market
  const href = await page.evaluate(() => Health.reorderUrl(Store.active().settings.routine[0], null, 'supply_low'));
  ok(/^https:\/\/www\.naturesfinest\.hu\/\?s=Detox/.test(href) && /utm_campaign=supply_low/.test(href), 'reorder in the HU shop: ' + href);
  // a second scan of the same pack: no duplicate, offers "new pack"
  await page.goto(base + '?p=5634&src=qr'); await page.waitForTimeout(900);
  ok(await page.$('#qrNew') && !(await page.$('#qrStart')), 'returning scan: open routine / new pack');
  // switch language manually
  await Promise.all([page.waitForNavigation(), page.selectOption('#qrLang', 'sl')]); await page.waitForTimeout(900);
  ok(await page.evaluate(() => I18N.lang === 'sl') && await page.$('.qr-hero') && /Belly Burn/.test(await page.textContent('h1')), 'manual language switch reloads into Slovenian and stays on the product');
  await page.screenshot({ path: out + '/q4-returning-sl.png' });

  // Austrian customer: German UI, AT shop; capsules product
  page = await phone('de-AT');
  await page.goto(base + '?p=1500&src=qr'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => I18N.lang === 'de') && /1 ×/.test(await page.textContent('.qr-hero')) && !/How to use/.test(await page.textContent('.qr-hero')), 'German + capsule dose');
  await page.click('#qrStart'); await page.click('[data-anchor="evening"]'); await page.waitForTimeout(400);
  const at = await page.evaluate(() => Health.reorderUrl(Store.active().settings.routine[0], 'X', 'r'));
  ok(/natures-finest\.at/.test(at) && /coupon=X/.test(at), 'AT shop: ' + at);

  // unknown product / broken label → still useful, never a dead end
  page = await phone('en-GB');
  await page.goto(base + '?p=5744&src=qr'); await page.waitForTimeout(900);
  ok(await page.$('.qr-hero') && /being updated|label on the pack/.test(await page.textContent('#qrLabel')), 'no label → graceful fallback');
  await page.goto(base + '?p=999999&src=qr'); await page.waitForTimeout(900);
  ok(!(await page.$('.qr-hero')), 'unknown sku does not crash');

  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
