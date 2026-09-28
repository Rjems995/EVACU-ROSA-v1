import cityRoads from '../data/santa-rosa-city-roads.json';
import accessData from '../data/road-access.json';
import { createHash } from 'node:crypto';
import { configured, supabase } from './supabase';
import type { Snapshot } from './types';
function withAccess(snapshot: Snapshot): Snapshot {
  const records = accessData.records as Record<
    string,
    { signature: string; tags: Record<string, string>; reversed: boolean }
  >;
  return {
    ...snapshot,
    roads: snapshot.roads.map((road) => {
      const record = records[road.id];
      const signature = createHash('sha256')
        .update(JSON.stringify([road.source, road.target, road.geometry.coordinates]))
        .digest('hex');
      return {
        ...road,
        access:
          record?.signature === signature
            ? { tags: record.tags, reversed: record.reversed }
            : undefined,
      };
    }),
  };
}
export async function getSnapshot(): Promise<Snapshot> {
  if (!configured()) {
    return withAccess({
      ...(cityRoads as Snapshot),
      shelters: [],
      hazards: [],
      demo: false,
      setupRequired: true,
      syncedAt: new Date().toISOString(),
    });
  }
  const { data, error } = await supabase().rpc('public_snapshot');
  if (error) throw new Error('The latest city data could not be loaded.');
  if (data?.schemaVersion !== 2) throw new Error('Apply the street hazard database migration.');
  if (data.demo)
    return withAccess({
      ...data,
      shelters: [],
      hazards: [],
      demo: false,
      setupRequired: true,
    } as Snapshot);
  return withAccess(data as Snapshot);
}
