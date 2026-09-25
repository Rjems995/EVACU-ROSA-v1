# Enable CDRRMO reporting

The public app no longer falls back to fictional incidents or shelters. Without a database, it shows the OSM street map and a setup status. Old demonstration snapshots are rejected when reading offline storage.

1. Create a Supabase project and apply `supabase/migrations/001_initial.sql` followed by `002_street_hazards.sql` in the SQL editor.
2. On a fresh project run `supabase/roads-only.sql`. This imports only the partial OSM road network, preserves existing road rows, and enables an empty operational dataset. It refuses to enable a dataset containing existing demonstration incidents or shelters. Do **not** use `supabase/seed.sql`; that file is only for disposable tests.
3. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project URL and public anon key. Never use a service-role key here. Rebuild and restart the app.
4. Create the CDRRMO user through Supabase Authentication. Assign the user's UUID in the SQL editor:

```sql
insert into public.admin_accounts(user_id, role, barangay)
values ('REPLACE-WITH-AUTH-USER-UUID', 'citywide', null);
```

5. Open `/admin` and sign in. Add locally verified shelters under **Shelters**. Review road access and coverage before operational use; the imported network is partial, with unverified barangay assignments.
6. Under **Street hazards**, choose **Report flooding**, **Report fire**, or **Report earthquake damage**. Tap multiple affected street segments on the map or select their search checkboxes (up to 100). Tap a selected street again or use **Remove** to deselect it. Review the selected list, set shared severity, blocked status, and report details, then **Publish report**. All selected streets save in one transaction. If an active report of the same hazard type already exists on a selected street, the entire batch is rejected; deselect that street or edit its existing report. Editing existing reports remains per street. No additional migration is required for multi-street reporting.
7. To clear an incident, choose **Mark as cleared**, review the selected street, and **Save cleared report**. History is retained. Other active hazards or road conditions can still block that street.

Only authenticated citywide/CDRRMO accounts can publish or clear street incidents; the server and database both enforce this. The public map refreshes within one minute, on returning to the page, or using **Refresh data**. Reports persist in the shared database and are visible across devices.

No database migrations or user provisioning have been run by this workspace. Until connection setup is complete, report forms can be prepared but publishing is disabled.
