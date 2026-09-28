import { distance } from './routing';
import type { Position, Route } from './types';
export type Maneuver = {
  point: Position;
  index: number;
  along: number;
  turn: 'left' | 'right' | 'continue' | 'arrive';
  street: string;
};
export function maneuvers(route: Route): Maneuver[] {
  const result: Maneuver[] = [];
  let along = 0;
  const points = route.coordinates;
  for (let i = 1; i < points.length; i++) {
    along += distance(points[i - 1], points[i]);
    if (i === points.length - 1) {
      result.push({ point: points[i], index: i, along, turn: 'arrive', street: '' });
      break;
    }
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    const cos = Math.cos((b[1] * Math.PI) / 180);
    const incoming = Math.atan2((b[0] - a[0]) * cos, b[1] - a[1]);
    const outgoing = Math.atan2((c[0] - b[0]) * cos, c[1] - b[1]);
    const angle = ((((outgoing - incoming) * 180) / Math.PI + 540) % 360) - 180;
    const junction = route.junctions?.find((j) => j.index === i);
    if (junction || Math.abs(angle) >= 40)
      result.push({
        point: b,
        index: i,
        along,
        turn: angle > 35 ? 'right' : angle < -35 ? 'left' : 'continue',
        street: junction?.street || '',
      });
  }
  return result;
}
export function routeProgress(route: Route, position: Position) {
  let along = 0,
    best = { along: 0, away: Infinity };
  for (let i = 1; i < route.coordinates.length; i++) {
    const a = route.coordinates[i - 1],
      b = route.coordinates[i],
      cos = Math.cos((position[1] * Math.PI) / 180);
    const dx = (b[0] - a[0]) * cos,
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((position[0] - a[0]) * cos * dx + (position[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    const length = distance(a, b),
      away = distance(position, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    if (away < best.away) best = { along: along + t * length, away };
    along += length;
  }
  return best;
}
export function instruction(m: Maneuver, fil: boolean) {
  const action = fil
    ? {
        left: 'Kumaliwa',
        right: 'Kumanan',
        continue: 'Magpatuloy',
        arrive: 'Lumapit sa silungan. Tiyakin ang pasukan',
      }
    : {
        left: 'Turn left',
        right: 'Turn right',
        continue: 'Continue',
        arrive: 'Approach the shelter. Check the entrance',
      };
  return action[m.turn] + (m.street ? `${fil ? ' sa ' : ' onto '}${m.street}` : '');
}
