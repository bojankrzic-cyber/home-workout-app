// Health program on a phone: QR → product guide → routine → daily check-in → reward → supply → weekly check-in.
//   NODE_PATH=$(npm root -g) node tools/program.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.clock.install({ time: new Date('2026-11-08T08:30:00') });   // a Sunday
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  const wait = ms => page.clock.runFor(ms);
  await page.goto(url); await page.evaluate(() => localStorage.clear());
  // scanned the QR code on the creatine pack – first visit, no profile yet
  await page.goto(url + '?p=creatine&src=pack'); await wait(500);
  ok(!/p=creatine/.test(page.url()), 'QR params removed from the address');
  ok(await page.$('.prod-hero'), 'value first: the product guide opens without a profile form');
  ok(await page.evaluate(() => Store.list().length === 1), 'a quiet local profile was made for the routine');
  ok(/3 g/.test(await page.textContent('.prod-hero')) && /Morning/.test(await page.textContent('.prod-hero')), 'how-to: dose + timing');
  await page.screenshot({ path: out + '/h1-product.png' });
  await page.click('#prAdd'); await wait(600);
  ok(await page.$('.pg-hero'), 'program opens');
  ok(await page.evaluate(() => { const r = Store.active().settings.routine[0]; return r.pid === 'creatine' && r.pack.servings === 85; }), 'routine with pack (85 servings)');
  await page.click('[data-ct="coffee"]'); await wait(300);
  ok(await page.evaluate(() => Store.active().settings.program.checkinTime === 'coffee'), 'check-in moment saved');
  await page.screenshot({ path: out + '/h2-program.png' });
  // Today: one-tap check-in
  await page.evaluate(() => window.__go('home')); await wait(400);
  ok(/Took your supplements today/.test(await page.textContent('.hp-check')), 'daily check-in card');
  ok(/7 more/.test(await page.textContent('.hp-next')), 'first reward is 7 away');
  await page.screenshot({ path: out + '/h3-today.png' });
  await page.click('.hp-check [data-hp="done"]'); await wait(400);
  ok(/Checked in/.test(await page.textContent('.hp-check')) && /6 more/.test(await page.textContent('.hp-next')), 'checked in, 6 to go');
  ok(await page.$('.t-item.k-supp.done'), 'the supplement is ticked too');
  // six earlier days already done → the 7th tap unlocks the first reward
  await page.evaluate(() => { const p = Store.active().settings.program; p.start = '2026-11-01'; delete p.days['2026-11-08']; ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].forEach(d => p.days[d] = 'done'); Store.save(); window.__go('home'); });
  await wait(400);
  await page.click('.hp-check [data-hp="done"]'); await wait(500);
  ok(await page.$('.unlock') && /FINESTME-SHIP/.test(await page.textContent('.unlock')), 'reward unlocked with code');
  await page.screenshot({ path: out + '/h4-reward.png' });
  await page.click('#uOk'); await wait(200);
  // weekly check-in (Sunday, program ≥5 days old)
  ok(await page.$('.hp-card.weekly'), 'weekly check-in offered on Sunday');
  await page.click('.hp-card.weekly .btn'); await wait(300);
  for (const k of ['energy', 'sleep', 'goal']) await page.click(`[data-wq="${k}"][data-v="4"]`);
  await page.click('#wqSave'); await wait(600);
  ok(await page.evaluate(() => Object.keys(Store.active().settings.program.weekly).length === 1), 'weekly answers saved');
  ok(/7\/7|1\/1|\d\/\d/.test(await page.textContent('.screen')), 'program shows weekly adherence');
  // supply runs low → reorder card with code; snooze hides it
  await page.evaluate(() => { const r = Store.active().settings.routine[0]; r.pack = { start: '2026-11-02', servings: 10 }; Store.save(); window.__go('home'); }); await wait(400);
  ok(await page.$('.hp-card.supply'), 'running-low card');
  const href = await page.getAttribute('.hp-card.supply [data-reorder]', 'href');
  ok(/add-to-cart=786110/.test(href) && /coupon=FINESTME-SHIP/.test(href), 'one-tap reorder link with code: ' + href);
  await page.screenshot({ path: out + '/h5-supply.png' });
  await page.click('.hp-card.supply [data-supply-snooze]'); await wait(300);
  ok(!(await page.$('.hp-card.supply')), 'snoozed');
  // three silent days → gentle offer
  await page.clock.setSystemTime(new Date('2026-11-12T09:00:00')); await page.evaluate(() => window.__go('home')); await wait(400);
  ok(/Life gets busy/.test(await page.textContent('.screen')), 'no-guilt offer after 3 silent days');
  await page.click('.hp-card.gentle [data-hp="pause"]'); await wait(300);
  ok(/paused/i.test(await page.textContent('.hp-card')), 'pause shown');
  await page.click('[data-hp="resume"]'); await wait(300);
  await page.evaluate(() => window.__go('program', {})); await wait(500);
  ok((await page.$$('.lad')).length === 4 && await page.$('.lad.got'), 'ladder with the first reward unlocked');
  await page.evaluate(() => document.querySelector('.screen').scrollTo(0, 99999)); await wait(200);
  await page.screenshot({ path: out + '/h6-program-bottom.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
