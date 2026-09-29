-- A provider event URL identifies one observation even when it is currently
-- unmatched (hackathon_id is null, for which ordinary UNIQUE permits duplicates).
with duplicates as (
  select id, row_number() over (
    partition by provider, source_url order by observed_at desc, id desc
  ) as duplicate_rank
  from public.hackathon_source_checks
)
delete from public.hackathon_source_checks checks
using duplicates
where checks.id = duplicates.id and duplicates.duplicate_rank > 1;

alter table public.hackathon_source_checks
  drop constraint if exists hackathon_source_checks_provider_event_url_uq;
create unique index if not exists hackathon_source_checks_provider_url_uq
  on public.hackathon_source_checks (provider, source_url);
