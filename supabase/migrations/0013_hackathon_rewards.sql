-- Store individual cash and non-cash event rewards with source evidence.
create table public.hackathon_rewards (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  name varchar(180) not null,
  category varchar(24) not null,
  recipient varchar(100) not null default 'Not specified',
  details text not null default '',
  amount numeric(14, 2),
  currency varchar(3),
  source_excerpt text not null default '',
  source_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hackathon_rewards_category_ck check (
    category in ('cash', 'software', 'credits', 'certificate', 'interview', 'kit', 'merchandise', 'other')
  ),
  constraint hackathon_rewards_amount_ck check (amount is null or amount >= 0),
  constraint hackathon_rewards_currency_ck check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint hackathon_rewards_amount_currency_ck check ((amount is null) = (currency is null)),
  constraint hackathon_rewards_source_url_ck check (source_url ~ '^https://')
);

create index hackathon_rewards_event_idx on public.hackathon_rewards (hackathon_id);
create trigger hackathon_rewards_updated_at before update on public.hackathon_rewards
  for each row execute function public.set_updated_at();

alter table public.hackathon_rewards enable row level security;
create policy hackathon_rewards_public_read on public.hackathon_rewards for select to anon, authenticated
  using (exists (
    select 1 from public.hackathons h
    where h.id = hackathon_id and h.published and h.verified
  ));
create policy hackathon_rewards_staff_all on public.hackathon_rewards for all to authenticated
  using (public.has_staff_role()) with check (public.has_staff_role());

grant select on public.hackathon_rewards to anon, authenticated;
grant insert, update, delete on public.hackathon_rewards to authenticated;
grant all on public.hackathon_rewards to service_role;

-- Preserve already-entered cash pools and explicit goodies while moving to the
-- itemized model; the detail text makes this legacy backfill visible to admins.
insert into public.hackathon_rewards
  (hackathon_id, name, category, recipient, details, amount, currency, source_excerpt, source_url)
select id, 'Total cash prize pool', 'cash', 'Event winners',
  'Migrated from the existing cash prize pool field.', total_prize_value, prize_currency, '', website_url
from public.hackathons
where total_prize_value > 0 and cash_prize_status = 'announced';

insert into public.hackathon_rewards
  (hackathon_id, name, category, recipient, details, amount, currency, source_excerpt, source_url)
select id, 'Goodies / swag', 'merchandise', 'Not specified',
  'Migrated from the existing goodies flag.', null, null, '', website_url
from public.hackathons
where goodies_available = true;
