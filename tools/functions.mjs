// Edge-function tests without Deno or network: node --experimental-strip-types tools/functions.mjs
// Loads each function with a fake Supabase client, fake Deno.env/serve and a fetch spy.
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
const errs = []; const ok = (c, m) => { if (!c) errs.push(m); };
const here = path.dirname(new URL(import.meta.url).pathname);
let handler = null;
const env = { SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x', WC_WEBHOOK_SECRET: 'wc-secret', SHOP_ID: 'nf-si', KLAVIYO_API_KEY: 'pk', KLAVIYO_LIST_ID: 'L1', WEBHOOK_TOKEN: 'tok', INGEST_TOKEN: 'ingest-secret' };
globalThis.Deno = { env: { get: k => env[k] }, serve: f => { handler = f; } };
// in-memory tables; current_consents is derived from store.consents (user → marketing granted)
// and store.reminders (user → 'reminders' granted)
const store = { orders: [], consents: { 'u-ana': true }, reminders: {}, device_connections: [], activities: [], body_measurements: [], ops: [] };
const rowsOf = t => t === 'current_consents'
  ? [...Object.entries(store.consents).map(([user_id, granted]) => ({ user_id, kind: 'marketing_email', granted })),
     ...Object.entries(store.reminders).map(([user_id, granted]) => ({ user_id, kind: 'reminders', granted }))]
  : (store[t] = store[t] || []);
// PostgREST-style column list: "a,b,alias:col->>key,col->key"
const pick = (row, cols) => {
  if (!cols || cols === '*') return { ...row };
  const out = {};
  for (const c of cols.split(',')) {
    const [alias, expr] = c.includes(':') ? c.split(':') : [null, c];
    const parts = expr.split(/->>?/); let v = row[parts[0]];
    for (const k of parts.slice(1)) v = v == null ? undefined : v[k];
    out[alias || parts[parts.length - 1]] = v === undefined ? null : v;
  }
  return out;
};
function query(t) {
  const filters = []; let cols = '*', op = 'select', payload = null;
  const match = r => filters.every(f => f(r));
  const run = async () => {
    const rows = rowsOf(t);
    store.ops.push({ t, op });
    if (op === 'update') { rows.filter(match).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
    return { data: rows.filter(match).map(r => pick(r, cols)), error: null };
  };
  const q = {
    select: c => { cols = c; return q; },
    update: v => { op = 'update'; payload = v; return q; },
    eq: (k, v) => { filters.push(r => r[k] === v); return q; },
    in: (k, vs) => { filters.push(r => vs.includes(r[k])); return q; },
    maybeSingle: async () => { const { data } = await run(); return { data: data[0] ?? null, error: null }; },
    then: (res, rej) => run().then(res, rej),
    upsert: async (rows, opts = {}) => {
      store.ops.push({ t, op: 'upsert' });
      const keys = (opts.onConflict || '').split(',').filter(Boolean);
      for (const row of [].concat(rows)) {
        const all = rowsOf(t), i = keys.length ? all.findIndex(r => keys.every(k => r[k] === row[k])) : -1;
        if (i >= 0) all[i] = { ...all[i], ...row }; else all.push({ ...row });
      }
      return { error: null };
    }
  };
  return q;
}
globalThis.__fake = {
  rpc: async (fn, a) => ({ data: fn === 'user_id_by_email' && a.p_email === 'ana@example.com' ? 'u-ana' : null }),
  from: query,
  auth: { admin: { getUserById: async id => ({ data: { user: { email: id === 'u-ana' ? 'ana@example.com' : 'bor@example.com' } } }) } }
};
const calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 202, text: async () => '' }; };
async function load(name) {
  const src = fs.readFileSync(path.join(here, '../supabase/functions', name, 'index.ts'), 'utf8')
    .replace(/import \{ createClient \} from 'npm:[^']+';/, 'const createClient = () => globalThis.__fake;');
  const f = path.join(os.tmpdir(), `fn-${name}-${Date.now()}.mts`); fs.writeFileSync(f, src);
  handler = null; await import(f); fs.unlinkSync(f); return handler;
}

// ---- shop-order
const shop = await load('shop-order');
const order = { id: 5501, status: 'processing', total: '44.97', currency: 'EUR', date_created_gmt: '2026-10-19T09:12:00', billing: { email: 'Ana@Example.com' },
  line_items: [{ sku: '786110', name: 'Creatine Monohydrate', quantity: 2 }, { sku: '567616', name: 'Recovery Shake', quantity: 1 }] };
const body = JSON.stringify(order);
const sig = crypto.createHmac('sha256', 'wc-secret').update(body).digest('base64');
const post = (b, h) => new Request('https://x/shop-order', { method: 'POST', body: b, headers: h });
let r = await shop(post(body, { 'x-wc-webhook-signature': sig }));
ok(r.status === 200, 'valid order accepted: ' + r.status);
const o = store.orders[0] || {};
ok(o.user_id === 'u-ana' && o.email === 'ana@example.com' && o.order_id === '5501' && o.shop === 'nf-si', 'order linked to the account by e-mail');
ok(o.total === 44.97 && o.items.length === 2 && o.items[0].sku === '786110' && o.items[0].qty === 2 && o.ordered_at === '2026-10-19T09:12:00Z', 'order fields mapped');
r = await shop(post(body, { 'x-wc-webhook-signature': sig.slice(0, -2) + 'AA' }));
ok(r.status === 401 && store.orders.length === 1, 'forged signature rejected');
r = await shop(post(body, {}));
ok(r.status === 401, 'missing signature rejected');
r = await shop(post('webhook_id=12', {}));
ok(r.status === 200, 'WooCommerce ping answered');
r = await shop(new Request('https://x', { method: 'GET' }));
ok(r.status === 405, 'GET refused');

// ---- klaviyo-sync
const kl = await load('klaviyo-sync');
const hook = (rec, table, auth = 'Bearer tok') => kl(new Request('https://x', { method: 'POST', headers: { authorization: auth }, body: JSON.stringify({ type: 'INSERT', table, record: rec }) }));
r = await hook({ user_id: 'u-ana', kind: 'marketing_email', granted: true }, 'consents', 'Bearer nope');
ok(r.status === 401 && calls.length === 0, 'webhook token required');
await hook({ user_id: 'u-ana', kind: 'marketing_email', granted: true }, 'consents');
ok(calls[0] && /profile-subscription-bulk-create-jobs$/.test(calls[0].url) && calls[0].body.data.relationships.list.data.id === 'L1' &&
  calls[0].body.data.attributes.profiles.data[0].attributes.email === 'ana@example.com', 'marketing consent subscribes to the list');
await hook({ user_id: 'u-ana', kind: 'marketing_email', granted: false }, 'consents');
ok(calls[1] && /bulk-delete-jobs$/.test(calls[1].url), 'withdrawn consent unsubscribes');
await hook({ user_id: 'u-ana', kind: 'health_data', granted: true }, 'consents');
ok(calls.length === 2, 'health consent never goes to Klaviyo');
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'a9', type: 'run', moving_s: 1830, dist_m: 5230, started_at: '2026-10-19T06:00:00Z', data: { pts: [[46, 14]] } }, 'activities');
const ev = calls[2] && calls[2].body.data.attributes;
ok(ev && ev.metric.data.attributes.name === 'App Activity Recorded' && ev.properties.km === 5.2 && ev.properties.minutes === 31, 'activity event with coarse numbers');
ok(ev && !JSON.stringify(ev).includes('pts') && !('hr' in ev.properties), 'no GPS track or health detail sent');
store.consents['u-bor'] = false;
await hook({ user_id: 'u-bor', member_id: 'p2', local_id: 'w1', done_at: '2026-10-19T07:00:00Z', data: { name: 'Full Body A', min: 50 } }, 'workouts');
ok(calls.length === 3, 'no events for people without marketing consent');
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'a9', deleted: true }, 'activities');
ok(calls.length === 3, 'tombstones are not events');


// Apple HealthKit / Health Connect data never goes to marketing (platform policies)
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'apple_health:1', type: 'run', moving_s: 1800, dist_m: 5000, data: { source: 'apple_health' } }, 'activities');
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'health_connect:1', type: 'walk', moving_s: 900, dist_m: 1000, data: { source: 'health_connect' } }, 'activities');
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'aggregator:terra:1', type: 'run', moving_s: 900, dist_m: 2000, data: { source: 'aggregator:terra', origin: 'apple_health' } }, 'activities');
ok(calls.length === 3, 'no Klaviyo events for Apple Health / Health Connect activities');
await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'garmin:7', type: 'ride', moving_s: 3600, dist_m: 30000, data: { source: 'garmin' } }, 'activities');
ok(calls.length === 4 && calls[3].body.data.attributes.properties.km === 30, 'Garmin activities still produce events');

// ---- device-ingest
const ing = await load('device-ingest');
store.device_connections.push(
  { id: 1, user_id: 'u-ana', member_id: 'p2', provider: 'garmin', external_user_id: 'G-ANA', status: 'active', last_sync_at: null },
  { id: 2, user_id: 'u-bor', member_id: 'p1', provider: 'polar', external_user_id: 'P-BOR', status: 'revoked', last_sync_at: null });
const ingest = (b, auth = 'Bearer ingest-secret', method = 'POST') =>
  ing(new Request('https://x/device-ingest', { method, headers: auth ? { authorization: auth } : {}, body: method === 'POST' ? (typeof b === 'string' ? b : JSON.stringify(b)) : undefined }));
const run1 = { external_id: 1001, type: 'run', start: '2026-10-19T07:05:00+02:00', elapsed: 1900, moving: 1830, dist: 5230.4, gain: 42, kcal: 380, hr: 151, hrMax: 178,
  hrs: [[0, 120], [60, 150]], pts: [[46.05, 14.5, 0, 300]], splits: [350, 348], device: 'Forerunner 265' };
const ride1 = { external_id: 'r-2', type: 'cycling_road', start: '2026-10-18T16:00:00Z', elapsed: 3600, dist: 30000, title: 'Hills' };
const scale1 = { external_id: 'm-1', measured_at: '2026-10-19T05:30:00Z', weight_kg: 81.6, fat_pct: 18.2, muscle_kg: 37.9, data: { water_pct: 55.1 } };
const nOps = () => store.ops.filter(o => o.op !== 'select').length;

r = await ingest({ provider: 'garmin', external_user_id: 'G-ANA', activities: [run1] }, 'Bearer wrong');
ok(r.status === 401 && store.activities.length === 0, 'ingest: wrong token → 401');
r = await ingest({ provider: 'garmin', external_user_id: 'G-ANA', activities: [run1] }, null);
ok(r.status === 401, 'ingest: missing token → 401');
r = await ingest({}, 'Bearer ingest-secret', 'GET');
ok(r.status === 405, 'ingest: GET refused');
r = await ingest({ provider: 'garmin', external_user_id: 'NOPE', activities: [run1] });
ok(r.status === 404 && store.activities.length === 0, 'ingest: unknown connection → 404, nothing written');
r = await ingest({ provider: 'polar', external_user_id: 'P-BOR', activities: [run1] });
ok(r.status === 404 && store.activities.length === 0, 'ingest: revoked connection → 404');

const ops0 = nOps();
for (const [bad, why] of [
  ['{nope', 'invalid JSON'], [[1, 2], 'array body'], [{ external_user_id: 'G-ANA' }, 'missing provider'],
  [{ provider: 'Garmin Connect!', external_user_id: 'G-ANA' }, 'bad provider name'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: {} }, 'activities not an array'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, start: 'yesterday' }] }, 'unparseable start'],
  [JSON.stringify({ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, dist: 0 }] }).replace('"dist":0', '"dist":1e999'), 'non-finite number'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, dist: '5 km' }] }, 'number as text'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, moving: -5 }] }, 'negative number'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, external_id: '' }] }, 'empty external_id'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: [{ ...run1, pts: 'x' }] }, 'pts not an array'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', activities: Array.from({ length: 501 }, (_, i) => ({ ...run1, external_id: i })) }, 'more than 500 activities'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', measurements: [{ external_id: 'x', measured_at: '2026-10-19T05:30:00Z', weight_kg: NaN }] }, 'NaN weight'],
  [{ provider: 'garmin', external_user_id: 'G-ANA', measurements: [{ external_id: 'x', measured_at: '2026-10-19T05:30:00Z' }] }, 'empty measurement'],
]) { r = await ingest(bad); ok(r.status === 400, `ingest: ${why} → 400 (got ${r.status})`); }
ok(nOps() === ops0 && store.activities.length === 0, 'ingest: bad payloads write nothing');

r = await ingest({ provider: 'garmin', external_user_id: 'G-ANA', activities: [run1, ride1], measurements: [scale1] });
let res = await r.json();
ok(r.status === 200 && res.activities === 2 && res.measurements === 1, 'ingest: 2 activities + 1 measurement accepted: ' + JSON.stringify(res));
const a1 = store.activities.find(x => x.local_id === 'garmin:1001'), a2 = store.activities.find(x => x.local_id === 'garmin:r-2');
ok(a1 && a1.user_id === 'u-ana' && a1.member_id === 'p2' && a1.type === 'run' && a1.started_at === '2026-10-19T05:05:00.000Z' && a1.dist_m === 5230 && a1.moving_s === 1830 && a1.deleted === false,
  'ingest: activity row keyed by provider:external_id for the connected member');
ok(a1 && a1.data.id === 'garmin:1001' && a1.data.source === 'garmin' && a1.data.title === 'Morning run' && a1.data.kcal === 380 && a1.data.hrMax === 178 &&
  a1.data.pts.length === 1 && a1.data.device === 'Forerunner 265' && a1.data.start === '2026-10-19T05:05:00.000Z', 'ingest: activity data in the app shape with default title');
ok(a2 && a2.data.type === 'other' && a2.data.sport === 'cycling_road' && a2.data.title === 'Hills' && a2.moving_s === 3600 && a2.data.source === 'garmin', 'ingest: unknown sport → other, title kept');
const m1 = store.body_measurements[0];
ok(store.body_measurements.length === 1 && m1.local_id === 'garmin:m-1' && m1.user_id === 'u-ana' && m1.member_id === 'p2' && m1.weight_kg === 81.6 &&
  m1.fat_pct === 18.2 && m1.muscle_kg === 37.9 && m1.source === 'garmin' && m1.data.water_pct === 55.1, 'ingest: measurement row');
ok(store.device_connections[0].last_sync_at && Date.now() - Date.parse(store.device_connections[0].last_sync_at) < 5000, 'ingest: last_sync_at updated');
ok(store.device_connections[1].last_sync_at === null, 'ingest: other connections untouched');

// the user deletes the run in the app and renames the ride; the watch re-sends both
a1.deleted = true; a1.data = { id: 'garmin:1001' };
a2.data = { ...a2.data, title: 'Sunday hills with Bor', rpe: 7 };
r = await ingest({ provider: 'garmin', external_user_id: 'G-ANA', activities: [run1, { ...ride1, dist: 30100 }] });
res = await r.json();
ok(res.activities === 1 && res.skipped === 1, 'ingest: tombstone skipped: ' + JSON.stringify(res));
ok(store.activities.find(x => x.local_id === 'garmin:1001').deleted === true && !store.activities.find(x => x.local_id === 'garmin:1001').data.type, 'ingest: deleted activity not resurrected');
const a2b = store.activities.find(x => x.local_id === 'garmin:r-2');
ok(a2b.dist_m === 30100 && a2b.data.title === 'Sunday hills with Bor' && a2b.data.rpe === 7 && store.activities.length === 2, 'ingest: re-sync updates data but keeps the user\'s title/effort');

// backfilled history (older than 3 days) creates no Klaviyo events
{
  const n0 = calls.length;
  await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'garmin:old1', type: 'run', moving_s: 1800, dist_m: 5000, started_at: new Date(Date.now() - 10 * 864e5).toISOString(), data: { source: 'garmin' } }, 'activities');
  ok(calls.length === n0, 'old backfilled activity sends no event');
  await hook({ user_id: 'u-ana', member_id: 'p1', local_id: 'garmin:new1', type: 'run', moving_s: 1800, dist_m: 5000, started_at: new Date(Date.now() - 3600e3).toISOString(), data: { source: 'garmin' } }, 'activities');
  ok(calls.length === n0 + 1, 'fresh synced activity still sends an event');
}
// ---- Health program events (app_events → Klaviyo reminder flows)
{
  const users = { 'u-mk': ['marketing_email'], 'u-rem': ['reminders'], 'u-none': [], 'u-off': [] };
  store.consents['u-mk'] = true; store.consents['u-rem'] = false; store.consents['u-none'] = false;
  store.reminders['u-rem'] = true; store.reminders['u-off'] = false;
  const now = new Date().toISOString();
  let id = 100;
  const appEv = (user_id, name, props = {}, extra = {}) => hook({ id: ++id, user_id, member_id: 'p1', name, props, created_at: now, ...extra }, 'app_events');
  const REMIND = { supply_low: 'App Supply Low', checkins_missed: 'App Checkins Missed', weekly_review: 'App Weekly Review', routine_started: 'App Routine Started',
    program_paused: 'App Program Paused', checkin_streak: 'App Checkin Streak', reorder_clicked: 'App Reorder Clicked' };
  const MARKETING = { reward_unlocked: 'App Reward Unlocked', complement_suggested: 'App Complement Suggested' };
  const last = () => calls[calls.length - 1].body.data.attributes;
  for (const [name, metric] of Object.entries({ ...REMIND, ...MARKETING })) {
    for (const u of Object.keys(users)) {
      const n0 = calls.length;
      r = await appEv(u, name);
      const allowed = u === 'u-mk' || (u === 'u-rem' && name in REMIND);
      ok(allowed ? calls.length === n0 + 1 : calls.length === n0, `app event ${name} for ${u}: ${allowed ? 'sent' : 'blocked'}`);
      if (allowed) ok(last().metric.data.attributes.name === metric && last().unique_id === `app_events:${id}` && /\/events$/.test(calls[calls.length - 1].url),
        `${name} → "${metric}" with unique_id app_events:<id> (got ${last().metric.data.attributes.name})`);
    }
  }
  // whitelist: only known keys with plain values reach Klaviyo
  await appEv('u-rem', 'supply_low', { product: 'Magnesium Bisglycinate', product_id: 42, sku: '786110', days_left: 5, reorder_url: 'https://naturesfinest.eu/r/abc',
    weight_kg: 82, hr: 61, note: 'feeling low', email: 'x@y.z', pts: [[46, 14]], energy: { nested: 1 }, mood: 4, until: '2026-11-01' });
  const p = last().properties;
  ok(JSON.stringify(Object.keys(p).sort()) === JSON.stringify(['days_left', 'mood', 'product', 'product_id', 'reorder_url', 'sku', 'until']),
    'app event props whitelisted: ' + JSON.stringify(p));
  ok(p.days_left === 5 && p.reorder_url === 'https://naturesfinest.eu/r/abc' && last().profile.data.attributes.email === 'bor@example.com', 'whitelisted values kept, profile by e-mail');
  await appEv('u-mk', 'weekly_review', ['not', 'an', 'object']);
  ok(JSON.stringify(last().properties) === '{}', 'non-object props → empty properties');
  let n0 = calls.length;
  await appEv('u-mk', 'buy_now_popup');
  ok(calls.length === n0, 'unknown app event name sends nothing');
  await appEv('u-mk', 'supply_low', {}, { created_at: new Date(Date.now() - 5 * 864e5).toISOString() });
  ok(calls.length === n0, 'stale app event (webhook retry days later) sends nothing');
  // withdrawing reminders consent stops reminders
  store.reminders['u-rem'] = false;
  await appEv('u-rem', 'checkins_missed', { missed: 3 });
  ok(calls.length === n0, 'withdrawn reminders consent → no reminder');
  // the 'reminders' consent itself sets a profile property for flow filters
  await hook({ user_id: 'u-ana', kind: 'reminders', granted: true }, 'consents');
  ok(calls.length === n0 + 1 && /\/profile-import$/.test(calls[n0].url) && calls[n0].body.data.attributes.properties.finestme_reminders === true &&
    calls[n0].body.data.attributes.email === 'ana@example.com', 'reminders consent → profile property true');
  await hook({ user_id: 'u-ana', kind: 'reminders', granted: false }, 'consents');
  ok(calls.length === n0 + 2 && calls[n0 + 1].body.data.attributes.properties.finestme_reminders === false, 'reminders withdrawn → profile property false');
  ok(!calls.slice(n0).some(c => /subscription/.test(c.url)), 'reminders consent never subscribes to the marketing list');
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
