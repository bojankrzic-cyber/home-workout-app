-- FinestMe platform – Health program events (daily supplement routine → Klaviyo reminders)
--
-- The app's Health program (routine check-ins, supply run-out prediction, rewards) appends small
-- events to public.app_events. A Database Webhook (INSERT) hands each row to the klaviyo-sync edge
-- function, which forwards a whitelisted subset as a Klaviyo event ("App Supply Low" …) that starts a
-- reminder flow (e-mail / SMS / WhatsApp) – but only with the matching consent:
--   'reminders'       – routine reminders the user asked for (a service message, NOT marketing)
--   'marketing_email' – rewards / product suggestions (and also covers reminders)
--
-- Events are append-only for clients: insert + read own rows, never update or delete.

-- ---------------------------------------------------------------- consents: new kind 'reminders'
alter table public.consents drop constraint if exists consents_kind_check;
alter table public.consents add constraint consents_kind_check
  check (kind in ('health_data', 'marketing_email', 'analytics', 'reminders'));

-- ---------------------------------------------------------------- program events (client-written)
create table public.app_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  member_id   text,                                  -- household member the routine belongs to
  name        text not null check (name in (
                'routine_started', 'checkin_streak', 'supply_low', 'reorder_clicked', 'reward_unlocked',
                'checkins_missed', 'weekly_review', 'program_paused', 'complement_suggested')),
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index app_events_user on public.app_events (user_id, created_at desc);

-- guard against runaway clients: props must be a small JSON object, at most 200 events per user per
-- rolling 24 h; the server clock sets created_at (device clocks drift, and it drives the rate limit)
create function public.app_events_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(new.props) <> 'object' then
    raise exception 'app_events.props must be a JSON object' using errcode = 'check_violation';
  end if;
  if octet_length(new.props::text) > 4096 then
    raise exception 'app_events.props larger than 4 kB' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.app_events
       where user_id = new.user_id and created_at > now() - interval '1 day') >= 200 then
    raise exception 'too many app events (200 per day)' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger app_events_guard before insert on public.app_events
  for each row execute function public.app_events_guard();

-- ---------------------------------------------------------------- row-level security
alter table public.app_events enable row level security;
create policy read_own_app_events on public.app_events for select to authenticated using (user_id = auth.uid());
create policy add_own_app_events on public.app_events for insert to authenticated with check (user_id = auth.uid());

grant select, insert on public.app_events to authenticated;
grant all on public.app_events to service_role;
