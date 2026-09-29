-- One private library for club records, project history, event results, and
-- member assessments. Original files never receive public URLs.

create type public.member_library_processing_status as enum ('ready', 'failed');

alter table public.student_hackathon_requests
  add column ai_consent_at timestamptz;
alter table public.club_members
  add column ai_matching_consent_at timestamptz;

create table public.member_library_files (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  original_filename varchar(240) not null,
  storage_path text not null unique,
  content_type varchar(120) not null,
  file_size integer not null,
  sha256 varchar(64) not null unique,
  processing_status public.member_library_processing_status not null default 'ready',
  ai_enabled boolean not null default false,
  college_name varchar(180),
  created_at timestamptz not null default now(),
  constraint member_library_files_size_ck check (file_size > 0 and file_size <= 10485760)
);

create index member_library_files_created_idx on public.member_library_files (created_at desc);
create index member_library_files_ai_created_idx on public.member_library_files (ai_enabled, created_at desc);

create table public.member_library_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.member_library_files(id) on delete cascade,
  chunk_index integer not null,
  sheet_name varchar(120),
  spreadsheet_row integer,
  member_email text,
  content text not null,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  constraint member_library_chunks_file_order_uq unique (file_id, chunk_index)
);

create index member_library_chunks_member_email_idx on public.member_library_chunks (lower(member_email)) where member_email is not null;
create index member_library_chunks_file_idx on public.member_library_chunks (file_id);
create index member_library_chunks_search_idx on public.member_library_chunks using gin (search_vector);

alter table public.member_library_files enable row level security;
alter table public.member_library_chunks enable row level security;
revoke all on public.member_library_files, public.member_library_chunks from anon, authenticated;

create policy member_library_files_admin_read on public.member_library_files
  for select to authenticated using (public.has_admin_role());
create policy member_library_files_admin_write on public.member_library_files
  for all to authenticated using (public.has_admin_role()) with check (public.has_admin_role());
create policy member_library_chunks_admin_read on public.member_library_chunks
  for select to authenticated using (public.has_admin_role());
create policy member_library_chunks_admin_write on public.member_library_chunks
  for all to authenticated using (public.has_admin_role()) with check (public.has_admin_role());

-- Supabase Storage holds originals in a private bucket. The server uploads
-- with its server-only service key after requireAdminMember() succeeds.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-library',
  'member-library',
  false,
  10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain',
    'text/markdown',
    'application/json'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy member_library_storage_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'member-library' and public.has_admin_role());
create policy member_library_storage_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'member-library' and public.has_admin_role())
  with check (bucket_id = 'member-library' and public.has_admin_role());
