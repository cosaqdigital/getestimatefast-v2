-- Independent GetEstimateFast contractor foundation; no public signup in this phase.
create table if not exists public.contractor_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 2 and 120),
 business_name text,
 contact_phone text not null,
 contact_email text not null,
 base_zip text not null check(base_zip ~ '^[0-9]{5}$'),
 city text not null,
 state_code text not null check(state_code ~ '^[A-Z]{2}$'),
 service_radius_miles integer not null default 25 check(service_radius_miles between 1 and 100),
 service_categories text[] not null default '{}',
 bio text,
 account_status text not null default 'pending_review' check(account_status in ('pending_review','active','suspended','rejected')),
 email_verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists contractor_profiles_coverage_idx on public.contractor_profiles(state_code,base_zip);
create index if not exists contractor_profiles_status_idx on public.contractor_profiles(account_status);
alter table public.contractor_profiles enable row level security;
revoke all on public.contractor_profiles from public, anon, authenticated;
grant select, insert, update on public.contractor_profiles to service_role;

create table if not exists public.contractor_verification_events (
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
 actor_admin_id uuid references auth.users(id) on delete set null,
 prior_status text, next_status text not null,
 note text, created_at timestamptz not null default now()
);
alter table public.contractor_verification_events enable row level security;
revoke all on public.contractor_verification_events from public, anon, authenticated;
grant select,insert on public.contractor_verification_events to service_role;
-- Contractors cannot view customer contact information or self-grant active status.
