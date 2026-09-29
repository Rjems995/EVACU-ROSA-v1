import { expect, it } from 'vitest';
import {
  instruction,
  maneuvers,
  routeProgress,
  oppositeHeading,
} from '../src/lib/navigation-guidance';
import { offlineRouteHTML } from '../src/lib/offline-route';
import type { Route, RankedShelter, Snapshot } from '../src/lib/types';
const route: Route = {
  coordinates: [
    [121, 14],
    [121, 14.001],
    [121.001, 14.001],
  ],
  roadIds: ['a', 'b'],
  junctions: [{ index: 1, street: 'Main Street' }],
  distance: 220,
  cost: 220,
  risk: 0,
  minutes: 4,
  start: [121, 14],
  end: [121.001, 14.001],
  snapDistance: 0,
};
it('announces a right turn and arrival in route order', () => {
  const turns = maneuvers(route);
  expect(turns.map((t) => t.turn)).toEqual(['right', 'arrive']);
  expect(instruction(turns[0], false)).toBe('Turn right onto Main Street');
  expect(instruction(turns[0], true)).toBe('Kumanan sa Main Street');
});
it('measures along-route progress separately from distance away', () => {
  const on = routeProgress(route, [121, 14.0005]);
  expect(on.away).toBeLessThan(1);
  expect(on.along).toBeGreaterThan(50);
  expect(routeProgress(route, [121.003, 14.003]).away).toBeGreaterThan(100);
});
it('distinguishes bends and turn-backs from intersection turns', () => {
  expect(maneuvers({ ...route, junctions: [] })[0].turn).toBe('bend-right');
  expect(
    maneuvers({
      ...route,
      coordinates: [
        [121, 14],
        [121, 14.001],
        [121, 14],
      ],
      junctions: [],
    })[0].turn,
  ).toBe('uturn');
});
it('ignores small geometry zigzags and duplicate coordinates', () => {
  const jitter = {
    ...route,
    junctions: [],
    coordinates: [
      [121, 14],
      [121.00001, 14.00005],
      [121, 14.0001],
      [121, 14.001],
    ] as [number, number][],
  };
  expect(maneuvers(jitter).map((m) => m.turn)).toEqual(['arrive']);
  expect(
    routeProgress({ ...route, coordinates: [[121, 14], ...route.coordinates] }, [121, 14.0005])
      .away,
  ).toBeLessThan(1);
});
it('uses continuity near parallel route legs and rejects stationary headings', () => {
  const loop = {
    ...route,
    coordinates: [
      [121, 14],
      [121, 14.001],
      [121.0001, 14.001],
      [121.0001, 14],
    ] as [number, number][],
  };
  expect(routeProgress(loop, [121.00007, 14.0005], 55).along).toBeLessThan(100);
  expect(oppositeHeading(180, 3, 0)).toBe(true);
  expect(oppositeHeading(180, 0, 0)).toBe(false);
  expect(oppositeHeading(null, 3, 0)).toBe(false);
});
it('exports self-contained offline directions and escapes staff text', () => {
  const selected = {
    route,
    shelter: {
      name: '<script>alert(1)</script>',
      barangay: 'Test',
      geometry: { coordinates: [121.001, 14.001] },
    },
  } as RankedShelter;
  const snapshot = {
    syncedAt: '2026-09-28T01:00:00Z',
    roads: [
      { id: 'a', name: 'A & B' },
      { id: 'b', name: 'Main Street' },
    ],
  } as Snapshot;
  const html = offlineRouteHTML(selected, snapshot, 'walking', false, '2026-09-28T02:00:00Z');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('A &amp; B');
  expect(html).toContain('2026-09-28T02:00:00Z');
  expect(html).toContain('Turn right');
  expect(html).not.toMatch(/<script|<link|<img/);
});
