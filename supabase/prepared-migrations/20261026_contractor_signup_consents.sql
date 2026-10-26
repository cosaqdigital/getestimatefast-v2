begin;

create table if not exists public.contractor_signup_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text not null,
  contact_phone text not null,
  sms_phone_e164 text not null,
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  privacy_accepted_at timestamptz not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists contractor_signup_consents_phone_idx
  on public.contractor_signup_consents(sms_phone_e164);

alter table public.contractor_signup_consents enable row level security;
revoke all on public.contractor_signup_consents from public, anon, authenticated;
grant select, insert, update on public.contractor_signup_consents to service_role;

commit;
