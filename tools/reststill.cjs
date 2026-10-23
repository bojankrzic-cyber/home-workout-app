// Rest is still: the figure stops in the next exercise's start pose and the rest text says what comes next (set, reps);
// it moves again when the exercise starts.   NODE_PATH=$(npm root -g) node tools/reststill.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { window.__said = []; window.speechSynthesis && (speechSynthesis.speak = u => window.__said.push(u.text)); });
  await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.waitForTimeout(1200);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.__go('train')); await page.waitForTimeout(400);
  await page.click('.hero-card .btn.primary'); await page.waitForTimeout(400);
  const done = () => page.evaluate(() => document.querySelector('#wDone').click());
  const resting = () => page.evaluate(() => document.querySelector('.player').classList.contains('resting'));
  for (let k = 0; k < 20 && !(await resting()); k++) { await done(); await page.waitForTimeout(150); }
  ok(await resting(), 'reached a rest');
  const fig = () => page.evaluate(() => document.querySelector('#wFig').innerHTML);
  await page.waitForTimeout(300);
  const a = await fig(); await page.waitForTimeout(1200);
  ok(a === await fig(), 'figure stands still during rest');
  const why = await page.evaluate(() => document.querySelector('#wWhy').textContent);
  ok(/Get ready: .+ · set \d+\/\d+ · [\d–]+ reps/.test(why) || /Get ready: /.test(why), 'rest says what is next: ' + why);
  await done(); await page.waitForTimeout(300);
  ok(!(await resting()), 'rest skipped');
  const b = await fig(); await page.waitForTimeout(1200);
  ok(b !== await fig(), 'figure moves again during the exercise');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
