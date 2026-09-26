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
  const intersecting = hazards.filter((h) => h.active && h.road_id === road.id);
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
    blocked:
      road.blocked ||
      intersecting.some((h) => h.blocked) ||
      road.condition >= 0.95 ||
      max() >= 0.85 ||
      risk.score >= 80,
  };
}
type Edge = {
  to: string;
  road: Road;
  risk: number;
  length: number;
  cost: number;
  reverse: boolean;
  coordinates: Position[];
};
export function buildGraph(roads: Road[], hazards: Hazard[]) {
  const nodes = new Map<string, Position>(),
    edges = new Map<string, Edge[]>();
  const junctionUses = new Map<string, number>();
  for (const road of roads)
    for (const id of new Set(
      road.node_ids?.length === road.geometry.coordinates.length
        ? road.node_ids
        : [road.source, road.target],
    ))
      junctionUses.set(id, (junctionUses.get(id) || 0) + 1);
  for (const road of roads) {
    const coords = road.geometry.coordinates as Position[];
    const ids = road.node_ids?.length === coords.length ? road.node_ids : undefined;
    const cuts = [
      0,
      ...coords.flatMap((_, i) =>
        i > 0 && i < coords.length - 1 && ids && (junctionUses.get(ids[i]) || 0) > 1 ? [i] : [],
      ),
      coords.length - 1,
    ];
    const risk = segmentRisk(road, hazards);
    const fullLength = coords.slice(1).reduce((sum, p, i) => sum + distance(coords[i], p), 0);
    for (let part = 1; part < cuts.length; part++) {
      const a = cuts[part - 1],
        b = cuts[part];
      const source = ids?.[a] || road.source,
        target = ids?.[b] || road.target;
      const coordinates = coords.slice(a, b + 1);
      nodes.set(source, coordinates[0]);
      nodes.set(target, coordinates[coordinates.length - 1]);
      if (risk.blocked) continue;
      const length = coordinates
        .slice(1)
        .reduce((sum, p, i) => sum + distance(coordinates[i], p), 0);
      const cost =
        Math.max(length, fullLength ? (road.base_cost * length) / fullLength : 0) *
        (1 + (4 * risk.score) / 100);
      const add = (from: string, to: string, reverse: boolean) =>
        edges.set(from, [
          ...(edges.get(from) || []),
          { to, road, risk: risk.score, length, cost, reverse, coordinates },
        ]);
      add(source, target, false);
      if (!road.oneway) add(target, source, true);
    }
  }
  return { nodes, edges };
}
export function findRoute(
  roads: Road[],
  hazards: Hazard[],
  origin: Position,
  destination: Position,
  graph = buildGraph(roads, hazards),
): Route | null {
  const { nodes, edges } = graph;
  const nearest = (pos: Position) =>
    [...nodes.entries()].reduce<[string, Position] | undefined>(
      (best, node) => (!best || distance(pos, node[1]) < distance(pos, best[1]) ? node : best),
      undefined,
    );
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
        const coords = [...edge.coordinates];
        if (edge.reverse) coords.reverse();
        coordinates.push(...coords.slice(1));
        total += edge.length;
        riskSum += edge.length * edge.risk;
      }
      const risk = total ? riskSum / total : 0;
      return {
        coordinates,
        roadIds: path.map((e) => e.road.id).filter((id, i, ids) => i === 0 || id !== ids[i - 1]),
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
  if (s.status === 'paused') return 'Not accepting';
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
  const graph = buildGraph(snapshot.roads, snapshot.hazards);
  for (const shelter of snapshot.shelters) {
    if (
      ['Full', 'Closed', 'Not accepting'].includes(shelterStatus(shelter)) ||
      (accessibleOnly && !shelter.accessible)
    )
      continue;
    const location = shelter.geometry.coordinates as Position;
    // Nearby street incidents influence ranking, but are not invented shelter-area closures.
    const proximity = Math.max(
      0,
      ...snapshot.hazards
        .filter((h) => h.active)
        .map((h) => {
          const nearest = Math.min(
            ...h.geometry.coordinates.map((p) => distance(location, p as Position)),
          );
          return h.severity * Math.max(0, 1 - nearest / 1000);
        }),
    );
    const route = findRoute(snapshot.roads, snapshot.hazards, origin, location, graph);
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
