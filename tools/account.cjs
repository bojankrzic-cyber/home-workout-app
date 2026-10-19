// Account UI on a phone with a fake Supabase client (no network):
//   NODE_PATH=$(npm root -g) node tools/account.cjs [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.FS_CONFIG = { supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'anon', privacyUrl: 'https://www.naturesfinest.si/privacy' };
    const T = window.__T = { otp: [], consents: [], upserts: 0, deleted: false, session: JSON.parse(sessionStorage.getItem('fakeSession') || 'null') };
    const subs = [];
    const q = (table) => {
      const o = {
        select() { return o; }, order() { return o; }, range() { return o; }, gte() { return o; }, limit() { return o; },
        upsert(rows) { T.upserts += rows.length; return Promise.resolve({ error: null }); },
        insert(rows) { [].concat(rows).forEach(r => T.consents.push(r)); return Promise.resolve({ error: null }); },
        then(res) {
          const data = table === 'orders' ? [{ order_id: '5501', ordered_at: '2026-10-19T09:12:00Z', total: 44.97, currency: '€', items: [{ name: 'Creatine Monohydrate', qty: 2 }] }]
            : table === 'current_consents' ? [{ kind: 'marketing_email', granted: T.consents.filter(c => c.kind === 'marketing_email').slice(-1).map(c => c.granted)[0] || false }] : [];
          return Promise.resolve({ data, error: null }).then(res);
        }
      };
      return o;
    };
    window.__cloudClient = {
      from: q,
      rpc: (fn) => { if (fn === 'delete_my_account') T.deleted = true; return Promise.resolve({ error: null }); },
      auth: {
        onAuthStateChange(f) { subs.push(f); },
        getSession() { return Promise.resolve({ data: { session: T.session } }); },
        signInWithOtp({ email }) { T.otp.push(email); return Promise.resolve({ error: null }); },
        verifyOtp({ email, token }) {
          if (token !== '424242') return Promise.resolve({ error: { message: 'invalid' } });
          T.session = { user: { id: 'u1', email } }; sessionStorage.setItem('fakeSession', JSON.stringify(T.session));
          subs.forEach(f => f('SIGNED_IN', T.session)); return Promise.resolve({ error: null });
        },
        signOut() { T.session = null; sessionStorage.removeItem('fakeSession'); subs.forEach(f => f('SIGNED_OUT', null)); return Promise.resolve({ error: null }); }
      }
    };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const ok = (c, m) => { if (!c) errs.push(m); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(300);
  await page.fill('#pName', 'Ana'); await page.click('#pSave'); await page.waitForTimeout(500);
  await page.click('.main-nav [data-go="settings"]'); await page.waitForTimeout(400);
  ok(/Save your progress/.test(await page.textContent('.acct-cta')), 'settings invites to sign in');
  await page.click('.acct-cta [data-go="account"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/a1-signin.png' });
  await page.fill('#acEmail', 'ana@example.com');
  await page.click('#acSend'); await page.waitForTimeout(300);
  ok(!(await page.evaluate(() => window.__T.otp.length)), 'no e-mail without the required consent');
  await page.check('#acHealth'); await page.check('#acMkt');
  await page.click('#acSend'); await page.waitForTimeout(400);
  ok((await page.evaluate(() => window.__T.otp[0])) === 'ana@example.com', 'sign-in e-mail requested');
  ok(await page.$('#acCode'), 'code step shown');
  await page.screenshot({ path: out + '/a2-code.png' });
  await page.fill('#acCode', '111111'); await page.click('#acVerify'); await page.waitForTimeout(300);
  ok(await page.$('#acCode'), 'wrong code keeps you on the code step');
  await page.fill('#acCode', '424242'); await page.click('#acVerify'); await page.waitForTimeout(3500);
  ok(/ana@example\.com/.test(await page.textContent('.screen')), 'signed in shows the e-mail');
  const cons = await page.evaluate(() => window.__T.consents);
  ok(cons.some(c => c.kind === 'health_data' && c.granted) && cons.some(c => c.kind === 'marketing_email' && c.granted === true), 'consents stored after sign-in');
  ok((await page.evaluate(() => window.__T.upserts)) >= 1, 'local profile pushed to the cloud');
  ok(/Creatine Monohydrate/.test(await page.textContent('#acOrders')), 'linked webshop orders listed');
  ok(/Synced/.test(await page.textContent('#acctStatus')), 'sync status shown');
  await page.screenshot({ path: out + '/a3-account.png' });
  ok(await page.isChecked('#acMkt2'), 'marketing toggle reflects consent');
  await page.uncheck('#acMkt2'); await page.waitForTimeout(300);
  ok((await page.evaluate(() => window.__T.consents.slice(-1)[0])).granted === false, 'unsubscribe recorded as a new consent row');
  // edits sync automatically
  const before = await page.evaluate(() => window.__T.upserts);
  await page.evaluate(() => { const s = Store.active(); s.settings.weight = 70.2; Store.save(); });
  await page.waitForTimeout(3200);
  ok((await page.evaluate(() => window.__T.upserts)) > before, 'a save triggers a push');
  // session survives reload, then sign out + delete
  await page.reload(); await page.waitForTimeout(500);
  await page.click('.main-nav [data-go="settings"]'); await page.waitForTimeout(500);
  ok(/Nature’s Finest account/.test(await page.textContent('.acct-cta')), 'still signed in after reload');
  await page.click('.acct-cta [data-go="account"]'); await page.waitForTimeout(400);
  await page.click('#acDel'); await page.click('.dlg [data-a="yes"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__T.deleted), 'account deletion called');
  ok(await page.$('#acEmail'), 'back to sign-in after deletion');
  ok((await page.evaluate(() => Store.list().length)) === 1, 'local data kept on the device');
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await browser.close();
})();
