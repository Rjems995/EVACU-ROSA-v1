import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const folder = 'supabase/sql-editor-setup';
mkdirSync(folder, { recursive: true });
const first = readFileSync('supabase/migrations/001_initial.sql', 'utf8');
const second = readFileSync('supabase/migrations/002_street_hazards.sql', 'utf8');
writeFileSync(`${folder}/00-create-tables.sql`, `-- Run this file first, once on a fresh project.\nbegin;\n${first}\ncommit;\n${second}`);
const data = JSON.parse(readFileSync('src/data/santa-rosa-roads.json', 'utf8'));
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const rows = data.roads.map(r => `(${[r.id, r.name, r.barangay, r.source, r.target].map(quote).join(',')},0,0,false,${r.oneway},${quote(JSON.stringify(r.geometry))}::jsonb)`);
const prefix = `-- OSM streets only; no fictional shelters or incidents. Apply migrations 001 and 002 first.
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
`;
const batches = [];
let batch = [], size = 0;
for (const row of rows) {
  const bytes = Buffer.byteLength(row, 'utf8') + 2;
  if (size + bytes > 175000 && batch.length) { batches.push(batch); batch = []; size = 0; }
  batch.push(row); size += bytes;
}
if (batch.length) batches.push(batch);
const files = ['00-create-tables.sql'];
batches.forEach((batch, i) => {
  const name = `${String(i + 1).padStart(2, '0')}-import-streets.sql`;
  const activation = i === batches.length - 1 ? 'update public.dataset_metadata set is_demo=false, updated_at=now() where id;\n' : '';
  const sql = `${prefix}${batch.join(',\n')}\non conflict (id) do nothing;\n${activation}commit;\n`;
  if (Buffer.byteLength(sql) >= 180000) throw new Error('Batch exceeds intended size');
  writeFileSync(`${folder}/${name}`, sql);
  files.push(name);
});
writeFileSync(`${folder}/README.md`, `# SQL Editor setup\n\nRegenerate these files with \`npm run prepare:database\`. Run them individually, in this order. Replace all editor contents between files; do not append them. Wait for success before continuing.\n\n${files.map((name, i) => `${i + 1}. [${name}](${name})`).join('\n')}\n\nRun the table file only once on a fresh database. Street imports preserve existing rows and may be retried. The final street file enables the operational dataset. These files contain no fictional shelters or incidents. If any file fails, stop and report the error.\n\nFor assistance alerts, also apply [migration 003](../migrations/003_assistance_requests.sql) once. Existing projects should apply only missing migrations, not rerun table creation.\n`);
console.log(JSON.stringify({ files, roads: rows.length, batches: batches.length }));
