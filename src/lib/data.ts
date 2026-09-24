import { demoSnapshot } from './demo';
import { configured, supabase } from './supabase';
import type { Snapshot } from './types';
export async function getSnapshot(): Promise<Snapshot> {
  if (!configured()) return demoSnapshot();
  const { data, error } = await supabase().rpc('public_snapshot');
  if (error) throw new Error('The latest city data could not be loaded.');
  if (data?.schemaVersion !== 2) throw new Error('Apply the street hazard database migration.');
  return data as Snapshot;
}
