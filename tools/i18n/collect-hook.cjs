// node -r tools/i18n/collect-hook.cjs tools/<suite>.cjs …  – while the suite runs, every on-screen string
// the i18n layer sees in English (console.debug "I18N\t<key>") is appended to $I18N_OUT (one key per line).
const Module = require('module');
const fs = require('fs');
const out = process.env.I18N_OUT || 'i18n-keys.txt';
const load = Module._load;
function hookPage(p) { p.on('console', (m) => { const t = m.text(); if (t.startsWith('I18N\t')) fs.appendFileSync(out, t.slice(5).replace(/\n/g, ' ') + '\n'); }); return p; }
function hookCtx(ctx) {
  ctx.on('page', hookPage);
  const np = ctx.newPage.bind(ctx); ctx.newPage = async (...a) => hookPage(await np(...a));
  return ctx;
}
Module._load = function (req, ...rest) {
  const m = load.call(this, req, ...rest);
  if (req === 'playwright' && !m.__i18nHooked) {
    m.__i18nHooked = true;
    const launch = m.chromium.launch.bind(m.chromium);
    m.chromium.launch = async (...a) => {
      const b = await launch(...a);
      const nc = b.newContext.bind(b); b.newContext = async (...x) => hookCtx(await nc(...x));
      const np = b.newPage.bind(b); b.newPage = async (...x) => hookPage(await np(...x));
      return b;
    };
  }
  return m;
};
