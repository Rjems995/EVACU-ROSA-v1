// Reproducible demo extract conversion. Input: Overpass `way...;out body;>;out skel qt;`.
// OSM data: © OpenStreetMap contributors, ODbL 1.0. Not field-verified evacuation data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/import-osm.mjs <overpass-json>');
const raw = JSON.parse(readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
if (raw.remark) throw new Error(raw.remark);
const nodes = new Map(
  raw.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lon, n.lat]]),
);
const ways = raw.elements.filter((e) => e.type === 'way');
const uses = new Map();
for (const way of ways)
  for (const node of new Set(way.nodes)) uses.set(node, (uses.get(node) || 0) + 1);
function uuid(value) {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const roads = [];
for (const way of ways) {
  let start = 0;
  for (let end = 1; end < way.nodes.length; end++) {
    if (end !== way.nodes.length - 1 && uses.get(way.nodes[end]) < 2) continue;
    const ids = way.nodes.slice(start, end + 1),
      coordinates = ids.map((id) => nodes.get(id));
    if (coordinates.every(Boolean) && ids[0] !== ids.at(-1)) {
      const reverse = way.tags?.['oneway:foot'] === '-1';
      if (reverse) {
        ids.reverse();
        coordinates.reverse();
      }
      roads.push({
        id: uuid(`osm-${way.id}-${start}-${end}`),
        name: way.tags?.name || `Unnamed ${way.tags?.highway || 'street'} (OSM ${way.id})`,
        barangay: 'Unassigned — verify with CDRRMO',
        source: String(ids[0]),
        target: String(ids.at(-1)),
        base_cost: 0,
        condition: 0,
        blocked: false,
        oneway: ['yes', '1', '-1'].includes(way.tags?.['oneway:foot']),
        geometry: { type: 'LineString', coordinates },
        osm_way_id: String(way.id),
      });
    }
    start = end;
  }
}
// Retain the largest connected sample component; don't invent connectors between roads.
const adj = new Map();
for (const r of roads) {
  adj.set(r.source, [...(adj.get(r.source) || []), r.target]);
  adj.set(r.target, [...(adj.get(r.target) || []), r.source]);
}
const visited = new Set();
let largest = new Set();
for (const start of adj.keys()) {
  if (visited.has(start)) continue;
  const component = new Set([start]),
    pending = [start];
  visited.add(start);
  while (pending.length)
    for (const next of adj.get(pending.pop()) || [])
      if (!visited.has(next)) {
        visited.add(next);
        component.add(next);
        pending.push(next);
      }
  if (component.size > largest.size) largest = component;
}
const connected = roads.filter((r) => largest.has(r.source));
const dataset = {
  attribution: '© OpenStreetMap contributors',
  license: 'ODbL-1.0',
  source: 'https://www.openstreetmap.org/copyright',
  osmTimestamp: raw.osm3s.timestamp_osm_base,
  bbox: [121.08, 14.28, 121.135, 14.335],
  roads: connected,
};
const graphPoints = [
  ...new Map(
    connected.flatMap((r) => [
      [r.source, r.geometry.coordinates[0]],
      [r.target, r.geometry.coordinates.at(-1)],
    ]),
  ).values(),
];
const nearest = (point) =>
  graphPoints.reduce((best, p) =>
    Math.hypot(p[0] - point[0], p[1] - point[1]) <
    Math.hypot(best[0] - point[0], best[1] - point[1])
      ? p
      : best,
  );
const shelters = [
  ['City Sports Complex', 'Tagapo', [121.109, 14.303], 500, 128],
  ['Balibago Community Hall', 'Balibago', [121.097, 14.291], 250, 211],
  ['Tagapo Covered Court', 'Tagapo', [121.121, 14.303], 350, 94],
  ['Pulong Santa Cruz Center', 'Pulong Santa Cruz', [121.091, 14.285], 200, 52],
  ['Dita Community School', 'Dita', [121.115, 14.285], 300, 300],
  ['Aplaya Community Center', 'Aplaya', [121.127, 14.309], 180, 40],
].map(([name, barangay, position, capacity, occupancy], i) => ({
  id: uuid(`demo-shelter-${i}`),
  name,
  barangay,
  capacity,
  occupancy,
  status: 'open',
  accessible: i !== 3,
  amenities: ['Drinking water', 'Toilets', ...(i % 2 === 0 ? ['First aid'] : [])],
  geometry: { type: 'Point', coordinates: nearest(position) },
}));
const hazards = [
  ['Tatlong Hari Street', 'flood', 0.9, true],
  ['Rizal Boulevard', 'fire', 0.9, true],
  ['Doctor Zavalla Street', 'earthquake', 0.55, false],
].map(([street, hazard_type, severity, blocked], i) => {
  const road = connected
    .filter((r) => r.name === street)
    .sort((a, b) => b.geometry.coordinates.length - a.geometry.coordinates.length)[0];
  if (!road) throw new Error(`Missing sample street: ${street}`);
  return {
    id: uuid(`demo-hazard-${i}`),
    road_id: road.id,
    name: road.name,
    barangay: road.barangay,
    hazard_type,
    severity,
    blocked,
    active: true,
    notes: 'Demonstration incident only — not an actual CDRRMO report.',
    updated_at: raw.osm3s.timestamp_osm_base,
    geometry: road.geometry,
  };
});
Object.assign(dataset, {
  shelters,
  hazards,
  boundaries: [],
  demo: true,
  schemaVersion: 2,
  syncedAt: raw.osm3s.timestamp_osm_base,
});
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/santa-rosa-roads.json', JSON.stringify(dataset));
const origin = nearest([121.109, 14.297]);
writeFileSync(
  'src/lib/constants.ts',
  `import type { Position } from './types';\nexport const DEMO_ORIGIN: Position = ${JSON.stringify(origin)};\n`,
);
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => quote(JSON.stringify(value)) + '::jsonb';
let sql =
  '-- DEMONSTRATION ONLY. Apply migrations 001 and 002 first, then run on a fresh disposable database.\n-- Road geometries © OpenStreetMap contributors / ODbL 1.0. Reports and shelter sites are fictional.\n-- Source: https://www.openstreetmap.org/copyright ; OSM timestamp: ' +
  dataset.osmTimestamp +
  '\nbegin;\n';
sql +=
  'insert into public.roads(id,name,barangay,source,target,base_cost,condition,blocked,oneway,geom) values\n' +
  connected
    .map(
      (r) =>
        `(${[r.id, r.name, r.barangay, r.source, r.target].map(quote).join(',')},0,0,false,${r.oneway},${json(r.geometry)})`,
    )
    .join(',\n') +
  ';\n';
sql +=
  'insert into public.evacuation_centers(id,name,barangay,capacity,occupancy,status,accessible,amenities,geom) values\n' +
  shelters
    .map(
      (s) =>
        `(${[s.id, s.name, s.barangay].map(quote).join(',')},${s.capacity},${s.occupancy},'open',${s.accessible},array[${s.amenities.map(quote).join(',')}],${json(s.geometry)})`,
    )
    .join(',\n') +
  ';\n';
sql +=
  'insert into public.road_hazards(id,road_id,hazard_type,severity,blocked,active,notes) values\n' +
  hazards
    .map(
      (h) =>
        `(${[h.id, h.road_id, h.hazard_type].map(quote).join(',')},${h.severity},${h.blocked},true,${quote(h.notes)})`,
    )
    .join(',\n') +
  ';\ncommit;\n';
writeFileSync('supabase/seed.sql', sql);
console.log(
  JSON.stringify({
    roads: connected.length,
    nodes: largest.size,
    timestamp: dataset.osmTimestamp,
    namedExamples: [
      ...new Set(connected.filter((r) => !r.name.startsWith('Unnamed')).map((r) => r.name)),
    ].slice(0, 35),
  }),
);
