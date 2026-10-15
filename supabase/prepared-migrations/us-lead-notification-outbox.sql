-- PREPARED ONLY: CLI unavailable. No migration-history timestamp invented.
-- Review/apply exclusively to the separately authorized GetEstimateFast schema.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create schema gef_notifications;
revoke all on schema gef_notifications from public, anon, authenticated;
grant usage on schema gef_notifications to service_role;

create table gef_notifications.lead_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','processing','retry','sent','exhausted')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default clock_timestamp(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  payload_sha256 text check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  error_code text check (error_code in ('RATE_LIMIT','PROVIDER_UNAVAILABLE','PROVIDER_REJECTED','TRANSPORT_UNKNOWN','INVALID_RESPONSE','PAYLOAD_CHANGED','RETRY_EXHAUSTED')),
  provider_id text check (length(provider_id) <= 128),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  check ((state='processing') = (lease_token is not null and lease_until is not null)),
  check ((state='sent') = (sent_at is not null))
);
create index lead_outbox_due_idx on gef_notifications.lead_outbox(next_attempt_at,created_at) where state in ('pending','retry');
create index lead_outbox_lease_idx on gef_notifications.lead_outbox(lease_until) where state='processing';
alter table gef_notifications.lead_outbox enable row level security;
revoke all on gef_notifications.lead_outbox from public, anon, authenticated, service_role;
grant select, insert, update on gef_notifications.lead_outbox to service_role;
-- service_role already has BYPASSRLS in Supabase. No public/client policies.

create function gef_notifications.enqueue_lead() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if current_setting('gef_notifications.rpc_intake', true) is distinct from 'v1' then
    raise exception 'EXCLUSIVE_RPC_INTAKE_REQUIRED';
  end if;
  insert into gef_notifications.lead_outbox(lead_id) values(new.id);
  return new;
end $$;
revoke all on function gef_notifications.enqueue_lead() from public, anon, authenticated;
grant execute on function gef_notifications.enqueue_lead() to service_role;
create trigger gef_lead_notification_intent after insert on public.leads
for each row execute function gef_notifications.enqueue_lead();

-- API receipt requires both persistence and an atomic notification intent.
-- Missing migration/RPC/trigger fails closed. No legacy HTTP insert fallback.
create function public.gef_persist_lead_and_notify(p_lead jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare v_id uuid; v_duplicate boolean:=false;
begin
  if (p_lead->>'submission_token') is null then raise exception 'SUBMISSION_TOKEN_REQUIRED'; end if;
  perform set_config('gef_notifications.rpc_intake','v1',true);
  insert into public.leads(submission_token,service_type,status,full_name,email,phone,city,zip_code,contact_method,details,source)
  values((p_lead->>'submission_token')::uuid,p_lead->>'service_type','new',p_lead->>'full_name',p_lead->>'email',p_lead->>'phone',p_lead->>'city',p_lead->>'zip_code',p_lead->>'contact_method',coalesce(p_lead->'details','{}'::jsonb),'getestimatefast.com')
  on conflict(submission_token) do nothing returning id into v_id;
  perform set_config('gef_notifications.rpc_intake','',true);
  if v_id is null then
    select id into v_id from public.leads where submission_token=(p_lead->>'submission_token')::uuid;
    v_duplicate:=true;
  end if;
  if v_id is null or not exists(select 1 from gef_notifications.lead_outbox where lead_id=v_id) then
    raise exception 'NOTIFICATION_INTENT_UNVERIFIED';
  end if;
  return jsonb_build_object('id',v_id,'duplicate',v_duplicate,'notification_queued',true);
end $$;

create function public.gef_claim_lead_notification() returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare v_job gef_notifications.lead_outbox;
begin
  -- Bounded housekeeping; SKIP LOCKED does not block another live claimant.
  with expired as (
    select id from gef_notifications.lead_outbox
    where state in ('pending','retry','processing')
      and (state<>'processing' or lease_until<=clock_timestamp())
      and (attempts>=6 or first_attempt_at<=clock_timestamp()-interval '20 hours')
    order by created_at limit 100 for update skip locked
  ) update gef_notifications.lead_outbox o set state='exhausted',error_code='RETRY_EXHAUSTED',lease_token=null,lease_until=null,updated_at=clock_timestamp()
    from expired where o.id=expired.id;
  select o.* into v_job from gef_notifications.lead_outbox o
    join public.leads l on l.id=o.lead_id
    where ((o.state in ('pending','retry') and o.next_attempt_at<=clock_timestamp()) or (o.state='processing' and o.lease_until<=clock_timestamp()))
      and o.attempts<6 and (o.first_attempt_at is null or o.first_attempt_at>clock_timestamp()-interval '20 hours')
    order by o.created_at limit 1 for update of o skip locked;
  if not found then return null; end if;
  update gef_notifications.lead_outbox set state='processing',attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp()
    where id=v_job.id returning * into v_job;
  return jsonb_build_object('id',v_job.id,'lead_id',v_job.lead_id,'lease_token',v_job.lease_token,
    'lease_until',v_job.lease_until,'idempotency_key','gef-lead-v1/'||v_job.id::text);
end $$;

-- Bind exact provider payload once, without duplicating PII in the outbox.
create function public.gef_prepare_lead_notification(p_id uuid,p_lease uuid,p_hash text) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare v_count integer;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_PAYLOAD_HASH'; end if;
  update gef_notifications.lead_outbox set payload_sha256=coalesce(payload_sha256,p_hash),updated_at=clock_timestamp()
  where id=p_id and state='processing' and lease_token=p_lease and lease_until>clock_timestamp()+interval '30 seconds'
    and (payload_sha256 is null or payload_sha256=p_hash);
  get diagnostics v_count=row_count;
  return v_count=1;
end $$;

create function public.gef_finish_lead_notification(p_id uuid,p_lease uuid,p_error text,p_provider_id text default null) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare v_count integer;
begin
  if p_error is not null and p_error not in ('RATE_LIMIT','PROVIDER_UNAVAILABLE','PROVIDER_REJECTED','TRANSPORT_UNKNOWN','INVALID_RESPONSE','PAYLOAD_CHANGED') then raise exception 'INVALID_ERROR_CODE'; end if;
  if p_error is null and (p_provider_id is null or p_provider_id !~ '^[a-zA-Z0-9_-]{1,128}$') then raise exception 'INVALID_PROVIDER_RECEIPT'; end if;
  update gef_notifications.lead_outbox set
    state=case when p_error is null then 'sent' when attempts>=6 or p_error in ('PROVIDER_REJECTED','PAYLOAD_CHANGED') or first_attempt_at<=clock_timestamp()-interval '20 hours' then 'exhausted' else 'retry' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,attempts-1))::integer),
    error_code=p_error,provider_id=case when p_error is null then p_provider_id else null end,
    sent_at=case when p_error is null then clock_timestamp() else null end,
    lease_token=null,lease_until=null,updated_at=clock_timestamp()
  where id=p_id and state='processing' and lease_token=p_lease and lease_until>clock_timestamp();
  get diagnostics v_count=row_count;
  return v_count=1;
end $$;

create function public.gef_lead_notification_stats() returns jsonb
language sql security invoker set search_path=pg_catalog as $$
  select jsonb_build_object(
    'states',coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from gef_notifications.lead_outbox group by state) s),'{}'::jsonb),
    'errors',coalesce((select jsonb_object_agg(error_code,n) from (select error_code,count(*) n from gef_notifications.lead_outbox where error_code is not null group by error_code) e),'{}'::jsonb)
  )
$$;
revoke all on function public.gef_persist_lead_and_notify(jsonb),public.gef_claim_lead_notification(),public.gef_prepare_lead_notification(uuid,uuid,text),public.gef_finish_lead_notification(uuid,uuid,text,text),public.gef_lead_notification_stats() from public,anon,authenticated;
grant execute on function public.gef_persist_lead_and_notify(jsonb),public.gef_claim_lead_notification(),public.gef_prepare_lead_notification(uuid,uuid,text),public.gef_finish_lead_notification(uuid,uuid,text,text),public.gef_lead_notification_stats() to service_role;
commit;
