-- Member directory and private matching data for the DeScience Synergy Engine.
-- Imported member rows may exist before a person signs in. auth_user_id is
-- therefore nullable and is linked only by the trusted auth.users trigger.

create type public.club_membership_status as enum (
  'current',
  'alumnus',
  'mentor',
  'guest'
);

create type public.travel_flexibility as enum (
  'remote_only',
  'regional',
  'anywhere'
);

create type public.student_request_status as enum (
  'open',
  'matched',
  'completed'
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name varchar(160) not null,
  email text not null,
  college_name varchar(180) not null,
  membership_status public.club_membership_status not null default 'current',
  github_url text,
  linkedin_url text,
  portfolio_url text,
  primary_skills text[] not null default '{}',
  comfortable_tech text[] not null default '{}',
  interests text[] not null default '{}',
  college_year varchar(40),
  current_job_or_study varchar(180),
  location_city varchar(120),
  can_travel boolean not null default false,
  recent_projects jsonb not null default '[]'::jsonb,
  verified_member boolean not null default false,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_members_email_nonempty_ck check (length(trim(email)) > 3),
  constraint club_members_projects_array_ck check (jsonb_typeof(recent_projects) = 'array')
);

create unique index club_members_email_uq on public.club_members (email);
create index club_members_status_verified_idx on public.club_members (membership_status, verified_member);
create index club_members_location_idx on public.club_members (location_city) where location_city is not null;
create index club_members_skills_gin_idx on public.club_members using gin (primary_skills);
create index club_members_interests_gin_idx on public.club_members using gin (interests);

-- DISC combinations stay private and only approved assessments are stored.
create table public.member_assessments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  disc_profile varchar(100) not null,
  agile_score numeric(9,2) not null,
  assessed_at date not null default current_date,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_assessments_disc_ck check (length(trim(disc_profile)) > 0),
  constraint member_assessments_agile_score_ck check (agile_score >= 0)
);
create unique index member_assessments_member_assessed_uq on public.member_assessments (member_id, assessed_at);
create index member_assessments_assessed_idx on public.member_assessments (assessed_at desc);

create table public.student_hackathon_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_of_interest text not null,
  student_skills text[] not null default '{}',
  tech_comfort text[] not null default '{}',
  roles_sought text[] not null default '{}',
  concerns text not null default '',
  contribution_summary text not null,
  location_city varchar(120),
  travel_flexibility public.travel_flexibility not null default 'remote_only',
  status public.student_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_requests_interest_nonempty_ck check (length(trim(field_of_interest)) > 0),
  constraint student_requests_contribution_nonempty_ck check (length(trim(contribution_summary)) > 0)
);

create index student_requests_owner_status_idx on public.student_hackathon_requests (user_id, status, created_at desc);
create index student_requests_open_idx on public.student_hackathon_requests (created_at desc) where status = 'open';

create table public.team_recommendations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.student_hackathon_requests(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  recommended_teammates uuid[] not null default '{}',
  assigned_mentor_id uuid references public.club_members(id) on delete set null,
  match_reasoning text not null,
  created_at timestamptz not null default now(),
  constraint team_recommendations_reason_nonempty_ck check (length(trim(match_reasoning)) > 0),
  unique (request_id, hackathon_id)
);

create index team_recommendations_request_idx on public.team_recommendations (request_id, created_at desc);
create index team_recommendations_hackathon_idx on public.team_recommendations (hackathon_id);

-- A preloaded club roster row is associated with an Auth account only when the
-- account's confirmed email exactly matches that admin-imported roster email.
create or replace function public.normalize_club_member_email()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

revoke all on function public.normalize_club_member_email() from public, anon, authenticated;
create trigger club_members_normalize_email before insert or update of email on public.club_members
  for each row execute function public.normalize_club_member_email();

create or replace function public.link_auth_user_to_club_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null then
    update public.club_members
       set auth_user_id = new.id
     where auth_user_id is null
       and lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

revoke all on function public.link_auth_user_to_club_member() from public, anon, authenticated;
create trigger auth_user_link_club_member
  after insert or update of email on auth.users
  for each row execute function public.link_auth_user_to_club_member();

create trigger club_members_updated_at before update on public.club_members
  for each row execute function public.set_updated_at();
create trigger member_assessments_updated_at before update on public.member_assessments
  for each row execute function public.set_updated_at();
create trigger student_requests_updated_at before update on public.student_hackathon_requests
  for each row execute function public.set_updated_at();

-- Helpers run with the migration owner to avoid recursive RLS policy queries.
create or replace function public.is_verified_club_member()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.club_members m
     where m.auth_user_id = (select auth.uid())
       and m.verified_member
       and m.membership_status in ('current', 'alumnus', 'mentor')
  );
$$;

create or replace function public.has_admin_role()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
     where u.id = (select auth.uid()) and u.role = 'admin'
  );
$$;

-- Middleware uses this minimal RPC because auth_user_id and email are not
-- readable columns for clients, even when they filter their own directory row.
create or replace function public.current_member_access()
returns table (verified_member boolean, membership_status public.club_membership_status, is_admin boolean)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(m.verified_member, false),
    m.membership_status,
    public.has_admin_role()
  from (select (select auth.uid()) as user_id) current_user_id
  left join public.club_members m on m.auth_user_id = current_user_id.user_id
  limit 1;
$$;

revoke all on function public.is_verified_club_member() from public;
revoke all on function public.has_admin_role() from public;
revoke all on function public.current_member_access() from public;
grant execute on function public.is_verified_club_member() to authenticated;
grant execute on function public.has_admin_role() to authenticated;
grant execute on function public.current_member_access() to authenticated;

alter table public.club_members enable row level security;
alter table public.member_assessments enable row level security;
alter table public.student_hackathon_requests enable row level security;
alter table public.team_recommendations enable row level security;

-- Directory access is limited to verified members. Email, auth IDs, and other
-- private identifiers are additionally excluded from authenticated column grants.
create policy club_members_read_directory on public.club_members for select to authenticated
  using (public.is_verified_club_member() or auth_user_id = (select auth.uid()) or public.has_admin_role());
create policy club_members_admin_insert on public.club_members for insert to authenticated
  with check (public.has_admin_role());
create policy club_members_admin_update on public.club_members for update to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());
create policy club_members_admin_delete on public.club_members for delete to authenticated
  using (public.has_admin_role());

create policy member_assessments_owner_or_admin_read on public.member_assessments for select to authenticated
  using (
    public.has_admin_role()
    or exists (
      select 1 from public.club_members m
       where m.id = member_id and m.auth_user_id = (select auth.uid())
    )
  );
create policy member_assessments_admin_write on public.member_assessments for all to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());

create policy student_requests_owner_or_admin_read on public.student_hackathon_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_role());
create policy student_requests_verified_insert on public.student_hackathon_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_verified_club_member());
create policy student_requests_owner_update on public.student_hackathon_requests for update to authenticated
  using (user_id = (select auth.uid()) and public.is_verified_club_member())
  with check (user_id = (select auth.uid()) and public.is_verified_club_member());
create policy student_requests_owner_delete on public.student_hackathon_requests for delete to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_role());

create policy team_recommendations_owner_or_admin_read on public.team_recommendations for select to authenticated
  using (
    public.has_admin_role()
    or exists (
      select 1 from public.student_hackathon_requests r
       where r.id = request_id and r.user_id = (select auth.uid())
    )
  );
create policy team_recommendations_admin_write on public.team_recommendations for all to authenticated
  using (public.has_admin_role()) with check (public.has_admin_role());

-- Restrict browser-visible columns. Server-side ingestion uses the checked admin
-- endpoint and the server-only DATABASE_URL; the service role is never shipped.
revoke all on public.club_members, public.member_assessments,
  public.student_hackathon_requests, public.team_recommendations from anon, authenticated;
grant select (
  id, full_name, membership_status, github_url, linkedin_url, portfolio_url,
  college_name, primary_skills, comfortable_tech, interests, college_year,
  current_job_or_study, location_city, can_travel, recent_projects,
  verified_member, created_at, updated_at
) on public.club_members to authenticated;
grant insert (full_name, email, college_name, membership_status, github_url, linkedin_url, portfolio_url,
  primary_skills, comfortable_tech, interests, college_year, current_job_or_study,
  location_city, can_travel, recent_projects, verified_member)
  on public.club_members to authenticated;
grant update (full_name, email, college_name, membership_status, github_url, linkedin_url, portfolio_url,
  primary_skills, comfortable_tech, interests, college_year, current_job_or_study,
  location_city, can_travel, recent_projects, verified_member)
  on public.club_members to authenticated;
grant delete on public.club_members to authenticated;

grant select on public.member_assessments to authenticated;
grant insert, update, delete on public.member_assessments to authenticated;
grant select, insert, update, delete on public.student_hackathon_requests to authenticated;
grant select, insert, update, delete on public.team_recommendations to authenticated;

-- Server-side admin ingestion and matching use the service role only after
-- verifying the caller's Auth session, AAL2, and admin role.
grant all on public.club_members, public.member_assessments,
  public.student_hackathon_requests, public.team_recommendations to service_role;
