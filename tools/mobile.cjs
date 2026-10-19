// Phone audit: every screen at iPhone Safari size; reports horizontal overflow and an off-screen back button.
//   NODE_PATH=$(npm root -g) node tools/mobile.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(300);
  await page.fill('input', 'Bojan'); await page.click('#pSave'); await page.waitForTimeout(500);
  const screens = [['home'], ['library'], ['exercise', { id: 'k_pulldown' }], ['exercise', { id: 'pushup' }], ['overview'], ['preview'], ['history'],
    ['settings'], ['profiles'], ['profileEdit'], ['equipment'], ['builder'], ['player']];
  for (const [s, p] of screens) {
    await page.goto(url); await page.waitForTimeout(250);
    await page.evaluate(([s, p]) => window.__go(s, p || {}), [s, p]);
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const w = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('body *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > w + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.chips-scroll,.filters,.hscroll')) bad.push((el.id || el.className || el.tagName).toString().slice(0, 40));
      });
      const back = [...document.querySelectorAll('[data-back], #bk, #wBack, .back-bar button')].filter(b => b.offsetParent);
      const vis = back.some(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
      return { overflow: [...new Set(bad)].slice(0, 5), back: back.length ? vis : 'none', sw: document.documentElement.scrollWidth > w };
    });
    console.log(s + (p ? ':' + p.id : ''), JSON.stringify(r));
    await page.screenshot({ path: out + '/' + s + (p ? '-' + p.id : '') + '.png' });
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
