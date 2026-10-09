alter table public.contractor_profiles
  add column if not exists sms_phone_e164 text,
  add column if not exists sms_opt_out_at timestamptz;

update public.contractor_profiles
set sms_phone_e164 = case
  when regexp_replace(contact_phone,'[^0-9]','','g') ~ '^[2-9][0-9]{2}[2-9][0-9]{6}$'
    then '1' || regexp_replace(contact_phone,'[^0-9]','','g')
  when regexp_replace(contact_phone,'[^0-9]','','g') ~ '^1[2-9][0-9]{2}[2-9][0-9]{6}$'
    then regexp_replace(contact_phone,'[^0-9]','','g')
  else null
end
where sms_phone_e164 is null;

create unique index if not exists contractor_profiles_sms_phone_e164_uidx
  on public.contractor_profiles(sms_phone_e164)
  where sms_phone_e164 is not null;

create table if not exists public.sms_consent_events(
  id uuid primary key default gen_random_uuid(),
  provider text not null check(provider in ('zenvia','profile')),
  provider_event_id text not null unique,
  contractor_user_id uuid references public.contractor_profiles(user_id) on delete set null,
  event_type text not null check(event_type in ('STOP','HELP','OTHER','PROFILE_OPT_IN','PROFILE_OPT_OUT')),
  action text not null check(action in ('OPTED_OUT','OPTED_IN','HELP_RECORDED','IGNORED','UNKNOWN_CONTRACTOR')),
  provider_timestamp timestamptz,
  response_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sms_consent_events enable row level security;
revoke all on public.sms_consent_events from public, anon, authenticated;
grant select, insert on public.sms_consent_events to service_role;
