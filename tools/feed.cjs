// Activity feed (Sports-Tracker-style cards incl. gym workouts), gym workout detail, today's calories on Home,
// statistics on Me.   NODE_PATH=$(npm root -g) node tools/feed.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }
  await page.fill('#pName', 'Eva'); await page.click('#pSave'); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const s = Store.active(); Object.assign(s.settings, { weight: 62, height: 168, birthYear: 1990, sex: 'f' });
    const now = new Date(), iso = (dh) => new Date(now.getTime() - dh * 36e5).toISOString();
    const pts = []; for (let i = 0; i < 60; i++) pts.push([46.05 + i * 0.0004, 14.5 + Math.sin(i / 8) * 0.002, 290, 0, 0]);
    s.activities = [
      { id: 'a1', type: 'run', start: iso(0.5), title: 'Morning run', dist: 5230, moving: 1710, elapsed: 1760, kcal: 340, pts },
      { id: 'a2', type: 'football', start: iso(50), title: 'Football', dist: 0, moving: 3600, elapsed: 3600, kcal: 450, hr: 148 },
      { id: 'a3', type: 'mtb', start: iso(400), title: 'Trail ride', dist: 23100, moving: 4200, elapsed: 4500, kcal: 610, pts: pts.map(p => [p[0], p[1] + 0.01, 300, 0, 0]) }
    ];
    s.log.push({ date: iso(0.2), session: 'A', name: 'Full body A', min: 42, sec: 2520, kcal: 220, sets: [{ id: 'kb_goblet_squat', reps: 10, load: 16 }, { id: 'kb_goblet_squat', reps: 10, load: 16 }, { id: 'pushup', reps: 12, load: 0 }], items: {} });
    Store.save();
  });
  await page.evaluate(() => window.__go('home')); await page.waitForTimeout(400);
  const kc = await page.$('.kc-card');
  ok(kc, 'Home: today\'s calories card');
  const total = await page.$eval('.kc-main b', e => parseInt(e.textContent, 10));
  ok(total > 560, 'today = 340 run + 220 gym + resting so far: ' + total);
  ok(/active 560/.test(await page.textContent('.kc-main')), 'active part = today\'s sessions: ' + await page.textContent('.kc-main'));
  await page.screenshot({ path: out + '/f0-home.png' });
  await page.evaluate(() => window.__go('activities')); await page.waitForTimeout(400);
  const cards = await page.$$eval('.feed-card', els => els.map(e => e.querySelector('.fc-tt b').textContent));
  ok(cards.length === 4 && cards[0] === 'Full body A' && cards[1] === 'Morning run', 'feed: newest first, gym included: ' + cards);
  ok(await page.$('.feed-card .fc-map svg.route'), 'GPS cards carry the route');
  ok(/Distance.*Duration.*Avg pace/.test(await page.textContent('.feed-card[data-go="activity"] .fc-stats')), 'GPS card: distance · duration · pace');
  ok(/Calories/.test(await page.$$eval('.feed-card', e => e[0].textContent)), 'gym card: calories');
  ok((await page.$$('[data-af]')).length === 5, 'filters: all + 4 sports');
  await page.screenshot({ path: out + '/f1-feed.png', fullPage: true });
  await page.click('.feed-card[data-go="gymLog"]'); await page.waitForTimeout(400);
  ok(/Goblet/i.test(await page.textContent('.gl-list')) && /16 kg × 10 \/ 10/.test(await page.textContent('.gl-list')), 'gym detail lists exercises');
  await page.screenshot({ path: out + '/f2-gym.png' });
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(400);
  ok(await page.$('.ps-card'), 'Me: statistics card');
  await page.click('[data-stp="all"]'); await page.waitForTimeout(300);
  ok(await page.$eval('.ps-tot b', e => e.textContent) === '4', 'all time: 4 activities');
  ok((await page.$$('.ps-row')).length === 4, 'one row per sport');
  await page.screenshot({ path: out + '/f3-stats.png' });
  await page.evaluate(() => window.__go('logSport')); await page.waitForTimeout(300);
  ok((await page.$$('[data-st]')).length >= 40, 'many sports to log: ' + (await page.$$('[data-st]')).length);
  await browser.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
