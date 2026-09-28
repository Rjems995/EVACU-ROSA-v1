import { describe, expect, it } from 'vitest';
import { roadDirections } from '../src/lib/road-access';
import { findRoute } from '../src/lib/routing';
import type { Road } from '../src/lib/types';
const road = (tags: Record<string, string>, reversed = false): Road => ({
  id: 'r',
  name: 'Test',
  barangay: 'Test',
  source: 'a',
  target: 'b',
  base_cost: 0,
  condition: 0,
  blocked: false,
  oneway: false,
  geometry: {
    type: 'LineString',
    coordinates: [
      [121, 14],
      [121.001, 14],
    ],
  },
  access: { tags, reversed },
});
describe('transport road access', () => {
  it('excludes footpaths and stairs from motor routes', () => {
    for (const highway of ['footway', 'steps', 'path', 'pedestrian']) {
      expect(roadDirections(road({ highway }), 'walking').forward).toBe(true);
      expect(roadDirections(road({ highway }), 'car').forward).toBe(false);
      expect(roadDirections(road({ highway }), 'motorcycle').forward).toBe(false);
    }
  });
  it('applies specific permissions before general permissions', () => {
    const r = road({
      highway: 'residential',
      access: 'private',
      motorcycle: 'yes',
      motorcar: 'no',
    });
    expect(roadDirections(r, 'motorcycle').forward).toBe(true);
    expect(roadDirections(r, 'car').forward).toBe(false);
    expect(roadDirections(r, 'walking').forward).toBe(false);
  });
  it('respects reverse one-way and bicycle exceptions', () => {
    const tags = { highway: 'residential', oneway: '-1', 'oneway:bicycle': 'no' };
    expect(roadDirections(road(tags), 'car')).toEqual({ forward: false, reverse: true });
    expect(roadDirections(road(tags, true), 'car')).toEqual({ forward: true, reverse: false });
    expect(roadDirections(road(tags), 'cycling')).toEqual({ forward: true, reverse: true });
    expect(roadDirections(road(tags), 'walking')).toEqual({ forward: true, reverse: true });
  });
  it('excludes unknown and conditional vehicle access', () => {
    expect(roadDirections({ ...road({}), access: undefined }, 'car').forward).toBe(false);
    expect(
      roadDirections(
        road({ highway: 'service', 'motor_vehicle:conditional': 'yes @ (Mo-Fr)' }),
        'car',
      ).forward,
    ).toBe(false);
  });
  it('uses a vehicle detour instead of a pedestrian shortcut', () => {
    const a = road({ highway: 'footway' });
    const b = {
      ...road({ highway: 'residential' }),
      id: 'detour',
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [121, 14],
          [121, 14.001],
          [121.001, 14],
        ],
      },
    };
    expect(findRoute([a, b], [], [121, 14], [121.001, 14], undefined, 'walking')?.roadIds).toEqual([
      'r',
    ]);
    expect(findRoute([a, b], [], [121, 14], [121.001, 14], undefined, 'car')?.roadIds).toEqual([
      'detour',
    ]);
    expect(
      findRoute([a, { ...b, blocked: true }], [], [121, 14], [121.001, 14], undefined, 'car'),
    ).toBeNull();
  });
});
