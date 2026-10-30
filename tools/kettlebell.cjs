// Kettlebell: Gym section with 6 sessions, "make it my program" switch (rotation becomes KB A, B, C …),
// fixed standards (100 swings + 10 get-ups) not inflated by the goal, new exercises render and play,
// settings row, no-kettlebell profile gets the equipment hint.   NODE_PATH=$(npm root -g) node tools/kettlebell.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })).newPage();
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }
  await page.fill('#pName', 'Bojan'); await page.click('#pSave'); await page.waitForTimeout(500);
  await page.evaluate(() => { const s = Store.active(); if (s.settings.equipment.indexOf('kb') < 0) s.settings.equipment.push('kb'); Store.save(); });
  // every new exercise exists, has frames, and its pattern list starts with itself
  const bad = await page.evaluate(() => ['kb_swing1', 'kb_clean', 'kb_snatch', 'kb_tgu', 'kb_halo', 'kb_row', 'kb_rack_squat'].filter(id => {
    const e = Exercises.BY_ID[id]; return !e || !e.anim.frames.length || !(e.groups || []).length || !Exercises.PATTERNS[Exercises.PATTERN_OF[id]].includes(id);
  }));
  ok(!bad.length, 'new kettlebell exercises complete: ' + bad);
  await page.evaluate(() => window.__go('train')); await page.waitForTimeout(500);
  ok((await page.$$('.session-card.kbc')).length === 6, 'Gym: 6 kettlebell workouts');
  const sec = await page.$('.kb-title'); await sec.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/kb1-section.png' });
  // fixed standards survive an endurance goal (no 4–6 get-ups)
  const kb1 = await page.evaluate(() => { const s = Store.active(); s.settings.goal = 'endurance'; const b = Program.build(s, 'KB1');
    return b.blocks.map(x => x.items.map(i => i.id + ':' + (i.reps || []).join('-')).join(',')).join('|'); });
  ok(/kb_tgu:1-1/.test(kb1) && /kb_swing1:10-10/.test(kb1), 'KB1 keeps 10 swings / 1 get-up per side: ' + kb1);
  // switch the program
  await page.evaluate(() => document.querySelector('[data-kbstyle="kb"]').click()); await page.waitForTimeout(500);
  const order = await page.evaluate(() => Program.plan(Store.active()).order.join(','));
  ok(/^KB1,KB2,KB3,KB4/.test(order), 'program rotation is kettlebell: ' + order);
  ok(/Kettlebell A/.test(await page.textContent('.hero-card h1')), 'hero shows Kettlebell A: ' + await page.textContent('.hero-card h1'));
  await page.screenshot({ path: out + '/kb2-program.png' });
  // play KB1: the swing set shows per side
  await page.evaluate(() => { window.__go('player', { key: 'KB1' }); }); await page.waitForTimeout(800);
  ok(/halo/i.test(await page.textContent('#wName')), 'KB1 starts with halos: ' + await page.textContent('#wName'));
  await page.screenshot({ path: out + '/kb3-player.png' });
  await page.evaluate(() => window.__go('exercise', { id: 'kb_tgu' })); await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/kb4-tgu.png' });
  // settings row
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(400);
  ok(await page.$('[data-set="style"][data-val=\'"kb"\'].on'), 'settings: Program style = Kettlebell');
  // a profile without kettlebells gets the gym rotation and an equipment hint
  await page.evaluate(() => { const s = Store.active(); s.settings.equipment = s.settings.equipment.filter(k => k !== 'kb'); Store.save(); window.__go('train'); }); await page.waitForTimeout(500);
  ok(!/KB/.test(await page.evaluate(() => Program.plan(Store.active()).order.join(','))), 'no kettlebells → gym rotation');
  ok(await page.$('.kb-title ~ .row [data-go="equipment"]'), 'no kettlebells → add-equipment card');
  await browser.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
