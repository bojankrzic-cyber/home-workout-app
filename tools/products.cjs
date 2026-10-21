// Product tips: off by default, adults only, goal matching, home/race/finish placements, UTM links
//   NODE_PATH=$(npm root -g) node tools/products.cjs ./out
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], log = (...a) => console.log(...a);
  for (const [w, h, tag] of [[1920, 1080, 'tv'], [390, 844, 'ph']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => { window.__HOME = 'train'; });   // these tests cover the Gym tab
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(__dirname, '../index.html'));
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    if (await p.$('[data-wl="train"]')) { await p.click('[data-wl="train"]'); await p.waitForTimeout(300); }   // first visit: "Training & movement"
    await p.keyboard.type('Bojan'); await p.click('#pSave'); await p.waitForTimeout(300);
    log(tag, 'default (pilot off):', await p.$$eval('.prod-card', e => e.length));
    await p.evaluate(() => { Store.active().settings.tips = true; Store.save(); }); await p.reload(); await p.waitForTimeout(300);
    log(tag, 'tips on, no age:', await p.$$eval('.prod-card', e => e.length));
    await p.evaluate(() => { const s = Store.active().settings; s.birthYear = 1981; s.goal = 'hyrox'; s.targetDate = new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10); Store.save(); });
    await p.reload(); await p.waitForTimeout(400);
    log(tag, 'adult hyrox:', await p.$$eval('.prod-card h4', e => e.map(x => x.textContent)));
    log(tag, 'link:', await p.$eval('.prod-card', e => e.href));
    await p.evaluate(() => { const el = document.querySelector('.prod-row'); el.scrollIntoView({ block: 'start' }); document.querySelector('.screen').scrollTop -= 80; });
    await p.waitForTimeout(300); await p.screenshot({ path: out + '/prod-' + tag + '-home.png' });
    await p.evaluate(() => { const s = Store.active().settings; s.goal = 'strength'; s.targetDate = null; Store.save(); }); await p.reload(); await p.waitForTimeout(300);
    log(tag, 'strength:', await p.$$eval('.prod-card h4', e => e.map(x => x.textContent)));
    await p.evaluate(() => __go('player', { key: 'F1' })); await p.waitForTimeout(500);
    for (let k = 0; k < 200; k++) { if (await p.$('#wHome')) break; await p.click('#wDone'); await p.waitForTimeout(10); }
    await p.waitForTimeout(400);
    log(tag, 'finish tip:', await p.$$eval('.fin-tip h4', e => e.map(x => x.textContent)));
    await p.screenshot({ path: out + '/prod-' + tag + '-finish.png' });
    await p.close();
  }
  log(errs.length ? errs : 'no errors'); await b.close();
})();
