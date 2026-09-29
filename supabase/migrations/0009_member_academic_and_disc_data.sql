-- Extended private member master details. Demographic and academic fields are
-- deliberately absent from authenticated directory column grants and AI prompts.
alter table public.club_members
  add column degree varchar(120),
  add column department varchar(160),
  add column gender varchar(80),
  add column date_of_birth date,
  add column cgpa numeric(9, 2),
  add column cgpa_scale numeric(7, 2),
  add constraint club_members_cgpa_nonnegative_ck check (cgpa is null or cgpa >= 0),
  add constraint club_members_cgpa_scale_positive_ck check (cgpa_scale is null or cgpa_scale > 0);

create index club_members_ai_matching_consent_idx
  on public.club_members (ai_matching_consent_at)
  where ai_matching_consent_at is not null;

-- OriginBI results use the two-letter combination captured by the club's report.
alter table public.member_assessments
  drop constraint member_assessments_disc_ck;
alter table public.member_assessments
  add constraint member_assessments_disc_ck check (disc_profile in (
    'DI', 'DS', 'DC', 'ID', 'IS', 'IC', 'SD', 'SI', 'SC', 'CD', 'CI', 'CS'
  ));
