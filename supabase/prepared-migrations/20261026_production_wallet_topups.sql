-- PREPARED ONLY. Production wallet top-ups over Stripe Live.
-- Requires the existing GetEstimateFast marketplace and Stripe Live schema.
-- No customer records, credits, promotions, prices or payments are seeded.
begin;

alter table gef_private.payment_intents
  add column if not exists checkout_session_id text;

alter table gef_private.payment_intents
  drop constraint if exists payment_intents_checkout_session_id_format_check;
alter table gef_private.payment_intents
  add constraint payment_intents_checkout_session_id_format_check
  check (checkout_session_id is null or checkout_session_id ~ '^cs_live_[A-Za-z0-9_]+$');

create unique index if not exists payment_intents_checkout_session_id_key
  on gef_private.payment_intents(checkout_session_id)
  where checkout_session_id is not null;

create table if not exists gef_private.live_topup_events(
  provider_event_id text primary key
    check(provider_event_id ~ '^evt_[A-Za-z0-9_]+$'),
  payment_intent_id uuid not null references gef_private.payment_intents(id),
  checkout_session_id text not null
    check(checkout_session_id ~ '^cs_live_[A-Za-z0-9_]+$'),
  provider_payment_id text,
  outcome text not null check(outcome in ('paid','failed','expired')),
  amount_cents bigint not null check(amount_cents between 1 and 100000000),
  currency text not null check(currency='USD'),
  mode text not null check(mode='live'),
  created_at timestamptz not null default now()
);

create index if not exists live_topup_events_intent_idx
  on gef_private.live_topup_events(payment_intent_id);

alter table gef_private.live_topup_events enable row level security;
revoke all on gef_private.live_topup_events from public,anon,authenticated;
grant select,insert on gef_private.live_topup_events to service_role;

drop trigger if exists immutable_live_topup_events on gef_private.live_topup_events;
create trigger immutable_live_topup_events
before update or delete on gef_private.live_topup_events
for each row execute function gef_private.reject_change();

create or replace function public.gef_create_live_topup(
  p_contractor uuid,
  p_amount bigint,
  p_bonus bigint,
  p_promotion uuid,
  p_operation_key text
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  i gef_private.payment_intents%rowtype;
  p public.marketplace_promotions%rowtype;
begin
  if p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9:_-]{8,120}$'
     or p_amount is null
     or p_amount < 100
     or p_amount > 100000000
     or p_bonus is null
     or p_bonus < 0
     or p_bonus > 100000000 then
    raise exception 'Invalid wallet top-up';
  end if;

  if not exists(
    select 1 from public.contractor_profiles
    where user_id=p_contractor
      and account_status='active'
      and email_verified_at is not null
      and state_code='FL'
  ) then
    raise exception 'Active contractor required';
  end if;

  if p_promotion is null then
    if p_bonus<>0 then raise exception 'Bonus promotion required'; end if;
  else
    select * into p
    from public.marketplace_promotions
    where id=p_promotion;
    if not found
       or not p.enabled
       or p.starts_at>now()
       or p.ends_at<=now()
       or p.amount_cents<>p_amount
       or p.bonus_cents<>p_bonus then
      raise exception 'Promotion unavailable';
    end if;
  end if;

  select * into i
  from gef_private.payment_intents
  where contractor_id=p_contractor
    and operation_key=p_operation_key;

  if found then
    if i.purpose<>'wallet_topup'
       or i.amount_cents<>p_amount
       or i.bonus_cents<>p_bonus
       or i.promotion_id is distinct from p_promotion
       or i.currency<>'USD'
       or i.provider<>'stripe_live' then
      raise exception 'Idempotency payload conflict';
    end if;
    return jsonb_build_object(
      'intent_id',i.id,
      'created',false,
      'status',i.status,
      'amount_cents',i.amount_cents,
      'bonus_cents',i.bonus_cents,
      'currency',i.currency,
      'checkout_session_id',i.checkout_session_id
    );
  end if;

  insert into gef_private.payment_intents(
    contractor_id,purpose,amount_cents,bonus_cents,promotion_id,currency,status,provider,operation_key
  ) values(
    p_contractor,'wallet_topup',p_amount,p_bonus,p_promotion,'USD','pending','stripe_live',p_operation_key
  )
  returning * into i;

  return jsonb_build_object(
    'intent_id',i.id,
    'created',true,
    'status',i.status,
    'amount_cents',i.amount_cents,
    'bonus_cents',i.bonus_cents,
    'currency',i.currency,
    'checkout_session_id',i.checkout_session_id
  );
end $$;

create or replace function public.gef_live_topup_read(p_intent uuid)
returns jsonb
language sql
stable
set search_path=''
as $$
  select jsonb_build_object(
    'id',i.id,
    'contractor_id',i.contractor_id,
    'purpose',i.purpose,
    'amount_cents',i.amount_cents,
    'bonus_cents',i.bonus_cents,
    'promotion_id',i.promotion_id,
    'currency',i.currency,
    'status',i.status,
    'provider',i.provider,
    'provider_payment_id',i.provider_payment_id,
    'checkout_session_id',i.checkout_session_id
  )
  from gef_private.payment_intents i
  where i.id=p_intent
    and i.purpose='wallet_topup'
    and i.provider='stripe_live';
$$;

create or replace function public.gef_live_topup_event_read(p_event text)
returns jsonb
language sql
stable
set search_path=''
as $$
  select jsonb_build_object(
    'provider_event_id',e.provider_event_id,
    'payment_intent_id',e.payment_intent_id,
    'checkout_session_id',e.checkout_session_id,
    'provider_payment_id',e.provider_payment_id,
    'outcome',e.outcome
  )
  from gef_private.live_topup_events e
  where e.provider_event_id=p_event;
$$;

create or replace function public.gef_bind_live_topup_session(p_intent uuid,p_session text)
returns jsonb
language plpgsql
set search_path=''
as $$
declare i gef_private.payment_intents%rowtype;
begin
  if p_session is null or p_session !~ '^cs_live_[A-Za-z0-9_]+$' then
    raise exception 'Invalid live Checkout session';
  end if;
  select * into i
  from gef_private.payment_intents
  where id=p_intent
  for update;
  if not found
     or i.purpose<>'wallet_topup'
     or i.provider<>'stripe_live'
     or i.status<>'pending' then
    raise exception 'Wallet top-up unavailable';
  end if;
  if i.checkout_session_id is not null and i.checkout_session_id<>p_session then
    raise exception 'Checkout session conflict';
  end if;
  update gef_private.payment_intents
  set checkout_session_id=p_session
  where id=p_intent;
  return jsonb_build_object('intent_id',p_intent,'checkout_session_id',p_session,'status','pending');
end $$;

create or replace function public.gef_confirm_live_topup(
  p_intent uuid,
  p_event text,
  p_session text,
  p_payment text,
  p_outcome text,
  p_amount bigint,
  p_currency text,
  p_mode text
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  i gef_private.payment_intents%rowtype;
  e gef_private.live_topup_events%rowtype;
begin
  if p_event is null or p_event !~ '^evt_[A-Za-z0-9_]+$'
     or p_session is null or p_session !~ '^cs_live_[A-Za-z0-9_]+$'
     or p_outcome not in ('paid','failed','expired')
     or p_currency is distinct from 'USD'
     or p_mode is distinct from 'live'
     or p_amount is null or p_amount < 1 then
    raise exception 'Invalid live wallet top-up confirmation';
  end if;

  select * into i
  from gef_private.payment_intents
  where id=p_intent
  for update;

  if not found
     or i.purpose<>'wallet_topup'
     or i.provider<>'stripe_live'
     or i.amount_cents<>p_amount
     or i.currency<>p_currency
     or i.checkout_session_id is distinct from p_session then
    raise exception 'Payment does not match wallet top-up';
  end if;

  select * into e
  from gef_private.live_topup_events
  where provider_event_id=p_event;

  if found then
    if e.payment_intent_id<>p_intent
       or e.checkout_session_id<>p_session
       or e.provider_payment_id is distinct from p_payment
       or e.outcome<>p_outcome
       or e.amount_cents<>p_amount
       or e.currency<>p_currency then
      raise exception 'Provider event payload conflict';
    end if;
    return jsonb_build_object('created',false,'status',i.status);
  end if;

  if p_outcome='paid' then
    if p_payment is null or p_payment !~ '^pi_[A-Za-z0-9_]+$' then
      raise exception 'Confirmed payment required';
    end if;

    if i.status='confirmed' then
      if i.provider_payment_id is distinct from p_payment then
        raise exception 'Top-up already paid by another payment';
      end if;
    elsif i.status='pending' then
      insert into gef_private.wallets(contractor_id)
      values(i.contractor_id)
      on conflict do nothing;

      perform 1 from gef_private.wallets
      where contractor_id=i.contractor_id
      for update;

      insert into gef_private.ledger(
        contractor_id,bucket,amount_cents,kind,operation_key,reference_id,reason
      ) values(
        i.contractor_id,'paid',i.amount_cents,'topup',
        'stripe-live-paid:'||i.id::text,i.id,'Verified Stripe Live wallet top-up'
      );

      if i.bonus_cents>0 then
        if i.promotion_id is null or not exists(
          select 1 from public.marketplace_promotions p
          where p.id=i.promotion_id
            and p.amount_cents=i.amount_cents
            and p.bonus_cents=i.bonus_cents
            and p.enabled
            and p.starts_at<=i.created_at
            and p.ends_at>i.created_at
        ) then
          raise exception 'Invalid promotion snapshot';
        end if;
        insert into gef_private.ledger(
          contractor_id,bucket,amount_cents,kind,operation_key,reference_id,reason
        ) values(
          i.contractor_id,'promotional',i.bonus_cents,'bonus',
          'stripe-live-bonus:'||i.id::text,i.id,'Verified promotional wallet credit'
        );
      end if;

      update gef_private.payment_intents
      set status='confirmed',provider_payment_id=p_payment
      where id=i.id;
    else
      raise exception 'Wallet top-up is no longer payable';
    end if;
  else
    if i.status='pending' then
      update gef_private.payment_intents
      set status=case when p_outcome='expired' then 'expired' else 'failed' end
      where id=i.id;
    elsif i.status='confirmed' then
      raise exception 'Confirmed top-up cannot be reversed by Checkout status';
    end if;
  end if;

  insert into gef_private.live_topup_events(
    provider_event_id,payment_intent_id,checkout_session_id,provider_payment_id,
    outcome,amount_cents,currency,mode
  ) values(
    p_event,p_intent,p_session,p_payment,p_outcome,p_amount,p_currency,p_mode
  );

  select * into i
  from gef_private.payment_intents
  where id=p_intent;

  return jsonb_build_object(
    'created',true,
    'status',i.status,
    'available',public.gef_wallet_summary(i.contractor_id)
  );
end $$;

revoke all on function public.gef_create_live_topup(uuid,bigint,bigint,uuid,text),
  public.gef_live_topup_read(uuid),
  public.gef_live_topup_event_read(text),
  public.gef_bind_live_topup_session(uuid,text),
  public.gef_confirm_live_topup(uuid,text,text,text,text,bigint,text,text)
from public,anon,authenticated;

grant execute on function public.gef_create_live_topup(uuid,bigint,bigint,uuid,text),
  public.gef_live_topup_read(uuid),
  public.gef_live_topup_event_read(text),
  public.gef_bind_live_topup_session(uuid,text),
  public.gef_confirm_live_topup(uuid,text,text,text,text,bigint,text,text)
to service_role;

grant update(status,provider_payment_id,checkout_session_id)
on gef_private.payment_intents to service_role;

commit;
