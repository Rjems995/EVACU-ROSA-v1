# Risk inference and route generation

This is a transparent prototype model with manually chosen parameters. Membership curves, rule weights, blocking thresholds, walking speed, and capacity penalties require calibration and validation with local disaster-response staff before operational use.

## Inputs and geometry

Every road has a degradation value in `[0,1]`, with 0 clear and 1 impassable. Active street reports have severity in `[0,1]` and reference a road ID. Only reports whose `road_id` equals the current segment's ID affect that segment. There is no polygon intersection or propagation to neighboring streets.

For a road, flood and fire inputs are the maximum active severity of that type reported on that road. Exposure is the maximum reported severity across all three types, including earthquake. An explicit blocked report excludes the segment even with low severity. Inactive/cleared reports have no effect; clearing one report does not clear other active reports.

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

A segment is unavailable if its road condition or any active linked report explicitly blocks it, degradation ≥ 0.95, any active linked severity ≥ 0.85, or fuzzy score ≥ 80. These exclusions are shared by routing and the public map's blocked-street styling.

Graph nodes are stable `source`/`target` identifiers and endpoint coordinates. Edges preserve their original polyline geometry. `oneway` controls whether the reverse edge is available. Length sums Haversine distance over every vertex.

`edgeCost = max(polylineLengthMetres, baseCost) × (1 + 4 × risk / 100)`.

A* uses straight-line Haversine distance as the heuristic, which does not overestimate the edge cost **provided all roads sharing a node ID have identical endpoint coordinates**. Import validation must enforce this invariant. Costs cannot be less than geographic distance. The implementation reopens improved nodes and reconstructs ordered geometry, including reverse traversal. The frontier currently uses a linear scan; a priority queue and server-side graph partitioning are appropriate for larger regional datasets.

Origin and destination snap to the nearest graph node, not the nearest arbitrary accessible road. Origin snapping is limited to 500 m and shelter snapping to 150 m. A blocked nearest node is not silently bypassed by selecting a more distant node. The connector from a user to that node and from the last node to a shelter entrance is not assessed or included in the network distance; the interface discloses this. Production data should contain shelter entrance nodes to eliminate destination gaps.

## Shelter eligibility and ranking

Exclude closed/full and unreachable shelters. Street reports do not invent area-wide shelter closures; operators must close a shelter explicitly if it is unsafe. The optional step-free filter uses a shelter attribute, not route accessibility certification.

`score = routeCost + 600 × occupancy/capacity + 1200 × proximity`.

Proximity is the maximum active severity scaled linearly from 1 at an affected street to 0 at 1,000 m. Distance uses the closest LineString vertex as an approximation; it is not exact line-distance calculation. This penalty affects shelter ordering only, not which neighboring streets are blocked. Production calibration should use a validated line-distance model.

Open: below 80% occupancy. Near full: 80% to below 100%. Full: no remaining capacity. Closed overrides capacity.

Walking ETA: `ceil(networkMetres / 65 × (1 + averageRisk/100))`, minimum one minute. Average risk is weighted by segment length. ETA does not include the unassessed approach, queues, actual traffic, mobility constraints, or real-time physical conditions. It is an estimate, not a guarantee of safety or arrival time.

## Data updates

Public snapshots are fetched in one database transaction and cached atomically in IndexedDB. The timestamp is the source dataset change time, not the time a cache is read. Reconnect, visibility changes, manual refresh, and a one-minute interval reload the snapshot. React recomputes rankings/routes whenever snapshot or origin/filter inputs change. Map-layer visibility never enters these computations.
