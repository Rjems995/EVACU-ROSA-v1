import { z } from 'zod';
const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const point = z.object({ type: z.literal('Point'), coordinates: coordinate });
const line = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(coordinate).min(2).max(10000),
});
const polygon = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(coordinate).min(4).max(10000)).min(1),
  })
  .refine(
    (p) =>
      p.coordinates.every((r) => r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]),
    'Polygon rings must be closed.',
  );
const common = {
  name: z.string().trim().min(2).max(150),
  barangay: z.string().trim().min(2).max(80),
};
export const schemas = {
  evacuation_centers: z
    .object({
      ...common,
      capacity: z.number().int().positive().max(100000),
      occupancy: z.number().int().min(0).max(100000),
      status: z.enum(['open', 'closed']),
      accessible: z.boolean(),
      amenities: z.array(z.string().max(80)).max(20),
      geometry: point,
    })
    .refine((v) => v.occupancy <= v.capacity, 'Occupancy must not exceed capacity.'),
  roads: z.object({
    ...common,
    source: z.string().min(1).max(80),
    target: z.string().min(1).max(80),
    base_cost: z.number().min(0),
    condition: z.number().min(0).max(1),
    blocked: z.boolean(),
    oneway: z.boolean(),
    geometry: line,
  }),
  hazard_zones: z.object({
    ...common,
    hazard_type: z.enum(['flood', 'fire', 'earthquake']),
    severity: z.number().min(0).max(1),
    active: z.boolean(),
    geometry: polygon,
  }),
  admin_accounts: z
    .object({
      user_id: z.uuid(),
      role: z.enum(['barangay', 'citywide']),
      barangay: z.string().max(80).nullable(),
    })
    .refine(
      (v) => v.role === 'citywide' || Boolean(v.barangay?.trim()),
      'Barangay administrators need an assigned barangay.',
    ),
};
export const routeInput = z.object({ origin: coordinate, accessibleOnly: z.boolean().optional() });
