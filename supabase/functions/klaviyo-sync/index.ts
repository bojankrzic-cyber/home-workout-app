// Platform → Klaviyo. Called by Supabase Database Webhooks (INSERT on consents, workouts, activities).
//
//   consents.marketing_email  → subscribe / unsubscribe the e-mail on the Klaviyo list (double opt-in
//                               follows the list's own setting)
//   workouts / activities     → engagement events WITHOUT health details (type, minutes, km only),
//                               and only for people whose current marketing consent is granted
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
