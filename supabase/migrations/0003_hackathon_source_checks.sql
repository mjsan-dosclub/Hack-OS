-- Secondary directory observations support double-checking canonical events.
-- They are evidence only and never set public.hackathons.verified.
create type public.verification_provider as enum ('hackodds', 'hackathonradar', 'hackclub', 'hackamaps');
create type public.source_check_status as enum ('confirmed', 'conflict', 'unmatched');

create table public.hackathon_source_checks (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid references public.hackathons(id) on delete cascade,
  provider public.verification_provider not null,
  source_url text not null check (source_url ~ '^https://'),
  observed_at timestamptz not null default now(),
  matched_title varchar(240) not null,
  start_date timestamptz,
  end_date timestamptz,
  venue_city varchar(120),
  venue_country varchar(120),
  prize_currency varchar(3) check (prize_currency is null or prize_currency ~ '^[A-Z]{3}$'),
  total_prize_value integer check (total_prize_value is null or total_prize_value >= 0),
  match_score integer not null check (match_score between 0 and 100),
  check_status public.source_check_status not null,
  agreed_fields text[] not null default '{}',
  constraint hackathon_source_checks_dates_ck check (end_date is null or start_date is null or end_date >= start_date),
  constraint hackathon_source_checks_provider_event_url_uq unique (provider, hackathon_id, source_url)
);
create index hackathon_source_checks_event_observed_idx on public.hackathon_source_checks (hackathon_id, observed_at desc);
create index hackathon_source_checks_provider_observed_idx on public.hackathon_source_checks (provider, observed_at desc);

alter table public.hackathon_source_checks enable row level security;
create policy source_checks_public_read on public.hackathon_source_checks for select to anon, authenticated
  using (exists (
    select 1 from public.hackathons h
    where h.id = hackathon_id and h.published and h.verified
  ));
create policy source_checks_staff_read on public.hackathon_source_checks for select to authenticated
  using (public.has_staff_role());
create policy source_checks_staff_write on public.hackathon_source_checks for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());
grant select, insert, update, delete on public.hackathon_source_checks to authenticated;
grant select on public.hackathon_source_checks to anon;
-- Server ingestion must use the server-side service role, never a browser key.
grant all on public.hackathon_source_checks to service_role;
