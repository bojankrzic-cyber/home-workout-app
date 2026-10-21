// Equipment profiles + substitution test:  NODE_PATH=$(npm root -g) node tools/equipment.cjs outdir
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript(() => { window.__HOME = 'train'; });   // these tests cover the Gym tab
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  const log = (...a) => console.log(...a);
  const titles = () => p.$$eval('.ex-row h4', els => els.map(e => e.textContent));
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  if (await p.$('[data-wl="train"]')) { await p.click('[data-wl="train"]'); await p.waitForTimeout(300); }   // first visit: "Training & movement"
  await p.keyboard.type('Bojan'); await p.click('#pMore'); await p.waitForTimeout(200); await p.click('#pEquip'); await p.waitForTimeout(700);
  log('onboarding equipment:', await p.$eval('.eq-head h1', e => e.textContent), '| selected', await p.$$eval('.eq-tile.on', els => els.length), '| score', await p.$eval('.eq-score', e => e.textContent));
  await p.screenshot({ path: out + '/e1-equipment.png' });
  await p.screenshot({ path: out + '/e1-equipment-full.png', fullPage: true });
  await p.click('#eqSave'); await p.waitForTimeout(300); await p.click('#pSave'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/e2-home.png' });
  // second person: bodyweight only
  await p.click('.who'); await p.waitForTimeout(300); await p.click('.profile.add'); await p.waitForTimeout(300);
  await p.keyboard.type('Gost'); await p.click('#pMore'); await p.waitForTimeout(200); await p.click('#pEquip'); await p.waitForTimeout(400);
  await p.click('[data-preset="bw"]'); await p.waitForTimeout(300);
  const bwScore = await p.$eval('.eq-score', e => e.textContent);
  log('bw preset score:', bwScore);
  // bodyweight-only must unlock a real library (push, pull, legs, core variants)
  const bwUnlocked = +((/(\d+)\s*\/\s*\d+/.exec(bwScore) || [])[1] || 0);
  if (bwUnlocked < 20) errs.push('bodyweight preset unlocks only ' + bwUnlocked + ' exercises');
  await p.click('[data-eq="rope"]'); await p.waitForTimeout(200);
  await p.click('#eqSave'); await p.waitForTimeout(300);
  log('back on profile edit, strip:', await p.$$eval('.eq-strip .eq-mini', els => els.length), await p.$eval('#pEquip', e => e.textContent));
  await p.click('#pSave'); await p.waitForTimeout(500);
  await p.click('[data-go="overview"]'); await p.waitForTimeout(500);
  const bwTitles = await titles();
  log('bw overview:', bwTitles);
  if (!bwTitles.some(t => /Superman|Prone Y raise/.test(t))) errs.push('bodyweight session has no back exercise');
  if (bwTitles.length < 6) errs.push('bodyweight session too short: ' + bwTitles.length);
  log('missing:', await p.$eval('.missing-note', e => e.textContent).catch(() => 'none'));
  await p.screenshot({ path: out + '/e3-bw-overview.png', fullPage: true });
  await p.click('[data-go="player"]'); await p.waitForTimeout(400);
  for (let k = 0; k < 120; k++) { if (await p.$('#wHome')) break; await p.click('#wDone'); await p.waitForTimeout(15); }
  log('bw session completed:', !!(await p.$('#wHome')));
  // full gym person
  await p.goto(url); await p.waitForTimeout(300); await p.click('.who'); await p.waitForTimeout(300); await p.click('.profile.add'); await p.waitForTimeout(300);
  await p.keyboard.type('Fit'); await p.click('[data-fid="pe-level-adv"]'); await p.click('#pMore'); await p.waitForTimeout(200); await p.click('#pEquip'); await p.waitForTimeout(500);
  await p.click('[data-preset="all"]'); await p.waitForTimeout(300);
  log('all preset score:', await p.$eval('.eq-score', e => e.textContent));
  await p.click('#eqSave'); await p.waitForTimeout(300); await p.click('#pSave'); await p.waitForTimeout(500);
  await p.click('[data-p=\'{"key":"HX1"}\']'); await p.waitForTimeout(500);
  log('HX1 full gym:', (await p.$$eval('.ex-row', els => els.map(e => e.querySelector('h4').textContent + ' = ' + e.querySelector('.rx').textContent))).join(' | '));
  await p.screenshot({ path: out + '/e4-hx-fullgym.png' });
  await p.click('[data-go="player"]'); await p.waitForTimeout(300);
  for (let k = 0; k < 60; k++) { if (await p.$('#wHome')) break; await p.click('#wDone'); await p.waitForTimeout(20); }
  log('HX1 race done:', !!(await p.$('#wHome')));
  await p.goto(url); await p.waitForTimeout(300); // fast login: lands on last person (Fit)
  await p.click('[data-go="builder"]'); await p.waitForTimeout(300); await p.click('[data-fid="b-type-kardio"]'); await p.waitForTimeout(300);
  log('cardio machines:', await p.$$eval('[data-b="machine"]', els => els.map(e => e.textContent)));
  await p.click('[data-fid="b-machine-treadmill"]'); await p.waitForTimeout(300);
  log('treadmill cardio:', await titles());
  await p.screenshot({ path: out + '/e5-builder.png' });
  await p.click('[data-fid="b-type-moc"]'); await p.waitForTimeout(300);
  log('strength full gym:', await titles());
  await p.goto(url); await p.waitForTimeout(300); await p.click('.who'); await p.waitForTimeout(300); await p.click('.profile:nth-child(2)'); await p.waitForTimeout(300);
  await p.click('[data-go="library"]'); await p.waitForTimeout(400);
  log('library mine (bw+rope):', await p.$$eval('.lib-card', els => els.length));
  await p.click('[data-fid="lib-f-all"]'); await p.waitForTimeout(300);
  log('library all, locked:', await p.$$eval('.lib-card.locked', els => els.length));
  await p.screenshot({ path: out + '/e6-library.png' });
  await p.goto(url); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/e7-picker.png' });
  log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
