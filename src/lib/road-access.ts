import type { Road } from './types';
import type { TransportMode } from './transport';

// Unknown/conditional permissions are excluded rather than interpreted as public access.
export function roadDirections(
  road: Road,
  mode: TransportMode,
): { forward: boolean; reverse: boolean } {
  const deny = { forward: false, reverse: false };
  const access = road.access;
  if (!access) return mode === 'walking' ? { forward: true, reverse: !road.oneway } : deny;
  const tags = access.tags;
  const keys =
    mode === 'walking'
      ? ['foot', 'access']
      : mode === 'cycling'
        ? ['bicycle', 'vehicle', 'access']
        : [mode === 'car' ? 'motorcar' : 'motorcycle', 'motor_vehicle', 'vehicle', 'access'];
  if (
    Object.keys(tags).some(
      (k) => k.includes(':conditional') && keys.some((key) => k.startsWith(key + ':')),
    ) ||
    tags['oneway:conditional']
  )
    return deny;
  if (
    ['construction', 'proposed', 'motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(
      tags.highway,
    )
  )
    return deny;
  const defaults =
    mode === 'walking'
      ? [
          'residential',
          'living_street',
          'service',
          'unclassified',
          'tertiary',
          'tertiary_link',
          'secondary',
          'secondary_link',
          'primary',
          'primary_link',
          'footway',
          'pedestrian',
          'steps',
          'path',
          'track',
        ]
      : mode === 'cycling'
        ? [
            'residential',
            'living_street',
            'service',
            'unclassified',
            'tertiary',
            'tertiary_link',
            'secondary',
            'secondary_link',
            'primary',
            'primary_link',
            'cycleway',
          ]
        : [
            'residential',
            'living_street',
            'service',
            'unclassified',
            'tertiary',
            'tertiary_link',
            'secondary',
            'secondary_link',
            'primary',
            'primary_link',
          ];
  const permission = keys.map((k) => tags[k]).find(Boolean);
  const explicitMode = keys
    .slice(0, -1)
    .some((k) => ['yes', 'designated', 'permissive'].includes(tags[k]));
  if (permission && !['yes', 'designated', 'permissive'].includes(permission)) return deny;
  if (!defaults.includes(tags.highway) && !explicitMode) return deny;
  if (tags.highway === 'steps' && mode !== 'walking') return deny;
  const key =
    mode === 'walking'
      ? 'foot'
      : mode === 'cycling'
        ? 'bicycle'
        : mode === 'car'
          ? 'motorcar'
          : 'motorcycle';
  if (keys.some((k) => tags[`oneway:${k}:conditional`])) return deny;
  const oneway =
    tags[`oneway:${key}`] ??
    (mode === 'walking'
      ? 'no'
      : ((mode === 'car' || mode === 'motorcycle' ? tags['oneway:motor_vehicle'] : undefined) ??
        tags['oneway:vehicle'] ??
        tags.oneway ??
        (tags.junction === 'roundabout' ? 'yes' : 'no')));
  if (!['yes', '1', 'true', 'no', '0', 'false', '-1'].includes(oneway)) return deny;
  let forward = oneway !== '-1',
    reverse = ['no', '0', 'false', '-1'].includes(oneway);
  for (const direction of ['forward', 'backward'] as const) {
    const value = keys.map((k) => tags[`${k}:${direction}`]).find(Boolean);
    if (value && !['yes', 'designated', 'permissive'].includes(value)) {
      if (direction === 'forward') forward = false;
      else reverse = false;
    }
  }
  return access.reversed ? { forward: reverse, reverse: forward } : { forward, reverse };
}
