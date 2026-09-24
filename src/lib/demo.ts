import data from '../data/santa-rosa-roads.json';
import type { Snapshot } from './types';
export { DEMO_ORIGIN } from './constants';
// OSM street geometry; the incident reports and shelter sites remain fictional.
export function demoSnapshot(): Snapshot {
  return data as Snapshot;
}
