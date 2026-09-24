import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('src/data/santa-rosa-roads.json', 'utf8'));
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const rows = data.roads.map(r => `(${[r.id, r.name, r.barangay, r.source, r.target].map(quote).join(',')},0,0,false,${r.oneway},${quote(JSON.stringify(r.geometry))}::jsonb)`);
writeFileSync('supabase/roads-only.sql', `-- OSM streets only; no fictional shelters or incidents. Apply migrations 001 and 002 first.
-- Geometry © OpenStreetMap contributors / ODbL. Coverage is partial and requires local validation.
-- Run on a fresh database. Existing rows are preserved.
begin;
do $$ begin
  if exists(select 1 from public.dataset_metadata where is_demo)
    and (exists(select 1 from public.evacuation_centers) or exists(select 1 from public.road_hazards) or exists(select 1 from public.hazard_zones)) then
    raise exception 'Existing demonstration records detected. Use a fresh project or review and remove fictional records before enabling live data.';
  end if;
end $$;
insert into public.roads(id,name,barangay,source,target,base_cost,condition,blocked,oneway,geom) values
${rows.join(',\n')}
on conflict (id) do nothing;
update public.dataset_metadata set is_demo=false, updated_at=now() where id;
commit;
`);
console.log(`Prepared ${rows.length} streets without shelters or incidents.`);
