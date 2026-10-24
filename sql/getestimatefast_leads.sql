-- GetEstimateFast ONLY. Run in a newly provisioned, dedicated Supabase project.
-- Do not execute in orcamentos-brasil or any other existing business database.
create extension if not exists pgcrypto;
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  service_type text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  zip_code text not null,
  contact_method text,
  details jsonb not null default '{}'::jsonb,
  source text not null default 'getestimatefast.com',
  status text not null default 'new' check (status in ('new','qualified','published','closed','rejected'))
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_location_service_idx on public.leads (zip_code, service_type);
alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;
grant select, insert, update on table public.leads to service_role;
-- No anon/authenticated policies. Only a secret server-side key may insert/read.
