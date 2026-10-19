-- Health program events + 'reminders' consent. Run by tools/db/test.sh after devices_test.sql.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'eva@example.com'), ('00000000-0000-0000-0000-0000000000f1', 'filip@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
insert into public.consents (user_id, kind, granted, version) values (auth.uid(), 'reminders', true, 'v1-2026-10');
do $$ begin assert (select granted from public.current_consents where kind = 'reminders'), '''reminders'' consent accepted'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.consents (user_id, kind, granted, version) values (auth.uid(), 'sms_spam', true, 'v1'); exception when check_violation then ok := true; end;
  assert ok, 'unknown consent kinds still rejected'; end $$;

insert into public.app_events (user_id, member_id, name, props)
  values (auth.uid(), 'p1', 'supply_low', '{"product":"Magnesium","days_left":5,"reorder_url":"https://naturesfinest.eu/r/1"}');
insert into public.app_events (user_id, name) values (auth.uid(), 'checkin_streak');
do $$ begin assert (select count(*) from public.app_events) = 2, 'Eva inserts and reads her events'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name, created_at) values (auth.uid(), 'weekly_review', '2020-01-01');
        ok := (select max(created_at) from public.app_events) > now() - interval '1 minute'; end;
  assert ok, 'server clock sets created_at'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name) values ('00000000-0000-0000-0000-0000000000f1', 'supply_low'); exception when others then ok := true; end;
  assert ok, 'cannot insert events for another user'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name) values (auth.uid(), 'buy_now_popup'); exception when check_violation then ok := true; end;
  assert ok, 'unknown event name rejected'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name, props) values (auth.uid(), 'weekly_review', jsonb_build_object('note', repeat('x', 4100))); exception when check_violation then ok := true; end;
  assert ok, 'props over 4 kB rejected'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name, props) values (auth.uid(), 'weekly_review', '[1,2]'); exception when check_violation then ok := true; end;
  assert ok, 'props must be an object'; end $$;
do $$ declare ok boolean := false; begin
  begin update public.app_events set name = 'reward_unlocked'; get diagnostics ok = row_count; ok := false; exception when others then ok := true; end;
  assert ok, 'events cannot be updated'; end $$;
do $$ declare ok boolean := false; begin
  begin delete from public.app_events; exception when others then ok := true; end;
  assert ok, 'events cannot be deleted by clients'; end $$;

-- rate guard: 200 per user per day
insert into public.app_events (user_id, name) select auth.uid(), 'checkin_streak' from generate_series(1, 197);
do $$ begin assert (select count(*) from public.app_events) = 200, '200 events allowed'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.app_events (user_id, name) values (auth.uid(), 'supply_low'); exception when others then ok := true; end;
  assert ok, '201st event in a day rejected'; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
do $$ begin assert (select count(*) from public.app_events) = 0, 'Filip sees none of Eva''s events'; end $$;
insert into public.app_events (user_id, name, props) values (auth.uid(), 'reward_unlocked', '{"reward":"10% off","code":"FM10"}');
do $$ begin assert (select count(*) from public.app_events) = 1, 'Eva''s limit does not affect Filip'; end $$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare ok boolean := false; begin
  begin perform 1 from public.app_events; exception when others then ok := true; end;
  assert ok, 'anonymous cannot read events'; end $$;
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert (select count(*) from public.app_events where user_id = '00000000-0000-0000-0000-0000000000e1') = 0, 'account deletion removes events';
  assert (select count(*) from public.app_events) = 1, 'other users'' events kept';
end $$;
select 'no errors' as result;
