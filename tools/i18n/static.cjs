// Static half of the string extraction: human text inside the app's data (exercises, programs, products,
// sports, reminder texts …) and string literals in the UI code. Output: one key per line (stdout).
//   NODE_PATH=$(npm root -g) node tools/i18n/static.cjs > keys-static.txt
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
const human = (s) => /[A-Za-z]{2}/.test(s) && (/\s/.test(s) || /^[A-Z][a-z]/.test(s)) && !/^(https?:|data:|\.\/|#|\/)|\.(png|webp|svg|mp3|jpe?g|js|json|css)\b|^[a-z0-9_.-]+$|[{};]\s*$|^\w+\(|=>|function\s*\(|<\/?[a-z]+[ >]/i.test(s) && s.length < 600;
(async () => {
  const keys = new Set();
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('file://' + root + '/index.html'); await p.waitForTimeout(800);
  const data = await p.evaluate(() => {
    const out = [], seen = new Set();
    const SKIPK = /^(id|img|url|pdf|icon|anim|frames|p|pose|scene|props|vb|key|ex|equip|eq|k|c|q|sku|cartId|type|kind|slot|group|color|goals|moments|alt|swap|fid)$/;
    function walk(v, k, depth) {
      if (depth > 9 || v == null) return;
      if (typeof v === 'string') { out.push(v); return; }
      if (typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)) { v.forEach((x) => walk(x, k, depth + 1)); return; }
      for (const kk of Object.keys(v)) { if (SKIPK.test(kk)) continue; try { walk(v[kk], kk, depth + 1); } catch (e) {} }
    }
    ['Exercises', 'Program', 'Products', 'Sport', 'Track', 'Health', 'Reminders', 'FinestQR', 'Today', 'Devices', 'HEALTH_COMPLEMENTS'].forEach((g) => walk(window[g], g, 0));
    return out;
  });
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const kf = await p.evaluate(() => 0);
  for (const s of data) if (human(s)) keys.add(await p.evaluate((x) => I18N.keyOf(x, []), norm(s)));
  // UI code literals (fragments of concatenations are harmless extra entries)
  const files = ['app', 'today', 'health', 'qr', 'scan', 'reminders', 'sport', 'devices', 'share', 'account', 'store', 'track', 'imports', 'program', 'products'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const re = /'((?:[^'\\\n]|\\.)*)'/g; let m;
    while ((m = re.exec(src))) {
      let s = m[1].replace(/\\'/g, "'").replace(/\\n/g, ' ');
      // inside HTML strings: keep the text between tags
      s.split(/<[^>]*>/).forEach((part) => { part = norm(part.replace(/&[a-z]+;/g, ' ')); if (human(part) && part.length > 2) keys.add(part.replace(/\d+(?:[.,:]\d+)*/g, (() => { let i = 0; return () => '{' + (i++) + '}'; })())); });
    }
  }
  await b.close();
  process.stdout.write([...keys].join('\n') + '\n');
})();
