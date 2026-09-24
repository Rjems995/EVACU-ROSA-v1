import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { lineString, point, polygon } from '@turf/helpers';
import { fuzzyRisk } from './fuzzy';
import type { Hazard, Position, RankedShelter, Road, Route, Shelter, Snapshot } from './types';
export function distance(a: Position, b: Position): number {
  const rad = Math.PI / 180,
    dLat = (b[1] - a[1]) * rad,
    dLng = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function segmentRisk(road: Road, hazards: Hazard[]) {
  const intersecting = hazards.filter(
    (h) =>
      h.active &&
      booleanIntersects(lineString(road.geometry.coordinates), polygon(h.geometry.coordinates)),
  );
  const max = (type?: string) =>
    Math.max(
      0,
      ...intersecting.filter((h) => !type || h.hazard_type === type).map((h) => h.severity),
    );
  const risk = fuzzyRisk({
    flood: max('flood'),
    fire: max('fire'),
    condition: road.condition,
    exposure: max(),
  });
  return {
    ...risk,
    blocked: road.blocked || road.condition >= 0.95 || max() >= 0.85 || risk.score >= 80,
  };
}
type Edge = {
  to: string;
  road: Road;
  risk: number;
  length: number;
  cost: number;
  reverse: boolean;
};
export function buildGraph(roads: Road[], hazards: Hazard[]) {
  const nodes = new Map<string, Position>(),
    edges = new Map<string, Edge[]>();
  for (const road of roads) {
    const coords = road.geometry.coordinates as Position[];
    nodes.set(road.source, coords[0]);
    nodes.set(road.target, coords[coords.length - 1]);
    const risk = segmentRisk(road, hazards);
    if (risk.blocked) continue;
    const length = coords.slice(1).reduce((sum, p, i) => sum + distance(coords[i], p), 0);
    const cost = Math.max(length, road.base_cost) * (1 + (4 * risk.score) / 100);
    const add = (from: string, to: string, reverse: boolean) =>
      edges.set(from, [
        ...(edges.get(from) || []),
        { to, road, risk: risk.score, length, cost, reverse },
      ]);
    add(road.source, road.target, false);
    if (!road.oneway) add(road.target, road.source, true);
  }
  return { nodes, edges };
}
export function findRoute(
  roads: Road[],
  hazards: Hazard[],
  origin: Position,
  destination: Position,
): Route | null {
  const { nodes, edges } = buildGraph(roads, hazards);
  const nearest = (pos: Position) =>
    [...nodes.entries()].sort((a, b) => distance(pos, a[1]) - distance(pos, b[1]))[0];
  const start = nearest(origin),
    goal = nearest(destination);
  if (!start || !goal || distance(origin, start[1]) > 500 || distance(destination, goal[1]) > 150)
    return null;
  // Do not silently snap past an impassable segment to a more distant accessible node.
  const open = new Set([start[0]]),
    g = new Map([[start[0], 0]]);
  const previous = new Map<string, { from: string; edge: Edge }>();
  while (open.size) {
    const current = [...open].reduce((a, b) =>
      g.get(a)! + distance(nodes.get(a)!, goal[1]) <= g.get(b)! + distance(nodes.get(b)!, goal[1])
        ? a
        : b,
    );
    if (current === goal[0]) {
      const path: Edge[] = [];
      let cursor = current;
      while (cursor !== start[0]) {
        const entry = previous.get(cursor)!;
        path.unshift(entry.edge);
        cursor = entry.from;
      }
      const coordinates: Position[] = [start[1]];
      let total = 0,
        riskSum = 0;
      for (const edge of path) {
        const coords = [...edge.road.geometry.coordinates] as Position[];
        if (edge.reverse) coords.reverse();
        coordinates.push(...coords.slice(1));
        total += edge.length;
        riskSum += edge.length * edge.risk;
      }
      const risk = total ? riskSum / total : 0;
      return {
        coordinates,
        roadIds: path.map((e) => e.road.id),
        distance: total,
        cost: g.get(current)!,
        risk,
        minutes: Math.max(1, Math.ceil((total / 65) * (1 + risk / 100))),
        start: start[1],
        end: goal[1],
        snapDistance: distance(origin, start[1]),
      };
    }
    open.delete(current);
    for (const edge of edges.get(current) || []) {
      const next = g.get(current)! + edge.cost;
      if (next < (g.get(edge.to) ?? Infinity)) {
        g.set(edge.to, next);
        previous.set(edge.to, { from: current, edge });
        open.add(edge.to);
      }
    }
  }
  return null;
}
export function shelterStatus(s: Shelter) {
  return s.status === 'closed'
    ? 'Closed'
    : s.occupancy >= s.capacity
      ? 'Full'
      : s.occupancy / s.capacity >= 0.8
        ? 'Near full'
        : 'Open';
}
export function rankShelters(
  snapshot: Snapshot,
  origin: Position,
  accessibleOnly = false,
): RankedShelter[] {
  const ranked: RankedShelter[] = [];
  for (const shelter of snapshot.shelters) {
    if (
      ['Full', 'Closed'].includes(shelterStatus(shelter)) ||
      (accessibleOnly && !shelter.accessible)
    )
      continue;
    const location = shelter.geometry.coordinates as Position;
    const inside = snapshot.hazards.filter(
      (h) => h.active && booleanPointInPolygon(point(location), polygon(h.geometry.coordinates)),
    );
    if (inside.some((h) => h.severity >= 0.7)) continue;
    const proximity = Math.max(
      0,
      ...snapshot.hazards
        .filter((h) => h.active)
        .map((h) => {
          if (inside.includes(h)) return h.severity;
          const nearest = Math.min(
            ...h.geometry.coordinates[0].map((p) => distance(location, p as Position)),
          );
          return h.severity * Math.max(0, 1 - nearest / 1000);
        }),
    );
    const route = findRoute(snapshot.roads, snapshot.hazards, origin, location);
    if (route)
      ranked.push({
        shelter,
        route,
        proximity,
        score: route.cost + (shelter.occupancy / shelter.capacity) * 600 + proximity * 1200,
      });
  }
  return ranked.sort((a, b) => a.score - b.score);
}
