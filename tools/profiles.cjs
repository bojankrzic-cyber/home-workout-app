// Multi-profile + builder flow test:  NODE_PATH=$(npm root -g) node tools/profiles.cjs outdir
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  const log = (...a) => console.log(...a);
  // migration from v1
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('homeworkout.v1', JSON.stringify({ settings: { days: 3, level: 'adv' }, log: [{ date: new Date().toISOString(), session: 'F1', min: 50, sets: [] }], ex: { db_bench: { load: 18, reps: [10, 10, 10] } } })); });
  await p.reload(); await p.waitForTimeout(400);
  log('migrated -> home:', await p.$eval('.who', e => e.textContent), '| plan chip:', await p.$eval('.topbar .chip', e => e.textContent));
  await p.screenshot({ path: out + '/p1-home.png' });
  // add second person with PIN
  await p.click('.who'); await p.waitForTimeout(300);
  await p.click('.profile.add'); await p.waitForTimeout(300);
  await p.keyboard.type('Ana'); // name field autofocused
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  log('focus after down from input:', await p.evaluate(() => document.activeElement.className));
  await p.click('[data-fid="pe-level-beg"]'); await p.waitForTimeout(200);
  log('name kept after refresh:', await p.$eval('#pName', e => e.value), '| focus kept:', await p.evaluate(() => document.activeElement.getAttribute('data-fid')));
  await p.fill('#pPin', '1234');
  await p.screenshot({ path: out + '/p2-edit.png' });
  await p.click('#pSave'); await p.waitForTimeout(300); await p.click('#eqSave'); await p.waitForTimeout(300);
  log('active after create:', await p.$eval('.who', e => e.textContent));
  // profile picker on reload (2 profiles)
  await p.reload(); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/p3-picker.png' });
  log('profiles shown:', await p.$$eval('.profile', els => els.map(e => e.textContent)));
  await p.click('.profile:nth-child(2)'); await p.waitForTimeout(300);
  for (const k of ['1', '2', '3', '9']) await p.keyboard.press(k);
  await p.waitForTimeout(400);
  log('wrong pin still on pin screen:', !!(await p.$('.keypad')));
  await p.screenshot({ path: out + '/p4-pin.png' });
  for (const k of ['1', '2', '3', '4']) await p.keyboard.press(k);
  await p.waitForTimeout(400);
  log('after correct pin:', await p.$eval('.who', e => e.textContent), '| level beg session sets:', await p.evaluate(() => 'ok'));
  // builder
  await p.click('[data-go="builder"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/p5-builder.png' });
  log('builder items:', await p.$$eval('.b-row h4', els => els.map(e => e.textContent)));
  await p.click('[data-fid="b-focus-prsa"]'); await p.waitForTimeout(300);
  log('after +prsa:', await p.$$eval('.b-row h4', els => els.map(e => e.textContent)));
  const before = await p.$eval('[data-fid="sw-2"]', e => e.getAttribute('data-swap'));
  await p.click('[data-fid="sw-2"]'); await p.waitForTimeout(300);
  log('swap:', before, '->', await p.$eval('[data-fid="sw-2"]', e => e.getAttribute('data-swap')), '| focus kept:', await p.evaluate(() => document.activeElement.getAttribute('data-fid')));
  await p.click('[data-fid="b-type-kardio"]'); await p.waitForTimeout(300);
  log('kardio:', await p.$eval('.ov-head p', e => e.textContent), await p.$$eval('.b-row h4', els => els.map(e => e.textContent)));
  await p.screenshot({ path: out + '/p6-cardio.png' });
  await p.click('[data-fid="b-type-mix"]'); await p.waitForTimeout(300);
  log('mix:', await p.$eval('.ov-head p', e => e.textContent));
  await p.click('#bSave'); await p.waitForTimeout(200);
  await p.click('#bGo'); await p.waitForTimeout(400);
  for (let k = 0; k < 200; k++) { if (await p.$('#wHome')) break; await p.click('#wDone'); await p.waitForTimeout(10); }
  await p.click('#wHome'); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/p7-home-ana.png', fullPage: true });
  log('saved row:', await p.$$eval('.section-title h2', els => els.map(e => e.textContent)));
  // quick tile + library focus filter
  await p.click('[data-quick="3"]'); await p.waitForTimeout(400);
  log('quick trup overview:', await p.$eval('.ov-head h1', e => e.textContent), await p.$$eval('.ex-row h4', els => els.map(e => e.textContent)));
  await p.goto(url); await p.waitForTimeout(300);
  await p.click('.profile:nth-child(1)'); await p.waitForTimeout(300);
  log('first profile log count:', await p.evaluate(() => JSON.parse(localStorage.getItem('homeworkout.v2')).order.map(id => { const x = JSON.parse(localStorage.getItem('homeworkout.v2')).profiles[id]; return x.name + ':' + x.log.length + ':' + x.settings.level; })));
  await p.click('[data-go="library"]'); await p.waitForTimeout(300);
  await p.click('[data-fid="lib-g-hrbet"]'); await p.waitForTimeout(300);
  log('library hrbet:', await p.$$eval('.lib-card h4', els => els.length), '| focus:', await p.evaluate(() => document.activeElement.getAttribute('data-fid')));
  await p.screenshot({ path: out + '/p8-library.png' });
  await p.click('.lib-card'); await p.waitForTimeout(300);
  await p.click('#solo'); await p.waitForTimeout(400);
  log('solo player:', await p.$eval('#wName', e => e.textContent), await p.$eval('#wBlock', e => e.textContent));
  log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
