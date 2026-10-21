// The app in the customer's language: detection, the picker everywhere, switching, and coverage –
// on the main screens no text with a translation may stay English, and untranslated leftovers are listed.
//   NODE_PATH=$(npm root -g) node tools/i18n.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const port = 8500 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); }, gaps = {};
  async function phone(locale) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale, serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(locale + ': ' + e.message)); return p;
  }
  // text nodes on screen: [missed: has a translation but shows English, unknown: English without an entry]
  const audit = (p, where) => p.evaluate((where) => {
    const d = window.I18N_DICT || {}, missed = [], unknown = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) {
      const s = n.nodeValue; if (!/[A-Za-z]{3}/.test(s)) continue;
      if (n.parentElement.closest('[translate="no"],.notranslate,script,style,select,.leaflet-control-attribution')) continue;
      const k = I18N.keyOf(s, []);
      if (d[k] && d[k] !== k) missed.push(k); else if (!d[k] && /^[\x20-\x7E’–…·×→←＋✓]+$/.test(k) && /[a-z]{3}/.test(k)) unknown.push(k);
    }
    return { where, missed, unknown };
  }, where);
  const LANGS = ['sl', 'hr', 'it', 'de', 'hu', 'sk', 'pl', 'cs', 'fr', 'es', 'pt', 'nl', 'ro', 'el', 'sv', 'da', 'bg', 'et', 'lt', 'lv'];
  for (const lang of LANGS) {
    const page = await phone(lang);
    await page.goto(base); await page.waitForTimeout(700);
    ok(await page.evaluate((l) => document.documentElement.lang === l && I18N.lang === l && !!window.I18N_DICT, lang), lang + ': detected from the phone and dictionary loaded');
    ok(await page.$('#wlLang'), lang + ': language picker on the very first screen');
    const welcome = await page.textContent('.wl-head h1');
    ok(welcome && !/would you like/.test(welcome), lang + ': first screen translated (' + welcome + ')');
    if (await page.$('[data-wl="train"]')) { await page.click('[data-wl="train"]'); await page.waitForTimeout(300); }   // first visit: "Training & movement"
    await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(600);
    const screens = [['home'], ['settings'], ['scan'], ['product', { id: '5634', src: 'qr' }]];
    for (const [s, p] of screens) {
      await page.evaluate(([s, p]) => window.__go(s, p || {}), [s, p]); await page.waitForTimeout(500);
      const a = await audit(page, s);
      ok(!a.missed.length, lang + '/' + s + ': shows English although translated: ' + a.missed.slice(0, 5).join(' | '));
      a.unknown.forEach(k => { gaps[k] = (gaps[k] || 0) + 1; });
      if (lang === 'hu' || lang === 'de') await page.screenshot({ path: `${out}/i-${lang}-${s}.png` });
    }
    await page.context().close();
  }
  // switching in Settings reloads into the new language and remembers it
  const page = await phone('en-GB');
  await page.goto(base); await page.waitForTimeout(500);
  await page.click('[data-wl="train"]'); await page.waitForTimeout(300);
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(400);
  await page.evaluate(() => window.__go('settings')); await page.waitForTimeout(300);
  await Promise.all([page.waitForNavigation(), page.selectOption('#setLang', 'de')]); await page.waitForTimeout(700);
  ok(await page.evaluate(() => I18N.lang === 'de' && localStorage.getItem('fs.lang') === 'de' && Store.active().settings.lang === 'de'), 'Settings → Deutsch: reloads, remembered on the device and in the profile');
  await page.goto(base + '?lang=pl'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => I18N.lang === 'pl'), '?lang=pl link sets the language');
  await browser.close(); srv.kill();
  const top = Object.entries(gaps).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  if (top.length) console.log('not yet in the dictionary (' + top.length + '):\n  ' + top.slice(0, 40).join('\n  '));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
