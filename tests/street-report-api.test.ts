import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ role: 'citywide', roadExists: true, payload: null as unknown }));
vi.mock('@/lib/supabase', () => ({
  configured: () => true,
  supabase: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'road_hazards' || table === 'assistance_requests')
        return {
          insert: (payload: unknown) => {
            state.payload = payload;
            return { select: async () => ({ data: [{ id: 'saved' }], error: null }) };
          },
          update: (payload: unknown) => {
            state.payload = payload;
            return { eq: () => ({ select: async () => ({ data: [{ id: 'saved' }], error: null }) }) };
          },
        };
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({
          data:
            table === 'admin_accounts'
              ? {
                  user_id: '11111111-1111-4111-8111-111111111111',
                  role: state.role,
                  barangay: 'Tagapo',
                }
              : state.roadExists
                ? { id: '44444444-4444-4444-8444-444444444444' }
                : null,
          error: null,
        }),
      };
    },
  }),
}));
import { POST, PATCH } from '../src/app/api/admin/[resource]/route';
const report = {
  road_id: '44444444-4444-4444-8444-444444444444',
  hazard_type: 'flood',
  severity: 0.2,
  blocked: true,
  active: true,
  notes: 'Street flooded',
};
const send = (body: unknown, token = true) =>
  POST(
    new Request('http://localhost/api/admin/road_hazards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer test-token' } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ resource: 'road_hazards' }) },
  );
beforeEach(() => {
  state.role = 'citywide';
  state.roadExists = true;
  state.payload = null;
});
it('rejects unauthenticated publication', async () => {
  expect((await send(report, false)).status).toBe(401);
});
it('rejects barangay publication even for a road in its own area', async () => {
  state.role = 'barangay';
  expect((await send(report)).status).toBe(403);
  expect(state.payload).toBeNull();
});
it('lets CDRRMO publish a report referencing a known road', async () => {
  expect((await send(report)).status).toBe(201);
  expect(state.payload).toEqual(report);
});
it('publishes multiple street reports in one insert', async () => {
  const {road_id, ...fields} = report;
  const ids = [road_id, '55555555-5555-4555-8555-555555555555'];
  expect((await send({...fields, road_ids:ids})).status).toBe(201);
  expect(state.payload).toEqual(ids.map(road_id => ({...fields,road_id})));
});
it('rejects empty or duplicate batch selections without writing', async () => {
  const {road_id, ...fields} = report;
  expect((await send({...fields, road_ids:[]})).status).toBe(400);
  expect((await send({...fields, road_ids:[road_id,road_id]})).status).toBe(400);
  expect(state.payload).toBeNull();
});
it('rejects batch publication by barangay administrators', async () => {
  state.role = 'barangay';
  const {road_id, ...fields} = report;
  expect((await send({...fields, road_ids:[road_id]})).status).toBe(403);
  expect(state.payload).toBeNull();
});
it('lets CDRRMO clear an existing incident without deleting its history', async () => {
  const response = await PATCH(new Request('http://localhost/api/admin/road_hazards?id=44444444-4444-4444-8444-444444444444', {
    method: 'PATCH', headers: {'Content-Type':'application/json', Authorization:'Bearer test-token'},
    body: JSON.stringify({...report, active:false}),
  }), {params:Promise.resolve({resource:'road_hazards'})});
  expect(response.status).toBe(200);
  expect(state.payload).toEqual({...report, active:false});
});
it('denies private assistance status access to barangay admins', async () => {
  state.role = 'barangay';
  const response = await PATCH(new Request('http://localhost/api/admin/assistance_requests?id=44444444-4444-4444-8444-444444444444', {
    method:'PATCH',headers:{Authorization:'Bearer test-token'},body:JSON.stringify({status:'acknowledged'}),
  }), {params:Promise.resolve({resource:'assistance_requests'})});
  expect(response.status).toBe(403);
  expect(state.payload).toBeNull();
});
it('allows CDRRMO to acknowledge assistance without modifying the reported location', async () => {
  const response = await PATCH(new Request('http://localhost/api/admin/assistance_requests?id=44444444-4444-4444-8444-444444444444', {
    method:'PATCH',headers:{Authorization:'Bearer test-token'},body:JSON.stringify({status:'acknowledged'}),
  }), {params:Promise.resolve({resource:'assistance_requests'})});
  expect(response.status).toBe(200);
  expect(state.payload).toEqual({status:'acknowledged'});
});
it('rejects missing road records and forged polygons', async () => {
  state.roadExists = false;
  expect((await send(report)).status).toBe(400);
  state.roadExists = true;
  expect((await send({ ...report, geometry: { type: 'Polygon', coordinates: [] } })).status).toBe(
    400,
  );
  expect(state.payload).toBeNull();
});
