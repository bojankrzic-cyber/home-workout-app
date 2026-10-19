// Cloud sync between two devices against an in-memory Supabase stand-in (no network):
//   node tools/cloud.cjs
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const src = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');

// ---- fake backend: tables keyed by primary key, server clock, RLS by user id
let tick = Date.parse('2026-10-19T08:00:00Z');
const PK = { members: ['user_id', 'local_id'], workouts: ['user_id', 'member_id', 'local_id'], activities: ['user_id', 'member_id', 'local_id'] };
const db = { members: new Map(), workouts: new Map(), activities: new Map(), consents: [] };
const users = { 'ana@example.com': 'uid-ana' };
function client(device) {
  let session = null; const subs = [];
  function query(table) {
    const st = { gte: null, from: 0, to: 1e9, rows: null };
    const q = {
      select() { return q; }, order() { return q; },
      range(a, b) { st.from = a; st.to = b; return q; },
      gte(_, v) { st.gte = v; return q; },
      upsert(rows) {
        if (!session) return Promise.resolve({ error: { message: 'not signed in' } });
        for (const r of rows) {
          if (r.user_id !== session.user.id) return Promise.resolve({ error: { message: 'RLS' } });
          const row = Object.assign({}, r, { updated_at: new Date(++tick).toISOString() });   // server clock (trigger)
          db[table].set(PK[table].map(k => row[k]).join('|'), JSON.parse(JSON.stringify(row)));
        }
        return Promise.resolve({ error: null });
      },
      insert(rows) { (Array.isArray(rows) ? rows : [rows]).forEach(r => db.consents.push(Object.assign({ created_at: new Date(++tick).toISOString() }, r))); return Promise.resolve({ error: null }); },
      then(res, rej) {
        const all = [...db[table].values()].filter(r => session && r.user_id === session.user.id && (!st.gte || r.updated_at >= st.gte))
          .sort((a, b) => a.updated_at < b.updated_at ? -1 : 1).slice(st.from, st.to + 1);
        return Promise.resolve({ data: JSON.parse(JSON.stringify(all)), error: null }).then(res, rej);
      }
    };
    return q;
  }
  return {
    from: query,
    rpc: () => Promise.resolve({ error: null }),
    auth: {
      onAuthStateChange(f) { subs.push(f); },
      getSession() { return Promise.resolve({ data: { session } }); },
      signInWithOtp() { return Promise.resolve({ error: null }); },
      verifyOtp({ email }) { session = { user: { id: users[email], email } }; subs.forEach(f => f('SIGNED_IN', session)); return Promise.resolve({ error: null }); },
      signOut() { session = null; subs.forEach(f => f('SIGNED_OUT', null)); return Promise.resolve({ error: null }); }
    }
  };
}

// ---- a device = its own window/localStorage running store.js + cloud.js
function device(name) {
  const ls = new Map();
  const ctx = {
    console, setTimeout: (f) => 0, clearTimeout() {}, JSON, Date, Math, Object, Promise, navigator: { onLine: true },
    localStorage: { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    location: { href: 'https://app.naturesfinest.eu/' }
  };
  ctx.window = ctx; ctx.FS_CONFIG = {}; ctx.__cloudClient = client(name);
  vm.createContext(ctx);
  vm.runInContext(src('store.js') + '\n' + src('cloud.js'), ctx);
  ctx.Store.load();
  ctx.Store.onSave(() => {});
  return ctx;
}
const settle = () => new Promise(r => setImmediate(r));
async function flush(d) { for (let i = 0; i < 6; i++) await settle(); await d.Cloud.sync(); for (let i = 0; i < 6; i++) await settle(); }

(async () => {
  // phone: Ana trains, records a run, signs in
  const phone = device('phone');
  const p = phone.Store.addProfile(phone.Store.newProfile('Ana'));
  p.settings.goal = 'endurance';
  p.log.push({ date: '2026-10-18T07:00:00.000Z', session: 'F1', name: 'Full Body A', min: 50, sets: [{ id: 'pushup', reps: 12, load: 0 }] });
  p.activities.push({ id: 'a1', type: 'run', start: '2026-10-18T17:00:00.000Z', dist: 5020, moving: 1700, pts: [[46, 14, 0, 300, 0]] });
  phone.Store.setActive(p.id); phone.Store.save();
  await phone.Cloud.init();
  await phone.Cloud.verifyCode('ana@example.com', '123456');
  await flush(phone);
  ok(db.members.size === 1 && db.workouts.size === 1 && db.activities.size === 1, 'phone pushed member, workout, activity');
  ok(phone.Cloud.status() === 'ok', 'phone status ok: ' + phone.Cloud.status() + ' ' + phone.Cloud.lastError);
  const before = db.members.get('uid-ana|' + p.id).updated_at;
  await flush(phone);
  ok(db.members.get('uid-ana|' + p.id).updated_at === before, 'unchanged data is not pushed again');

  // TV: fresh install made an empty starter profile during onboarding, then signs in with the code
  const tv = device('tv');
  const starter = tv.Store.addProfile(tv.Store.newProfile('Me')); tv.Store.setActive(starter.id); tv.Store.save();
  await tv.Cloud.init();
  await tv.Cloud.verifyCode('ana@example.com', '654321');
  await flush(tv);
  const tvList = tv.Store.list();
  ok(tvList.length === 1 && tvList[0].name === 'Ana', 'TV got Ana and dropped the empty starter: ' + tvList.map(x => x.name));
  ok(tvList[0].log.length === 1 && tvList[0].activities.length === 1 && tvList[0].settings.goal === 'endurance', 'TV has history + settings');
  ok(tv.Store.active() && tv.Store.active().id === p.id, 'TV switched to the synced profile');

  // TV: log a workout, change body weight, delete the run
  const ta = tv.Store.active();
  ta.log.push({ date: '2026-10-19T18:00:00.000Z', session: 'F2', name: 'Full Body B', min: 45, sets: [] });
  ta.settings.weight = 71.5;
  ta.activities = [];
  tv.Store.save();
  await flush(tv);
  ok(db.workouts.size === 2, 'TV pushed the new workout');
  ok(db.activities.get('uid-ana|' + p.id + '|a1').deleted === true, 'deleted run became a tombstone');

  // phone picks it all up
  await flush(phone);
  const pp = phone.Store.list()[0];
  ok(pp.log.length === 2 && pp.log[1].session === 'F2', 'phone got the TV workout (sorted)');
  ok(pp.settings.weight === 71.5, 'phone got the new body weight');
  ok(pp.activities.length === 0, 'phone removed the deleted run');

  // offline edit on the phone wins over an older remote copy (local unsynced change is kept and pushed)
  pp.name = 'Ana K.'; phone.Store.save();
  await flush(phone);
  await flush(tv);
  ok(tv.Store.list()[0].name === 'Ana K.', 'name change reached the TV');

  // a second household member created on the TV syncs to the phone
  const bor = tv.Store.addProfile(tv.Store.newProfile('Bor')); bor.log.push({ date: '2026-10-19T19:00:00.000Z', session: 'F1', min: 30, sets: [] }); tv.Store.save();
  await flush(tv); await flush(phone);
  ok(phone.Store.list().map(x => x.name).sort().join() === 'Ana K.,Bor', 'household member synced: ' + phone.Store.list().map(x => x.name));

  // removing a member on one device removes it on the other
  tv.Store.removeProfile(bor.id);
  await flush(tv); await flush(phone);
  ok(phone.Store.list().length === 1, 'member removal synced');

  // pending consents are sent after the first sign-in
  const n = device('laptop');
  n.localStorage.setItem('formshaper.pendingConsents', JSON.stringify({ version: 'v1', kinds: { health_data: true, marketing_email: false } }));
  await n.Cloud.init(); await n.Cloud.verifyCode('ana@example.com', '111111'); await flush(n);
  ok(db.consents.filter(c => c.kind === 'health_data' && c.granted).length === 1 && db.consents.some(c => c.kind === 'marketing_email' && c.granted === false), 'consents recorded after sign-in');
  ok(n.localStorage.getItem('formshaper.pendingConsents') === null, 'pending consents cleared');

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
})();
