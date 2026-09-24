import { expect, it } from 'vitest';
import { schemas, routeInput } from '../src/lib/validation';
import { demoSnapshot } from '../src/lib/demo';
it('rejects impossible capacity and invalid coordinates', () => {
  expect(
    schemas.evacuation_centers.safeParse({ ...demoSnapshot().shelters[0], occupancy: 1000000 })
      .success,
  ).toBe(false);
  expect(routeInput.safeParse({ origin: [200, 100] }).success).toBe(false);
});
it('requires an existing-road identifier and disallows client-authored hazard geometry', () => {
  const report = {
    road_id: demoSnapshot().roads[0].id,
    hazard_type: 'flood',
    severity: 0.4,
    blocked: true,
    active: true,
    notes: '',
  };
  expect(schemas.road_hazards.safeParse(report).success).toBe(true);
  expect(schemas.road_hazards.safeParse({ ...report, road_id: '' }).success).toBe(false);
  expect(
    schemas.road_hazards.safeParse({
      ...report,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 2],
          ],
        ],
      },
    }).success,
  ).toBe(false);
});
it('rejects unassigned barangay administrators', () => {
  expect(
    schemas.admin_accounts.safeParse({
      user_id: '11111111-1111-4111-8111-111111111111',
      role: 'barangay',
      barangay: null,
    }).success,
  ).toBe(false);
});
