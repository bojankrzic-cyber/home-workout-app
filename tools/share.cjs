// Social sharing on a phone with a fake system share sheet:  NODE_PATH=$(npm root -g) node tools/share.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = d => !!d;
    navigator.share = async d => { window.__shared.push({ text: d.text, files: (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) }); };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(500);
  // an activity with a route (a 3 km loop)
  await page.evaluate(() => {
    const pts = [], M = 1 / 111195, t0 = Date.now() - 3 * 3600e3;
    for (let i = 0; i <= 1000; i++) { const a = i / 1000 * 2 * Math.PI; pts.push([46.05 + Math.sin(a) * 480 * M, 14.5 + (1 - Math.cos(a)) * 480 * M * 1.44, i, 300, 0]); }
    const act = Track.manual({ type: 'run', sec: 1000, dist: 3000, start: new Date(t0).toISOString() }, 75);
    act.pts = pts; act.best = Track.bestEfforts(pts); act.splits = [333, 334, 333]; act.hr = 151; act.title = 'Lake loop';
    Store.active().activities.unshift(act); Store.save();
    window.__actId = act.id;
  });
  await page.evaluate(() => window.__go('activity', { id: window.__actId })); await page.waitForTimeout(500);
  await page.click('#aShare'); await page.waitForTimeout(1200);
  ok(await page.$('.share-sheet'), 'share sheet opens');
  const src = await page.getAttribute('#shImg', 'src');
  ok(src && src.startsWith('blob:'), 'image rendered');
  const dims = await page.evaluate(() => new Promise(r => { const i = document.querySelector('#shImg'); if (i.complete) r([i.naturalWidth, i.naturalHeight]); else i.onload = () => r([i.naturalWidth, i.naturalHeight]); }));
  ok(dims[0] === 1080 && dims[1] === 1920, 'story is 1080×1920: ' + dims);
  ok(await page.isChecked('#shHide'), 'route privacy on by default');
  ok(/#FinestMe/.test(await page.inputValue('#shCap')) && /3\.00 km run/.test(await page.inputValue('#shCap')), 'caption: ' + await page.inputValue('#shCap'));
  ok(/wa\.me/.test(await page.getAttribute('[data-net="whatsapp"]', 'href')) && /utm_source=share/.test(decodeURIComponent(await page.getAttribute('[data-net="whatsapp"]', 'href'))), 'network links carry UTM');
  await page.screenshot({ path: out + '/s1-story.png' });
  await page.click('[data-fmt="post"]'); await page.waitForTimeout(900);
  const d2 = await page.evaluate(() => new Promise(r => { const i = document.querySelector('#shImg'); setTimeout(() => r([i.naturalWidth, i.naturalHeight]), 300); }));
  ok(d2[0] === 1080 && d2[1] === 1080, 'post is square: ' + d2);
  await page.click('[data-fmt="sticker"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/s2-sticker.png' });
  await page.click('#shGo'); await page.waitForTimeout(800);
  const sh = await page.evaluate(() => window.__shared[0]);
  ok(sh && sh.files[0] && sh.files[0].type === 'image/png' && sh.files[0].size > 20000, 'system share gets the PNG: ' + JSON.stringify(sh && sh.files));
  ok(sh && /utm_content=activity/.test(sh.text), 'shared text has the tracking link');
  ok(!(await page.$('.share-sheet')), 'sheet closes after sharing');
  // week from Today
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(400);
  await page.click('[data-share-week]'); await page.waitForTimeout(1000);
  ok(/My week/.test(await page.inputValue('#shCap')), 'week caption');
  await page.screenshot({ path: out + '/s3-week.png' });
  await page.click('#shClose');
  // workout finish
  await page.evaluate(() => window.__go('player', { key: Program.nextSessionKey(Store.active()) })); await page.waitForTimeout(500);
  for (let k = 0; k < 150; k++) { if (await page.$('#wShare')) break; await page.click('#wDone').catch(() => {}); await page.waitForTimeout(15); }
  ok(await page.$('#wShare'), 'finish card offers Share');
  await page.click('#wShare'); await page.waitForTimeout(1000);
  ok(/sets in/.test(await page.inputValue('#shCap')), 'workout caption: ' + await page.inputValue('#shCap'));
  await page.screenshot({ path: out + '/s4-workout.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
