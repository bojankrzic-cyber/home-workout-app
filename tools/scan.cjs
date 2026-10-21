// In-app scanner: the fake camera shows the real printed QR of Detox Belly Burn (qrstud.io short link) →
// the product guide opens; plus resolve() rules, the no-camera search fallback and the entry points.
//   NODE_PATH=$(npm root -g) node tools/scan.cjs [outdir]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const out = process.argv[2] || '.';
  const root = path.resolve(__dirname, '..');
  const y4m = path.join(os.tmpdir(), 'qr-5634.y4m');
  execFileSync('python3', [path.join(__dirname, 'fixtures/y4m.py'), path.join(__dirname, 'fixtures/qr-5634.png'), y4m]);
  const port = 8900 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`;
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const exe = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  let browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
  let ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-GB', permissions: ['camera'], serviceWorkers: 'block' });
  let page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  // resolve rules
  await page.goto(base); await page.waitForTimeout(600);
  const r = await page.evaluate(() => [Scan.resolve('https://qrstud.io/sbqz24k'), Scan.resolve('https://app.naturesfinest.eu/?p=5465&src=qr'), Scan.resolve('5482'),
    Scan.resolve('https://www.naturesfinest.si/wp-content/uploads/2026/08/5465-Liver-Cleanse-doc.pdf'), Scan.resolve('https://www.naturesfinest.it/dnk-quiz/'), Scan.resolve('hello'), Scan.search('belly').length]);
  ok(r[0].sku === '5634' && r[1].sku === '5465' && r[2].sku === '5482' && r[3].sku === '5465', 'printed short link, app link, number, old PDF link → product: ' + JSON.stringify(r.slice(0, 4)));
  ok(r[4].url && !r[5] && r[6] >= 1, 'other links → open-link offer; junk → nothing; search works');
  // entry points: no routine yet → Today invites to scan; Health sheet has "Scan a product"
  if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }   // first visit: "Training & movement"
  await page.fill('#pName', 'Ana').catch(() => {}); await page.click('#pSave').catch(() => {}); await page.waitForTimeout(600);
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(400);
  ok(await page.$('.scan-hero.first [data-go="scan"]'), 'Today: scan hero right under the greeting');
  ok(await page.evaluate(() => { const b = document.querySelector('.buddy'), h = document.querySelector('.scan-hero'); return b && h && b.nextElementSibling === h; }), 'scan hero sits directly under the greeting');
  // ＋ menu: scan first, above the three worlds; not inside Health any more
  await page.click('[data-sheet="start"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const l = document.querySelector('.sheet .scan-line'), w = document.querySelector('.sheet .sh-worlds'); return l && w && (l.compareDocumentPosition(w) & 4); }), '＋ menu: Scan a product on top');
  await page.screenshot({ path: out + '/s0-plus.png' });
  await page.click('.sheet [data-sheet="health"]'); await page.waitForTimeout(300);
  ok(!(await page.$('.sheet [data-sgo="scan"]')), 'Health sheet no longer carries the scanner');
  await page.evaluate(() => document.querySelector('.sheet-wrap').remove());
  await page.click('.scan-hero [data-go="scan"]'); await page.waitForTimeout(400);
  ok(await page.$('.scan-screen video') || await page.$('.qr-hero'), 'scanner opens with the camera (or has already read the code)');
  await page.screenshot({ path: out + '/s1-scanner.png' });
  await page.waitForSelector('.qr-hero', { timeout: 15000 }).catch(() => {});
  ok(await page.$('.qr-hero') && /Belly Burn/.test(await page.textContent('h1')), 'camera read the printed QR → Detox Belly Burn guide');
  ok(await page.evaluate(() => !document.querySelector('video') || !document.querySelector('video').srcObject), 'camera stopped after the hit');
  await browser.close();
  // a small code (as on a real label: ~22 % of the picture height, off-centre) still reads – centre crop at full sharpness
  const y4s = path.join(os.tmpdir(), 'qr-5634-small.y4m');
  execFileSync('python3', [path.join(__dirname, 'fixtures/y4m.py'), path.join(__dirname, 'fixtures/qr-5634.png'), y4s, '0.22']);
  browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4s] });
  ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-GB', permissions: ['camera'], serviceWorkers: 'block' });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base); await page.waitForTimeout(500);
  await page.fill('#pName', 'Ana').catch(() => {}); await page.click('#pSave').catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => window.__go('scan')); await page.waitForTimeout(300);
  await page.waitForSelector('.qr-hero', { timeout: 15000 }).catch(() => {});
  ok(await page.$('.qr-hero'), 'small, off-centre code on the label is read');
  await browser.close();
  // live camera on the barcode (what people do first) – reads by itself
  const y4b = path.join(os.tmpdir(), 'ean-5491.y4m');
  execFileSync('python3', [path.join(__dirname, 'fixtures/y4m.py'), path.join(__dirname, 'fixtures/ean-5491.png'), y4b, '0.5']);
  browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4b] });
  ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-GB', permissions: ['camera'], serviceWorkers: 'block' });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base); await page.waitForTimeout(500);
  await page.fill('#pName', 'Ana').catch(() => {}); await page.click('#pSave').catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => window.__go('scan')); await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/s3-barcode.png' });
  await page.click('#scShot').catch(() => {});
  await page.waitForSelector('.qr-hero', { timeout: 15000 }).catch(() => {});
  ok(await page.$('.qr-hero') && /ImunUp/.test(await page.textContent('h1')), 'camera on the barcode → ImunUp guide');
  await browser.close();
  // camera blocked → search fallback
  browser = await chromium.launch({ executablePath: exe });
  ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-GB', serviceWorkers: 'block' });
  page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(base); await page.waitForTimeout(500);
  await page.fill('#pName', 'Ana').catch(() => {}); await page.click('#pSave').catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(() => window.__go('scan')); await page.waitForTimeout(1500);
  ok(await page.$('.scan-cam.off'), 'no camera → camera box collapses with a hint');
  ok((await page.$$('.scan-guide .sg-ok')).length === 2, 'guide: QR code or barcode');
  // no camera: "Take a photo of the code" with the phone camera app – a photo of the ImunUp barcode
  await page.setInputFiles('#scPhoto', path.join(__dirname, 'fixtures/ean-5491.png'));
  await page.waitForSelector('.qr-hero', { timeout: 15000 }).catch(() => {});
  ok(await page.$('.qr-hero') && /ImunUp/.test(await page.textContent('h1')), 'photo of the barcode → ImunUp guide (EAN from the ERP)');
  await page.evaluate(() => window.__go('scan')); await page.waitForTimeout(600);
  await page.fill('#scQ', 'liver'); await page.waitForTimeout(200);
  ok((await page.$$('[data-sku]')).length >= 1, 'search finds Liver Cleanse');
  await page.screenshot({ path: out + '/s2-search.png' });
  await page.click('[data-sku="5465"]'); await page.waitForTimeout(600);
  ok(await page.$('.qr-hero') && /Liver/.test(await page.textContent('h1')), 'picked from search → guide');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
