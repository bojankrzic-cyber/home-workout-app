// Profile sex: a woman's profile draws the female figure, and her first-time starting loads are lighter
// (upper body ~55 %, legs/glutes ~70 %); with history the log takes over.   NODE_PATH=$(npm root -g) node tools/sex.cjs
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
  await page.goto(`http://127.0.0.1:${port}/index.html?p=5176&src=qr`); await page.waitForTimeout(1200);
  await page.click('#qrStart'); await page.click('[data-anchor="breakfast"]'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const mk = sex => ({ settings: { sex, level: 'mid' }, ex: {} });
    const sug = (sex, id) => Program.suggest(mk(sex), { id, reps: [8, 10] }).load;
    return { mb: sug('m', 'db_bench'), fb: sug('f', 'db_bench'), mg: sug('m', 'kb_goblet_squat'), fg: sug('f', 'kb_goblet_squat'), mk: sug('m', 'k_row'), fk: sug('f', 'k_row'),
      hist: Program.suggest({ settings: { sex: 'f', level: 'mid' }, ex: { db_bench: { load: 20, reps: [8, 8, 8] } } }, { id: 'db_bench', reps: [8, 10] }).load };
  });
  ok(r.fb < r.mb && r.fb >= r.mb * 0.4, 'women: lighter upper-body start ' + JSON.stringify(r));
  ok(r.fg < r.mg && r.fg / r.mg > r.fb / r.mb, 'women: legs less reduced than upper body');
  ok(r.fk < r.mk && r.fk >= 1, 'women: cable levels lower');
  ok(r.hist === 20, 'with history the log decides');
  // figure
  await page.evaluate(() => { Store.active().settings.sex = 'f'; Store.save(); window.__go('library'); }); await page.waitForTimeout(500);
  await page.evaluate(() => window.__go('exercise', { id: 'kb_goblet_squat' })); await page.waitForTimeout(800);
  const hairF = await page.evaluate(() => document.querySelectorAll('.g-fig .hair').length);
  await page.evaluate(() => { Store.active().settings.sex = 'm'; Store.save(); window.__go('exercise', { id: 'kb_goblet_squat' }); }); await page.waitForTimeout(800);
  const hairM = await page.evaluate(() => document.querySelectorAll('.g-fig .hair').length);
  ok(hairF > hairM, 'female figure draws the ponytail (' + hairF + ' vs ' + hairM + ')');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
