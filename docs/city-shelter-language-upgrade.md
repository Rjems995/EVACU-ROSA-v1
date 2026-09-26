# City streets, shelter operations and Filipino controls

## Existing Supabase project

Your existing tables, users and reports stay in place. Do not rerun the original table creation.

1. In SQL Editor, run all of [004_shelter_operations.sql](../supabase/migrations/004_shelter_operations.sql) once. Migrations 001–003 must already be installed.
2. Run the **21 numbered files** under [city-road-upgrade](../supabase/city-road-upgrade/README.md), from `01-streets.sql` through `21-streets.sql`. Replace editor contents between files and wait for success each time. The files are deliberately small enough for SQL Editor.
3. Refresh the public app and sign in to `/admin`. Choose **Shelters → Edit record**. Update occupancy, availability, supplies and notes; publish with **Save changes**.

Street imports can be retried. They add missing IDs and populate original OSM junction IDs only where existing geometry and endpoint IDs still match. Existing street names, conditions, closures, hazard reports and shelter records are preserved. Manually edited geometry or topology is left untouched. Imports do not certify a street as passable. In-progress imports expose a partial network until every batch finishes.

New installations can follow the original setup guide, then apply this upgrade. `npm run prepare:database` continues to generate the original setup batches; `node scripts/expand-city-roads.mjs <city-overpass.json>` regenerates this separate additive upgrade. This generator is pinned to the committed extract timestamp. Later OSM refreshes require a reviewed migration to avoid duplicating roads linked to incident reports.

## Shelter workflow

- **Open:** accepting arrivals when occupancy is below capacity.
- **Paused:** temporarily not accepting new arrivals. The shelter remains visible but is excluded from route recommendations.
- **Closed:** unavailable; excluded from recommendations.
- **Supplies:** unknown, adequate, low or unavailable for drinking water, food and first aid. Unknown is the default; no supplies are assumed.
- **Entrance:** place the house pin at the actual entrance. Check “Entrance pin checked in person by staff” only after local verification. Moving the pin clears the checkbox. Routing still ends at the nearest mapped network point, within 150 m; the gap is not assessed.
- **Updates:** a public note, server timestamp and existing change history support handovers. Public shelter details flag updates older than 24 hours. This does not automatically close a shelter.

Existing authorization applies: citywide administrators manage all shelters; barangay administrators manage shelters in their assigned barangay. There is no new unrestricted staff role. Supabase row-level security stays enabled.

## Public controls

The header language selector switches between English and Filipino and saves the preference in the browser. The selected position, route, accessibility filter and assistance consent stay intact when switching languages. The public evacuation flow is translated; the CDRRMO administration panel remains English. Place names, street names and staff-entered notes are shown as recorded.

Primary emergency controls are at least 52 px high, with concise steps for choosing a location, finding a shelter and opening navigation. Language selection, map layers and location controls have at least 44 px targets.

## Data limits

The city dataset contains 10,946 segments: 5,000 preserved legacy segments and 5,946 additions, including disconnected mapped paths. Junctions use OSM node IDs; crossing lines do not imply a connection. New roads exclude mapped `foot=no/private` (or general `access=no/private` when no foot override exists), motorways, trunks and non-walkable highway categories. Steps remain possible on walking routes; the shelter accessibility filter does not promise a wheelchair-accessible route.

The area query uses [Santa Rosa OSM relation 1335521](https://www.openstreetmap.org/relation/1335521). Boundary-crossing ways and legacy border streets can extend outside the city. It is broader mapped coverage, not a field-certified complete network. Gates, node restrictions, conditional access, barangay assignment, physical accessibility and incident freshness still need local review. The generated `legacy-access-review.json` lists 496 original segments absent from the permitted city-area extract (including border streets); it is a review list, not 496 confirmed closures.

The public Supabase key cannot apply migrations. No live schema or reports are changed by building or testing this upgrade.
