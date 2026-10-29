alter table public.sms_consent_events
  drop constraint if exists sms_consent_events_provider_check,
  add constraint sms_consent_events_provider_check check(provider in ('zenvia','telnyx','profile'));

alter table public.sms_consent_events
  drop constraint if exists sms_consent_events_event_type_check,
  add constraint sms_consent_events_event_type_check check(event_type in ('STOP','START','HELP','OTHER','PROFILE_OPT_IN','PROFILE_OPT_OUT'));

create table if not exists public.sms_delivery_events(
  id uuid primary key default gen_random_uuid(),
  provider text not null check(provider='telnyx'),
  provider_event_id text not null unique,
  message_id text not null,
  event_type text not null check(event_type in ('message.sent','message.finalized')),
  delivery_status text,
  error_codes text[] not null default '{}',
  provider_timestamp timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sms_delivery_events_message_id_idx on public.sms_delivery_events(message_id);
alter table public.sms_delivery_events enable row level security;
revoke all on public.sms_delivery_events from public, anon, authenticated, service_role;
grant select, insert on public.sms_delivery_events to service_role;


alter table public.sms_consent_events
  add column if not exists response_error_stage text,
  add column if not exists response_error_http_status integer,
  add column if not exists response_error_code text;


alter table public.sms_consent_events
  add column if not exists webhook_version text;

grant update on table public.sms_consent_events to service_role;
