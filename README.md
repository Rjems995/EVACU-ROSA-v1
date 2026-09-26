# EVACU-ROSA

A responsive evacuation-map application for Santa Rosa City, Laguna. Built with Next.js App Router, React, TypeScript, Tailwind CSS, Leaflet, Supabase Auth, PostgreSQL/PostGIS, Mamdani fuzzy inference, A* routing, and IndexedDB.

**The default public map contains streets only, with no fictional shelters or incidents.** Connect Supabase to enable CDRRMO sign-in and shared reports using [the CDRRMO setup guide](docs/cdrrmo-setup.md). The expanded dataset contains 10,946 OpenStreetMap street/footpath segments, selected using the Santa Rosa city area. Completeness, access and local conditions still need field verification. Official boundaries are not included. See [street data attribution](src/data/README.md).

**Existing Supabase projects:** apply [migration 004](supabase/migrations/004_shelter_operations.sql), then the 21 [city street upgrade batches](supabase/city-road-upgrade/README.md). This adds shelter operations fields and streets while retaining existing road IDs and reports. See [the upgrade guide](docs/city-shelter-language-upgrade.md).

## Run locally

Node.js 22+ is required. This workspace includes a checksum-verified portable Node installation under the ignored `.tools` directory. In PowerShell:

```powershell
. .\scripts\use-node.ps1
npm.cmd install
npm.cmd run dev
```

Open <http://localhost:3000>. The app requests your location automatically; allow the browser prompt to use it, or choose a point on the map. The CDRRMO panel is at `/admin`, with **Report flooding**, **Report fire**, and **Report earthquake damage**. Without credentials, reports can be prepared but publishing is disabled. No routes are offered until verified shelters are published.

The helper changes PATH only in the current PowerShell session. For another terminal, dot-source it again. Alternatively install Node.js system-wide and use normal `npm` commands.

If PowerShell blocks `.ps1` scripts, use this session-only PATH command instead:

```powershell
$env:Path = "$PWD\.tools\node-v22.23.3-win-x64;$env:Path"
```

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

## Connect Supabase

1. Create a Supabase project. Run `001_initial.sql`, then `002_street_hazards.sql` from `supabase/migrations/` in its SQL editor. Existing installs need migration 002. It creates CDRRMO-only street reports and preserves old polygon reports as an administrator-only archive.
2. Import the numbered street batches in [SQL Editor setup](supabase/sql-editor-setup/README.md). Skip `00-create-tables.sql` if you already applied migrations 001 and 002. These batches import streets only. Regenerate them with `npm run prepare:database`. Apply migration `003_assistance_requests.sql` once to enable assistance alerts.
3. Copy `.env.example` to `.env.local`. Fill in your project URL and public anon key. Never put the service-role key in a `NEXT_PUBLIC_` variable. Restart/rebuild Next.js after changing these values.
4. Create an administrator in Supabase **Authentication → Users**. Assign its UUID using the SQL editor:

```sql
insert into public.admin_accounts(user_id, role, barangay)
values ('AUTH-USER-UUID-HERE', 'citywide', null);
```

5. Sign in at `/admin`. City administrators can assign/revoke app roles for **existing Auth users**. Creating Auth identities, password resets, and deleting Auth identities remain in the Supabase dashboard; the application deliberately has no service-role credential.
6. Run the RLS verification script in a disposable Supabase database: `supabase/tests/rls.sql`. It rolls back its fixtures.

Barangay administrators can manage assigned shelters/road conditions. **Only citywide/CDRRMO administrators publish, update, or clear street hazard reports.** Nobody can change their own app role through the API or ordinary authenticated database access. The API verifies the caller's JWT with `auth.getUser()` and leaves RLS enabled for every write. See the [reporting workflow and migration guide](docs/street-reporting.md).

## What is included

- Automatic location request with permission/HTTPS fallback, manual coordinates/map selection, shelter search, accessible-entrance filter, hazard toggles, ranked shelters, and route details.
- Flood, fire, and earthquake reports highlight only the selected street segment: red for blocked, amber for affected, paired with status text and named street labels. Hiding a layer **never** removes its reports from routing.
- Capacity/status indicators, reported facilities, walking-time estimates, high-contrast dark theme, mobile sticky primary action, semantic forms/buttons, keyboard-accessible shelter list, reduced-motion support.
- English/Filipino public controls with a saved language preference; location, routing, assistance consent and shelter information translate without resetting the current route. Recorded street names and staff notes remain unchanged.
- Staff can update shelter occupancy, temporarily pause arrivals, report water/food/first-aid supplies, add a public note and confirm an entrance pin. Paused, full and closed shelters are excluded from recommendations. Updates are timestamped and audited; entries older than 24 hours are flagged.
- CRUD for shelters, hazards, road conditions/geometry, and app administrator roles; immutable operational change history. Admin tables are presented as responsive cards.
- IndexedDB snapshots including the graph, shelters, boundaries, and hazards. Offline route computation uses that snapshot. Online/reconnect/visibility events and a one-minute poll update data and recalculate displayed routes.
- Service worker for the public app shell and same-origin static assets. Admin pages and API responses are not service-worker cached. OpenStreetMap tiles are **not** cached or downloaded in bulk. Offline maps still show saved geometry, hazards, routes, and shelter markers; background tiles may be absent.

Service-worker registration is enabled in production builds. Use `npm run build` followed by `npm start` to test offline reloads; development mode keeps hot-reload assets out of the offline cache.

## API

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/snapshot` | GET | Consistent public dataset, source timestamp, demo flag |
| `/api/shelters` | GET | Public shelter list |
| `/api/hazards` | GET | Hazard reports |
| `/api/routes` | POST | Ranked reachable shelters and routes |
| `/api/admin/evacuation_centers` | GET/POST/PATCH/DELETE | Shelter management |
| `/api/admin/road_hazards` | GET/POST/PATCH/DELETE | Street reports; CDRRMO-only writes |
| `/api/admin/roads` | GET/POST/PATCH/DELETE | Road management |
| `/api/admin/admin_accounts` | GET/POST/PATCH/DELETE | City-admin role assignments |
| `/api/admin/incident_logs` | GET | Authorized history, newest first |

Route body: `{"origin":[121.109,14.297],"accessibleOnly":false}`. Coordinates are always **longitude, latitude**. Admin requests require `Authorization: Bearer <access_token>`; PATCH/DELETE require `?id=<uuid>`. PATCH accepts a complete editable record, not an arbitrary partial update. Geometry input is GeoJSON in `geometry`. SQL stores GeoJSON in `geom` and generates a typed, indexed PostGIS `location` column from it. Public output is serialized from PostGIS with `ST_AsGeoJSON`.

Street reports accept `{road_id, hazard_type, severity, blocked, active, notes}`. Geometry is derived from the referenced road, never accepted from the report form or request body. The database sets the report's barangay and author.

## Algorithms and limitations

See [docs/algorithms.md](docs/algorithms.md) for membership functions, rule base, centroid defuzzification, A* costs, shelter ranking, snapping thresholds, and ETA assumptions.

Supabase migrations and RLS integration require a connected instance to execute. Real Android/iOS devices and local responder workflows require field acceptance. Step-free shelter filtering does not guarantee a wheelchair-accessible route. Hazard proximity is an approximate penalty, not a physical hazard model.

## Replacing the synthetic data

Verify the sample OSM graph or replace it with an approved full-city network, import verified shelters and official boundaries, and have CDRRMO publish actual street incidents. See [docs/data-import.md](docs/data-import.md) and [the extract provenance](src/data/README.md). The sample has unverified access/topology and no official barangay assignments.

After validation, a database operator can set `dataset_metadata.is_demo = false`. That flag is not writable by app administrators. Remove all synthetic records first. The application does not silently fall back to demo data if a configured Supabase service fails; it displays an error and uses previously cached data where available.

## Browser checks

```powershell
. .\scripts\use-node.ps1
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.tools\browsers"
npx.cmd playwright install chromium firefox webkit
npm.cmd run test:e2e
```

Playwright covers desktop Chromium/Firefox/WebKit and Android/iPhone viewport emulation. This is not a claim of physical-device certification. See [docs/verification.md](docs/verification.md) for the test record and remaining external checks.

On a machine with Edge installed, set `$env:EVACU_TEST_EDGE = '1'` before running browser tests to include branded Microsoft Edge. `npm run test:e2e` builds the production app automatically and requires port 3000 to be free.

## Version control

Generated files, dependencies, portable tooling, secrets, and browser results are ignored. A GitHub Actions workflow runs type checks, unit tests, a production build, and browser tests. Create a private GitHub repository and add it as the remote when ready; no repository is published by this scaffold.

## Reference documentation

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [Supabase JWT verification with getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
