// UI smoke test + screenshots:  NODE_PATH=$(npm root -g) node tools/ui.cjs outdir
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(300);
  // first run: create a profile
  await page.screenshot({ path: out + '/0-first-run.png' });
  await page.keyboard.type('Bojan');
  await page.click('#pSave'); await page.waitForTimeout(300);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/1-home.png' });
  // D-pad: focus is on "Začni trening"; go right to Predogled
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/2-preview.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/3-overview.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/4-player-warmup.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(800); // skip warm-up
  await page.screenshot({ path: out + '/5-player-strength.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(800); // set done -> rest
  await page.screenshot({ path: out + '/6-rest.png' });
  // run through whole session quickly
  for (let k = 0; k < 120; k++) { const done = await page.$('#wHome'); if (done) break; await page.click('#wDone'); await page.waitForTimeout(20); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/7-finish.png' });
  await page.click('#wHome'); await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/8-home-after.png' });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => { document.querySelector('[data-go="library"]').click(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/9-library.png' });
  await page.evaluate(() => { document.querySelector('[data-go="exercise"]').click(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/10-exercise.png' });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => { document.querySelector('[data-go="history"]').click(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/11-history.png' });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto('file://' + path.resolve(__dirname, '../index.html'));
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: out + '/12-phone.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
