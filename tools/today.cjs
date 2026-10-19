// Today + Start menu + supplement routine on a phone:  NODE_PATH=$(npm root -g) node tools/today.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  await page.fill('#pName', 'Bojan'); await page.click('#pSave'); await page.waitForTimeout(500);
  ok(await page.$('.today-screen .buddy'), 'Today with buddy is the home');
  ok(/Bojan/.test(await page.textContent('.buddy-hello')), 'buddy greets by name');
  ok(await page.$('.t-item.k-setup'), 'no routine yet → set-up card');
  const kinds = await page.$$eval('.t-item', els => els.map(e => e.className));
  ok(kinds.some(k => /k-workout|k-move/.test(k)), 'plan has a workout or easy movement');
  ok(kinds.some(k => /k-weight/.test(k)), 'first day asks for a weigh-in');
  await page.screenshot({ path: out + '/t1-today-empty.png' });

  // routine: add two catalog products + a custom one
  await page.click('.t-item.k-setup [data-go="routine"]'); await page.waitForTimeout(300);
  await page.click('[data-radd="vitd3"]'); await page.waitForTimeout(250);
  await page.click('[data-radd="magnesium"]'); await page.waitForTimeout(250);
  await page.fill('#rcName', 'Omega-3'); await page.fill('#rcDose', '2 capsules'); await page.click('#rcAdd'); await page.waitForTimeout(250);
  ok((await page.$$('.r-item')).length === 3, 'three supplements in the routine');
  const omega = await page.$$eval('.r-item', els => els.map(e => e.querySelector('h3').textContent));
  ok(omega.includes('Omega-3'), 'custom supplement added');
  await page.screenshot({ path: out + '/t2-routine.png' });
  // move Omega-3 to evening
  const om = await page.$eval('.r-item:last-child [data-rs]', b => b.getAttribute('data-rs'));
  await page.click(`[data-rs="${om}"][data-slot="evening"]`); await page.waitForTimeout(250);
  ok(await page.evaluate(id => Store.active().settings.routine.find(r => r.id === id).slot === 'evening', om), 'slot change saved');
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(400);
  const supp = await page.$$eval('.t-item.k-supp b', els => els.map(e => e.textContent));
  ok(supp.length === 3 && supp[0] === 'Vitamin D3 2000 IU', 'supplements on Today, morning first: ' + supp);
  await page.screenshot({ path: out + '/t3-today.png' });
  // tick one off
  const before = await page.textContent('.day-ring b');
  await page.click('.t-item.k-supp [data-take]'); await page.waitForTimeout(300);
  ok((await page.$$('.t-item.k-supp.done')).length === 1, 'tick marks it taken');
  ok(await page.textContent('.day-ring b') !== before, 'day ring advances');

  // Start menu: worlds
  await page.click('.main-nav [data-sheet="start"]'); await page.waitForTimeout(300);
  ok((await page.$$('.sh-world')).length === 3, 'Start menu shows Trail, Gym, Health');
  await page.screenshot({ path: out + '/t4-start.png' });
  await page.click('.sh-world.w-trail'); await page.waitForTimeout(250);
  ok((await page.$$('.sh-opt')).length === 4, 'Trail lists run/walk/hike/ride');
  await page.screenshot({ path: out + '/t5-trail.png' });
  await page.click('.sh-back'); await page.click('.sh-world.w-gym'); await page.waitForTimeout(250);
  ok(/Today’s workout/.test(await page.textContent('.sheet')), 'Gym offers today’s workout');
  await page.screenshot({ path: out + '/t6-gym.png' });
  await page.click('.sh-back'); await page.click('.sh-world.w-health'); await page.waitForTimeout(250);
  await page.screenshot({ path: out + '/t7-health.png' });
  await page.click('[data-take-all]'); await page.waitForTimeout(300);
  ok((await page.$$('.t-item.k-supp.done')).length === 3, 'take-all marks every supplement');
  // weight via sheet
  await page.click('.main-nav [data-sheet="start"]'); await page.waitForTimeout(300); await page.click('.sh-world.w-health'); await page.waitForTimeout(300); await page.click('.sheet [data-sheet="weight"]'); await page.waitForTimeout(300);
  await page.fill('#shW', '82,4'); await page.click('#shWSave'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => Store.active().settings.weight === 82.4), 'weight logged from the sheet');
  ok((await page.$$('.t-item.k-weight.done')).length === 1, 'weigh-in ticked on Today');
  await page.screenshot({ path: out + '/t8-today-done.png' });
  // Trail → walk preselected in Record
  await page.click('.main-nav [data-sheet="start"]'); await page.waitForTimeout(300); await page.click('.sh-world.w-trail'); await page.waitForTimeout(300);
  await page.click('[data-sgo="record"][data-p*="walk"]'); await page.waitForTimeout(400);
  ok(/walk/i.test(await page.textContent('#rStart')), 'Record opens with Walk preselected');
  await page.click('.rec-back'); await page.waitForTimeout(300);
  // Gym tab = old home
  await page.click('.main-nav [data-go="train"]'); await page.waitForTimeout(400);
  ok(/Your program/.test(await page.textContent('.screen')), 'Gym tab has the program');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
