import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const folder = 'supabase/sql-editor-setup';
mkdirSync(folder, { recursive: true });
const first = readFileSync('supabase/migrations/001_initial.sql', 'utf8');
const second = readFileSync('supabase/migrations/002_street_hazards.sql', 'utf8');
writeFileSync(`${folder}/00-create-tables.sql`, `-- Run this file first, once on a fresh project.\nbegin;\n${first}\ncommit;\n${second}`);
const source = readFileSync('supabase/roads-only.sql', 'utf8');
const start = source.indexOf('insert into public.roads');
const valuesStart = source.indexOf('\n', start) + 1;
const end = source.indexOf('\non conflict', valuesStart);
const prefix = source.slice(0, valuesStart);
const rows = source.slice(valuesStart, end).split(',\n');
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
writeFileSync(`${folder}/README.md`, `# SQL Editor setup\n\nThe combined file was too large. Run these files individually, in this order. Replace all editor contents between files; do not append them. Wait for success before continuing.\n\n${files.map((name, i) => `${i + 1}. [${name}](${name})`).join('\n')}\n\nRun the table file only once on a fresh database. Street imports preserve existing rows and may be retried. The final street file enables the operational dataset. These files contain no fictional shelters or incidents. If any file fails, stop and report the error.\n`);
console.log(JSON.stringify({ files, roads: rows.length, batches: batches.length }));
