// Reminders on a phone (fake Supabase + fake push service): the ask after the first check-in, consent,
// reminders-only account, push subscription, the schedule row the server works from, settings, and the
// "✅ Done" action from a notification.   NODE_PATH=$(npm root -g) node tools/reminders.cjs [outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const port = 8600 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.FS_CONFIG = { supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'anon', vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' };
    const T = window.__T = JSON.parse(sessionStorage.getItem('fakeT') || '{"rows":{},"anon":0,"session":null}');
    const keep = () => sessionStorage.setItem('fakeT', JSON.stringify(T));
    const subs = [];
    const q = (table) => {
      const o = {
        select() { return o; }, order() { return o; }, range() { return o; }, gte() { return o; }, limit() { return o; }, eq() { return o; }, delete() { return o; },
        upsert(rows) { (T.rows[table] = T.rows[table] || []).push(...[].concat(rows)); keep(); return Promise.resolve({ error: null }); },
        insert(rows) { (T.rows[table] = T.rows[table] || []).push(...[].concat(rows)); keep(); return Promise.resolve({ error: null }); },
        then(res) { return Promise.resolve({ data: [], error: null }).then(res); }
      };
      return o;
    };
    window.__cloudClient = { from: q, rpc: () => Promise.resolve({ error: null }), auth: {
      onAuthStateChange(f) { subs.push(f); }, getSession() { return Promise.resolve({ data: { session: T.session } }); },
      signInAnonymously() { T.anon++; T.session = { user: { id: 'anon-1', email: null, is_anonymous: true } }; keep(); subs.forEach(f => f('SIGNED_IN', T.session)); return Promise.resolve({ data: { user: T.session.user }, error: null }); },
      signInWithOtp() { return Promise.resolve({ error: null }); }, updateUser(u) { T.linked = u.email; keep(); return Promise.resolve({ error: null }); },
      signOut() { return Promise.resolve({ error: null }); }
    } };
    // push service stand-in
    Notification.requestPermission = () => Promise.resolve('granted');
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p', auth: 'a' } }; }, unsubscribe() { return Promise.resolve(true); } };
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null), subscribe: () => Promise.resolve(sub) } }), register: () => Promise.resolve({}) } });
  });
  const page = await ctx.newPage();
  const errs = [], ok = (c, m) => { if (!c) errs.push(m); };
  page.on('pageerror', e => errs.push(e.message));
  // QR start → day 1
  await page.goto(base + '?p=5634&src=qr'); await page.waitForTimeout(900);
  await page.click('#qrStart'); await page.click('[data-anchor="coffee"]'); await page.waitForTimeout(400);
  await page.click('#qrHome'); await page.waitForTimeout(500);
  ok(await page.$('.rem-card'), 'after the first check-in Today asks: "Want a nudge if you forget?"');
  await page.click('#remYes'); await page.waitForTimeout(300);
  ok(/coffee time/.test(await page.textContent('.rem-sheet h3')), 'the ask names the customer’s own moment');
  await page.screenshot({ path: out + '/r1-ask.png' });
  await page.click('#rmPush'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__T.anon === 0), 'no consent ticked → nothing happens');
  await page.check('#rmOk'); await page.click('#rmPush'); await page.waitForTimeout(3600);
  const T = await page.evaluate(() => window.__T);
  ok(T.anon === 1, 'reminders-only (anonymous) account created');
  const cons = (T.rows.consents || []).map(c => c.kind + ':' + c.granted).sort().join();
  ok(cons === 'health_data:true,reminders:true', 'explicit consents stored: ' + cons);
  ok((T.rows.push_subscriptions || [])[0] && T.rows.push_subscriptions[0].endpoint === 'https://fcm.googleapis.com/fcm/send/test' && T.rows.push_subscriptions[0].lang === 'en', 'phone registered for push');
  const st = (T.rows.reminder_state || []).slice(-1)[0] || {};
  ok(st.anchor === 'coffee' && st.remind_min === 450 && st.tz === 'Europe/Budapest' && st.push === true && st.product === 'Detox - Belly Burn' && st.checkins === 1 && st.runout, 'schedule row for the server: ' + JSON.stringify(st));
  ok(!(await page.$('.rem-card')), 'ask disappears once answered');
  // settings: own time
  await page.evaluate(() => window.__go('program')); await page.waitForTimeout(500);
  ok(await page.$('.rem-panel #rmP.on'), 'program: reminders panel, this phone on');
  await page.screenshot({ path: out + '/r2-settings.png', fullPage: true });
  await page.fill('#rmAt', '06:45'); await page.dispatchEvent('#rmAt', 'change'); await page.waitForTimeout(3200);
  const st2 = await page.evaluate(() => window.__T.rows.reminder_state.slice(-1)[0]);
  ok(st2.remind_min === 405, 'own reminder time synced: ' + st2.remind_min);
  // e-mail upgrade keeps the same user (link, not a new account)
  await page.click('#rmE'); await page.waitForTimeout(400);
  ok(await page.$('#acEmail'), 'e-mail channel → add your e-mail (account screen)');
  await page.check('#acHealth'); await page.fill('#acEmail', 'ana@example.com'); await page.click('#acSend'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__T.linked === 'ana@example.com'), 'anonymous account upgraded with the e-mail (same user)');
  // notification "✅ Done" tomorrow
  await page.evaluate(() => { const s = Store.active(); delete s.settings.program.days[Health.ymd()]; Store.save(); });
  await page.goto(base + '?a=checkin'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => Health.count(Store.active()) === 1 && Store.active().settings.program.days[Health.ymd()] === 'done'), '✅ Done on the notification checks in');
  await browser.close(); srv.kill();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
