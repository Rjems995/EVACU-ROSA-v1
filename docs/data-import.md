# Preparing operational spatial data

The SQL seed is a reproducible **synthetic test fixture near Santa Rosa**, not official geographic data. Importing and approving authoritative data is an external prerequisite.

1. Obtain verified evacuation facilities and current capacity/status from the responsible local authority. Record a Point in WGS84/EPSG:4326 and connect the actual entrance to the road network. Confirm access and facility attributes.
2. Obtain approved city and barangay polygons. The two seed rectangles are illustrative sectors, not actual administrative boundaries. Import Polygon geometry; split MultiPolygon boundaries into separate records or deliberately extend the schema to support MultiPolygon.
3. Obtain an OSM road extract under its license. Build a walkable graph using appropriate access tags; exclude private/restricted/impassable ways as required by validated local policy. Split ways at actual traversable intersections, preserve bridges/tunnels and grade separation, assign stable node IDs, and set walking direction restrictions. OSM is not itself a guarantee of emergency accessibility.
4. Import WGS84 LineStrings. Every shared node ID must refer to exactly the same coordinate. Edge geometries must begin/end at their declared source/target. Keep `base_cost >= 0`; 0 uses measured length. Include shelter approach edges and model barriers. Validate topology, duplicates, components, and near-coincident junctions before enabling routes.
5. Assign every writable road/hazard/shelter record to an official barangay. A cross-boundary road should be split at the boundary or managed under a documented citywide policy. The application does not automatically spatially verify a text barangay assignment.
6. Load an authorized hazard feed with report timestamps and normalized severity. Polygon intersection uses all active hazards, including earthquake exposure. Review thresholds with responders. Every insert/update/delete creates an operational audit record; public data polling is once per minute.
7. Remove synthetic records, confirm geometry validity and bounds, run RLS checks, compare generated paths with approved routes, and validate performance at expected scale. The browser currently loads the full city graph, so graph-size limits and profiling are essential before deployment.
8. Only after approval, have a database operator set:

```sql
update public.dataset_metadata set is_demo = false, updated_at = now() where id;
```

Use transactional imports. Preserve source attribution and license notices; the public base map already displays OpenStreetMap attribution. Do not prefetch standard OSM tiles for offline use. If offline background mapping is required, choose a tile provider/license explicitly permitting it and implement a separately bounded tile cache.
