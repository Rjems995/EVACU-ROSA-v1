import { describe, expect, it } from 'vitest';
import { fuzzyRisk, membership } from '../src/lib/fuzzy';
import { demoSnapshot, DEMO_ORIGIN } from '../src/lib/demo';
import { findRoute, rankShelters, segmentRisk, shelterStatus } from '../src/lib/routing';
import type { Hazard, Position, Road } from '../src/lib/types';
const positions: Record<string, Position> = {
  a: [121, 14],
  b: [121.001, 14],
  c: [121, 14.0004],
  d: [121.001, 14.0004],
};
const edge = (source: string, target: string, overrides: Partial<Road> = {}): Road => ({
  id: source + target,
  name: source + target,
  barangay: 'Test',
  source,
  target,
  base_cost: 0,
  condition: 0,
  blocked: false,
  oneway: false,
  geometry: { type: 'LineString', coordinates: [positions[source], positions[target]] },
  ...overrides,
});
describe('Mamdani risk scoring', () => {
  it('covers membership endpoints and overlapping midpoints', () => {
    expect(membership(0)).toEqual({ low: 1, medium: 0, high: 0 });
    expect(membership(0.5)).toEqual({ low: 0, medium: 1, high: 0 });
    expect(membership(1)).toEqual({ low: 0, medium: 0, high: 1 });
  });
  it('classifies clear roads as low and severe hazards as high', () => {
    expect(fuzzyRisk({ flood: 0, fire: 0, condition: 0, exposure: 0 }).score).toBeLessThan(20);
    expect(fuzzyRisk({ flood: 1, fire: 0, condition: 0, exposure: 0 }).score).toBeGreaterThan(80);
  });
  it('elevates earthquake exposure without flood or fire', () => {
    expect(fuzzyRisk({ flood: 0, fire: 0, condition: 0, exposure: 0.8 }).score).toBeGreaterThan(50);
  });
  it('never reports nonfinite scores even for invalid measurements', () => {
    expect(
      fuzzyRisk({ flood: NaN, fire: Infinity, condition: 0, exposure: 0 }).score,
    ).toBeGreaterThan(80);
  });
  it('scores every sampled combination without gaps', () => {
    for (let x = 0; x <= 10; x++)
      for (let y = 0; y <= 10; y++) {
        const { score } = fuzzyRisk({ flood: x / 10, fire: y / 10, condition: 0.4, exposure: 0.3 });
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
  });
});
describe('risk-weighted A*', () => {
  it('detours around a blocked road', () => {
    const roads = [
      edge('a', 'b', { blocked: true }),
      edge('a', 'c'),
      edge('c', 'd'),
      edge('d', 'b'),
    ];
    expect(findRoute(roads, [], positions.a, positions.b)?.roadIds).toEqual(['ac', 'cd', 'db']);
  });
  it('respects one-way direction and disconnected networks', () => {
    expect(findRoute([edge('a', 'b', { oneway: true })], [], positions.b, positions.a)).toBeNull();
    expect(findRoute([edge('a', 'b'), edge('c', 'd')], [], positions.a, positions.d)).toBeNull();
  });
  it('rejects distant origin snapping', () => {
    expect(findRoute([edge('a', 'b')], [], [120, 13], positions.b)).toBeNull();
  });
  it('handles being at the destination', () => {
    expect(findRoute([edge('a', 'b')], [], positions.a, positions.a)?.distance).toBe(0);
  });
  it('affects only the reported road ID, not adjacent streets or shared junctions', () => {
    const h: Hazard = {
      id: 'h',
      name: 'fire',
      barangay: 'Test',
      hazard_type: 'fire',
      severity: 0.9,
      active: true,
      updated_at: '2026-01-01',
      road_id: 'ab',
      blocked: true,
      notes: 'CDRRMO street report',
      geometry: edge('a', 'b').geometry,
    };
    expect(segmentRisk(edge('a', 'b'), [h]).blocked).toBe(true);
    expect(segmentRisk(edge('a', 'b'), [{ ...h, active: false }]).blocked).toBe(false);
    expect(segmentRisk(edge('a', 'c'), [h]).blocked).toBe(false);
    expect(
      segmentRisk(edge('a', 'b', { id: 'another-street-with-same-geometry' }), [h]).blocked,
    ).toBe(false);
  });
  it('honors low-severity explicit closures and keeps other active hazards after a report is cleared', () => {
    const road = edge('a', 'b');
    const flood: Hazard = {
      id: 'flood',
      road_id: road.id,
      name: 'Test',
      barangay: 'Test',
      hazard_type: 'flood',
      severity: 0.1,
      blocked: true,
      active: true,
      notes: 'Closed by CDRRMO',
      updated_at: '2026-01-01',
      geometry: road.geometry,
    };
    const fire: Hazard = { ...flood, id: 'fire', hazard_type: 'fire' };
    expect(findRoute([road], [flood], positions.a, positions.b)).toBeNull();
    expect(segmentRisk(road, [{ ...flood, active: false }, fire]).blocked).toBe(true);
    expect(
      findRoute(
        [road],
        [
          { ...flood, active: false },
          { ...fire, active: false },
        ],
        positions.a,
        positions.b,
      )?.roadIds,
    ).toEqual(['ab']);
  });
  it('takes a longer low-risk path when its weighted cost is lower', () => {
    const roads = [
      edge('a', 'b', { condition: 0.79 }),
      edge('a', 'c'),
      edge('c', 'd'),
      edge('d', 'b'),
    ];
    expect(findRoute(roads, [], positions.a, positions.b)?.roadIds).toEqual(['ac', 'cd', 'db']);
  });
});
describe('shelter ranking', () => {
  it('excludes full shelters and routes around reported street closures', () => {
    const s = demoSnapshot();
    const ranked = rankShelters(s, DEMO_ORIGIN);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.shelter.occupancy < r.shelter.capacity)).toBe(true);
    const blocked = new Set(
      s.roads.filter((road) => segmentRisk(road, s.hazards).blocked).map((road) => road.id),
    );
    expect(ranked.every((r) => r.route.roadIds.every((id) => !blocked.has(id)))).toBe(true);
    expect(ranked[0].score).toBeLessThanOrEqual(ranked.at(-1)!.score);
  });
  it('filters for reported step-free entrances', () => {
    expect(rankShelters(demoSnapshot(), DEMO_ORIGIN, true).every((r) => r.shelter.accessible)).toBe(
      true,
    );
  });
  it('recomputes after road updates', () => {
    const s = demoSnapshot();
    expect(rankShelters(s, DEMO_ORIGIN).length).toBeGreaterThan(0);
    expect(
      rankShelters({ ...s, roads: s.roads.map((r) => ({ ...r, blocked: true })) }, DEMO_ORIGIN),
    ).toEqual([]);
  });
  it('uses exact status boundaries', () => {
    const s = demoSnapshot().shelters[0];
    expect(shelterStatus({ ...s, capacity: 100, occupancy: 80 })).toBe('Near full');
    expect(shelterStatus({ ...s, capacity: 100, occupancy: 100 })).toBe('Full');
    expect(shelterStatus({ ...s, status: 'closed' })).toBe('Closed');
  });
});
