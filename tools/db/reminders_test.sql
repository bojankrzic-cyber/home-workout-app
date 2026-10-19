-- Reminders: schedule, push subscriptions and the send log. Run by tools/db/test.sh.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a7', null), ('00000000-0000-0000-0000-0000000000b7', 'bine@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
insert into public.reminder_state (user_id, member_id, tz, lang, anchor, freq, start_date, push)
  values (auth.uid(), 'p1', 'Europe/Budapest', 'hu', 'coffee', 'daily', '2026-10-20', true);
insert into public.reminder_state (user_id, member_id, lang, anchor, push) values (auth.uid(), 'p1', 'hu', 'evening', true)
  on conflict (user_id, member_id) do update set anchor = excluded.anchor;
do $$ begin assert (select anchor from public.reminder_state) = 'evening', 'upsert updates the schedule'; end $$;
do $$ begin assert (select updated_at from public.reminder_state) > now() - interval '1 minute', 'server stamps updated_at'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.reminder_state (user_id, member_id, anchor) values (auth.uid(), 'p2', 'midnight'); exception when check_violation then ok := true; end;
  assert ok, 'unknown anchor rejected'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.reminder_state (user_id, member_id) values ('00000000-0000-0000-0000-0000000000b7', 'p1'); exception when others then ok := true; end;
  assert ok, 'cannot write another user''s schedule'; end $$;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://fcm.googleapis.com/fcm/send/abc', 'k', 'a');
do $$ declare ok boolean := false; begin
  begin insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'http://evil.example/x', 'k', 'a'); exception when check_violation then ok := true; end;
  assert ok, 'push endpoint must be https'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.reminder_log (user_id, member_id, dedupe_key, kind, channel, local_date) values (auth.uid(), 'p1', 'x', 'x', 'push', current_date); exception when others then ok := true; end;
  assert ok, 'clients cannot write the send log'; end $$;
insert into public.app_events (user_id, name) values (auth.uid(), 'reminders_on');
insert into public.app_events (user_id, name) values (auth.uid(), 'guide_viewed');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', false);
do $$ begin assert (select count(*) from public.reminder_state) = 0 and (select count(*) from public.push_subscriptions) = 0, 'Bine sees nobody else''s schedule or phones'; end $$;
reset role;

-- server side: the log is exactly-once per occasion
insert into public.reminder_log (user_id, member_id, dedupe_key, kind, channel, local_date) values ('00000000-0000-0000-0000-0000000000a7', 'p1', 'checkin:2026-10-20:push', 'checkin_coffee', 'push', '2026-10-20');
do $$ declare ok boolean := false; begin
  begin insert into public.reminder_log (user_id, member_id, dedupe_key, kind, channel, local_date) values ('00000000-0000-0000-0000-0000000000a7', 'p1', 'checkin:2026-10-20:push', 'checkin_coffee', 'push', '2026-10-20'); exception when unique_violation then ok := true; end;
  assert ok, 'same occasion cannot be logged twice'; end $$;
-- deleting the account removes schedule, phones and log
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a7';
do $$ begin assert (select count(*) from public.reminder_state) + (select count(*) from public.push_subscriptions) + (select count(*) from public.reminder_log) = 0, 'erasure cascades'; end $$;
select 'reminders ok';
