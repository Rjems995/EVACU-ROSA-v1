// Add citywide OSM streets without renumbering streets with existing hazard reports.
// Input: area(3601335521);way[highway](area);out body;>;out skel qt;
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = process.argv[2];
if (!path) throw Error('Usage: node scripts/expand-city-roads.mjs <city-overpass.json>');
const raw = JSON.parse(readFileSync(path, 'utf8'));
if (raw.remark) throw Error(raw.remark);
const legacy = JSON.parse(readFileSync('src/data/santa-rosa-roads.json', 'utf8'));
const nodes = new Map(
  raw.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lon, n.lat]]),
);
// Use the original way's node IDs, never coordinate coincidence across bridges or levels.
const saved = existsSync('src/data/santa-rosa-city-roads.json')
  ? JSON.parse(readFileSync('src/data/santa-rosa-city-roads.json', 'utf8'))
  : { roads: [] };
if (saved.osmTimestamp && saved.osmTimestamp !== raw.osm3s?.timestamp_osm_base)
  throw Error(
    'This upgrade is pinned to its original OSM extract. A newer extract needs a reviewed migration so existing incident-linked roads cannot be duplicated.',
  );
const savedRoads = new Map(saved.roads.map((r) => [r.id, r]));
const originalPath = process.argv[3] || '.tools/santa-rosa-osm.json';
const original = existsSync(originalPath)
  ? JSON.parse(readFileSync(originalPath, 'utf8').replace(/^\uFEFF/, ''))
  : { elements: [] };
const originalNodes = new Map(
  original.elements.filter((e) => e.type === 'node').map((n) => [n.id, [n.lon, n.lat]]),
);
const originalWays = new Map(
  original.elements.filter((e) => e.type === 'way').map((w) => [String(w.id), w]),
);
const allowed = new Set([
  'residential',
  'living_street',
  'service',
  'unclassified',
  'tertiary',
  'tertiary_link',
  'secondary',
  'secondary_link',
  'primary',
  'primary_link',
  'footway',
  'path',
  'pedestrian',
  'steps',
  'track',
]);
const ways = raw.elements.filter(
  (e) =>
    e.type === 'way' &&
    allowed.has(e.tags?.highway) &&
    !['no', 'private'].includes(e.tags.foot ?? e.tags.access) &&
    !['yes', 'private'].includes(e.tags.area),
);
const permittedWayIds = new Set(ways.map((w) => String(w.id)));
const pair = (a, b) => [a, b].sort().join(':');
const covered = new Set();
const roads = legacy.roads.map((r) => {
  const way = originalWays.get(r.osm_way_id);
  const coordinateIds = new Map(
    (way?.nodes || []).map((id) => [originalNodes.get(id)?.join(','), String(id)]),
  );
  const previous = savedRoads.get(r.id);
  const node_ids =
    previous?.node_ids?.length === r.geometry.coordinates.length &&
    JSON.stringify(previous.geometry) === JSON.stringify(r.geometry)
      ? [...previous.node_ids]
      : r.geometry.coordinates.map((xy) => coordinateIds.get(xy.join(',')) || '');
  node_ids[0] = r.source;
  node_ids[node_ids.length - 1] = r.target;
  if (node_ids.some((id) => !id))
    throw Error(`Cannot match legacy street ${r.id}; review OSM changes before importing.`);
  for (let i = 1; i < node_ids.length; i++) covered.add(pair(node_ids[i - 1], node_ids[i]));
  // Keep legacy IDs, geometry and report associations intact, even if access tags changed.
  return { ...r, node_ids };
});
const uses = new Map();
for (const way of ways) for (const id of new Set(way.nodes)) uses.set(id, (uses.get(id) || 0) + 1);
const uuid = (value) => {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
for (const way of ways) {
  let ids = [];
  const flush = () => {
    if (ids.length < 2) {
      ids = [];
      return;
    }
    if (ids[0] === ids.at(-1)) {
      const ring = ids;
      const middle = Math.floor(ring.length / 2);
      if (middle < 1 || ring.length < 4) {
        ids = [];
        return;
      }
      ids = ring.slice(0, middle + 1);
      flush();
      ids = ring.slice(middle);
      flush();
      return;
    }
    const reverse = way.tags['oneway:foot'] === '-1';
    if (reverse) ids.reverse();
    const node_ids = ids.map(String);
    if (ids[0] !== ids.at(-1))
      roads.push({
        id: uuid(`city-osm-${way.id}-${node_ids.join('-')}`),
        name: way.tags.name || `Unnamed ${way.tags.highway} (OSM ${way.id})`,
        barangay: 'Unassigned — verify with CDRRMO',
        source: node_ids[0],
        target: node_ids.at(-1),
        base_cost: 0,
        condition: 0,
        blocked: false,
        oneway: ['yes', '1', '-1'].includes(way.tags['oneway:foot']),
        geometry: { type: 'LineString', coordinates: ids.map((id) => nodes.get(id)) },
        osm_way_id: String(way.id),
        node_ids,
      });
    ids = [];
  };
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1],
      b = way.nodes[i];
    if (covered.has(pair(String(a), String(b))) || !nodes.has(a) || !nodes.has(b)) {
      flush();
      continue;
    }
    if (!ids.length) ids.push(a);
    ids.push(b);
    if ((uses.get(b) || 0) > 1) flush();
  }
  flush();
}
const dataset = {
  schemaVersion: 2,
  demo: false,
  setupRequired: true,
  shelters: [],
  hazards: [],
  boundaries: [],
  syncedAt: raw.osm3s.timestamp_osm_base,
  osmTimestamp: raw.osm3s.timestamp_osm_base,
  attribution: '© OpenStreetMap contributors',
  license: 'ODbL-1.0',
  source: 'https://www.openstreetmap.org/relation/1335521',
  roads,
};
writeFileSync('src/data/santa-rosa-city-roads.json', JSON.stringify(dataset));
// Existing roads remain unchanged in Supabase. Populate junction IDs only when geometry matches.
const quote = (x) => "'" + String(x).replaceAll("'", "''") + "'";
const rows = roads.map(
  (r) =>
    `(${[r.id, r.name, r.barangay, r.source, r.target].map(quote).join(',')},${r.oneway},${quote(JSON.stringify(r.geometry))}::jsonb,array[${r.node_ids.map(quote).join(',')}])`,
);
const batches = [];
let batch = [],
  bytes = 0;
for (const row of rows) {
  if (bytes + Buffer.byteLength(row) > 165000 && batch.length) {
    batches.push(batch);
    batch = [];
    bytes = 0;
  }
  batch.push(row);
  bytes += Buffer.byteLength(row) + 2;
}
if (batch.length) batches.push(batch);
mkdirSync('supabase/city-road-upgrade', { recursive: true });
batches.forEach((rows, i) =>
  writeFileSync(
    `supabase/city-road-upgrade/${String(i + 1).padStart(2, '0')}-streets.sql`,
    `-- Apply migration 004 first. Additive import; preserves existing reports and road conditions.\nbegin;\ninsert into public.roads(id,name,barangay,source,target,oneway,geom,node_ids) values\n${rows.join(',\n')}\non conflict(id) do update set node_ids=excluded.node_ids where roads.geom=excluded.geom and roads.source=excluded.source and roads.target=excluded.target and roads.node_ids is distinct from excluded.node_ids;\ncommit;\n`,
  ),
);
const review = legacy.roads
  .filter((r) => !permittedWayIds.has(r.osm_way_id))
  .map((r) => ({ id: r.id, name: r.name, osm_way_id: r.osm_way_id }));
writeFileSync(
  'supabase/city-road-upgrade/README.md',
  `# City street upgrade\n\nRun migration 004 first, then all ${batches.length} numbered SQL files in order. Replace SQL Editor contents between files. Existing reports, road conditions, shelter records and street IDs are preserved. Do not rerun table creation. Imports can be retried.\n\n${legacy.roads.length} existing segments plus ${roads.length - legacy.roads.length} additional OSM street/footpath segments. Disconnected components are retained; no connectors are invented. Area query uses Santa Rosa relation 1335521; ways crossing the city edge may extend beyond it. Coverage depends on OSM and is not a completeness or passability guarantee. New paths exclude mapped private/no foot access and motorways. Existing streets require local review: ${review.length} legacy segments were not in the current permitted walking extract. Their live conditions are never overwritten.\n\n${batches
    .map((_, i) => {
      const name = String(i + 1).padStart(2, '0') + '-streets.sql';
      return `${i + 1}. [${name}](${name})`;
    })
    .join(
      '\n',
    )}\n\nReproduce: node scripts/expand-city-roads.mjs <city-overpass.json>. Data © OpenStreetMap contributors, ODbL. Source: https://www.openstreetmap.org/relation/1335521\n`,
);
writeFileSync(
  'supabase/city-road-upgrade/legacy-access-review.json',
  JSON.stringify(review, null, 2),
);
console.log(
  JSON.stringify({
    existing: legacy.roads.length,
    total: roads.length,
    added: roads.length - legacy.roads.length,
    batches: batches.length,
    legacyReview: review.length,
  }),
);
