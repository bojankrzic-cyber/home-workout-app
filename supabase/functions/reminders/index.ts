// Reminders outside the app. Called every 15 minutes by pg_cron (migration 20261020000000_reminders.sql).
// For every routine (public.reminder_state) the pure planner (../_shared/reminder_plan.ts) decides what is due;
// push goes straight to the phone (Web Push, VAPID), e-mail becomes an app_events row 'reminder_due' that
// klaviyo-sync turns into the Klaviyo metric "App Reminder Due" (one flow, the text comes in the event).
// Every send is logged once (reminder_log, unique per occasion) – a retry or a parallel run never doubles it.
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { plan, local, type State, type Sent } from '../_shared/reminder_plan.ts';
import I18N from '../_shared/reminder_i18n.json' with { type: 'json' };

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SECRET = Deno.env.get('CRON_SECRET') ?? '';
const VAPID = { pub: Deno.env.get('VAPID_PUBLIC_KEY') ?? '', priv: Deno.env.get('VAPID_PRIVATE_KEY') ?? '', subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:app@naturesfinest.eu' };
if (VAPID.pub && VAPID.priv) webpush.setVapidDetails(VAPID.subject, VAPID.pub, VAPID.priv);
const DICTS = I18N as Record<string, Record<string, string>>;
const PAGE = 500;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  if (!SECRET || req.headers.get('x-cron-secret') !== SECRET) return new Response('unauthorized', { status: 401 });
  const now = new Date(), since = new Date(+now - 40 * 864e5).toISOString();
  const stats = { states: 0, push: 0, email: 0, gone: 0, failed: 0 };
  for (let from = 0; ; from += PAGE) {
    const { data: rows, error } = await db.from('reminder_state').select('*').neq('freq', 'off').order('user_id').range(from, from + PAGE - 1);
    if (error) return new Response(error.message, { status: 500 });
    if (!rows || !rows.length) break;
    stats.states += rows.length;
    const ids = [...new Set(rows.map((r: State) => r.user_id))];
    const [subs, logs, cons] = await Promise.all([
      db.from('push_subscriptions').select('user_id,endpoint,p256dh,auth').in('user_id', ids),
      db.from('reminder_log').select('user_id,member_id,dedupe_key,channel,local_date').in('user_id', ids).gte('sent_at', since),
      db.from('current_consents').select('user_id,kind,granted').in('user_id', ids).in('kind', ['reminders', 'marketing_email']),
    ]);
    const mailOk = new Set((cons.data ?? []).filter((c: { granted: boolean }) => c.granted).map((c: { user_id: string }) => c.user_id));
    for (const s of rows as State[]) {
      const sent = (logs.data ?? []).filter((l: Sent & { user_id: string; member_id: string }) => l.user_id === s.user_id && l.member_id === s.member_id);
      const mySubs = (subs.data ?? []).filter((x: { user_id: string }) => x.user_id === s.user_id);
      const msgs = plan({ ...s, push: s.push && mySubs.length > 0, email: s.email && mailOk.has(s.user_id) }, now, sent, DICTS[s.lang] ?? DICTS.en);
      const day = local(now, s.tz).date;
      for (const m of msgs) {
        // claim the occasion first (unique key) – if another run already sent it, skip
        const { error: dup } = await db.from('reminder_log').insert({ user_id: s.user_id, member_id: s.member_id, dedupe_key: m.key + ':' + m.channel, kind: m.kind, channel: m.channel, local_date: day });
        if (dup) continue;
        if (m.channel === 'push') {
          let okAny = false;
          for (const sub of mySubs) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag, done: m.done }), { TTL: 4 * 3600, urgency: 'normal' });
              okAny = true;
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); stats.gone++; } else stats.failed++;
            }
          }
          if (okAny) stats.push++;
        } else {
          await db.from('app_events').insert({ user_id: s.user_id, member_id: s.member_id, name: 'reminder_due',
            props: { kind: m.kind, title: m.title, body: m.body, url: 'https://app.naturesfinest.eu/' + m.url.replace(/^\.\//, ''), lang: s.lang, product: s.runout_product || s.product || '' } });
          stats.email++;
        }
      }
    }
    if (rows.length < PAGE) break;
  }
  return new Response(JSON.stringify(stats), { headers: { 'content-type': 'application/json' } });
});
