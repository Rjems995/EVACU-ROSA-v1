import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const extracts = ['.tools/santa-rosa-osm.json', '.tools/santa-rosa-city-osm.json'].map(read);
const roads = read('src/data/santa-rosa-city-roads.json').roads;
const lookups = extracts.map((raw) => ({
  ways: new Map(raw.elements.filter((e) => e.type === 'way').map((e) => [String(e.id), e])),
  nodes: new Map(raw.elements.filter((e) => e.type === 'node').map((e) => [e.id, [e.lon, e.lat]])),
}));
const records = {};
for (const road of roads) {
  const coords = road.geometry.coordinates;
  for (const lookup of lookups) {
    const way = lookup.ways.get(road.osm_way_id);
    if (!way?.tags?.highway) continue;
    const points = way.nodes.map((id) => lookup.nodes.get(id)?.join(','));
    const indices = coords.map((p) => points.indexOf(p.join(',')));
    if (indices.some((i) => i < 0)) continue;
    const reversed = indices[0] > indices.at(-1);
    if (indices.some((v, i) => i && (reversed ? v >= indices[i - 1] : v <= indices[i - 1])))
      continue;
    const tags = Object.fromEntries(
      Object.entries(way.tags).filter(([k]) =>
        /^(highway|junction|access|foot|bicycle|vehicle|motor_vehicle|motorcycle|motorcar|oneway)(:|$)/.test(
          k,
        ),
      ),
    );
    const signature = createHash('sha256')
      .update(JSON.stringify([road.source, road.target, road.geometry.coordinates]))
      .digest('hex');
    records[road.id] = { signature, tags, reversed };
    break;
  }
}
writeFileSync(
  'src/data/road-access.json',
  JSON.stringify({
    timestamps: extracts.map((e) => e.osm3s.timestamp_osm_base),
    attribution: '© OpenStreetMap contributors, ODbL-1.0',
    records,
  }),
);
console.log(`Access metadata for ${Object.keys(records).length}/${roads.length} roads`);
