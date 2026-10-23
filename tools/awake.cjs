// Screen stays on during a workout: wake lock taken at start, taken again after the browser drops it (screen hidden and back),
// released on exit; on iPhone a muted inline video runs as well.   NODE_PATH=$(npm root -g) node tools/awake.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  // fake Screen Wake Lock: counts requests, keeps the live sentinels, lets the test drop them like the browser does
  const fake = () => {
    window.__wl = { requests: 0, live: [] };
    let hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
    window.__setHidden = h => {
      hidden = h;
      if (h) window.__wl.live.splice(0).forEach(s => { s.released = true; s.dispatchEvent(new Event('release')); });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => {
      window.__wl.requests++;
      const s = new EventTarget(); s.released = false;
      s.release = () => { if (s.released) return Promise.resolve(); s.released = true; window.__wl.live = window.__wl.live.filter(x => x !== s); s.dispatchEvent(new Event('release')); return Promise.resolve(); };
      window.__wl.live.push(s); return Promise.resolve(s);
    } } });
  };
  async function run(label, ctxOpts) {
    const page = await (await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }, ctxOpts))).newPage();
    page.on('pageerror', e => errs.push(label + ': ' + e.message));
    await page.addInitScript(fake);
    await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.waitForTimeout(1200);
    await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.waitForTimeout(400);
    await page.evaluate(() => window.__go('train')); await page.waitForTimeout(400);
    await page.click('.hero-card .btn.primary'); await page.waitForTimeout(300);
    const st = () => page.evaluate(() => ({ req: __wl.requests, live: __wl.live.length, vid: !!document.querySelector('body > video[playsinline]') }));
    let s = await st();
    ok(s.live === 1, `${label}: wake lock held at workout start (${JSON.stringify(s)})`);
    await page.evaluate(() => __setHidden(true)); await page.waitForTimeout(100);
    s = await st(); ok(s.live === 0, `${label}: lock dropped while hidden`);
    await page.evaluate(() => __setHidden(false)); await page.waitForTimeout(200);
    s = await st(); ok(s.live === 1 && s.req === 2, `${label}: lock taken again on return (${JSON.stringify(s)})`);
    await page.evaluate(() => { __setHidden(true); __setHidden(false); }); await page.waitForTimeout(200);
    s = await st(); ok(s.live === 1, `${label}: still exactly one lock after another round (${JSON.stringify(s)})`);
    return { page, st };
  }
  // Android / desktop: wake lock only
  let r = await run('android', {});
  let s = await r.st(); ok(!s.vid, 'android: no fallback video when wake lock works');
  // leave the workout: lock released, nothing re-taken on return
  await r.page.click('#wExit'); await r.page.waitForTimeout(300);
  const leave = await r.page.$('#leaveUnsaved, [data-act="leave"]'); if (leave) { await leave.click(); await r.page.waitForTimeout(300); }
  if (await r.page.$('.player')) { await r.page.evaluate(() => window.__go('home')); await r.page.waitForTimeout(300); }
  s = await r.st(); ok(s.live === 0, `android: lock released after leaving (${JSON.stringify(s)})`);
  await r.page.evaluate(() => { __setHidden(true); __setHidden(false); }); await r.page.waitForTimeout(200);
  s = await r.st(); ok(s.live === 0, 'android: no lock after leaving and coming back');
  // iPhone: lock plus muted inline video
  r = await run('iphone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  s = await r.st(); ok(s.vid, 'iphone: muted inline video running');
  const v = await r.page.evaluate(() => { const e = document.querySelector('body > video[playsinline]'); return { muted: e.muted, loop: e.loop }; });
  ok(v.muted && v.loop, 'iphone: video is muted and looping');
  await r.page.evaluate(() => window.__go('home')); await r.page.waitForTimeout(300);
  s = await r.st(); ok(!s.vid && s.live === 0, `iphone: video and lock gone after leaving (${JSON.stringify(s)})`);
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
