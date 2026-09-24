# Street-level reporting and automatic location

The public app requests the browser's current location when it opens. Permission is always controlled by the browser and operating system; the app cannot bypass a denial. Automatic location requires HTTPS or localhost. If unavailable, residents can use the map or enter coordinates. A manual selection cancels the effect of a pending location callback. The initial location is used locally and is not automatically uploaded or persisted.

## CDRRMO workflow

1. Sign in with a `citywide` (CDRRMO) account and open **Street hazards → Report street hazard**.
2. Click the affected street segment on the map, or search the street name and select a segment from the keyboard-accessible list. A street may have several segments between junctions; publish a report for each affected segment.
3. Choose flood, fire, or earthquake; set severity and whether the segment is blocked; add report details. High severity (85%+) also excludes the segment from routing.
4. Save. The public map refreshes within one minute or when manually refreshed. Red solid lines mean blocked; amber dashed lines mean affected. Street names, hazard types, status, and report details are available in map labels/popups and the hazard list.
5. Edit the report and set **Active hazard → No** when the incident is cleared. Another active incident or independent road closure can still keep that segment blocked.

The report references an existing road ID. Its map geometry is always derived from that road's PostGIS LineString, not a hand-drawn rectangle. Neighboring streets and shared junctions do not inherit the report. Only CDRRMO/citywide users can create/update/delete street reports, enforced by both the API and database RLS. Barangay users retain their existing scoped operational permissions but cannot publish street hazard reports. Reports retain actor/timestamp history. One active report of each hazard type is allowed per segment.

## Database upgrade

Apply `supabase/migrations/002_street_hazards.sql` after migration 001. This preserves existing `hazard_zones` polygons as a read-only city-admin archive, creates `road_hazards`, and upgrades the public snapshot RPC. Existing polygons are **not automatically converted to street closures**; CDRRMO must identify the affected streets.

New installs must apply both migrations before running `supabase/seed.sql`. The seed is for a fresh disposable demonstration database, not for replacing live records. OSM streets require official topology/access/barangay review before live use.

Public snapshots use `schemaVersion: 2`. Cached snapshots from the old polygon model are rejected, so reconnect at least once after upgrading to populate the new offline cache. Live Supabase execution and authenticated operations still require integration testing against your own project.
