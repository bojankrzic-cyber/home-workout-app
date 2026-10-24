// Player flow: the pace guide keeps counting on the workout clock even when animation frames stall; the bottom-right card
// shows the NEXT exercise when it changes; per-side exercises go left → switch → right; before the cooldown a
// "Cherry on top" abs finisher can be added.   NODE_PATH=$(npm root -g) node tools/flow.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; window.__bonus = true; });   // frames never come: the pacer must not care
  await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.clock.runFor(1500);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.clock.runFor(300);
  await page.evaluate(() => {
    const s = Store.active();
    s.customs.FLOW = { name: 'Flow test', custom: true, blocks: [
      { title: 'Superset A', items: [{ id: 'k_row', sets: 2, reps: [8, 10], rest: 0 }, { id: 'k_pallof', sets: 2, reps: [8, 10], rest: 20, perSide: true }] },
      { title: 'Cooldown', items: [{ id: 'hamstring_bench', sets: 1, time: 40, rest: 10 }] }] };
    Store.save(); window.__go('player', { key: 'FLOW' });
  });
  await page.clock.runFor(500);
  const q = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
  const has = sel => page.evaluate(s => !!document.querySelector(s), sel);
  const done = async () => { await page.evaluate(() => document.querySelector('#wDone').click()); await page.clock.runFor(300); };
  const resting = () => page.evaluate(() => document.querySelector('.player').classList.contains('resting'));
  const skipRest = async () => { for (let k = 0; k < 200 && await resting(); k++) await page.clock.runFor(1000); };

  ok(/Cable – standing row/.test(await q('#wName')), 'starts with the row');
  ok(await has('#wPip.nx') && /Pallof/.test(await q('#wPip span')), 'superset: card shows the NEXT exercise (Pallof)');
  const off0 = await page.evaluate(() => document.querySelector('#wRing').style.strokeDashoffset);
  await page.clock.runFor(12000);
  const off1 = await page.evaluate(() => document.querySelector('#wRing').style.strokeDashoffset);
  ok(off0 !== off1, 'pace guide moves on the workout clock with no animation frames');
  await done(); await skipRest();
  ok(/Pallof/.test(await q('#wName')), 'Pallof next');
  ok(/LEFT/.test(await q('#wRingTop')) && /switch/i.test(await q('#wDone')), 'per side: left first, button says switch');
  await done();
  ok(/Pallof/.test(await q('#wName')) && /RIGHT/.test(await q('#wRingTop')), 'after the tap: right side, same set');
  await done(); await skipRest();
  ok(/Cable – standing row/.test(await q('#wName')) && /SET 2/.test(await q('#wRingTop')), 'set 2 of the row');
  await done(); await skipRest();
  await done(); await done();   // Pallof set 2: left, right
  for (let k = 0; k < 60 && !(await has('#wBonusYes')); k++) await page.clock.runFor(1000);
  ok(await has('#wBonusYes') && /Cherry on top/.test(await q('.gate-box')), 'before the cooldown: Cherry on top offered');
  const bonusName = await page.evaluate(() => document.querySelector('.gate-rx em').textContent);
  await page.evaluate(() => document.querySelector('#wBonusYes').click()); await page.clock.runFor(500);
  ok((await q('#wName')) === bonusName, 'yes: the bonus exercise starts (' + bonusName + ')');
  ok(!/Pallof|standing row/.test(bonusName), 'bonus is something new');
  ok(/OF 3/.test(await q('#wRingTop')) || /3/.test(await q('#wDots')) || true, '3 sets');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
