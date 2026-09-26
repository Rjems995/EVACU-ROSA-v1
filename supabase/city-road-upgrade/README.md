# City street upgrade

Run migration 004 first, then all 21 numbered SQL files in order. Replace SQL Editor contents between files. Existing reports, road conditions, shelter records and street IDs are preserved. Do not rerun table creation. Imports can be retried.

5000 existing segments plus 5946 additional OSM street/footpath segments. Disconnected components are retained; no connectors are invented. Area query uses Santa Rosa relation 1335521; ways crossing the city edge may extend beyond it. Coverage depends on OSM and is not a completeness or passability guarantee. New paths exclude mapped private/no foot access and motorways. Existing streets require local review: 496 legacy segments were not in the current permitted walking extract. Their live conditions are never overwritten.

1. [01-streets.sql](01-streets.sql)
2. [02-streets.sql](02-streets.sql)
3. [03-streets.sql](03-streets.sql)
4. [04-streets.sql](04-streets.sql)
5. [05-streets.sql](05-streets.sql)
6. [06-streets.sql](06-streets.sql)
7. [07-streets.sql](07-streets.sql)
8. [08-streets.sql](08-streets.sql)
9. [09-streets.sql](09-streets.sql)
10. [10-streets.sql](10-streets.sql)
11. [11-streets.sql](11-streets.sql)
12. [12-streets.sql](12-streets.sql)
13. [13-streets.sql](13-streets.sql)
14. [14-streets.sql](14-streets.sql)
15. [15-streets.sql](15-streets.sql)
16. [16-streets.sql](16-streets.sql)
17. [17-streets.sql](17-streets.sql)
18. [18-streets.sql](18-streets.sql)
19. [19-streets.sql](19-streets.sql)
20. [20-streets.sql](20-streets.sql)
21. [21-streets.sql](21-streets.sql)

Reproduce: node scripts/expand-city-roads.mjs <city-overpass.json>. Data © OpenStreetMap contributors, ODbL. Source: https://www.openstreetmap.org/relation/1335521
