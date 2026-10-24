alter table public.contractor_profiles add column if not exists sms_opt_in boolean not null default false;
alter table public.contractor_profiles add column if not exists sms_opt_in_at timestamptz;
create table if not exists public.opportunity_sms_simulations(
 id uuid primary key default gen_random_uuid(),
 matching_recipient_id uuid not null unique references public.opportunity_matching_recipients(id) on delete cascade,
 status text not null check(status in ('SIMULATED','BLOCKED_NO_CONSENT','BLOCKED_INACTIVE')),
 message_preview text not null,
 created_at timestamptz not null default now()
);
alter table public.opportunity_sms_simulations enable row level security;
revoke all on public.opportunity_sms_simulations from public,anon,authenticated;
grant select,insert on public.opportunity_sms_simulations to service_role;
