// Platform → Klaviyo. Called by Supabase Database Webhooks (INSERT on consents, workouts, activities, app_events).
//
//   consents.marketing_email  → subscribe / unsubscribe the e-mail on the Klaviyo list (double opt-in
//                               follows the list's own setting)
//   workouts / activities     → engagement events WITHOUT health details (type, minutes, km only),
//                               and only for people whose current marketing consent is granted.
//                               Never for activities from Apple HealthKit or Android Health Connect
//                               (data.source or data.origin 'apple_health' / 'health_connect'): Apple's and
//                               Google's platform policies forbid using that data for marketing/advertising.
//   consents.reminders        → profile property finestme_reminders (true/false) so reminder flows can filter on it
//   app_events                → Health program events ("App Supply Low", "App Reward Unlocked" …) that start
//                               reminder flows (e-mail / SMS / WhatsApp). Only whitelisted props are sent.
//                               Routine reminders need the 'reminders' OR 'marketing_email' consent; rewards and
//                               product suggestions need 'marketing_email'. No consent → nothing is sent.
//
// Secrets: KLAVIYO_API_KEY (private key, scopes: profiles:write, lists:write, subscriptions:write, events:write),
//          KLAVIYO_LIST_ID, WEBHOOK_TOKEN (shared secret the database webhook sends as "Authorization: Bearer …")
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const KEY = Deno.env.get('KLAVIYO_API_KEY') ?? '';
const LIST = Deno.env.get('KLAVIYO_LIST_ID') ?? '';
const TOKEN = Deno.env.get('WEBHOOK_TOKEN') ?? '';
const API = 'https://a.klaviyo.com/api';
const HEAD = { Authorization: `Klaviyo-API-Key ${KEY}`, revision: '2024-10-15', 'content-type': 'application/vnd.api+json', accept: 'application/vnd.api+json' };

async function emailOf(userId: string): Promise<string | null> {
  const { data } = await db.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}
async function marketingOk(userId: string): Promise<boolean> {
  const { data } = await db.from('current_consents').select('granted').eq('user_id', userId).eq('kind', 'marketing_email').maybeSingle();
  return !!data?.granted;
}
async function consentOk(userId: string, kinds: string[]): Promise<boolean> {
  const { data } = await db.from('current_consents').select('kind,granted').eq('user_id', userId).in('kind', kinds);
  return (data ?? []).some((c: { granted?: boolean }) => !!c.granted);
}
// Health program events: name → consents that allow it (any one is enough)
const REMIND = ['reminders', 'marketing_email'], MARKETING = ['marketing_email'];
const APP_EVENTS: Record<string, string[]> = {
  routine_started: REMIND, checkin_streak: REMIND, supply_low: REMIND, reorder_clicked: REMIND,
  checkins_missed: REMIND, weekly_review: REMIND, program_paused: REMIND,
  reward_unlocked: MARKETING, complement_suggested: MARKETING,
  // written by the reminders function: the text is localized already – one Klaviyo flow sends {{ event.title }} / {{ event.body }}
  reminder_due: REMIND,
};
const APP_PROPS = ['product', 'product_id', 'sku', 'days_left', 'reorder_url', 'reward', 'code', 'checkins', 'streak',
  'missed', 'week', 'adherence', 'energy', 'sleep', 'mood', 'checkin_time', 'until', 'kind', 'title', 'body', 'url', 'lang'];
const appMetric = (name: string) => 'App ' + name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
// only whitelisted keys with plain values (string / number / boolean) – never nested objects
function appProps(p: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) return out;
  for (const k of APP_PROPS) {
    const v = (p as Record<string, unknown>)[k];
    if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) out[k] = v;
  }
  return out;
}

// Apple HealthKit / Android Health Connect data must never reach marketing tools
const RESTRICTED = ['apple_health', 'health_connect'];
const restricted = (r: { data?: { source?: string; origin?: string } }) =>
  RESTRICTED.includes(r.data?.source ?? '') || RESTRICTED.includes(r.data?.origin ?? '');

async function klaviyo(path: string, payload: unknown) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: HEAD, body: JSON.stringify(payload) });
  if (!r.ok && r.status !== 409) throw new Error(`Klaviyo ${path} ${r.status}: ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${TOKEN}`) return new Response('unauthorized', { status: 401 });
  const ev = await req.json();               // { type: 'INSERT', table, record }
  const r = ev.record ?? {};
  if (ev.type !== 'INSERT' || !r.user_id) return new Response('ignored');
  const email = await emailOf(r.user_id);
  if (!email) return new Response('no email');

  if (ev.table === 'consents' && r.kind === 'marketing_email') {
    const profiles = { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } } }] };
    if (r.granted) {
      await klaviyo('/profile-subscription-bulk-create-jobs', { data: { type: 'profile-subscription-bulk-create-job', attributes: { custom_source: 'Nature\'s Finest app', profiles }, relationships: { list: { data: { type: 'list', id: LIST } } } } });
    } else {
      await klaviyo('/profile-subscription-bulk-delete-jobs', { data: { type: 'profile-subscription-bulk-delete-job', attributes: { profiles: { data: [{ type: 'profile', attributes: { email, subscriptions: { email: { marketing: { consent: 'UNSUBSCRIBED' } } } } }] } }, relationships: { list: { data: { type: 'list', id: LIST } } } } });
    }
    return new Response('ok');
  }
  if (ev.table === 'consents' && r.kind === 'reminders') {
    await klaviyo('/profile-import', { data: { type: 'profile', attributes: { email, properties: { finestme_reminders: !!r.granted } } } });
    return new Response('ok');
  }

  if (ev.table === 'app_events') {
    const allowed = APP_EVENTS[r.name];
    if (!allowed) return new Response('unknown event');
    // a reminder that arrives days late (webhook retries) is worse than none
    const at = Date.parse(r.created_at ?? '');
    if (isFinite(at) && Date.now() - at > 3 * 864e5) return new Response('stale – no event');
    if (!await consentOk(r.user_id, allowed)) return new Response('no consent');
    await klaviyo('/events', { data: { type: 'event', attributes: {
      metric: { data: { type: 'metric', attributes: { name: appMetric(r.name) } } },
      profile: { data: { type: 'profile', attributes: { email } } },
      properties: appProps(r.props),
      time: r.created_at ?? new Date().toISOString(),
      unique_id: `app_events:${r.id}`,
    } } });
    return new Response('ok');
  }

  if (ev.table === 'activities' && restricted(r)) return new Response('restricted source');
  // connecting a watch backfills its history – only fresh activities (last 3 days) become marketing events
  const when = Date.parse((ev.table === 'activities' ? r.started_at : r.done_at) ?? '');
  if (isFinite(when) && Date.now() - when > 3 * 864e5) return new Response('backfill – no event');
  if ((ev.table === 'workouts' || ev.table === 'activities') && !r.deleted && await marketingOk(r.user_id)) {
    const isAct = ev.table === 'activities';
    await klaviyo('/events', { data: { type: 'event', attributes: {
      metric: { data: { type: 'metric', attributes: { name: isAct ? 'App Activity Recorded' : 'App Workout Completed' } } },
      profile: { data: { type: 'profile', attributes: { email } } },
      properties: isAct ? { sport: r.type, minutes: Math.round((r.moving_s ?? 0) / 60), km: Math.round((r.dist_m ?? 0) / 100) / 10 }
                        : { workout: r.data?.name ?? r.data?.session ?? 'Workout', minutes: r.data?.min ?? null },
      time: (isAct ? r.started_at : r.done_at) ?? new Date().toISOString(),
      unique_id: `${ev.table}:${r.user_id}:${r.member_id}:${r.local_id}`,
    } } });
  }
  return new Response('ok');
});
