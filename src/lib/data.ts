import cityRoads from '../data/santa-rosa-city-roads.json';
import { configured, supabase } from './supabase';
import type { Snapshot } from './types';
export async function getSnapshot(): Promise<Snapshot> {
  if (!configured()) {
    return {
      ...(cityRoads as Snapshot),
      shelters: [],
      hazards: [],
      demo: false,
      setupRequired: true,
      syncedAt: new Date().toISOString(),
    };
  }
  const { data, error } = await supabase().rpc('public_snapshot');
  if (error) throw new Error('The latest city data could not be loaded.');
  if (data?.schemaVersion !== 2) throw new Error('Apply the street hazard database migration.');
  if (data.demo)
    return { ...data, shelters: [], hazards: [], demo: false, setupRequired: true } as Snapshot;
  return data as Snapshot;
}
