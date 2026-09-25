# No-route assistance alerts

Apply `supabase/migrations/003_assistance_requests.sql` once in Supabase SQL Editor before enabling this feature. This small migration adds the private assistance inbox and submission function; existing street/shelter data is preserved.

After selecting a location, users can opt in to automatic CDRRMO notification when a requested search finds no suitable route. Otherwise, the no-route screen offers **Share location and notify CDRRMO**. The exact selected location is shown; manually selected origins are identified as such. No request is automatically sent without opt-in. A no-route outcome can reflect shelter availability, accessibility filters, disconnected or incomplete data, or blocked roads; it is not proof of entrapment. The feature does not trigger merely because setup has no shelters or the origin is outside road coverage.

CDRRMO citywide accounts see **People requesting assistance**, including new/unresolved counts, location, optional contact/details, and acknowledgement/resolution controls. The panel polls every 15 seconds while open. There are no SMS, email, push, or closed-browser notifications. Acknowledgement is an administrative status, not confirmation that responders were dispatched.

Public submission uses a narrow database function. Public users cannot read assistance requests, and barangay accounts cannot read or modify them. No location/contact data is included in public snapshots or offline map caches. UUIDs make retries in the same open form idempotent; reopening the page may create a new request. Offline attempts explicitly report that they were not sent, with no background queue. Lost-response retries reuse the original payload. Requests are unverified public submissions; deployment should add abuse monitoring and appropriate rate limiting before public rollout.

Test submissions are mocked locally. No artificial emergency reports are sent to the connected CDRRMO database during tests. Database policy tests require a separate test project.
