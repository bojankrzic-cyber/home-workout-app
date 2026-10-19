-- Device connections + body measurements. Run by tools/db/test.sh after rls_test.sql.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'cene@example.com'), ('00000000-0000-0000-0000-0000000000d1', 'dora@example.com');

-- service-role path (OAuth callback / adapter): may create connections
set role service_role;
insert into public.device_connections (user_id, member_id, provider, external_user_id, scopes)
  values ('00000000-0000-0000-0000-0000000000c1', 'p1', 'garmin', 'g-123', '{activities}'),
         ('00000000-0000-0000-0000-0000000000c1', 'p2', 'withings', 'w-9', '{weight}');
update public.device_connections set last_sync_at = now() where external_user_id = 'g-123';
reset role;
do $$ declare ok boolean := false; begin
  begin insert into public.device_connections (user_id, member_id, provider, external_user_id) values ('00000000-0000-0000-0000-0000000000d1', 'p1', 'garmin', 'g-123');
  exception when unique_violation then ok := true; end;
  assert ok, 'one provider account links to one person only'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.device_connections (user_id, member_id, provider, external_user_id, status) values ('00000000-0000-0000-0000-0000000000d1', 'p1', 'polar', 'x', 'bogus');
  exception when check_violation then ok := true; end;
  assert ok, 'status is constrained'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ begin assert (select count(*) from public.device_connections) = 2, 'Cene sees his connections'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.device_connections (user_id, member_id, provider, external_user_id) values (auth.uid(), 'p1', 'polar', 'p-1'); exception when others then ok := true; end;
  assert ok, 'clients cannot create connections'; end $$;
do $$ declare ok boolean := false; begin
  begin update public.device_connections set status = 'active', member_id = 'p9'; exception when others then ok := true; end;
  assert ok, 'clients cannot change connections'; end $$;
insert into public.body_measurements (user_id, member_id, local_id, measured_at, weight_kg, fat_pct, muscle_kg, source)
  values (auth.uid(), 'p1', 'm1', now(), 82.4, 18.5, 38.2, 'manual');
do $$ declare t1 timestamptz; t2 timestamptz; begin
  select updated_at into t1 from public.body_measurements where local_id = 'm1';
  update public.body_measurements set weight_kg = 82.1 where local_id = 'm1';
  select updated_at into t2 from public.body_measurements where local_id = 'm1';
  assert t2 > t1, 'server clock touches updated_at'; end $$;
delete from public.device_connections where external_user_id = 'w-9';
do $$ begin assert (select count(*) from public.device_connections) = 1, 'Cene disconnects his scale'; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin assert (select count(*) from public.device_connections) = 0 and (select count(*) from public.body_measurements) = 0, 'Dora sees nothing of Cene'; end $$;
delete from public.device_connections;
do $$ declare ok boolean := false; begin
  begin insert into public.body_measurements (user_id, member_id, local_id) values ('00000000-0000-0000-0000-0000000000c1', 'p1', 'mx'); exception when others then ok := true; end;
  assert ok, 'cannot write measurements into another account'; end $$;
reset role;
do $$ begin assert (select count(*) from public.device_connections where external_user_id = 'g-123') = 1, 'cross-account disconnect blocked'; end $$;

delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin assert (select count(*) from public.device_connections) = 0 and (select count(*) from public.body_measurements) = 0, 'account deletion removes connections and measurements'; end $$;
select 'no errors' as result;
