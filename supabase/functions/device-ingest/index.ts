// Smart watches / trackers / scales → platform. The single entry point every provider adapter calls
// (server-to-server): an aggregator webhook handler (Thryve, Terra …), a Garmin Health/Activity API
// adapter, or the native app's Apple Health / Health Connect bridge via a server relay.
//
//   POST /functions/v1/device-ingest
//   Authorization: Bearer <INGEST_TOKEN>
//   { provider, external_user_id,
//     activities?:   [{ external_id, type, start, elapsed?, moving?, dist?, gain?, kcal?, hr?, hrMax?,
//                       hrs?, pts?, splits?, laps?, title?, device?, origin? }],
//     measurements?: [{ external_id, measured_at, weight_kg?, fat_pct?, muscle_kg?, data? , origin? }] }
//   → 200 { activities: n, measurements: m, skipped: k }   (k = items the user deleted in the app)
//
// Activities are already normalized to the app's activity shape (js/track.js). `origin` is the
// underlying data source when an aggregator relays another platform (e.g. 'apple_health') – it
// decides marketing restrictions downstream (klaviyo-sync).
// The connection (provider, external_user_id) → (user_id, member_id) is created by the OAuth
// callback with the service role; unknown or revoked connections are rejected with 404.
//
// Secrets: INGEST_TOKEN (shared with the adapters only)
// Deploy: supabase functions deploy device-ingest --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TOKEN = Deno.env.get('INGEST_TOKEN') ?? '';
const MAX_ITEMS = 500;
const CHUNK = 50;                                   // activities can carry GPS tracks – keep requests small

// activity types the app knows (js/track.js TYPES); anything else is shown as 'other'
const TYPES: Record<string, string> = {
  run: 'run', walk: 'walk', hike: 'hike', ride: 'ride', swim: 'swim', football: 'football', tennis: 'tennis',
  padel: 'padel', basketball: 'basketball', ski: 'ski', yoga: 'yoga', pilates: 'pilates', gym: 'gym session',
  indoor_run: 'treadmill', indoor_ride: 'indoor bike', other: 'other sport',
};

type Json = Record<string, unknown>;
class Bad extends Error {}

async function sameSecret(given: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const h = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([h(given), h(expected)]);        // equal length → constant-time loop
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
function str(v: unknown, what: string, max = 200, required = true): string | undefined {
  if (v == null && !required) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Bad(`${what}: expected text (max ${max})`);
  return v.trim();
}
function num(v: unknown, what: string, max: number): number | undefined {
  if (v == null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new Bad(`${what}: expected a number 0…${max}`);
  return v;
}
function time(v: unknown, what: string): string {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t < Date.UTC(2000, 0, 1) || t > Date.now() + 86400e3) throw new Bad(`${what}: expected an ISO timestamp`);
  return new Date(t).toISOString();
}
function arr(v: unknown, what: string, max: number): unknown[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v) || v.length > max) throw new Bad(`${what}: expected an array (max ${max})`);
  return v;
}
function list(v: unknown, what: string): Json[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > MAX_ITEMS) throw new Bad(`${what}: expected an array (max ${MAX_ITEMS})`);
  v.forEach((x, i) => { if (!isObj(x)) throw new Bad(`${what}[${i}]: expected an object`); });
  return v as Json[];
}

// "Morning run" like the app's autoTitle; the hour is taken from the provider's local timestamp when it
// carries an offset, otherwise from Central European time
function defaultTitle(startRaw: string, type: string): string {
  const m = /T(\d{2}):\d{2}(?::[\d.]+)?([+-]\d{2}:?\d{2})$/.exec(startRaw);
  const h = m ? +m[1] : +new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Ljubljana' }).format(new Date(startRaw));
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 14 ? 'Lunch' : h < 18 ? 'Afternoon' : h < 22 ? 'Evening' : 'Night';
  return `${part} ${TYPES[type] ?? TYPES.other}`;
}

function activity(a: Json, i: number, provider: string): Json {
  const w = `activities[${i}]`;
  const ext = str(a.external_id, `${w}.external_id`, 128)!;
  const rawType = str(a.type, `${w}.type`, 40)!.toLowerCase();
  const type = rawType in TYPES ? rawType : 'other';
  const start = time(a.start, `${w}.start`);
  const out: Json = {
    id: `${provider}:${ext}`, type, start,
    elapsed: num(a.elapsed, `${w}.elapsed`, 30 * 86400), moving: num(a.moving, `${w}.moving`, 30 * 86400),
    dist: num(a.dist, `${w}.dist`, 2e6), gain: num(a.gain, `${w}.gain`, 1e5), kcal: num(a.kcal, `${w}.kcal`, 1e5),
    hr: num(a.hr, `${w}.hr`, 260), hrMax: num(a.hrMax, `${w}.hrMax`, 260),
    hrs: arr(a.hrs, `${w}.hrs`, 1e5), pts: arr(a.pts, `${w}.pts`, 1e5),
    splits: arr(a.splits, `${w}.splits`, 2000), laps: arr(a.laps, `${w}.laps`, 2000),
    title: str(a.title, `${w}.title`, 200, false) ?? defaultTitle(String(a.start), type),
    device: str(a.device, `${w}.device`, 100, false),
    source: provider, external_id: ext,
    origin: str(a.origin, `${w}.origin`, 64, false),
  };
  if (rawType !== type) out.sport = rawType;      // keep the provider's sport name for later mapping
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

function measurement(m: Json, i: number, provider: string): Json {
  const w = `measurements[${i}]`;
  const ext = str(m.external_id, `${w}.external_id`, 128)!;
  const extra = m.data == null ? {} : m.data;
  if (!isObj(extra)) throw new Bad(`${w}.data: expected an object`);
  const row = {
    local_id: `${provider}:${ext}`,
    measured_at: time(m.measured_at, `${w}.measured_at`),
    weight_kg: num(m.weight_kg, `${w}.weight_kg`, 999) ?? null,
    fat_pct: num(m.fat_pct, `${w}.fat_pct`, 100) ?? null,
    muscle_kg: num(m.muscle_kg, `${w}.muscle_kg`, 999) ?? null,
    source: provider,
    data: { ...extra, external_id: ext, origin: str(m.origin, `${w}.origin`, 64, false) },
  };
  if (row.weight_kg == null && row.fat_pct == null && row.muscle_kg == null && !Object.keys(extra).length) throw new Bad(`${w}: no values`);
  if (row.data.origin === undefined) delete row.data.origin;
  return row;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !(await sameSecret(auth.slice(7), TOKEN))) return new Response('unauthorized', { status: 401 });

  let provider: string, ext: string, acts: Json[], meas: Json[];
  try {
    let body: unknown;
    try { body = await req.json(); } catch { throw new Bad('body: invalid JSON'); }
    if (!isObj(body)) throw new Bad('body: expected an object');
    provider = str(body.provider, 'provider', 64)!.toLowerCase();
    if (!/^[a-z0-9_.-]+(:[a-z0-9_.-]+)?$/.test(provider)) throw new Bad('provider: invalid');
    ext = str(body.external_user_id, 'external_user_id', 200)!;
    acts = list(body.activities, 'activities').map((a, i) => activity(a, i, provider));
    meas = list(body.measurements, 'measurements').map((m, i) => measurement(m, i, provider));
  } catch (e) {
    if (e instanceof Bad) return json({ error: e.message }, 400);
    throw e;
  }

  const { data: conn, error: cErr } = await db.from('device_connections').select('id,user_id,member_id,status')
    .eq('provider', provider).eq('external_user_id', ext).maybeSingle();
  if (cErr) return json({ error: cErr.message }, 500);
  if (!conn || conn.status !== 'active') return json({ error: 'unknown connection' }, 404);
  const owner = { user_id: conn.user_id, member_id: conn.member_id };

  // rows the user already has: tombstones (deleted in the app) stay deleted; their own edits
  // (title, effort, notes) survive a re-sync of the same activity
  async function existing(table: string, cols: string, ids: string[]) {
    const found = new Map<string, Json>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.from(table).select(cols).eq('user_id', owner.user_id).eq('member_id', owner.member_id).in('local_id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Json[]) found.set(String(r.local_id), r);
    }
    return found;
  }
  async function upsert(table: string, rows: Json[]) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,member_id,local_id' });
      if (error) throw new Error(error.message);
    }
  }

  let skipped = 0;
  try {
    const prevA = await existing('activities', 'local_id,deleted,title:data->>title,rpe:data->rpe,notes:data->>notes', acts.map(a => String(a.id)));
    const aRows = acts.filter(a => !(prevA.get(String(a.id))?.deleted && ++skipped)).map(a => {
      const p = prevA.get(String(a.id));
      if (p) { if (p.title) a.title = p.title; if (p.rpe != null) a.rpe = p.rpe; if (p.notes) a.notes = p.notes; }
      return { ...owner, local_id: a.id, type: a.type, started_at: a.start, dist_m: a.dist != null ? Math.round(a.dist as number) : null,
        moving_s: Math.round(((a.moving ?? a.elapsed ?? 0) as number)), data: a, deleted: false };
    });
    const prevM = await existing('body_measurements', 'local_id,deleted', meas.map(m => String(m.local_id)));
    const mRows = meas.filter(m => !(prevM.get(String(m.local_id))?.deleted && ++skipped)).map(m => ({ ...owner, ...m, deleted: false }));
    await upsert('activities', aRows);
    await upsert('body_measurements', mRows);
    const { error } = await db.from('device_connections').update({ last_sync_at: new Date().toISOString() }).eq('id', conn.id);
    if (error) throw new Error(error.message);
    return json({ activities: aRows.length, measurements: mRows.length, skipped });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
