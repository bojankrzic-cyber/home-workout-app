// Week plan: 1–7 workouts, of them Trail; default 5 = 4 gym (upper/lower) + 1 Trail on the weekend; Today shows the
// Trail item on a Trail day; settings keep at least one gym workout.   NODE_PATH=$(npm root -g) node tools/week.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-10-31T09:00:00') });   // a Saturday
  await page.goto(`http://127.0.0.1:${port}/index.html`); await page.clock.runFor(1500);
  await page.click('[data-wl="train"]'); await page.clock.runFor(300);
  await page.keyboard.type('Ana'); await page.click('#pSave').catch(() => {}); await page.clock.runFor(800);
  const p = await page.evaluate(() => { const s = { settings: { days: 5, trail: 1, prefDays: [] } }; return Program.plan(s); });
  ok(JSON.stringify(p.order) === '["L1","U1","L2","U2"]' && JSON.stringify(p.days) === '[1,2,4,5]' && JSON.stringify(p.trail) === '[6]', 'default 5 = 4 gym upper/lower + Trail Saturday: ' + JSON.stringify(p));
  const p7 = await page.evaluate(() => Program.plan({ settings: { days: 7, trail: 2, prefDays: [] } }));
  ok(p7.gym === 5 && p7.order.length === 5 && p7.trail.length === 2 && p7.days.length === 5 && p7.days.concat(p7.trail).sort().join() === '0,1,2,3,4,5,6', '7 = 5 gym + 2 Trail, every day used: ' + JSON.stringify(p7));
  const p1 = await page.evaluate(() => Program.plan({ settings: { days: 1, trail: 3, prefDays: [] } }));
  ok(p1.gym === 1 && p1.trailN === 0, '1 workout stays gym');
  const pp = await page.evaluate(() => Program.plan({ settings: { days: 5, trail: 1, prefDays: [1, 3, 5, 0] } }));
  ok(JSON.stringify(pp.trail) === '[0]' && pp.days.indexOf(0) < 0, 'picked days: Trail takes Sunday');
  const st = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /profile/i.test(k)) || 'null') || 'null'); return null; });
  // new profile defaults
  await page.evaluate(() => window.__go('settings')); await page.clock.runFor(500);
  ok(await page.$('[data-set="days"][data-val="5"].on') && await page.$('[data-set="trail"][data-val="1"].on'), 'new profile: 5 per week, 1 Trail');
  await page.evaluate(() => window.__go('home')); await page.clock.runFor(800);
  ok(await page.evaluate(() => /Start Trail/.test(document.body.textContent)), 'Saturday is a Trail day on Today');
  // dropping to 1 workout keeps it in the gym
  await page.evaluate(() => window.__go('settings')); await page.clock.runFor(500);
  await page.click('[data-set="days"][data-val="1"]'); await page.clock.runFor(500);
  ok(await page.$('[data-set="trail"][data-val="0"].on') && !(await page.$('[data-set="trail"][data-val="1"]')), '1 workout: Trail 0');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
