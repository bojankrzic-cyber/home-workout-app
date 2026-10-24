// Every exercise and set ends on the user's tap (default); every new exercise and set starts on the user's tap too: a timed step stops at 0:00 and waits, a rep set waits after the
// pace guide hits the target; rest still counts down by itself; Hands-free on restores auto-advance.   NODE_PATH=$(npm root -g) node tools/tapnext.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  async function start(handsFree, count) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
    page.on('pageerror', e => errs.push(e.message));
    await page.clock.install();
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    if (count) await page.addInitScript(() => { window.__readyCountdown = true; });   // no figure animation: minutes of fake clock stay fast
    await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.clock.runFor(1500);
    await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.clock.runFor(500);
    if (handsFree) { await page.evaluate(() => window.__go('settings')); await page.clock.runFor(300); await page.click('[data-set="handsFree"][data-val="true"]'); await page.clock.runFor(300); }
    await page.evaluate(() => window.__go('train')); await page.clock.runFor(500);
    await page.click('.hero-card .btn.primary'); await page.clock.runFor(300);
    return page;
  }
  const name = p => p.evaluate(() => document.querySelector('#wName').textContent);
  const resting = p => p.evaluate(() => document.querySelector('.player').classList.contains('resting'));
  const timeUp = p => p.evaluate(() => document.querySelector('.player').classList.contains('time-up'));

  // default: tap to continue
  let page = await start(false);
  const first = await name(page);   // 6:00 steady warm-up (timed)
  await page.clock.runFor(366 * 1000);
  ok(await name(page) === first, `timed step waits at 0:00 (now "${await name(page)}", was "${first}")`);
  ok(await timeUp(page), 'Done button calls for the tap');
  ok(await page.evaluate(() => document.querySelector('#wRingVal').textContent) === '0:00', 'clock holds at 0:00');
  await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(500);
  ok(await name(page) !== first || await resting(page), 'tap moves on');
  ok(!(await timeUp(page)), 'tap-call cleared on the next step');
  // walk to the first rep set
  for (let k = 0; k < 30; k++) {
    if (await resting(page)) { await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(300); continue; }
    if (await page.evaluate(() => !document.querySelector('#wLog').hidden)) break;
    await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(300);
  }
  ok(await page.evaluate(() => !document.querySelector('#wLog').hidden), 'reached a rep set');
  const repName = await name(page), repSet = await page.evaluate(() => document.querySelector('#wRingTop').textContent);
  await page.clock.runFor(90 * 1000);   // pace guide long past the target
  ok(await name(page) === repName && !(await resting(page)) && await page.evaluate(() => document.querySelector('#wRingTop').textContent) === repSet, 'rep set waits for the tap');
  ok(!/next in/.test(await page.evaluate(() => document.querySelector('#wDone').textContent)), 'no auto-advance countdown on the button');
  await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(300);
  if (await resting(page)) {
    await page.clock.runFor(200 * 1000);
    ok(!(await resting(page)), 'rest still ends by itself');
  }
  await page.context().close();

  // hands-free on: a timed step moves on by itself
  page = await start(true);
  const f2 = await name(page);
  await page.clock.runFor(366 * 1000);
  ok(await name(page) !== f2 || await resting(page), 'hands-free: timed step advances on its own');
  await page.context().close();

  // 3-2-1 START before every exercise
  page = await start(false, true);
  const has = sel => page.evaluate(q => !!document.querySelector(q), sel);
  const clock = () => page.evaluate(() => document.querySelector('#wRingVal').textContent);
  ok(await has('.gate #wGo') && await has('.gate [data-cs="5"]'), 'workout start: choose 3/5/7 s, then start');
  await page.evaluate(() => document.querySelector('.gate [data-cs="5"]').click()); await page.clock.runFor(100);
  ok(await page.evaluate(() => Store.active().settings.countSec === 5), 'countdown choice saved');
  await page.evaluate(() => document.querySelector('.gate [data-cs="3"]').click());
  await page.evaluate(() => document.querySelector('#wGo').click()); await page.clock.runFor(100);
  ok(await has('.ready'), 'count-in at workout start');
  const c0 = await clock(); await page.clock.runFor(2500);
  ok(await clock() === c0, 'clock held during the count-in');
  await page.clock.runFor(700);
  ok(!(await has('.ready')) && await has('.go-flash'), 'START flashes after 3-2-1');
  await page.clock.runFor(2000);
  ok(await clock() !== c0 && !(await has('.go-flash')), 'clock runs after START');
  // warm-up done -> a NEW exercise: the clock waits on the big start button, then 3-2-1
  await page.clock.runFor(366 * 1000);
  await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(200);
  for (let k = 0; k < 400 && await resting(page); k++) await page.clock.runFor(500);
  ok(await has('.gate #wGo'), 'new exercise waits on "Start next exercise"');
  ok(!(await has('.ready')), 'no count-in before the tap');
  const g0 = await clock(); await page.clock.runFor(20000);
  ok(await has('.gate') && await clock() === g0, 'clock holds while waiting for the user');
  await page.evaluate(() => document.querySelector('#wGo').click()); await page.clock.runFor(200);
  ok(!(await has('.gate')) && await has('.ready'), 'tap starts the 3-2-1');
  await page.clock.runFor(3300);
  ok(!(await has('.ready')), 'count-in ends');
  // next set of the SAME exercise: after the rest it waits on "Start next set" too (no soft count during the rest)
  const ex1 = await name(page);
  ok(await page.evaluate(() => /exercise/.test(document.querySelector('#wGo') ? '' : 'exercise')), 'button gone after start');
  await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(200);
  let sawCount = false;
  for (let k = 0; k < 400 && await resting(page); k++) { await page.clock.runFor(500); if (await has('.ready')) sawCount = true; }
  ok(await name(page) === ex1, 'same exercise next set');
  ok(await has('.gate #wGo') && !sawCount, 'same exercise: waits on the button, no count during the rest');
  ok(/set/i.test(await page.evaluate(() => document.querySelector('#wGo').textContent)), 'button says next set');
  await page.evaluate(() => document.querySelector('#wGo').click()); await page.clock.runFor(200);
  ok(await has('.ready'), 'tap starts the 3-2-1 for the set');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
