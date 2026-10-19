-- FinestMe platform – initial schema (Supabase, EU region / Frankfurt)
--
-- One account (auth.users, magic-link login with the webshop e-mail) holds a household:
-- members (the in-app profiles), their workouts and activities. Orders arrive from the
-- webshop webhook and are linked to an account by e-mail. Everything a user can read is
-- protected by row-level security; webshop and marketing tables are written only by
-- server-side functions (service role).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- app data (client-synced)
create table public.members (
  user_id     uuid not null references auth.users (id) on delete cascade,
  local_id    text not null,                 -- profile id generated on the device ('p…')
  name        text not null default 'Me',
  color       text,
  pin         text,                          -- privacy lock hash for shared TVs (not security)
  settings    jsonb not null default '{}',   -- goal, body, equipment, preferences, body-weight log
  ex          jsonb not null default '{}',   -- per-exercise progression
  customs     jsonb not null default '{}',
  saved       jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  primary key (user_id, local_id)
);

create table public.workouts (
  user_id     uuid not null references auth.users (id) on delete cascade,
  member_id   text not null,
  local_id    text not null,                 -- '<ISO date>|<session key>'
  done_at     timestamptz,
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  primary key (user_id, member_id, local_id)
);

create table public.activities (
  user_id     uuid not null references auth.users (id) on delete cascade,
  member_id   text not null,
  local_id    text not null,                 -- activity id ('a…')
  type        text,
  started_at  timestamptz,
  dist_m      integer,
  moving_s    integer,
  data        jsonb not null default '{}',   -- full activity incl. GPS points
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  primary key (user_id, member_id, local_id)
);
create index activities_started on public.activities (user_id, started_at desc);

-- ---------------------------------------------------------------- consent audit (GDPR art. 7 + 9)
-- append-only: the latest row per (user, kind) is the current state
create table public.consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('health_data', 'marketing_email', 'analytics')),
  granted     boolean not null,
  version     text not null,                 -- version of the consent text shown
  created_at  timestamptz not null default now()
);
create index consents_user on public.consents (user_id, kind, created_at desc);

create view public.current_consents with (security_invoker = true) as
  select distinct on (user_id, kind) user_id, kind, granted, version, created_at
  from public.consents order by user_id, kind, created_at desc, id desc;

-- ---------------------------------------------------------------- webshop (server-written)
create table public.orders (
  shop          text not null default 'naturesfinest',
  order_id      text not null,
  user_id       uuid references auth.users (id) on delete set null,
  email         text not null,
  status        text,
  total         numeric(10, 2),
  currency      text,
  items         jsonb not null default '[]',  -- [{ sku, name, qty }]
  ordered_at    timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (shop, order_id)
);
create index orders_email on public.orders (lower(email));
create index orders_user on public.orders (user_id);

-- QR scans from packaging / promo material (step 4: product page + routine)
create table public.product_scans (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  sku         text not null,
  src         text,                          -- pack | flyer | insert | …
  batch       text,
  scanned_at  timestamptz not null default now()
);

-- server clock decides "changed since" for sync (device clocks drift)
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger touch_members before insert or update on public.members for each row execute function public.touch_updated_at();
create trigger touch_workouts before insert or update on public.workouts for each row execute function public.touch_updated_at();
create trigger touch_activities before insert or update on public.activities for each row execute function public.touch_updated_at();
create trigger touch_orders before insert or update on public.orders for each row execute function public.touch_updated_at();
create index members_updated on public.members (user_id, updated_at);
create index workouts_updated on public.workouts (user_id, updated_at);
create index activities_updated on public.activities (user_id, updated_at);

-- ---------------------------------------------------------------- row-level security
alter table public.members enable row level security;
alter table public.workouts enable row level security;
alter table public.activities enable row level security;
alter table public.consents enable row level security;
alter table public.orders enable row level security;
alter table public.product_scans enable row level security;

create policy own_members on public.members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_workouts on public.workouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_activities on public.activities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- consents: read own, append own; never update/delete (audit trail)
create policy read_own_consents on public.consents for select to authenticated using (user_id = auth.uid());
create policy add_own_consents on public.consents for insert to authenticated with check (user_id = auth.uid());
-- orders: users only read their own; writes come from the shop webhook (service role bypasses RLS)
create policy read_own_orders on public.orders for select to authenticated using (user_id = auth.uid());
-- scans: anyone may log a scan (before login); a logged-in user may only attach their own id
create policy log_scan on public.product_scans for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- ---------------------------------------------------------------- linking + account deletion
-- a new account picks up earlier webshop orders placed with the same e-mail
create function public.link_orders_to_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.orders set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_orders_to_new_user();

-- used by the shop webhook to attach a new order to an existing account
create function public.user_id_by_email(p_email text) returns uuid
  language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;

-- right to erasure: the signed-in user deletes their account and all app data (cascades);
-- orders stay for accounting but lose the link to the account
create function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

grant select, insert, update, delete on public.members, public.workouts, public.activities to authenticated;
grant select, insert on public.consents to authenticated;
grant select on public.current_consents, public.orders to authenticated;
grant insert on public.product_scans to anon, authenticated;
