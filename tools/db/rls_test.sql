-- RLS + linking + erasure checks. Run by tools/db/test.sh; any failed assert aborts with an error.
\set ON_ERROR_STOP on
insert into public.orders (order_id, email, total, items) values ('1001', 'Ana@Example.com', 29.98, '[{"sku":"786110","qty":2}]');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'), ('00000000-0000-0000-0000-00000000000b', 'bor@example.com');
do $$ begin assert (select user_id from public.orders where order_id = '1001') = '00000000-0000-0000-0000-00000000000a', 'order linked on sign-up'; end $$;
do $$ begin assert public.user_id_by_email('BOR@example.com') = '00000000-0000-0000-0000-00000000000b', 'lookup by e-mail'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.members (user_id, local_id, name) values (auth.uid(), 'p1', 'Ana');
insert into public.activities (user_id, member_id, local_id, type, dist_m) values (auth.uid(), 'p1', 'a1', 'run', 5000);
insert into public.consents (user_id, kind, granted, version) values (auth.uid(), 'health_data', true, 'v1'), (auth.uid(), 'marketing_email', true, 'v1'), (auth.uid(), 'marketing_email', false, 'v1');
do $$ begin assert (select granted from public.current_consents where kind = 'marketing_email') = false, 'latest consent wins'; end $$;
do $$ begin assert (select count(*) from public.orders) = 1, 'Ana sees her order'; end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.members (user_id, local_id) values ('00000000-0000-0000-0000-00000000000b', 'px'); exception when others then ok := true; end;
  assert ok, 'cannot write into another account'; end $$;
do $$ declare ok boolean := false; begin
  begin update public.consents set granted = true; get diagnostics ok = row_count; ok := false; exception when others then ok := true; end;
  assert ok, 'consents are append-only'; end $$;
do $$ declare ok boolean := false; begin
  begin perform public.user_id_by_email('bor@example.com'); exception when others then ok := true; end;
  assert ok, 'clients cannot look up accounts by e-mail'; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin assert (select count(*) from public.members) = 0 and (select count(*) from public.activities) = 0 and (select count(*) from public.orders) = 0 and (select count(*) from public.consents) = 0, 'Bor sees nothing of Ana'; end $$;
update public.members set name = 'hacked';
reset role;
do $$ begin assert (select name from public.members where local_id = 'p1') = 'Ana', 'cross-account update blocked'; end $$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into public.product_scans (sku, src) values ('786110', 'pack');
do $$ declare ok boolean := false; begin
  begin perform 1 from public.members; exception when others then ok := true; end;
  assert ok, 'anonymous cannot read app data'; end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from auth.users where email = 'ana@example.com') = 0, 'account erased';
  assert (select count(*) from public.members) = 0 and (select count(*) from public.activities) = 0 and (select count(*) from public.consents) = 0, 'app data erased';
  assert (select user_id from public.orders where order_id = '1001') is null, 'order kept for accounting, unlinked';
end $$;
select 'no errors' as result;
