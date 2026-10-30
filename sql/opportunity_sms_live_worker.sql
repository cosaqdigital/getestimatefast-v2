-- Server-only claim function for the live opportunity SMS worker.
-- Safe to deploy before live activation: this function never contacts Telnyx.
create or replace function public.gef_claim_opportunity_sms_batch(
  p_limit integer,
  p_daily_limit integer,
  p_now timestamptz
) returns table(
  id uuid,
  opportunity_id uuid,
  contractor_user_id uuid,
  recipient_phone_e164 text,
  attempt_count integer
)
language plpgsql
set search_path=''
as $fn$
declare
  v_used integer;
  v_remaining integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5 then
    raise exception 'Invalid SMS batch limit';
  end if;
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 2000 then
    raise exception 'Invalid SMS daily limit';
  end if;
  if p_now is null then
    raise exception 'Invalid SMS worker timestamp';
  end if;

  select count(*)::integer
  into v_used
  from public.opportunity_sms_queue q
  where q.sent_at >= p_now - interval '24 hours'
     or (q.status='SENDING' and q.updated_at >= p_now - interval '24 hours');

  v_remaining:=least(p_limit,greatest(0,p_daily_limit-v_used));
  if v_remaining < 1 then
    return;
  end if;

  return query
  with candidates as (
    select q.id
    from public.opportunity_sms_queue q
    where q.attempt_count < 5
      and (
        q.status='QUEUED'
        or (
          q.status='FAILED'
          and q.next_attempt_at is not null
          and q.next_attempt_at <= p_now
        )
      )
    order by q.created_at,q.id
    for update skip locked
    limit v_remaining
  ),
  claimed as (
    update public.opportunity_sms_queue q
    set status='SENDING',
        attempt_count=q.attempt_count+1,
        next_attempt_at=null,
        last_error_code=null,
        updated_at=p_now
    from candidates c
    where q.id=c.id
    returning q.id,q.opportunity_id,q.contractor_user_id,q.recipient_phone_e164,q.attempt_count
  )
  select c.id,c.opportunity_id,c.contractor_user_id,c.recipient_phone_e164,c.attempt_count
  from claimed c
  order by c.id;
end;
$fn$;

revoke all on function public.gef_claim_opportunity_sms_batch(integer,integer,timestamptz)
from public,anon,authenticated;
grant execute on function public.gef_claim_opportunity_sms_batch(integer,integer,timestamptz)
to service_role;
