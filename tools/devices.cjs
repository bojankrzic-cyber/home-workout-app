// Watches & sensors on a phone: brand guidance, Bluetooth heart rate while recording, watch-file import
// that merges with the phone recording.   NODE_PATH=$(npm root -g) node tools/devices.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  await ctx.addInitScript(() => {
    // scripted GPS
    const subs = {}; let id = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(ok) { subs[++id] = ok; return id; }, clearWatch(i) { delete subs[i]; },
      getCurrentPosition(ok) { ok({ coords: { latitude: 46.05, longitude: 14.5, accuracy: 5, altitude: 300 }, timestamp: Date.now() }); } } });
    window.__gps = (lat, lon, ts) => Object.values(subs).forEach(f => f({ coords: { latitude: lat, longitude: lon, accuracy: 5, altitude: 300 }, timestamp: ts }));
    // fake Bluetooth heart-rate strap: window.__beat(bpm) sends one measurement
    let ch = null;
    window.__beat = bpm => { if (!ch) return; const dv = new DataView(new Uint8Array([0, bpm]).buffer); ch.l.forEach(f => f({ target: { value: dv } })); };
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {
      requestDevice: async () => ({ name: 'Polar H10 1234', addEventListener() {},
        gatt: { connected: true, disconnect() {}, connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => (ch = { l: [], addEventListener(e, f) { this.l.push(f); }, startNotifications: async () => {} }) }) }) } })
    } });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }   // first visit: "Training & movement"
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(500);

  // guidance per brand
  await page.click('.main-nav [data-sheet="start"]'); await page.waitForTimeout(250); await page.click('.sh-world.w-trail'); await page.waitForTimeout(250);
  await page.click('[data-sgo="devices"]'); await page.waitForTimeout(300);
  await page.click('[data-dv="garmin"]'); await page.waitForTimeout(300);
  ok(/Export Original/.test(await page.textContent('.dv-cards')), 'Garmin export steps');
  ok(/Broadcast Heart Rate/.test(await page.textContent('.dv-cards')), 'Garmin live HR steps');
  ok(await page.evaluate(() => Store.active().settings.device === 'garmin'), 'brand remembered');
  await page.screenshot({ path: out + '/d1-garmin.png' });
  await page.click('[data-dv="apple"]'); await page.waitForTimeout(250);
  ok(/HealthFit/.test(await page.textContent('.dv-cards')) && !(await page.$('#dvOn')), 'Apple Watch: export app, no live HR');
  await page.click('[data-dv="strap"]'); await page.waitForTimeout(250);
  await page.click('#dvOn'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__beat(128)); await page.waitForTimeout(900);
  ok(/128/.test(await page.textContent('.dv-cards')), 'strap shows live bpm: ' + (await page.textContent('.dv-cards')).slice(0, 200));

  // record a run with live HR
  const M = 1 / 111195, t0 = Date.parse('2026-10-19T06:30:00Z');
  await page.evaluate(() => window.__go('record', { type: 'run' })); await page.waitForTimeout(400);
  await page.evaluate(([t]) => window.__gps(46.05, 14.5, t), [t0]);
  ok(/bpm/.test(await page.textContent('#rHr')), 'Record shows heart rate');
  await page.click('#rStart'); await page.waitForTimeout(200);
  await page.evaluate(([M, t0]) => {
    for (let i = 1; i <= 400; i++) { window.__gps(46.05 + i * 3 * M, 14.5, t0 + i * 1000); }
  }, [M, t0]);
  for (let i = 0; i < 4; i++) { await page.evaluate(b => window.__beat(b), 140 + i * 5); await page.waitForTimeout(1300); }
  await page.screenshot({ path: out + '/d2-record-hr.png' });
  await page.click('#rPause'); await page.focus('#rFinish'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.click('.dlg [data-a="yes"]'); await page.waitForTimeout(800);
  const rec = await page.evaluate(() => Store.active().activities[0]);
  ok(rec && rec.hrs && rec.hrs.length >= 1 && rec.hr >= 140, 'recorded run keeps heart rate: ' + JSON.stringify(rec && { hr: rec.hr, n: rec.hrs && rec.hrs.length }));
  await page.click('#aSave'); await page.waitForTimeout(300);

  // the same run exported from a watch (TCX with HR, starts 20 s earlier) → merged, not duplicated
  const recStart = Date.parse(rec.start);
  const tp = Array.from({ length: 401 }, (_, i) => `<Trackpoint><Time>${new Date(recStart - 20000 + i * 1000).toISOString()}</Time><Position><LatitudeDegrees>${(46.05 + i * 3 * M).toFixed(7)}</LatitudeDegrees><LongitudeDegrees>14.5</LongitudeDegrees></Position><AltitudeMeters>300</AltitudeMeters><DistanceMeters>${i * 3}</DistanceMeters><HeartRateBpm><Value>${130 + (i % 30)}</Value></HeartRateBpm></Trackpoint>`).join('');
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>${new Date(recStart - 20000).toISOString()}</Id><Lap StartTime="${new Date(recStart - 20000).toISOString()}"><TotalTimeSeconds>400</TotalTimeSeconds><DistanceMeters>1200</DistanceMeters><Calories>95</Calories><Track>${tp}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const f1 = path.join(out, 'watch-run.tcx'); fs.writeFileSync(f1, tcx);
  // and a treadmill session from another day
  const tp2 = Array.from({ length: 300 }, (_, i) => `<Trackpoint><Time>${new Date(Date.parse('2026-10-17T18:00:00Z') + i * 2000).toISOString()}</Time><DistanceMeters>${i * 5.5}</DistanceMeters><HeartRateBpm><Value>${120 + (i % 40)}</Value></HeartRateBpm></Trackpoint>`).join('');
  const f2 = path.join(out, 'treadmill.tcx');
  fs.writeFileSync(f2, `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-17T18:00:00Z</Id><Lap StartTime="2026-10-17T18:00:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>1650</DistanceMeters><Track>${tp2}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`);
  await page.evaluate(() => window.__go('devices', { k: 'garmin' })); await page.waitForTimeout(300);
  await page.setInputFiles('#dvFile', [f1, f2]); await page.waitForTimeout(1500);
  const list = await page.evaluate(() => Store.active().activities.map(a => ({ t: a.type, s: a.start, hr: a.hr, n: (a.hrs || []).length, src: a.source })));
  ok(list.length === 2, 'watch run merged, treadmill added: ' + JSON.stringify(list));
  ok(list.some(a => a.n > 20), 'merged run carries the watch heart-rate series');
  await page.evaluate(() => window.__go('activities', {})); await page.waitForTimeout(400);
  await page.click('.feed-card[data-go="activity"]'); await page.waitForTimeout(800);
  ok(/Heart rate/.test(await page.textContent('.screen')) && (await page.$$('.hz')).length === 5, 'activity shows heart rate + zones: ' + JSON.stringify(await page.evaluate(() => [document.querySelector('.act-tt') && document.querySelector('.act-tt').textContent, document.querySelectorAll('.zone').length, (document.querySelector('.screen').textContent.match(/Heart rate.{0,80}/) || [''])[0], Store.active().activities.map(a => [a.title, (a.hrs||[]).length])])));
  await page.evaluate(() => document.querySelector('.screen').scrollTo(0, 900)); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/d3-hr-panel.png' });
  // importing the same files again changes nothing
  await page.evaluate(() => window.__go('devices', { k: 'garmin' })); await page.waitForTimeout(300);
  await page.setInputFiles('#dvFile', [f1, f2]); await page.waitForTimeout(1200);
  ok((await page.evaluate(() => Store.active().activities.length)) === 2, 'no duplicates on re-import');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
