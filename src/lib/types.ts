import type { LineString, Point, Polygon } from 'geojson';
export type HazardType = 'flood' | 'fire' | 'earthquake';
export type Shelter = {
  id: string;
  name: string;
  barangay: string;
  capacity: number;
  occupancy: number;
  status: 'open' | 'closed' | 'paused';
  accessible: boolean;
  amenities: string[];
  geometry: Point;
  entrance_verified?: boolean;
  water_status?: 'unknown' | 'adequate' | 'low' | 'unavailable';
  food_status?: 'unknown' | 'adequate' | 'low' | 'unavailable';
  medical_status?: 'unknown' | 'adequate' | 'low' | 'unavailable';
  operational_notes?: string;
  updated_at?: string;
};
export type Road = {
  id: string;
  name: string;
  barangay: string;
  source: string;
  target: string;
  base_cost: number;
  condition: number;
  blocked: boolean;
  oneway: boolean;
  geometry: LineString;
  osm_way_id?: string;
  node_ids?: string[];
};
export type Hazard = {
  id: string;
  name: string;
  barangay: string;
  hazard_type: HazardType;
  severity: number;
  active: boolean;
  updated_at: string;
  road_id: string;
  blocked: boolean;
  notes: string;
  geometry: LineString; // Derived from the linked road, never hand-drawn.
};
export type Boundary = { id: string; name: string; kind: 'city' | 'barangay'; geometry: Polygon };
export type Snapshot = {
  schemaVersion: 2;
  shelters: Shelter[];
  roads: Road[];
  hazards: Hazard[];
  boundaries: Boundary[];
  syncedAt: string;
  demo: boolean;
  setupRequired?: boolean;
};
export type Position = [number, number]; // longitude, latitude (GeoJSON order)
export type Route = {
  coordinates: Position[];
  roadIds: string[];
  distance: number;
  cost: number;
  risk: number;
  minutes: number;
  start: Position;
  end: Position;
  snapDistance: number;
};
export type RankedShelter = { shelter: Shelter; route: Route; score: number; proximity: number };
