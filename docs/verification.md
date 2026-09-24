# Verification record

Executed locally on Windows on 2026-09-24 with Node.js **22.23.3**, npm **10.9.9**, and the dependency versions recorded in `package-lock.json`.

| Check | Result |
| --- | --- |
| Production Next.js build and TypeScript compilation | Passed |
| Fuzzy inference, routing, ranking, and input-validation unit tests | 17 passed |
| Browser suite, including installed Microsoft Edge | 19 passed; 5 deliberately skipped duplicate axe audits |
| Public route selection, hazard tabs, theme toggle, horizontal overflow | Passed in Chromium, Edge, Firefox, WebKit, Pixel 7 emulation, iPhone 13 emulation |
| Offline page reload, IndexedDB recovery, local route computation | Passed in Chromium, Edge, Firefox, Pixel 7 emulation |
| Actual-origin outage reload and cached local routing | Passed in WebKit and iPhone 13 emulation |
| Read-only admin demo and rejection of unauthenticated writes | Passed across all six browser configurations |
| Axe WCAG A/AA/2.1 AA semantic/contrast checks | No violations in the tested public light/dark states and admin demo, Chromium |
| npm dependency audit after updates | 0 reported vulnerabilities |

WebKit's `context.setOffline(true)` causes service-worker navigation to fail with an internal browser error, even for a literal cached response. This is a [documented Playwright issue](https://github.com/microsoft/playwright/issues/42775). The WebKit tests therefore serve the app through a temporary local proxy, warm the application cache, **stop that proxy**, and reload with the origin genuinely unavailable. No failed navigation is swallowed or marked as a pass. This checks origin-outage recovery, not every Safari network condition.

The public shell and initial scripts/styles are cached during service-worker installation. A performance observer sends already-loaded dynamic scripts/styles to the worker, covering assets fetched before first-visit worker control. Map tiles, admin pages, and API responses are excluded from service-worker caching. Public spatial data is independently stored in IndexedDB.

## External checks still required

- Apply the PostGIS migration/seed against a real Supabase instance and run `supabase/tests/rls.sql`. No project credentials were available during this build, so database execution, real administrator sign-in, authenticated CRUD, and role enforcement were **not integration-tested**. The SQL test script covers anonymous access, own/cross-barangay changes, self-escalation, regular authenticated users, citywide writes, and audit permissions.
- Verify actual official boundaries, shelters, road topology, access restrictions, incident reporting, and capacity freshness. The included roads and polygons are synthetic.
- Test on physical Android phones/tablets, iPhones/iPads, and the target desktop Chrome/Edge/Firefox versions. Browser-engine emulation is useful evidence, not physical-device certification.
- Perform manual screen-reader/keyboard testing, enlarged text, touch/pinch gestures, poor GPS reception, low-memory/storage conditions, long outages, and update recovery after a deployment. Automated axe checks do not prove full WCAG compliance.
- Calibrate risk rules, block thresholds, route costs and ETA assumptions with responsible disaster-response staff; assess graph size and API load before rollout.
- Provision HTTPS hosting, Supabase production settings, backups, monitoring, and a GitHub remote. No cloud project or public deployment was created.
