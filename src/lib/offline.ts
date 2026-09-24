import { openDB } from 'idb';
import type { Snapshot } from './types';
const database = () =>
  openDB('evacu-rosa', 1, {
    upgrade(db) {
      db.createObjectStore('snapshots');
    },
  });
export async function cacheSnapshot(snapshot: Snapshot) {
  const db = await database();
  await db.put('snapshots', snapshot, 'latest');
  db.close();
}
export async function readSnapshot(): Promise<Snapshot | undefined> {
  const db = await database();
  const result = await db.get('snapshots', 'latest');
  db.close();
  // Old polygon reports must never masquerade as street-specific reports.
  return result?.schemaVersion === 2 ? result : undefined;
}
