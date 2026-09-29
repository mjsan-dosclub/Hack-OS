alter table public.hackathon_source_checks
  add column if not exists format public.hackathon_format;
