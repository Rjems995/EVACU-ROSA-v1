import type { Boundary, Hazard, Position, Road, Shelter, Snapshot } from './types';
export const DEMO_ORIGIN: Position = [121.109, 14.297];
// Synthetic training grid. These are not surveyed streets or approved evacuation sites.
const node = (x: number, y: number): Position => [121.085 + x * 0.006, 14.279 + y * 0.006];
const names = [
  'City Sports Complex',
  'Balibago Community Hall',
  'Tagapo Covered Court',
  'Pulong Santa Cruz Center',
  'Dita Community School',
  'Aplaya Community Center',
];
const sites = [
  [4, 4],
  [2, 2],
  [6, 4],
  [1, 1],
  [5, 1],
  [7, 5],
];
const barangays = ['Tagapo', 'Balibago', 'Tagapo', 'Pulong Santa Cruz', 'Dita', 'Aplaya'];
const shelters: Shelter[] = sites.map(([x, y], i) => ({
  id: `shelter-${i + 1}`,
  name: names[i],
  barangay: barangays[i],
  geometry: { type: 'Point', coordinates: node(x, y) },
  capacity: [500, 250, 350, 200, 300, 180][i],
  occupancy: [128, 211, 94, 52, 300, 40][i],
  status: 'open',
  accessible: i !== 3,
  amenities: ['Drinking water', 'Toilets', ...(i % 2 === 0 ? ['First aid'] : [])],
}));
const roads: Road[] = [];
for (let x = 0; x < 8; x++)
  for (let y = 0; y < 6; y++) {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      if (x + dx >= 8 || y + dy >= 6) continue;
      roads.push({
        id: `road-${x}-${y}-${dx}-${dy}`,
        name: `Training link ${x}-${y}`,
        barangay: 'Tagapo',
        source: `${x}-${y}`,
        target: `${x + dx}-${y + dy}`,
        base_cost: 0,
        condition: x === 5 && y === 2 ? 0.55 : 0.05,
        blocked: false,
        oneway: false,
        geometry: { type: 'LineString', coordinates: [node(x, y), node(x + dx, y + dy)] },
      });
    }
  }
const rectangle = (west: number, south: number, east: number, north: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});
const hazards: Hazard[] = [
  {
    id: 'hazard-1',
    name: 'Flood-prone lakeside area',
    barangay: 'Aplaya',
    hazard_type: 'flood',
    severity: 0.9,
    active: true,
    updated_at: '2026-01-01T00:00:00Z',
    geometry: rectangle(121.122, 14.3, 121.133, 14.316),
  },
  {
    id: 'hazard-2',
    name: 'Reported structure fire',
    barangay: 'Balibago',
    hazard_type: 'fire',
    severity: 0.9,
    active: true,
    updated_at: '2026-01-01T00:00:00Z',
    geometry: rectangle(121.089, 14.294, 121.096, 14.301),
  },
  {
    id: 'hazard-3',
    name: 'Earthquake inspection area',
    barangay: 'Dita',
    hazard_type: 'earthquake',
    severity: 0.55,
    active: true,
    updated_at: '2026-01-01T00:00:00Z',
    geometry: rectangle(121.113, 14.281, 121.121, 14.287),
  },
];
const boundaries: Boundary[] = [
  {
    id: 'city',
    name: 'Illustrative study area',
    kind: 'city',
    geometry: rectangle(121.081, 14.275, 121.135, 14.316),
  },
  {
    id: 'b1',
    name: 'Illustrative west sector',
    kind: 'barangay',
    geometry: rectangle(121.081, 14.275, 121.107, 14.316),
  },
  {
    id: 'b2',
    name: 'Illustrative east sector',
    kind: 'barangay',
    geometry: rectangle(121.107, 14.275, 121.135, 14.316),
  },
];
export function demoSnapshot(): Snapshot {
  return { shelters, roads, hazards, boundaries, demo: true, syncedAt: '2026-01-01T00:00:00Z' };
}
