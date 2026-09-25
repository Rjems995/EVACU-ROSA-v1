# SQL Editor setup

Regenerate these files with `npm run prepare:database`. Run them individually, in this order. Replace all editor contents between files; do not append them. Wait for success before continuing.

1. [00-create-tables.sql](00-create-tables.sql)
2. [01-import-streets.sql](01-import-streets.sql)
3. [02-import-streets.sql](02-import-streets.sql)
4. [03-import-streets.sql](03-import-streets.sql)
5. [04-import-streets.sql](04-import-streets.sql)
6. [05-import-streets.sql](05-import-streets.sql)
7. [06-import-streets.sql](06-import-streets.sql)
8. [07-import-streets.sql](07-import-streets.sql)
9. [08-import-streets.sql](08-import-streets.sql)

Run the table file only once on a fresh database. Street imports preserve existing rows and may be retried. The final street file enables the operational dataset. These files contain no fictional shelters or incidents. If any file fails, stop and report the error.

For assistance alerts, also apply [migration 003](../migrations/003_assistance_requests.sql) once. Existing projects should apply only missing migrations, not rerun table creation.
