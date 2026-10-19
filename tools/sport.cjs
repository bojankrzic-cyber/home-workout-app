// Sport tracker end-to-end on a phone viewport with a scripted GPS:
//   NODE_PATH=$(npm root -g) node tools/sport.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // scripted GPS: window.__gps(lat, lon, acc, ts) delivers one fix to every watchPosition callback
  await ctx.addInitScript(() => {
    const subs = {}; let id = 0;
    const geo = {
      watchPosition(ok) { subs[++id] = ok; return id; },
      clearWatch(i) { delete subs[i]; },
      getCurrentPosition(ok) { ok({ coords: { latitude: 46.05, longitude: 14.5, accuracy: 5, altitude: 300 }, timestamp: Date.now() }); }
    };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    window.__gps = (lat, lon, acc, ts, ele) => Object.values(subs).forEach(f => f({ coords: { latitude: lat, longitude: lon, accuracy: acc, altitude: ele == null ? 300 : ele }, timestamp: ts }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  await page.fill('#pName', 'Runner'); await page.click('#pSave'); await page.waitForTimeout(500);
  ok(await page.$('.main-nav [data-sheet="start"]'), 'Start in the nav');
  await page.screenshot({ path: out + '/s1-home.png' });

  const M = 1 / 111195;
  // feed a run: n fixes, 1 s apart, `step` metres north each
  async function run(from, n, step, t0) {
    await page.evaluate(([from, n, step, t0, M]) => {
      for (let i = 0; i < n; i++) window.__gps(46.05 + (from + i * step) * M, 14.5 + Math.sin(i / 7) * 2 * M, 6, t0 + i * 1000, 300 + i * 0.02);
    }, [from, n, step, t0, M]);
  }
  await page.click('.main-nav [data-sheet="start"]'); await page.waitForTimeout(300); await page.click('.sh-world.w-trail'); await page.waitForTimeout(300);
  await page.click('[data-sgo="record"][data-p*="run"]'); await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.evaluate(([M, t]) => window.__gps(46.05, 14.5, 5, t), [M, t0]);
  ok(/GPS ready/.test(await page.textContent('#rGps')), 'GPS ready status');
  await page.screenshot({ path: out + '/s2-ready.png' });
  await page.click('#rStart'); await page.waitForTimeout(200);
  await run(0, 760, 3, t0 + 1000);   // 2.28 km at 3 m/s
  await page.waitForTimeout(1200);
  const dist = parseFloat(await page.textContent('#rDist'));
  ok(dist > 2.15 && dist < 2.4, 'live distance ' + dist);
  ok(/^12:\d\d$/.test(await page.textContent('#rTime')), 'moving time ~12:40: ' + await page.textContent('#rTime'));
  ok(/^5:\d\d$/.test(await page.textContent('#rAvg')), 'avg pace 5:33-ish: ' + await page.textContent('#rAvg'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/s3-recording.png' });
  await page.click('#rPause'); await page.waitForTimeout(200);
  ok(/PAUSED/.test(await page.textContent('#rState')), 'paused state');
  // finish via keyboard (TV remote path) → confirm dialog
  await page.focus('#rFinish'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.click('.dlg [data-a="yes"]'); await page.waitForTimeout(800);
  ok(await page.$('.act-screen'), 'activity summary after finish');
  ok((await page.$$('.split')).length >= 2, 'two km splits');
  ok(/1 km/.test(await page.textContent('.efforts')), '1 km best effort');
  await page.click('[data-rpe="7"]');
  await page.fill('#aTitle', 'Riverside tempo');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/s4-summary.png', fullPage: false });
  await page.evaluate(() => document.querySelector('.screen').scrollTo(0, 99999)); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/s5-summary-bottom.png' });
  await page.click('#aSave'); await page.waitForTimeout(500);
  ok(/Riverside tempo/.test(await page.textContent('.last-act')), 'home shows the last activity');
  const saved = await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('homeworkout.v2')); return db.profiles[db.active].activities[0]; });
  ok(saved.rpe === 7 && saved.splits.length === 2 && saved.pts.length > 100, 'activity stored with rpe, splits, points');

  // crash recovery: start, move 500 m, reload, come back → resumes
  await page.evaluate(() => window.__go('record')); await page.waitForTimeout(300);
  const t1 = Date.now();
  await page.evaluate(t => window.__gps(46.06, 14.5, 5, t), t1);
  await page.click('#rStart'); await run(0, 170, 3, t1 + 1000);
  await page.waitForTimeout(4500);
  await run(510, 5, 3, t1 + 172000);   // triggers the periodic snapshot
  await page.reload(); await page.waitForTimeout(500);
  ok(/paused at/.test(await page.textContent('.t-banner')), 'Today flags the unfinished recording');
  await page.click('.t-banner'); await page.waitForTimeout(400);
  ok(await page.$('#rResume'), 'recovered recording offers Resume');
  ok(parseFloat(await page.textContent('#rDist')) > 0.4, 'recovered distance kept');
  // back while recording → discard dialog
  await page.click('.rec-back'); await page.waitForTimeout(200);
  ok(await page.$('.dlg'), 'leaving asks before discarding');
  await page.click('.dlg [data-a="yes"]'); await page.waitForTimeout(400);

  // manual log: tennis 1 h 15
  await page.evaluate(() => window.__go('logSport', {})); await page.waitForTimeout(300);
  await page.click('[data-st="tennis"]'); await page.waitForTimeout(200);
  await page.fill('#lH', '1'); await page.fill('#lM', '15'); await page.click('[data-lrpe="6"]');
  await page.screenshot({ path: out + '/s6-log.png' });
  await page.click('#lSave'); await page.waitForTimeout(400);
  ok(/Tennis/.test(await page.textContent('.act-tt')), 'manual tennis saved');
  ok(await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('homeworkout.v2')); const a = db.profiles[db.active].activities.find(x => x.type === 'tennis'); return a.rpe === 6 && a.moving === 4500; }), 'manual entry keeps effort + duration');
  await page.click('#aSave'); await page.waitForTimeout(300);

  // GPX import
  const gpx = '<?xml version="1.0"?><gpx><trk><name>Bled loop</name><type>cycling</type><trkseg>' +
    Array.from({ length: 900 }, (_, i) => `<trkpt lat="${(46.36 + Math.sin(i / 143) * 0.012).toFixed(6)}" lon="${(14.09 + Math.cos(i / 143) * 0.017 - 0.017).toFixed(6)}"><ele>${475 + Math.sin(i / 60) * 6}</ele><time>${new Date(Date.parse('2026-10-12T08:00:00Z') + i * 2000).toISOString()}</time></trkpt>`).join('') + '</trkseg></trk></gpx>';
  const gpxPath = path.join(out, 'bled.gpx'); fs.writeFileSync(gpxPath, gpx);
  await page.evaluate(() => window.__go('logSport', {})); await page.waitForTimeout(300);
  await page.setInputFiles('#gpx', gpxPath); await page.waitForTimeout(800);
  ok(/Bled loop/.test(await page.inputValue('#aTitle')), 'GPX imported with its name');
  ok(/Ride/.test(await page.textContent('.act-tt')), 'GPX type ride');
  await page.click('#aSave'); await page.waitForTimeout(300);

  await page.evaluate(() => window.__go('activities', {})); await page.waitForTimeout(500);
  ok((await page.$$('.act-row')).length === 3, 'three activities listed');
  await page.screenshot({ path: out + '/s7-list.png' });
  await page.evaluate(() => window.__go('history', {})); await page.waitForTimeout(500);
  ok(/Running records/.test(await page.textContent('.screen')), 'progress shows running records');
  await page.screenshot({ path: out + '/s8-progress.png' });

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
