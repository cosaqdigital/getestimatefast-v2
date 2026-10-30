-- PREPARED MIGRATION. DO NOT APPLY AUTOMATICALLY.
-- This creates the server-only queue needed before live opportunity SMS can be enabled.
-- It does not send SMS and does not change any environment variable.
begin;

create table if not exists public.opportunity_sms_queue (
  id uuid primary key default gen_random_uuid(),
  matching_recipient_id uuid not null unique
    references public.opportunity_matching_recipients(id) on delete cascade,
  opportunity_id uuid not null
    references public.opportunity_previews(id) on delete cascade,
  contractor_user_id uuid not null
    references public.contractor_profiles(user_id) on delete cascade,
  recipient_phone_e164 text,
  status text not null check (status in (
    'QUEUED',
    'BLOCKED_INACTIVE',
    'BLOCKED_NO_CONSENT',
    'BLOCKED_INVALID_PHONE',
    'SENDING',
    'SENT',
    'FAILED',
    'DELIVERED'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  provider_message_id text unique,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 80),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_sms_queue_phone_check check (
    recipient_phone_e164 is null
    or recipient_phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
  )
);

create index if not exists opportunity_sms_queue_dispatch_idx
  on public.opportunity_sms_queue(status,next_attempt_at,created_at)
  where status in ('QUEUED','FAILED');

alter table public.opportunity_sms_queue enable row level security;
revoke all on public.opportunity_sms_queue from public,anon,authenticated;
grant select,insert,update on public.opportunity_sms_queue to service_role;

commit;
