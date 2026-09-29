-- Keep eligibility and submission requirements in the shared directory contract.
alter table public.hackathons
  add column if not exists eligibility_rules text not null default 'Eligibility details have not been published.',
  add column if not exists submission_guidelines text not null default 'Check the official event page for submission requirements.';
