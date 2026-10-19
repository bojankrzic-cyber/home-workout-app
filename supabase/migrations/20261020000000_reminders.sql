-- FinestMe – reminders outside the app (web push + e-mail via Klaviyo)
--
-- reminder_state     one row per routine (user × household member), written by the app on every change:
--                    the schedule the server needs (time zone, the customer's moment, last check-in, run-out
--                    date …). The reminders edge function reads it every 15 minutes (pg_cron below).
-- push_subscriptions the phones that asked for reminders (Web Push endpoint + keys)
-- reminder_log       one row per sent reminder and occasion – the unique key makes every send exactly-once
-- Rules and texts: supabase/functions/_shared/reminder_plan.ts, docs/reminders.md.

create table public.reminder_state (
  user_id        uuid not null references auth.users (id) on delete cascade,
  member_id      text not null,
  tz             text not null default 'Europe/Ljubljana',
  lang           text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  anchor         text not null default 'breakfast' check (anchor in ('coffee', 'breakfast', 'lunch', 'evening')),
  remind_min     int check (remind_min between 0 and 1439),
  learned_min    int check (learned_min between 0 and 1439),
  freq           text not null default 'daily' check (freq in ('daily', '3x', 'off')),
  paused_until   date,
  start_date     date,
  last_checkin   date,
  checkins       int not null default 0,
  streak         int not null default 0,
  product        text check (length(product) <= 120),
  runout         date,
  runout_product text check (length(runout_product) <= 120),
  runout_url     text check (length(runout_url) <= 600),
  weekly_last    text check (length(weekly_last) <= 10),
  push           boolean not null default false,
  email          boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (user_id, member_id)
);
create index reminder_state_active on public.reminder_state (user_id) where freq <> 'off';

create table public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  lang       text check (length(lang) <= 5),
  ua         text check (length(ua) <= 200),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

create table public.reminder_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  member_id  text not null,
  dedupe_key text not null,
  kind       text not null,
  channel    text not null check (channel in ('push', 'email')),
  local_date date not null,
  sent_at    timestamptz not null default now(),
  unique (user_id, member_id, dedupe_key)
);
create index reminder_log_recent on public.reminder_log (user_id, sent_at desc);

-- the server clock stamps every schedule change
create function public.reminder_state_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger reminder_state_touch before insert or update on public.reminder_state
  for each row execute function public.reminder_state_touch();

-- ---------------------------------------------------------------- row-level security
alter table public.reminder_state enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;
create policy own_reminder_state on public.reminder_state for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_push_subscriptions on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy read_own_reminder_log on public.reminder_log for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.reminder_state, public.push_subscriptions to authenticated;
grant select on public.reminder_log to authenticated;
grant all on public.reminder_state, public.push_subscriptions, public.reminder_log to service_role;

-- ---------------------------------------------------------------- app events used by the funnel and reminders
alter table public.app_events drop constraint if exists app_events_name_check;
alter table public.app_events add constraint app_events_name_check check (name in (
  'routine_started', 'checkin_streak', 'supply_low', 'reorder_clicked', 'reward_unlocked', 'checkins_missed',
  'weekly_review', 'program_paused', 'complement_suggested',
  'guide_viewed', 'account_prompt_shown', 'install_prompt', 'reminders_on', 'reminder_due'));

-- ---------------------------------------------------------------- schedule: every 15 minutes
-- Needs pg_cron + pg_net (Database → Extensions) and two Vault secrets:
--   reminders_url    = https://<project-ref>.supabase.co/functions/v1/reminders
--   reminders_secret = the same value as the function secret CRON_SECRET
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('finestme-reminders', '*/15 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_url'),
        headers := jsonb_build_object('content-type', 'application/json',
                     'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_secret')),
        body := '{}'::jsonb, timeout_milliseconds := 55000)
    $job$);
    -- keep the log small: occasions older than 60 days are never looked at again
    perform cron.schedule('finestme-reminder-log-trim', '17 3 * * *', $job$ delete from public.reminder_log where sent_at < now() - interval '60 days' $job$);
  end if;
end $outer$;
