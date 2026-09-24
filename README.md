# EVACU-ROSA

A responsive evacuation-map application for Santa Rosa City, Laguna. Built with Next.js App Router, React, TypeScript, Tailwind CSS, Leaflet, Supabase Auth, PostgreSQL/PostGIS, Mamdani fuzzy inference, A* routing, and IndexedDB.

**The default dataset is a synthetic demonstration, not operational evacuation guidance.** The place names, capacities, road links, hazard reports, and rectangular boundaries are illustrative. No official city endorsement or data verification is implied.

## Run locally

Node.js 22+ is required. This workspace includes a checksum-verified portable Node installation under the ignored `.tools` directory. In PowerShell:

```powershell
. .\scripts\use-node.ps1
npm.cmd install
npm.cmd run dev
```

Open <http://localhost:3000>. Use **Try sample location**, then **Find Shelter Now**. The admin preview is at `/admin`. The app works in demo mode without any account or environment variables.

The helper changes PATH only in the current PowerShell session. For another terminal, dot-source it again. Alternatively install Node.js system-wide and use normal `npm` commands.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```

## Connect Supabase

1. Create a Supabase project. Run `supabase/migrations/001_initial.sql` in its SQL editor. It enables PostGIS in `extensions`, creates tables, spatial indexes, RLS policies, audit triggers, and the public snapshot RPC.
2. For a **disposable demonstration database only**, run `supabase/seed.sql`. This loads the same synthetic graph and illustrative locations as the browser demo. Seed data stays explicitly marked as demonstration data.
3. Copy `.env.example` to `.env.local`. Fill in your project URL and public anon key. Never put the service-role key in a `NEXT_PUBLIC_` variable. Restart/rebuild Next.js after changing these values.
4. Create an administrator in Supabase **Authentication → Users**. Assign its UUID using the SQL editor:

```sql
insert into public.admin_accounts(user_id, role, barangay)
values ('AUTH-USER-UUID-HERE', 'citywide', null);
```

5. Sign in at `/admin`. City administrators can assign/revoke app roles for **existing Auth users**. Creating Auth identities, password resets, and deleting Auth identities remain in the Supabase dashboard; the application deliberately has no service-role credential.
6. Run the RLS verification script in a disposable Supabase database: `supabase/tests/rls.sql`. It rolls back its fixtures.

Barangay administrators can write only records in their assigned barangay. Citywide/CDRRMO administrators can manage all operational records and other administrators. Nobody can change their own app role through the API or ordinary authenticated database access. Public clients can read operational information, but cannot modify it or see administrator accounts/audit history. The API uses the caller's JWT, verifies it with `auth.getUser()`, and leaves RLS enabled for every write.

## What is included

- Public map, location permission flow, manual map point selection, shelter search, accessible-entrance filter, hazard toggles, boundary toggle, ranked shelters, route display and segment list.
- Flood, fire, and earthquake overlays. Hiding a map layer **never** removes it from risk calculations.
- Capacity/status indicators, reported facilities, walking-time estimates, high-contrast dark theme, mobile sticky primary action, semantic forms/buttons, keyboard-accessible shelter list, reduced-motion support.
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
| `/api/admin/hazard_zones` | GET/POST/PATCH/DELETE | Hazard management |
| `/api/admin/roads` | GET/POST/PATCH/DELETE | Road management |
| `/api/admin/admin_accounts` | GET/POST/PATCH/DELETE | City-admin role assignments |
| `/api/admin/incident_logs` | GET | Authorized history, newest first |

Route body: `{"origin":[121.109,14.297],"accessibleOnly":false}`. Coordinates are always **longitude, latitude**. Admin requests require `Authorization: Bearer <access_token>`; PATCH/DELETE require `?id=<uuid>`. PATCH accepts a complete editable record, not an arbitrary partial update. Geometry input is GeoJSON in `geometry`. SQL stores GeoJSON in `geom` and generates a typed, indexed PostGIS `location` column from it. Public output is serialized from PostGIS with `ST_AsGeoJSON`.

## Algorithms and limitations

See [docs/algorithms.md](docs/algorithms.md) for membership functions, rule base, centroid defuzzification, A* costs, shelter ranking, snapping thresholds, and ETA assumptions.

The sample is a functional prototype, not a validated emergency system. Supabase migrations and RLS integration require a connected instance to execute. Real Android/iOS devices and local responder workflows require field acceptance. Step-free shelter filtering does not guarantee a wheelchair-accessible route. Hazard proximity is an approximate penalty, not a physical hazard model.

## Replacing the synthetic data

Import verified shelter locations and capacity reports, official city/barangay polygons, an approved hazard feed, and a properly noded OSM-derived road graph. See [docs/data-import.md](docs/data-import.md). The included graph is intentionally synthetic; it is not an OSM road extract. The base map is OSM.

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
