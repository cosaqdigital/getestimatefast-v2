alter table public.contractor_profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.contractor_profiles add column if not exists privacy_version text;
alter table public.contractor_profiles add column if not exists terms_accepted_at timestamptz;
alter table public.contractor_profiles add column if not exists terms_version text;
-- No public grants. Membership and verification are checked server-side.
