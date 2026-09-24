# Santa Rosa sample street network

`santa-rosa-roads.json` contains an OpenStreetMap-derived road graph and explicitly fictional shelter/incident fixtures. Geometry and names are **© OpenStreetMap contributors**, distributed under **ODbL 1.0**: https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/ . The JSON records the source timestamp and query bounding box.

The included graph contains 5,000 street segments in the largest connected component of the downloaded sample. It preserves OSM way geometry and shared node IDs, splitting ways at junctions. This is a sample-area extract, not certified complete Santa Rosa coverage. Ways intersecting the query box may extend outside it. Polygon areas are not used to infer road closures.

The import excludes ways tagged `access=private/no` or `foot=no`, and excludes motorway/trunk/primary roads. It recognizes `oneway:foot`. Gate/node restrictions, official barangay assignments, crossings, accessibility, and field conditions still need verification. Imported streets are deliberately marked “Unassigned — verify with CDRRMO” instead of assigning invented barangays.

Rebuild the fixture and a **fresh-database-only** SQL seed:

```text
node scripts/import-osm.mjs path/to/overpass-response.json
```

Query used against `https://overpass-api.de/api/interpreter`:

```text
[out:json][timeout:45];
way["highway"~"^(residential|tertiary|secondary|unclassified|living_street|service|pedestrian|footway|path|steps)$"]
["access"!~"^(private|no)$"]["foot"!="no"](14.28,121.08,14.335,121.135);
out body; >; out skel qt;
```

The import script generates sample flood/fire/earthquake reports on named street segments. These are not observed incidents or CDRRMO publications. Shelter positions are snapped to the sample graph for testing and do not identify validated facilities. No fabricated boundary polygons are included.
