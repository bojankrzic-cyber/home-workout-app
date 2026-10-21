// HYROX + player HUD test:  NODE_PATH=$(npm root -g) node tools/hyrox.cjs outdir
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
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  if (await p.$('[data-wl="train"]')) { await p.click('[data-wl="train"]'); await p.waitForTimeout(300); }   // first visit: "Training & movement"
  await p.keyboard.type('Bojan'); await p.click('[data-fid="pe-level-adv"]'); await p.click('#pSave'); await p.waitForTimeout(400); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/h1-home.png' });
  await p.screenshot({ path: out + '/h1-home-full.png', fullPage: true });
  // normal strength player
  await p.click('[data-go="player"]'); await p.waitForTimeout(500);
  await p.click('#wDone'); await p.waitForTimeout(2600);
  await p.screenshot({ path: out + '/h2-reps.png' });
  log('reps ring:', await p.$eval('#wRingTop', e => e.textContent), await p.$eval('#wRingVal', e => e.textContent), await p.$eval('#wRingSub', e => e.textContent), '| clock', await p.$eval('#wClock', e => e.textContent));
  // to the first rest (a bodyweight warm-up is a few short intervals)
  for (let k = 0; k < 14 && !(await p.$('.player.resting')); k++) { await p.click('#wDone'); await p.waitForTimeout(700); }
  await p.screenshot({ path: out + '/h3-rest.png' });
  const r1 = await p.$eval('#wRingVal', e => e.textContent); await p.click('#wPlus'); await p.waitForTimeout(100);
  log('rest:', r1, '-> +15 =', await p.$eval('#wRingVal', e => e.textContent));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // HYROX half sim
  await p.goto(url); await p.waitForTimeout(400);
  await p.click('[data-p=\'{"key":"HX2"}\']'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/h4-hx-overview.png' });
  await p.click('[data-go="player"]'); await p.waitForTimeout(400);
  await p.click('#wDone'); await p.waitForTimeout(300); // warm-up
  await p.click('#wDone'); await p.waitForTimeout(300); // run 1
  await p.waitForTimeout(2000);
  await p.screenshot({ path: out + '/h5-hx-station.png' });
  log('station:', await p.$eval('#wName', e => e.textContent), await p.$eval('#wRingTop', e => e.textContent), await p.$eval('#wRingVal', e => e.textContent), await p.$eval('#wRingSub', e => e.textContent));
  for (let k = 0; k < 40; k++) { if (await p.$('#wHome')) break; await p.click('#wDone'); await p.waitForTimeout(150); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/h6-hx-finish.png' });
  log('splits:', await p.$$eval('.fin-splits .split', els => els.map(e => e.textContent)));
  // builder hyrox
  await p.click('#wHome'); await p.waitForTimeout(300);
  await p.click('[data-go="builder"]'); await p.waitForTimeout(400);
  await p.click('[data-fid="b-type-hyrox"]'); await p.waitForTimeout(300);
  await p.click('[data-fid="b-format-full"]'); await p.waitForTimeout(300);
  log('builder hyrox:', await p.$eval('.ov-head p', e => e.textContent));
  await p.screenshot({ path: out + '/h7-builder-hx.png' });
  await p.click('[data-go="library"]').catch(() => {});
  await p.goto(url); await p.waitForTimeout(300);
  await p.click('[data-go="library"]'); await p.waitForTimeout(300);
  await p.click('[data-fid="lib-g-hyrox"]'); await p.waitForTimeout(300);
  log('library hyrox:', await p.$$eval('.lib-card h4', els => els.map(e => e.textContent)));
  await p.screenshot({ path: out + '/h8-lib.png' });
  log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
})();
