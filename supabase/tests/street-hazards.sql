-- Run in a disposable Supabase database after migrations 001 and 002. Rolls back all fixtures.
begin;
insert into auth.users(id,email) values
 ('61111111-1111-4111-8111-111111111111','street-city@example.invalid'),
 ('62222222-2222-4222-8222-222222222222','street-barangay@example.invalid');
insert into public.admin_accounts(user_id,role,barangay) values
 ('61111111-1111-4111-8111-111111111111','citywide',null),
 ('62222222-2222-4222-8222-222222222222','barangay','Tagapo');
insert into public.roads(id,name,barangay,source,target,geom) values
 ('64444444-4444-4444-8444-444444444444','Test street','Tagapo','test-start','test-end','{"type":"LineString","coordinates":[[121.109,14.297],[121.110,14.297]]}');

select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ begin
  begin
    insert into public.road_hazards(road_id,hazard_type,severity,blocked,notes)
    values('64444444-4444-4444-8444-444444444444','flood',.2,true,'Unauthorized');
    raise exception 'Barangay report publication was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.road_hazards(id,road_id,hazard_type,severity,blocked,notes,barangay,reported_by)
values ('65555555-5555-4555-8555-555555555555','64444444-4444-4444-8444-444444444444','flood',.2,true,'Official street report','Forged area','62222222-2222-4222-8222-222222222222');
do $$ begin
  if not exists(select 1 from public.road_hazards where id='65555555-5555-4555-8555-555555555555' and barangay='Tagapo' and reported_by=auth.uid()) then raise exception 'Report provenance not enforced'; end if;
  if (public.public_snapshot()->>'schemaVersion')::integer <> 2 then raise exception 'Snapshot version missing'; end if;
  if not exists(select 1 from jsonb_array_elements(public.public_snapshot()->'hazards') h where h->>'id'='65555555-5555-4555-8555-555555555555' and h->'geometry'->>'type'='LineString') then raise exception 'Report does not derive street geometry'; end if;
  begin
    insert into public.road_hazards(road_id,hazard_type,severity) values('64444444-4444-4444-8444-444444444444','flood',.5);
    raise exception 'Duplicate active street report allowed';
  exception when unique_violation then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ declare n integer; begin
  update public.road_hazards set active=false where id='65555555-5555-4555-8555-555555555555';
  get diagnostics n=row_count;
  if n <> 0 then raise exception 'Barangay administrator cleared a CDRRMO report'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
set local role authenticated;
update public.road_hazards set active=false where id='65555555-5555-4555-8555-555555555555';
do $$ begin
  if not exists(select 1 from public.incident_logs where record_id='65555555-5555-4555-8555-555555555555' and action='UPDATE') then raise exception 'Clearance was not audited'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.road_hazards where id='65555555-5555-4555-8555-555555555555' and not active) then raise exception 'Public clearance data unavailable'; end if;
  if has_table_privilege('anon','public.hazard_zones','SELECT') then raise exception 'Legacy polygon archive remains public'; end if;
end $$;
reset role;
rollback;
