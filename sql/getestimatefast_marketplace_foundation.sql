-- Dedicated GetEstimateFast Supabase project only.
-- Additive schema; does not alter Orçamentos Brasil or existing customer requests.
alter table public.leads add column if not exists submission_token uuid;
create unique index if not exists leads_submission_token_key on public.leads(submission_token);
create index if not exists leads_status_created_idx on public.leads(status, created_at desc);
alter table public.leads add column if not exists admin_note text;
alter table public.leads add column if not exists reviewed_at timestamptz;

-- Admin identities must be explicitly approved by a trusted operator.
-- No public users can grant themselves access.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to service_role;

-- Status transition audit trail, written only by verified server-side administrators.
create table if not exists public.lead_status_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text not null,
  next_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists lead_status_events_lead_created_idx
  on public.lead_status_events(lead_id, created_at desc);
alter table public.lead_status_events enable row level security;
revoke all on public.lead_status_events from public, anon, authenticated;
grant select, insert on public.lead_status_events to service_role;
