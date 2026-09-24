import { expect, it, vi } from 'vitest';
const saved = vi.hoisted(() => ({schemaVersion:2, demo:true}));
vi.mock('idb', () => ({openDB: async () => ({get: async () => saved, close: () => {}})}));
import { readSnapshot } from '../src/lib/offline';
it('rejects an old cached demonstration even with the current schema', async () => {
  expect(await readSnapshot()).toBeUndefined();
});
it('allows cached operational data for offline use', async () => {
  saved.demo = false;
  expect(await readSnapshot()).toEqual(saved);
});
