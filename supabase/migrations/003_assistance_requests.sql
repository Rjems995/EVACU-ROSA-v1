begin;
create table public.assistance_requests (
  id uuid primary key,
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  location_source text not null check (location_source in ('gps','selected')),
  details text not null default '' check (length(details) <= 500),
  contact text not null default '' check (length(contact) <= 120),
  status text not null default 'new' check (status in ('new','acknowledged','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.assistance_requests(status,created_at desc);
alter table public.assistance_requests enable row level security;
revoke all on public.assistance_requests from anon, authenticated;
grant select on public.assistance_requests to authenticated;
grant update(status) on public.assistance_requests to authenticated;
create policy cdrrmo_read on public.assistance_requests for select to authenticated using (public.is_city_admin());
create policy cdrrmo_update on public.assistance_requests for update to authenticated using (public.is_city_admin()) with check (public.is_city_admin());

-- Public callers can submit but cannot list or read anyone's location/contact.
-- A client-generated UUID makes retries idempotent, including lost responses.
create function public.submit_assistance_request(request_id uuid, lng double precision, lat double precision, source text, message text, contact_info text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if request_id is null or lng is null or lat is null or source is null or message is null or contact_info is null then
    raise exception 'Missing request fields';
  end if;
  insert into public.assistance_requests(id,longitude,latitude,location_source,details,contact)
  values(request_id,lng,lat,source,message,contact_info)
  on conflict (id) do nothing;
  return request_id;
end;
$$;
revoke all on function public.submit_assistance_request(uuid,double precision,double precision,text,text,text) from public;
grant execute on function public.submit_assistance_request(uuid,double precision,double precision,text,text,text) to anon, authenticated;
create function public.touch_assistance_request() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger assistance_updated before update on public.assistance_requests for each row execute function public.touch_assistance_request();
commit;
