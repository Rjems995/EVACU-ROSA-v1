-- Run this file first, once on a fresh project.
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
grant usage on schema extensions to anon, authenticated;
set search_path = public, extensions;

create table public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('barangay','citywide')),
  barangay text,
  check (role = 'citywide' or length(trim(barangay)) > 0 and barangay is not null)
);

create table public.evacuation_centers (
  id uuid primary key default gen_random_uuid(), name text not null, barangay text not null,
  capacity integer not null check (capacity > 0), occupancy integer not null default 0 check (occupancy >= 0 and occupancy <= capacity),
  status text not null default 'open' check (status in ('open','closed')),
  accessible boolean not null default false, amenities text[] not null default '{}',
  geom jsonb not null,
  location extensions.geometry(Point,4326) generated always as (extensions.st_setsrid(extensions.st_geomfromgeojson(geom),4326)) stored,
  updated_at timestamptz not null default now()
);
create table public.roads (
  id uuid primary key default gen_random_uuid(), name text not null, barangay text not null,
  source text not null, target text not null,
  base_cost double precision not null default 0 check (base_cost >= 0),
  condition double precision not null default 0 check (condition between 0 and 1),
  blocked boolean not null default false, oneway boolean not null default false,
  geom jsonb not null,
  location extensions.geometry(LineString,4326) generated always as (extensions.st_setsrid(extensions.st_geomfromgeojson(geom),4326)) stored,
  updated_at timestamptz not null default now(), check (source <> target)
);
create table public.hazard_zones (
  id uuid primary key default gen_random_uuid(), name text not null, barangay text not null,
  hazard_type text not null check (hazard_type in ('flood','fire','earthquake')),
  severity double precision not null check (severity between 0 and 1), active boolean not null default true,
  geom jsonb not null,
  location extensions.geometry(Polygon,4326) generated always as (extensions.st_setsrid(extensions.st_geomfromgeojson(geom),4326)) stored,
  updated_at timestamptz not null default now(), check (extensions.st_isvalid(location))
);
create table public.barangay_boundaries (
  id uuid primary key default gen_random_uuid(), name text not null,
  kind text not null check (kind in ('city','barangay')), geom jsonb not null,
  location extensions.geometry(Polygon,4326) generated always as (extensions.st_setsrid(extensions.st_geomfromgeojson(geom),4326)) stored,
  check (extensions.st_isvalid(location))
);
create table public.incident_logs (
  id bigint generated always as identity primary key,
  resource text not null, record_id uuid not null, action text not null,
  barangay text, actor uuid references auth.users(id) on delete set null,
  before_record jsonb, after_record jsonb, created_at timestamptz not null default now()
);
create table public.dataset_metadata (
  id boolean primary key default true check (id), is_demo boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.dataset_metadata(id,is_demo) values (true,true);
create index on public.evacuation_centers using gist(location);
create index on public.roads using gist(location);
create index on public.hazard_zones using gist(location);
create index on public.barangay_boundaries using gist(location);
create index on public.roads(source);
create index on public.roads(target);
create index on public.incident_logs(barangay,created_at desc);

-- Security-definer helpers only read the trusted role table, never user metadata.
create function public.is_city_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_accounts where user_id = (select auth.uid()) and role = 'citywide');
$$;
create function public.can_manage(area text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_accounts where user_id = (select auth.uid()) and (role = 'citywide' or barangay = area));
$$;
revoke all on function public.is_city_admin() from public;
revoke all on function public.can_manage(text) from public;
grant execute on function public.is_city_admin(), public.can_manage(text) to authenticated;

alter table public.admin_accounts enable row level security;
alter table public.evacuation_centers enable row level security;
alter table public.roads enable row level security;
alter table public.hazard_zones enable row level security;
alter table public.barangay_boundaries enable row level security;
alter table public.incident_logs enable row level security;
alter table public.dataset_metadata enable row level security;

create policy admin_read on public.admin_accounts for select to authenticated using (user_id = (select auth.uid()) or public.is_city_admin());
create policy admin_insert on public.admin_accounts for insert to authenticated with check (public.is_city_admin() and user_id <> (select auth.uid()));
create policy admin_update on public.admin_accounts for update to authenticated using (public.is_city_admin() and user_id <> (select auth.uid())) with check (public.is_city_admin() and user_id <> (select auth.uid()));
create policy admin_delete on public.admin_accounts for delete to authenticated using (public.is_city_admin() and user_id <> (select auth.uid()));

create policy public_read on public.evacuation_centers for select to anon, authenticated using (true);
create policy manage on public.evacuation_centers for all to authenticated using (public.can_manage(barangay)) with check (public.can_manage(barangay));
create policy public_read on public.roads for select to anon, authenticated using (true);
create policy manage on public.roads for all to authenticated using (public.can_manage(barangay)) with check (public.can_manage(barangay));
create policy public_read on public.hazard_zones for select to anon, authenticated using (true);
create policy manage on public.hazard_zones for all to authenticated using (public.can_manage(barangay)) with check (public.can_manage(barangay));
create policy public_read on public.barangay_boundaries for select to anon, authenticated using (true);
create policy manage on public.barangay_boundaries for all to authenticated using (public.is_city_admin()) with check (public.is_city_admin());
create policy history_read on public.incident_logs for select to authenticated using (public.can_manage(barangay));
create policy public_read on public.dataset_metadata for select to anon, authenticated using (true);
-- Only a database operator can certify a dataset by switching is_demo off.
revoke all on public.evacuation_centers, public.roads, public.hazard_zones, public.barangay_boundaries, public.dataset_metadata, public.admin_accounts, public.incident_logs from anon, authenticated;
grant select on public.evacuation_centers, public.roads, public.hazard_zones, public.barangay_boundaries, public.dataset_metadata to anon, authenticated;
grant insert, update, delete on public.evacuation_centers, public.roads, public.hazard_zones, public.barangay_boundaries to authenticated;
grant select, insert, update, delete on public.admin_accounts to authenticated;
grant select on public.incident_logs to authenticated;
revoke all on public.admin_accounts, public.incident_logs from anon;
revoke insert, update, delete on public.incident_logs, public.dataset_metadata from authenticated;

create function public.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.incident_logs(resource,record_id,action,barangay,actor,before_record,after_record)
  values (tg_table_name, coalesce(new.id,old.id), tg_op, coalesce(new.barangay,old.barangay), auth.uid(),
    case when tg_op <> 'INSERT' then to_jsonb(old) - 'location' end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - 'location' end);
  update public.dataset_metadata set updated_at = now() where id;
  return coalesce(new,old);
end;
$$;
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger audit after insert or update or delete on public.hazard_zones for each row execute function public.audit_change();
create trigger audit after insert or update or delete on public.roads for each row execute function public.audit_change();
create trigger audit after insert or update or delete on public.evacuation_centers for each row execute function public.audit_change();
create trigger touch before update on public.hazard_zones for each row execute function public.touch_updated_at();
create trigger touch before update on public.roads for each row execute function public.touch_updated_at();
create trigger touch before update on public.evacuation_centers for each row execute function public.touch_updated_at();
revoke all on function public.audit_change(), public.touch_updated_at() from public;

-- One transactionally consistent, PostGIS-derived public snapshot; RLS still applies.
create function public.public_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'shelters', coalesce((select jsonb_agg((to_jsonb(s) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(s.location)::jsonb)) from public.evacuation_centers s),'[]'::jsonb),
    'roads', coalesce((select jsonb_agg((to_jsonb(r) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(r.location)::jsonb)) from public.roads r),'[]'::jsonb),
    'hazards', coalesce((select jsonb_agg((to_jsonb(h) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(h.location)::jsonb)) from public.hazard_zones h),'[]'::jsonb),
    'boundaries', coalesce((select jsonb_agg((to_jsonb(b) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(b.location)::jsonb)) from public.barangay_boundaries b),'[]'::jsonb),
    'demo', coalesce((select is_demo from public.dataset_metadata where id),true),
    'syncedAt', (select updated_at from public.dataset_metadata where id)
  );
$$;
revoke all on function public.public_snapshot() from public;
grant execute on function public.public_snapshot() to anon, authenticated;

commit;
-- Keep old polygon records as an administrator-only archive; do not guess affected streets.
begin;
drop policy public_read on public.hazard_zones;
drop policy manage on public.hazard_zones;
create policy legacy_city_read on public.hazard_zones for select to authenticated using (public.is_city_admin());
revoke all on public.hazard_zones from anon, authenticated;
grant select on public.hazard_zones to authenticated;

create table public.road_hazards (
  id uuid primary key default gen_random_uuid(),
  road_id uuid not null references public.roads(id) on delete restrict,
  barangay text not null,
  hazard_type text not null check (hazard_type in ('flood','fire','earthquake')),
  severity double precision not null check (severity between 0 and 1),
  blocked boolean not null default true,
  active boolean not null default true,
  notes text not null default '' check (length(notes) <= 1000),
  reported_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index on public.road_hazards(road_id);
create unique index one_active_report_per_type on public.road_hazards(road_id,hazard_type) where active;
alter table public.road_hazards enable row level security;
revoke all on public.road_hazards from anon, authenticated;
grant select on public.road_hazards to anon, authenticated;
grant insert,update,delete on public.road_hazards to authenticated;
create policy public_read on public.road_hazards for select to anon, authenticated using (true);
create policy cdrrmo_manage on public.road_hazards for all to authenticated
  using (public.is_city_admin()) with check (public.is_city_admin());

create function public.set_report_road() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select barangay into new.barangay from public.roads where id = new.road_id;
  if not found then raise exception 'Select an existing street segment' using errcode='23503'; end if;
  -- The caller cannot spoof the author or area of a report.
  if auth.uid() is not null then new.reported_by = auth.uid(); end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_report_road() from public;
create trigger report_road before insert or update on public.road_hazards for each row execute function public.set_report_road();
create trigger audit after insert or update or delete on public.road_hazards for each row execute function public.audit_change();

create or replace function public.public_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'schemaVersion', 2,
    'shelters', coalesce((select jsonb_agg((to_jsonb(s) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(s.location)::jsonb)) from public.evacuation_centers s),'[]'::jsonb),
    'roads', coalesce((select jsonb_agg((to_jsonb(r) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(r.location)::jsonb)) from public.roads r),'[]'::jsonb),
    'hazards', coalesce((select jsonb_agg(to_jsonb(h) || jsonb_build_object('name',r.name,'barangay',r.barangay,'geometry',extensions.st_asgeojson(r.location)::jsonb)) from public.road_hazards h join public.roads r on r.id=h.road_id),'[]'::jsonb),
    'boundaries', coalesce((select jsonb_agg((to_jsonb(b) - 'location' - 'geom') || jsonb_build_object('geometry',extensions.st_asgeojson(b.location)::jsonb)) from public.barangay_boundaries b),'[]'::jsonb),
    'demo', coalesce((select is_demo from public.dataset_metadata where id),true),
    'syncedAt', (select updated_at from public.dataset_metadata where id)
  );
$$;
update public.dataset_metadata set updated_at=now() where id;
commit;
