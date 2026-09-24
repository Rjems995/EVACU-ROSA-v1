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
