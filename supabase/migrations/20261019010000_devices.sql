-- FinestMe platform – smart watches, trackers and scales (automatic sync)
--
-- Provider-agnostic: an adapter (aggregator such as Thryve/Terra, Garmin Health/Activity API, or the
-- native app for Apple Health / Health Connect) links a provider account to one household member
-- (device_connections) and pushes normalized data through the device-ingest edge function, which
-- writes public.activities and public.body_measurements with the service role. Clients only read
-- their connections and may disconnect (delete) them.

-- ---------------------------------------------------------------- linked provider accounts
create table public.device_connections (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  member_id         text not null,                 -- household member the watch belongs to
  provider          text not null,                 -- 'garmin' | 'polar' | 'apple_health' | 'health_connect' | 'withings' | 'aggregator:<name>' …
  external_user_id  text not null,                 -- the provider's (or aggregator's) id for this person
  status            text not null default 'active' check (status in ('active', 'revoked', 'error')),
  scopes            text[] not null default '{}',
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  unique (provider, external_user_id)
);
create index device_connections_user on public.device_connections (user_id);

-- ---------------------------------------------------------------- smart scales / body tracker (client-synced)
create table public.body_measurements (
  user_id      uuid not null references auth.users (id) on delete cascade,
  member_id    text not null,
  local_id     text not null,                      -- '<provider>:<external id>' or a device-generated id
  measured_at  timestamptz,
  weight_kg    numeric(5, 2),
  fat_pct      numeric(4, 1),
  muscle_kg    numeric(5, 2),
  source       text,                               -- 'withings' | 'garmin' | 'manual' | …
  data         jsonb not null default '{}',        -- full measurement (water, bone, visceral fat, BMR …)
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  primary key (user_id, member_id, local_id)
);
create trigger touch_body_measurements before insert or update on public.body_measurements
  for each row execute function public.touch_updated_at();
create index body_measurements_updated on public.body_measurements (user_id, updated_at);
create index body_measurements_measured on public.body_measurements (user_id, measured_at desc);

-- ---------------------------------------------------------------- row-level security
alter table public.device_connections enable row level security;
alter table public.body_measurements enable row level security;

-- connections: read own + disconnect own; created/updated only by the OAuth callback / adapters (service role)
create policy read_own_connections on public.device_connections for select to authenticated using (user_id = auth.uid());
create policy delete_own_connections on public.device_connections for delete to authenticated using (user_id = auth.uid());
create policy own_body_measurements on public.body_measurements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, delete on public.device_connections to authenticated;
grant select, insert, update, delete on public.body_measurements to authenticated;
grant all on public.device_connections, public.body_measurements to service_role;
