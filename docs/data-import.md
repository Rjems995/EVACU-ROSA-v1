# Preparing operational spatial data

The SQL batches in `supabase/sql-editor-setup/` contain **OSM streets only**. They are not an approved evacuation dataset. See `src/data/README.md` for provenance, bounds, and import limitations. Apply migrations 001 and 002 before importing the street batches. Fictional incidents and shelters remain only in the JSON test fixture and are not exported to SQL.

1. Obtain verified evacuation facilities and current capacity/status from the responsible local authority. Record a Point in WGS84/EPSG:4326 and connect the actual entrance to the road network. Confirm access and facility attributes.
2. Obtain approved city and barangay polygons. The demo includes no boundary polygons; its boundary toggle is disabled until these are supplied. Import Polygon geometry; split MultiPolygon boundaries into separate records or extend the schema to support MultiPolygon.
3. Obtain an OSM road extract under its license. Build a walkable graph using appropriate access tags; exclude private/restricted/impassable ways as required by validated local policy. Split ways at actual traversable intersections, preserve bridges/tunnels and grade separation, assign stable node IDs, and set walking direction restrictions. OSM is not itself a guarantee of emergency accessibility.
4. Import WGS84 LineStrings. Every shared node ID must refer to exactly the same coordinate. Edge geometries must begin/end at their declared source/target. Keep `base_cost >= 0`; 0 uses measured length. Include shelter approach edges and model barriers. Validate topology, duplicates, components, and near-coincident junctions before enabling routes.
5. Assign every road/shelter to an official barangay. The OSM sample uses an explicit unassigned value instead of guessing. A cross-boundary road should be split or managed under a citywide policy. A street hazard report automatically inherits its road's barangay; no spatial area is fabricated.
6. Have CDRRMO publish flood/fire/earthquake records in `road_hazards` by selecting existing road IDs, severity, blocked state, and notes. The report geometry comes from the road LineString. Every change is audited; public polling is once per minute. Review thresholds with responders.
7. Remove synthetic records, confirm geometry validity and bounds, run RLS checks, compare generated paths with approved routes, and validate performance at expected scale. The browser currently loads the full city graph, so graph-size limits and profiling are essential before deployment.
8. Only after approval, have a database operator set:

```sql
update public.dataset_metadata set is_demo = false, updated_at = now() where id;
```

Use transactional imports. Preserve source attribution and license notices; the public base map already displays OpenStreetMap attribution. Do not prefetch standard OSM tiles for offline use. If offline background mapping is required, choose a tile provider/license explicitly permitting it and implement a separately bounded tile cache.
