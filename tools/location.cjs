// Record when location is blocked: help card, retry, time-only recording that saves.
//   NODE_PATH=$(npm root -g) node tools/location.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(() => {
    window.__allow = false;
    const err = { code: 1, message: 'User denied Geolocation' };
    let subs = {}, id = 0;
    const fix = () => ({ coords: { latitude: 46.05, longitude: 14.5, accuracy: 6, altitude: 300 }, timestamp: Date.now() });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(ok, no) { subs[++id] = ok; setTimeout(() => window.__allow ? ok(fix()) : no(err), 30); return id; },
      clearWatch(i) { delete subs[i]; },
      getCurrentPosition(ok, no) { setTimeout(() => window.__allow ? ok(fix()) : no(err), 30); }
    } });
  });
  const page = await ctx.newPage();
  await page.clock.install();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.clock.runFor(400);
  if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }   // first visit: "Training & movement"
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.clock.runFor(600);
  ok(/FINEST/.test(await page.textContent('.brand')), 'new wordmark');
  ok((await page.title()).startsWith('FinestMe'), 'new title');
  await page.evaluate(() => window.__go('record', { type: 'walk' })); await page.clock.runFor(500);
  ok(/Location is off/.test(await page.textContent('#rGps')), 'status says location is off');
  ok(/aA/.test(await page.textContent('.loc-card')), 'iPhone steps shown');
  ok(await page.$('#rRetry') && await page.$('#rNoGps'), 'retry + without-GPS offered');
  await page.screenshot({ path: out + '/l1-blocked.png' });
  await page.click('#rRetry'); await page.clock.runFor(300);
  ok(await page.$('#rReload') && /Still off/.test(await page.textContent('.loc-card')), 'second refusal offers reload');
  // record time only
  await page.click('#rNoGps'); await page.clock.runFor(2000);
  ok(/RECORDING/.test(await page.textContent('#rState')), 'recording without GPS');
  await page.clock.runFor(90000);
  ok(/^1:3\d$/.test(await page.textContent('#rTime')) && /^time$/.test(await page.textContent('#rTimeL')), 'timer runs without GPS: ' + await page.textContent('#rTime'));
  await page.screenshot({ path: out + '/l2-time-only.png' });
  await page.click('#rPause'); await page.clock.runFor(200);
  await page.focus('#rFinish'); await page.keyboard.press('Enter'); await page.clock.runFor(200);
  await page.click('.dlg [data-a="yes"]'); await page.clock.runFor(600);
  const a = await page.evaluate(() => Store.active().activities[0]);
  ok(a && a.type === 'walk' && a.moving >= 90 && a.dist === 0, 'time-only walk saved: ' + JSON.stringify(a && { t: a.type, m: a.moving, d: a.dist }));
  // allowing location later: retry switches to the normal Start
  await page.evaluate(() => window.__go('record', { type: 'run' })); await page.clock.runFor(400);
  await page.evaluate(() => { window.__allow = true; }); await page.click('#rRetry'); await page.clock.runFor(400);
  ok(await page.$('#rStart') && /GPS ready/.test(await page.textContent('#rGps')), 'after allowing, Start is back');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
