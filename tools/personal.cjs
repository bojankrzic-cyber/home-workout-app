// Personal profile: goal, body, HR zones, limitations, session length → program effects
//   NODE_PATH=$(npm root -g) node tools/personal.cjs ./out
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  const log = (...a) => console.log(...a);
  for (const [w, h, tag] of [[1920, 1080, 'tv'], [390, 844, 'phone']]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => { window.__HOME = 'train'; });   // these tests cover the Gym tab
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    if (await p.$('[data-wl="train"]')) { await p.click('[data-wl="train"]'); await p.waitForTimeout(300); }   // first visit: "Training & movement"
    await p.keyboard.type('Bojan'); await p.click('#pSave'); await p.waitForTimeout(400);
    const before = await p.evaluate(() => { const s = Program.build(Store.active(), 'F1'); return { min: Program.estimateMin(s), main: s.blocks[1].items.map(i => i.id + ' ' + (i.reps || []).join('-')).join(', ') }; });
    await p.click('.goal-line'); await p.waitForTimeout(400);
    await p.click('[data-fid="pe-goal-strength"]'); await p.waitForTimeout(150);
    for (let k = 0; k < 2; k++) await p.click('[data-fid="pe-age-p"]');
    await p.click('[data-fid="pe-height-p"]'); await p.click('[data-fid="pe-weight-p"]');
    await p.click('[data-fid="pe-targetWeight-m"]'); for (let k = 0; k < 6; k++) await p.click('[data-fid="pe-targetWeight-m"]');
    await p.click('[data-fid="pe-restHr-p"]');
    await p.click('[data-fid="pe-limits-knee"]'); await p.click('[data-fid="pe-sessionMin-45"]');
    await p.click('[data-fid="pe-prefDays-1"]'); await p.click('[data-fid="pe-prefDays-3"]'); await p.click('[data-fid="pe-prefDays-5"]');
    await p.fill('#pWhy', 'Strong at 50'); await p.fill('#pDate', '2027-03-01');
    await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/me-' + tag + '.png' });
    await p.screenshot({ path: out + '/me-' + tag + '-full.png', fullPage: true });
    await p.click('#pSave'); await p.waitForTimeout(400);
    const s = await p.evaluate(() => Store.active().settings);
    log(tag, 'saved:', s.goal, s.birthYear, s.height, s.weight, s.targetWeight, s.restHr, s.limits, s.sessionMin, s.prefDays, s.why, s.targetDate, 'bodyLog', s.bodyLog.length);
    const after = await p.evaluate(() => { const s = Program.build(Store.active(), 'F1'); return { min: Program.estimateMin(s), trimmed: s.trimmed, main: s.blocks[1].items.map(i => i.id + ' ' + (i.reps || []).join('-')).join(', '), joint: s.blocks.flatMap(b => b.items).filter(i => i.joint).map(i => i.swappedFrom + '→' + i.id) }; });
    log(tag, 'F1 before', before, '\n   after', after);
    await p.screenshot({ path: out + '/me-' + tag + '-home.png' });
    await p.click('[data-go="history"]'); await p.waitForTimeout(300);
    await p.click('[data-fid="wl-m"]'); await p.click('[data-fid="wl-m"]'); await p.click('#wlSave'); await p.waitForTimeout(300);
    await p.screenshot({ path: out + '/me-' + tag + '-progress.png', fullPage: true });
    await p.close();
  }
  log(errs.length ? errs : 'no errors');
  await browser.close();
})();
