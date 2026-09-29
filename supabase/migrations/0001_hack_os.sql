-- Core extensions, enums, tables, indexes, timestamp triggers, and RLS policies.
create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.user_role as enum ('member', 'moderator', 'admin');
create type public.hackathon_format as enum ('online', 'in-person', 'hybrid');
create type public.application_status as enum ('upcoming', 'open', 'closed', 'ended');
create type public.hackathon_source as enum ('devpost', 'devfolio', 'unstop', 'manual', 'mlh');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- Role is assigned by trusted service/admin tooling; profile owners cannot promote themselves.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(100),
  github_username varchar(39),
  skills text[] not null default '{}',
  bio varchar(500),
  university varchar(180),
  social_links text[] not null default '{}',
  role public.user_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_github_username_uq on public.users (lower(github_username)) where github_username is not null;
create index users_university_idx on public.users (university);

create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  slug varchar(180) not null unique,
  title varchar(240) not null,
  description text not null default '',
  organizer varchar(180) not null,
  website_url text not null,
  banner_url text,
  format public.hackathon_format not null,
  venue_city varchar(120),
  venue_country varchar(120),
  latitude double precision,
  longitude double precision,
  prize_currency varchar(3) not null default 'USD' check (prize_currency ~ '^[A-Z]{3}$'),
  total_prize_value integer not null default 0 check (total_prize_value >= 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  registration_deadline timestamptz,
  application_status public.application_status not null default 'upcoming',
  source public.hackathon_source not null,
  source_id varchar(240),
  verified boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hackathons_dates_order_ck check (end_date >= start_date),
  constraint hackathons_coordinates_pair_ck check ((latitude is null) = (longitude is null)),
  constraint hackathons_latitude_ck check (latitude is null or latitude between -90 and 90),
  constraint hackathons_longitude_ck check (longitude is null or longitude between -180 and 180),
  unique (source, source_id)
);
create index hackathons_deadline_idx on public.hackathons (registration_deadline);
create index hackathons_dates_idx on public.hackathons (start_date, end_date);
create index hackathons_location_idx on public.hackathons (latitude, longitude);
create index hackathons_public_status_idx on public.hackathons (published, verified, application_status);
create index hackathons_search_idx on public.hackathons using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

create table public.hackathon_tracks (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  title varchar(180) not null,
  description text not null default '',
  prize_amount integer not null default 0 check (prize_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hackathon_tracks_hackathon_idx on public.hackathon_tracks (hackathon_id);

create table public.hackathon_tags (
  id uuid primary key default gen_random_uuid(),
  slug varchar(64) not null unique,
  name varchar(80) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.hackathon_tag_links (
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  tag_id uuid not null references public.hackathon_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hackathon_id, tag_id)
);
create index hackathon_tag_links_tag_idx on public.hackathon_tag_links (tag_id);

create table public.saved_hackathons (
  user_id uuid not null references public.users(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);
create index saved_hackathons_hackathon_idx on public.saved_hackathons (hackathon_id);

-- Apply update timestamps in the database regardless of write path.
create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger hackathons_updated_at before update on public.hackathons for each row execute function public.set_updated_at();
create trigger hackathon_tracks_updated_at before update on public.hackathon_tracks for each row execute function public.set_updated_at();
create trigger hackathon_tags_updated_at before update on public.hackathon_tags for each row execute function public.set_updated_at();
create trigger saved_hackathons_updated_at before update on public.saved_hackathons for each row execute function public.set_updated_at();

-- SECURITY DEFINER helper avoids recursive users-table RLS checks. Only trusted role values grant admin powers.
create or replace function public.has_staff_role()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role in ('moderator', 'admin')
  );
$$;
revoke all on function public.has_staff_role() from public;
grant execute on function public.has_staff_role() to authenticated;

alter table public.users enable row level security;
alter table public.hackathons enable row level security;
alter table public.hackathon_tracks enable row level security;
alter table public.hackathon_tags enable row level security;
alter table public.hackathon_tag_links enable row level security;
alter table public.saved_hackathons enable row level security;

-- Anyone may discover only records intentionally published and verified by staff.
create policy hackathons_public_read on public.hackathons for select to anon, authenticated
  using (published and verified);
create policy hackathons_staff_all on public.hackathons for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());
create policy tracks_public_read on public.hackathon_tracks for select to anon, authenticated
  using (exists (select 1 from public.hackathons h where h.id = hackathon_id and h.published and h.verified));
create policy tracks_staff_all on public.hackathon_tracks for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());
create policy tags_public_read on public.hackathon_tags for select to anon, authenticated using (true);
create policy tags_staff_all on public.hackathon_tags for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());
create policy tag_links_public_read on public.hackathon_tag_links for select to anon, authenticated
  using (exists (select 1 from public.hackathons h where h.id = hackathon_id and h.published and h.verified));
create policy tag_links_staff_all on public.hackathon_tag_links for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());

-- A user can read and edit only their own profile. Role changes are still blocked
-- by column grants: client roles can update profile columns but not role/id.
create policy users_read_self_or_staff on public.users for select to authenticated
  using (id = (select auth.uid()) or public.has_staff_role());
create policy users_insert_self on public.users for insert to authenticated
  with check (id = (select auth.uid()) and role = 'member');
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_staff_update on public.users for update to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());
create policy users_delete_self on public.users for delete to authenticated
  using (id = (select auth.uid()));
grant select, insert, delete on public.users to authenticated;
grant update (display_name, github_username, skills, bio, university, social_links) on public.users to authenticated;

create policy saved_hackathons_owner_all on public.saved_hackathons for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- SQL privileges are required in addition to RLS policies. These grants define
-- which operations may be attempted; the policies define which rows may pass.
grant select on public.hackathons, public.hackathon_tracks, public.hackathon_tags, public.hackathon_tag_links to anon, authenticated;
grant insert, update, delete on public.hackathons, public.hackathon_tracks, public.hackathon_tags, public.hackathon_tag_links to authenticated;
grant select, insert, update, delete on public.saved_hackathons to authenticated;

-- Ingestion uses the Supabase service role from server-side jobs only; service_role
-- bypasses RLS. Never ship its key to browser code.
