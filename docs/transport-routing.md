# Transport-aware routing and rerouting

Snapshot responses enrich matching roads with access tags from the committed OSM access extract. No Supabase migration is needed. Road IDs and existing reports are preserved. Matching requires the same committed road ID, endpoints and coordinates (legacy database rows do not include OSM way IDs); edited or unknown roads do not inherit stale permissions. Regenerate with `node scripts/extract-road-access.mjs` using the original extracts in `.tools`.

The extract uses OSM snapshots dated September 24–25, 2026. Attribution: © OpenStreetMap contributors, ODbL-1.0. Source semantics: https://wiki.openstreetmap.org/wiki/Key:access and https://wiki.openstreetmap.org/wiki/Key:oneway.

Walking, cycling, motorcycles and cars use access precedence, road-type defaults and mode-specific direction restrictions. Private, destination-only, unsupported conditional restrictions and unknown permissions are conservatively excluded. Unknown roads retain legacy walking behavior but are excluded for other modes. Motorways/trunks are excluded; no motorcycle engine-size assumptions are made. Turn restrictions, barrier nodes, lane guidance, live traffic, width and parking are not modeled. Follow road signs and responder instructions; this is not a guarantee of passability.

During navigation, GPS fixes with accuracy of 30 metres or better update the route origin after at least 30 metres of movement. Snapshot refreshes (currently every 60 seconds, or on manual/visibility refresh) also recalculate routes. The selected shelter is retained if still reachable and accepting people; otherwise the next ranked shelter is selected with an update notice. If no suitable route remains, guidance stops and displays a CDRRMO contact notice. No assistance request is sent without the existing explicit consent flow.

Voice remains a route overview, not turn-by-turn prompts. Changing directions cancels old speech. GPS loss does not fabricate a new position. Arrival remains a local confirmation and does not change shelter occupancy or resolve assistance requests.
