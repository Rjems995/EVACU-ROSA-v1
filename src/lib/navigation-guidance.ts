import { distance } from './routing';
import type { Position, Route } from './types';
export type Maneuver = {
  point: Position;
  index: number;
  along: number;
  turn: 'left' | 'right' | 'continue' | 'arrive' | 'uturn' | 'bend-left' | 'bend-right';
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
    // Sample across short geometry segments to avoid GPS-scale zigzags becoming turns.
    let before = i - 1,
      after = i + 1;
    while (before > 0 && distance(points[before], points[i]) < 12) before--;
    while (after < points.length - 1 && distance(points[i], points[after]) < 12) after++;
    const a = points[before],
      b = points[i],
      c = points[after];
    const cos = Math.cos((b[1] * Math.PI) / 180);
    const incoming = Math.atan2((b[0] - a[0]) * cos, b[1] - a[1]);
    const outgoing = Math.atan2((c[0] - b[0]) * cos, c[1] - b[1]);
    const angle = ((((outgoing - incoming) * 180) / Math.PI + 540) % 360) - 180;
    const junction = route.junctions?.find((j) => j.index === i);
    const last = result.at(-1);
    if (junction || (Math.abs(angle) >= 55 && (!last || along - last.along > 25)))
      result.push({
        point: b,
        index: i,
        along,
        turn:
          Math.abs(angle) >= 150
            ? 'uturn'
            : angle > 35
              ? junction
                ? 'right'
                : 'bend-right'
              : angle < -35
                ? junction
                  ? 'left'
                  : 'bend-left'
                : 'continue',
        street: junction?.street || '',
      });
  }
  return result;
}
export function routeProgress(route: Route, position: Position, previousAlong?: number) {
  let along = 0,
    best = { along: 0, away: Infinity, bearing: 0 },
    bestScore = Infinity;
  for (let i = 1; i < route.coordinates.length; i++) {
    const a = route.coordinates[i - 1],
      b = route.coordinates[i],
      cos = Math.cos((position[1] * Math.PI) / 180);
    const dx = (b[0] - a[0]) * cos,
      dy = b[1] - a[1];
    if (dx === 0 && dy === 0) continue;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((position[0] - a[0]) * cos * dx + (position[1] - a[1]) * dy) / (dx * dx + dy * dy),
      ),
    );
    const length = distance(a, b),
      away = distance(position, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    const candidate = along + t * length;
    const score =
      away +
      (previousAlong === undefined ? 0 : Math.min(80, Math.abs(candidate - previousAlong) * 0.15));
    if (score < bestScore) {
      bestScore = score;
      best = {
        along: candidate,
        away,
        bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
      };
    }
    along += length;
  }
  return best;
}
export function oppositeHeading(
  heading: number | null | undefined,
  speed: number | null | undefined,
  bearing: number,
) {
  if (heading == null || !Number.isFinite(heading) || speed == null || speed < 1.5) return false;
  return Math.abs(((heading - bearing + 540) % 360) - 180) > 120;
}
export function instruction(m: Maneuver, fil: boolean) {
  const action = fil
    ? {
        left: 'Kumaliwa',
        right: 'Kumanan',
        continue: 'Magpatuloy',
        arrive: 'Lumapit sa silungan. Tiyakin ang pasukan',
        uturn: 'Bumalik lamang kung pinapayagan at ligtas',
        'bend-left': 'Sundan ang kurba pakaliwa',
        'bend-right': 'Sundan ang kurba pakanan',
      }
    : {
        left: 'Turn left',
        right: 'Turn right',
        continue: 'Continue',
        arrive: 'Approach the shelter. Check the entrance',
        uturn: 'Turn back only where permitted and safe',
        'bend-left': 'Follow the bend left',
        'bend-right': 'Follow the bend right',
      };
  return action[m.turn] + (m.street ? `${fil ? ' sa ' : ' onto '}${m.street}` : '');
}
