# Verification record

## City, shelter and language upgrade — 2026-09-26

- Production builds and TypeScript compilation passed with both unconfigured and mocked-project settings; the normal project build is restored after testing.
- **43 unit tests passed**, including preservation of all 5,000 original street geometries/IDs, internal OSM junctions, blocked segments, foot directionality, paused shelters and supply validation.
- Public route, language persistence, shelter status, assistance consent and navigation checks passed on desktop Chromium/Firefox/WebKit and Pixel 7/iPhone 13 browser profiles over targeted runs. The new language test checks against actual viewport width, avoiding a false pass when mobile browsers expand the layout viewport.
- Mobile testing exposed two layout problems that were fixed: the location message covered coordinate entry, and the language selector widened the header. Messages now sit in the location section and the phone header wraps.
- Offline and hazard-map checks passed on Firefox and iPhone after reruns with longer **local-only** timing limits on a loaded workstation. CI timeout settings were not relaxed. Earlier default-timeout runs had startup/map-loading timeouts; this is not a single clean full-suite result.
- **10 mocked admin tests passed** across all five profiles: batch street hazards and barangay shelter updates, including clearing entrance verification when moving the pin. No live reports, alerts or shelters were written.
- Browser fixtures now serve test snapshots directly and block external map tiles. The offline test removes the snapshot mock before disconnecting or stopping its origin proxy, so it still verifies genuine cached recovery.

Migration 004 and the 21 additive road batches were prepared but **not executed against Supabase**. Live database migration/RLS integration and local road/entrance validation remain external checks. See [the upgrade guide](city-shelter-language-upgrade.md).

## CI fixes verified 2026-09-25

Reproduced the CI browser setup locally on Windows with real Supabase credentials excluded from the test processes. Public suite: **71 passed, 9 intentional skips** (five admin tests run separately and four duplicate accessibility audits). A second build with a fake Supabase URL/key then passed all **five** mocked admin batch tests across Chromium, Firefox, WebKit, Pixel 7, and iPhone 13 emulation. No live database writes were performed. GitHub's Ubuntu workflow still needs to run after pushing these changes.

The admin batch test now reads explicitly supplied environment variables, not `.env.local`. The workflow builds an unconfigured public app and a separate mocked admin app. Assistance tests block service workers so WebKit cannot bypass their request mocks, following [Playwright's network-testing guidance](https://playwright.dev/docs/network). Offline tests still enable service workers: Chromium uses offline emulation, while Firefox/WebKit stop a temporary origin proxy and verify cached reload and routing with the server genuinely unavailable.

Workflow actions were updated to Node-24-compatible releases and the runner is pinned to Ubuntu 24.04. The app itself continues to use Node 22. Public tests reuse the already-built app instead of repeating the same build.

## Earlier verification

Executed locally on Windows on 2026-09-24 with Node.js **22.23.3**, npm **10.9.9**, and the dependency versions recorded in `package-lock.json`.

| Check | Result |
| --- | --- |
| Production Next.js build and TypeScript compilation | Passed |
| Fuzzy inference, street-ID routing, ranking, input validation, and mocked API authorization unit tests | 23 passed |
| Browser suite, including installed Microsoft Edge | 49 passed; 5 deliberately skipped duplicate axe audits |
| Public route selection, hazard tabs, theme toggle, horizontal overflow | Passed in Chromium, Edge, Firefox, WebKit, Pixel 7 emulation, iPhone 13 emulation |
| Offline page reload, IndexedDB recovery, local route computation | Passed in Chromium, Edge, Firefox, Pixel 7 emulation |
| Actual-origin outage reload and cached local routing | Passed in WebKit and iPhone 13 emulation |
| Read-only admin demo and rejection of unauthenticated writes | Passed across all six browser configurations |
| Automatic location, denied permission fallback, and late-GPS/manual-selection race | Passed across all six browser configurations |
| Street-only hazard lines, blocked street names, and layer filtering | Passed across all six browser configurations |
| CDRRMO street search/segment selection preview with no polygon entry | Passed across all six browser configurations |
| Axe WCAG A/AA/2.1 AA semantic/contrast checks | No violations in the tested public light/dark states and admin demo, Chromium |
| npm dependency audit after updates | 0 reported vulnerabilities |

WebKit's `context.setOffline(true)` causes service-worker navigation to fail with an internal browser error, even for a literal cached response. This is a [documented Playwright issue](https://github.com/microsoft/playwright/issues/42775). The WebKit tests therefore serve the app through a temporary local proxy, warm the application cache, **stop that proxy**, and reload with the origin genuinely unavailable. No failed navigation is swallowed or marked as a pass. This checks origin-outage recovery, not every Safari network condition.

The public shell and initial scripts/styles are cached during service-worker installation. A performance observer sends already-loaded dynamic scripts/styles to the worker, covering assets fetched before first-visit worker control. Map tiles, admin pages, and API responses are excluded from service-worker caching. Public spatial data is independently stored in IndexedDB.

## External checks still required

- Apply migrations 001 and 002 against a real Supabase instance and run `supabase/tests/rls.sql` and `supabase/tests/street-hazards.sql`. No project credentials were available, so database execution, real sign-in, and authenticated CRUD were **not integration-tested**. Mocked API tests verify rejection of unauthenticated/barangay publication, acceptance of CDRRMO requests, missing-road rejection, and rejection of client-authored geometry. SQL tests additionally cover database RLS, provenance, duplicate reports, and clearance auditing.
- Verify official boundaries, shelters, road topology, access restrictions, incident reporting, and capacity freshness. The road geometry now comes from OSM; incidents and shelters remain fictional and no official boundaries are included.
- Test on physical Android phones/tablets, iPhones/iPads, and the target desktop Chrome/Edge/Firefox versions. Browser-engine emulation is useful evidence, not physical-device certification.
- Perform manual screen-reader/keyboard testing, enlarged text, touch/pinch gestures, poor GPS reception, low-memory/storage conditions, long outages, and update recovery after a deployment. Automated axe checks do not prove full WCAG compliance.
- Calibrate risk rules, block thresholds, route costs and ETA assumptions with responsible disaster-response staff; assess graph size and API load before rollout.
- Provision HTTPS hosting, Supabase production settings, backups, monitoring, and a GitHub remote. No cloud project or public deployment was created.
