import { expect, it } from 'vitest';
import legacy from '../src/data/santa-rosa-roads.json';
import city from '../src/data/santa-rosa-city-roads.json';
import { findRoute, rankShelters } from '../src/lib/routing';
import { schemas } from '../src/lib/validation';
import type { Position, Road, Shelter, Snapshot } from '../src/lib/types';
const a: Position = [121.1, 14.3],
  b: Position = [121.101, 14.3],
  c: Position = [121.102, 14.3],
  d: Position = [121.101, 14.301];
const main: Road = {
  id: 'main',
  name: 'Main',
  barangay: 'Test',
  source: 'a',
  target: 'c',
  base_cost: 0,
  condition: 0,
  blocked: false,
  oneway: false,
  node_ids: ['a', 'b', 'c'],
  geometry: { type: 'LineString', coordinates: [a, b, c] },
};
const branch: Road = {
  ...main,
  id: 'branch',
  source: 'b',
  target: 'd',
  node_ids: ['b', 'd'],
  geometry: { type: 'LineString', coordinates: [b, d] },
};
const shelter: Shelter = {
  id: 's',
  name: 'Test shelter',
  barangay: 'Test',
  capacity: 100,
  occupancy: 10,
  status: 'open',
  accessible: true,
  amenities: [],
  geometry: { type: 'Point', coordinates: d },
};
it('adds city streets while preserving every legacy street ID and geometry', () => {
  const byId = new Map(city.roads.map((r) => [r.id, r]));
  expect(byId.size).toBe(city.roads.length);
  expect(city.roads.length).toBeGreaterThan(legacy.roads.length);
  for (const road of legacy.roads) expect(byId.get(road.id)?.geometry).toEqual(road.geometry);
  for (const road of city.roads)
    expect(road.node_ids.length).toBe(road.geometry.coordinates.length);
  expect(city.shelters).toEqual([]);
  expect(city.hazards).toEqual([]);
});
it('connects an added street at an internal OSM junction without changing the old report ID', () => {
  const route = findRoute([main, branch], [], a, d);
  expect(route?.roadIds).toEqual(['main', 'branch']);
  expect(route?.coordinates).toEqual([a, b, d]);
  expect(findRoute([{ ...main, blocked: true }, branch], [], a, d)).toBeNull();
  expect(findRoute([main, { ...branch, node_ids: [] }], [], a, d)?.roadIds).toEqual([
    'main',
    'branch',
  ]);
  expect(findRoute([{ ...main, oneway: true }, branch], [], d, a)).toBeNull();
});
it('does not invent a junction when geometries coincide but OSM node IDs differ', () => {
  const separate = { ...branch, source: 'other', node_ids: ['other', 'd'] };
  expect(findRoute([main, separate], [], a, d)).toBeNull();
});
it('excludes temporarily paused shelters and preserves an open alternative', () => {
  const snapshot: Snapshot = {
    schemaVersion: 2,
    demo: false,
    roads: [main, branch],
    hazards: [],
    boundaries: [],
    syncedAt: '2026-09-25T00:00:00Z',
    shelters: [
      { ...shelter, status: 'paused' },
      { ...shelter, id: 'open' },
    ],
  };
  expect(rankShelters(snapshot, a).map((r) => r.shelter.id)).toEqual(['open']);
});
it('validates staff supplies, entrance confirmation and occupancy independently', () => {
  expect(
    schemas.evacuation_centers.safeParse({
      ...shelter,
      status: 'paused',
      water_status: 'low',
      entrance_verified: true,
    }).success,
  ).toBe(true);
  expect(
    schemas.evacuation_centers.safeParse({ ...shelter, food_status: 'invented' }).success,
  ).toBe(false);
  expect(schemas.evacuation_centers.safeParse({ ...shelter, occupancy: 101 }).success).toBe(false);
  expect(
    schemas.evacuation_centers.safeParse({ ...shelter, operational_notes: 'x'.repeat(1001) })
      .success,
  ).toBe(false);
});
