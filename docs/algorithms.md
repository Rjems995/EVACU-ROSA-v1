# Risk inference and route generation

This is a transparent prototype model with manually chosen parameters. Membership curves, rule weights, blocking thresholds, walking speed, and capacity penalties require calibration and validation with local disaster-response staff before operational use.

## Inputs and geometry

Every road has a degradation value in `[0,1]`, with 0 clear and 1 impassable. Active hazards have severity in `[0,1]`. A GeoJSON line/polygon intersection test includes hazards touching or crossing a road, even when both road endpoints lie outside the polygon.

For a road, flood and fire inputs are the maximum intersecting severity of that type. Exposure is the maximum severity of **all three hazard types**, including earthquake. This keeps four fuzzy inputs while accounting for earthquake damage/exposure. Inactive hazards have no effect. These values are report severities; the app does not infer water depth, fire spread, or earthquake intensity from them.

## Fuzzification

For each normalized input `x`:

- `low(x) = max(0, 1 - 2x)` — left shoulder.
- `medium(x) = max(0, 1 - 2|x - 0.5|)` — triangle with peak 0.5.
- `high(x) = max(0, 2x - 1)` — right shoulder.

Inputs are clamped to `[0,1]`; nonfinite measurements are treated as worst-case (`1`). All points have coverage; adjacent sets overlap.

## Mamdani rule base

AND uses minimum, OR uses maximum. The following grouped rules correspond directly to the implementation:

1. IF flood is low AND fire is low AND degradation is low AND exposure is low, THEN risk is low.
2. IF any input is medium, THEN risk is medium.
3. IF any input is high, THEN risk is high.
4. IF flood is medium AND degradation is medium, THEN risk is high.
5. IF fire is medium AND exposure is medium, THEN risk is high.

Rules 2 and 3 each represent four single-antecedent rules. Each rule clips its output membership at its firing strength (`min` implication); all clipped outputs are merged by `max` aggregation.

## Output functions and centroid

Risk universe `z ∈ [0,100]`:

- Low: `max(0, 1 - z/35)`.
- Medium: `max(0, 1 - |z - 50|/30)`.
- High: `max(0, min(1, (z - 60)/40))`.

Centroid defuzzification evaluates `z = 0, 1, …, 100`: `score = Σ z·μ(z) / Σ μ(z)`. A zero-area result fails closed at 100. Labels: below 35 = low, 35 to below 70 = elevated, 70+ = high. A clear segment has a small nonzero centroid because the low-risk output has finite area; this is intentional.

## Exclusion and A*

A segment is unavailable if explicitly blocked, degradation ≥ 0.95, any intersecting active severity ≥ 0.85, or fuzzy score ≥ 80. These hard exclusions prevent trading a known severe hazard for a shorter path.

Graph nodes are stable `source`/`target` identifiers and endpoint coordinates. Edges preserve their original polyline geometry. `oneway` controls whether the reverse edge is available. Length sums Haversine distance over every vertex.

`edgeCost = max(polylineLengthMetres, baseCost) × (1 + 4 × risk / 100)`.

A* uses straight-line Haversine distance as the heuristic, which does not overestimate the edge cost **provided all roads sharing a node ID have identical endpoint coordinates**. Import validation must enforce this invariant. Costs cannot be less than geographic distance. The implementation reopens improved nodes and reconstructs ordered geometry, including reverse traversal. The frontier currently uses a linear scan; a priority queue and server-side graph partitioning are appropriate for larger regional datasets.

Origin and destination snap to the nearest graph node, not the nearest arbitrary accessible road. Origin snapping is limited to 500 m and shelter snapping to 150 m. A blocked nearest node is not silently bypassed by selecting a more distant node. The connector from a user to that node and from the last node to a shelter entrance is not assessed or included in the network distance; the interface discloses this. Production data should contain shelter entrance nodes to eliminate destination gaps.

## Shelter eligibility and ranking

Exclude closed/full shelters, unreachable shelters, and shelters inside active hazard polygons with severity ≥ 0.7. The optional step-free filter uses a shelter attribute, not route accessibility certification.

`score = routeCost + 600 × occupancy/capacity + 1200 × proximity`.

Proximity is the maximum active severity scaled linearly from 1 at the polygon to 0 at 1,000 m. For sites outside a polygon, this implementation approximates distance with its nearest boundary **vertex**; it is not an exact boundary-distance calculation. Sites inside a polygon use its full severity. Production calibration should replace this with PostGIS geography distance or another validated model.

Open: below 80% occupancy. Near full: 80% to below 100%. Full: no remaining capacity. Closed overrides capacity.

Walking ETA: `ceil(networkMetres / 65 × (1 + averageRisk/100))`, minimum one minute. Average risk is weighted by segment length. ETA does not include the unassessed approach, queues, actual traffic, mobility constraints, or real-time physical conditions. It is an estimate, not a guarantee of safety or arrival time.

## Data updates

Public snapshots are fetched in one database transaction and cached atomically in IndexedDB. The timestamp is the source dataset change time, not the time a cache is read. Reconnect, visibility changes, manual refresh, and a one-minute interval reload the snapshot. React recomputes rankings/routes whenever snapshot or origin/filter inputs change. Map-layer visibility never enters these computations.
