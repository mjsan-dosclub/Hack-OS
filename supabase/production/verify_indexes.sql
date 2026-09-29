-- Run using psql (outside a transaction) against the production database after backup.
-- CREATE INDEX CONCURRENTLY avoids blocking normal writes while the index is built.
-- Existing single-column and search indexes are retained; these add common query paths.

create index concurrently if not exists hackathons_public_deadline_format_idx
  on public.hackathons (registration_deadline asc nulls last, format, start_date)
  where published = true and verified = true
    and application_status in ('open', 'upcoming');

create index concurrently if not exists hackathons_public_dates_idx
  on public.hackathons (start_date, end_date)
  where published = true and verified = true;

create index concurrently if not exists hackathons_public_format_deadline_idx
  on public.hackathons (format, registration_deadline asc nulls last, start_date)
  where published = true and verified = true
    and application_status in ('open', 'upcoming');

create index concurrently if not exists hackathons_search_idx
  on public.hackathons using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

-- Verification: expected indexes should be present and valid (indisvalid = true).
select
  expected.index_name,
  pg_indexes.indexdef,
  coalesce(index_state.indisvalid, false) as is_valid
from (values
  ('hackathons_public_deadline_format_idx'),
  ('hackathons_public_dates_idx'),
  ('hackathons_public_format_deadline_idx'),
  ('hackathons_search_idx')
) as expected(index_name)
left join pg_indexes
  on pg_indexes.schemaname = 'public'
  and pg_indexes.indexname = expected.index_name
left join pg_namespace as index_namespace on index_namespace.nspname = 'public'
left join pg_class as index_class
  on index_class.relname = expected.index_name
  and index_class.relnamespace = index_namespace.oid
left join pg_index as index_state on index_state.indexrelid = index_class.oid
order by expected.index_name;
