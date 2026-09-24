import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ configured: false, data: {} as Record<string, unknown> }));
vi.mock('@/lib/supabase', () => ({configured: () => state.configured, supabase: () => ({rpc: async () => ({data: state.data, error: null})})}));
import { getSnapshot } from '../src/lib/data';
beforeEach(() => { state.configured = false; state.data = {}; });
it('serves only streets before connection setup', async () => {
  const data = await getSnapshot();
  expect(data.demo).toBe(false);
  expect(data.setupRequired).toBe(true);
  expect(data.shelters).toEqual([]);
  expect(data.hazards).toEqual([]);
  expect(data.roads.length).toBeGreaterThan(0);
});
it('does not relabel connected demonstration incidents as real reports', async () => {
  state.configured = true;
  state.data = {schemaVersion:2,demo:true,shelters:[{id:'fictional'}],hazards:[{id:'fictional'}]};
  const data = await getSnapshot();
  expect(data.hazards).toEqual([]);
  expect(data.shelters).toEqual([]);
  expect(data.setupRequired).toBe(true);
});
it('preserves operational reports from a connected database', async () => {
  state.configured = true;
  state.data = {schemaVersion:2,demo:false,hazards:[{id:'actual-report'}]};
  expect((await getSnapshot()).hazards).toEqual([{id:'actual-report'}]);
});
