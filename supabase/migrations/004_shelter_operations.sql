-- Existing projects: run once after migration 003. Preserves all reports and shelters.
begin;
alter table public.evacuation_centers drop constraint evacuation_centers_status_check;
alter table public.evacuation_centers add constraint evacuation_centers_status_check
  check (status in ('open','closed','paused'));
alter table public.evacuation_centers
  add column entrance_verified boolean not null default false,
  add column water_status text not null default 'unknown' check (water_status in ('unknown','adequate','low','unavailable')),
  add column food_status text not null default 'unknown' check (food_status in ('unknown','adequate','low','unavailable')),
  add column medical_status text not null default 'unknown' check (medical_status in ('unknown','adequate','low','unavailable')),
  add column operational_notes text not null default '' check (length(operational_notes) <= 1000);
-- OSM node IDs let routing recognize real junctions without changing reported street IDs.
alter table public.roads add column node_ids text[] not null default '{}';
alter table public.roads add constraint road_node_count check
  (cardinality(node_ids) = 0 or cardinality(node_ids) = jsonb_array_length(geom->'coordinates'));
create function public.reset_road_junctions() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.geom is distinct from old.geom or new.source is distinct from old.source or new.target is distinct from old.target then
    new.node_ids := '{}';
  end if;
  return new;
end;
$$;
create trigger reset_junctions before update of geom,source,target on public.roads
for each row execute function public.reset_road_junctions();
revoke all on function public.reset_road_junctions() from public;
-- Existing barangay/citywide RLS, audit history and server timestamps still apply.
commit;
