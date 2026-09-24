-- DEMONSTRATION ONLY: synthetic graph and illustrative areas near Santa Rosa, Laguna.
-- Names do not designate officially approved evacuation sites. Run only on a fresh demo DB.
set search_path = public, extensions;
insert into public.evacuation_centers(name,barangay,capacity,occupancy,status,accessible,amenities,geom) values
 ('City Sports Complex','Tagapo',500,128,'open',true,array['Drinking water','Toilets','First aid'],'{"type":"Point","coordinates":[121.109,14.303]}'),
 ('Balibago Community Hall','Balibago',250,211,'open',true,array['Drinking water','Toilets'],'{"type":"Point","coordinates":[121.097,14.291]}'),
 ('Tagapo Covered Court','Tagapo',350,94,'open',true,array['Drinking water','Toilets','First aid'],'{"type":"Point","coordinates":[121.121,14.303]}'),
 ('Pulong Santa Cruz Center','Pulong Santa Cruz',200,52,'open',false,array['Drinking water','Toilets'],'{"type":"Point","coordinates":[121.091,14.285]}'),
 ('Dita Community School','Dita',300,300,'open',true,array['Drinking water','Toilets','First aid'],'{"type":"Point","coordinates":[121.115,14.285]}'),
 ('Aplaya Community Center','Aplaya',180,40,'open',true,array['Drinking water','Toilets'],'{"type":"Point","coordinates":[121.127,14.309]}');
insert into public.roads(name,barangay,source,target,base_cost,condition,geom)
select 'Training link ' || x || '-' || y, 'Tagapo', x || '-' || y, (x+dx) || '-' || (y+dy), 0,
 case when x=5 and y=2 then 0.55 else 0.05 end,
 extensions.st_asgeojson(extensions.st_makeline(extensions.st_setsrid(extensions.st_makepoint(121.085+x*.006,14.279+y*.006),4326),extensions.st_setsrid(extensions.st_makepoint(121.085+(x+dx)*.006,14.279+(y+dy)*.006),4326)))::jsonb
from generate_series(0,7) x cross join generate_series(0,5) y cross join (values (1,0),(0,1)) d(dx,dy)
where x+dx < 8 and y+dy < 6;
insert into public.hazard_zones(name,barangay,hazard_type,severity,geom) values
 ('Flood-prone lakeside area','Aplaya','flood',.9,extensions.st_asgeojson(extensions.st_makeenvelope(121.122,14.3,121.133,14.316,4326))::jsonb),
 ('Reported structure fire','Balibago','fire',.9,extensions.st_asgeojson(extensions.st_makeenvelope(121.089,14.294,121.096,14.301,4326))::jsonb),
 ('Earthquake inspection area','Dita','earthquake',.55,extensions.st_asgeojson(extensions.st_makeenvelope(121.113,14.281,121.121,14.287,4326))::jsonb);
insert into public.barangay_boundaries(name,kind,geom) values
 ('Illustrative study area','city',extensions.st_asgeojson(extensions.st_makeenvelope(121.081,14.275,121.135,14.316,4326))::jsonb),
 ('Illustrative west sector','barangay',extensions.st_asgeojson(extensions.st_makeenvelope(121.081,14.275,121.107,14.316,4326))::jsonb),
 ('Illustrative east sector','barangay',extensions.st_asgeojson(extensions.st_makeenvelope(121.107,14.275,121.135,14.316,4326))::jsonb);
