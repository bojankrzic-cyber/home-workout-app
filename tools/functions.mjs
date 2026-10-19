// Edge-function tests without Deno or network: node --experimental-strip-types tools/functions.mjs
// Loads each function with a fake Supabase client, fake Deno.env/serve and a fetch spy.
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
const errs = []; const ok = (c, m) => { if (!c) errs.push(m); };
const here = path.dirname(new URL(import.meta.url).pathname);
let handler = null;
const env = { SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x', WC_WEBHOOK_SECRET: 'wc-secret', SHOP_ID: 'nf-si', KLAVIYO_API_KEY: 'pk', KLAVIYO_LIST_ID: 'L1', WEBHOOK_TOKEN: 'tok' };
globalThis.Deno = { env: { get: k => env[k] }, serve: f => { handler = f; } };
const store = { orders: [], consents: { 'u-ana': true } };
globalThis.__fake = {
  rpc: async (fn, a) => ({ data: fn === 'user_id_by_email' && a.p_email === 'ana@example.com' ? 'u-ana' : null }),
  from: t => ({
    upsert: async row => { store.orders.push(row); return { error: null }; },
    select: () => { const q = { eq: (k, v) => { q[k] = v; return q; }, maybeSingle: async () => ({ data: { granted: store.consents[q.user_id] } }) }; return q; }
  }),
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

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
