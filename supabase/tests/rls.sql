-- Run against a DISPOSABLE Supabase instance after 001_initial.sql.
-- All fixtures are rolled back. A failed assertion aborts the transaction.
begin;
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','city-test@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','barangay-test@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','resident-test@example.invalid');
insert into public.admin_accounts(user_id,role,barangay) values
 ('11111111-1111-4111-8111-111111111111','citywide',null),
 ('22222222-2222-4222-8222-222222222222','barangay','Tagapo');
insert into public.evacuation_centers(id,name,barangay,capacity,geom) values
 ('44444444-4444-4444-8444-444444444444','Test Tagapo','Tagapo',100,'{"type":"Point","coordinates":[121.109,14.297]}'),
 ('55555555-5555-4555-8555-555555555555','Test Balibago','Balibago',100,'{"type":"Point","coordinates":[121.109,14.297]}');

set local role anon;
do $$ begin
  if not exists(select 1 from public.evacuation_centers) then raise exception 'Anonymous public read failed'; end if;
  if has_table_privilege('anon','public.evacuation_centers','INSERT') then raise exception 'Anonymous write privilege leaked'; end if;
  if has_table_privilege('anon','public.admin_accounts','SELECT') then raise exception 'Anonymous admin data leaked'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ declare n integer; begin
  update public.evacuation_centers set occupancy=1 where id='44444444-4444-4444-8444-444444444444';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Own barangay update failed'; end if;
  update public.evacuation_centers set occupancy=1 where id='55555555-5555-4555-8555-555555555555';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-barangay update allowed'; end if;
  update public.admin_accounts set role='citywide' where user_id='22222222-2222-4222-8222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Self escalation allowed'; end if;
  if exists(select 1 from public.admin_accounts where user_id <> auth.uid()) then raise exception 'Other admin records leaked'; end if;
  begin
    update public.evacuation_centers set barangay='Balibago' where id='44444444-4444-4444-8444-444444444444';
    raise exception 'Moving a record outside assigned barangay was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$ declare n integer; begin
  delete from public.evacuation_centers where id='44444444-4444-4444-8444-444444444444';
  get diagnostics n=row_count;
  if n <> 0 then raise exception 'Non-admin delete allowed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ declare n integer; begin
  update public.evacuation_centers set occupancy=2 where id='55555555-5555-4555-8555-555555555555';
  get diagnostics n=row_count;
  if n <> 1 then raise exception 'Citywide update failed'; end if;
  if not exists(select 1 from public.incident_logs where record_id='55555555-5555-4555-8555-555555555555' and action='UPDATE') then raise exception 'Audit history missing'; end if;
  if has_table_privilege('authenticated','public.incident_logs','UPDATE') then raise exception 'Audit mutation allowed'; end if;
  if has_table_privilege('authenticated','public.evacuation_centers','TRUNCATE') then raise exception 'TRUNCATE privilege leaked'; end if;
end $$;
reset role;
rollback;
