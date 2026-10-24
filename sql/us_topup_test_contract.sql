-- PREPARED ONLY. TEST-MODE ONLY contract for future verified payment adapters.
-- No webhook or HTTP financial endpoint invokes this function.
begin;
create table gef_private.payment_events(
 provider_event_id text primary key,
 payment_intent_id uuid not null references gef_private.payment_intents(id),
 provider_payment_id text not null,amount_cents bigint not null,currency text not null check(currency='USD'),
 mode text not null check(mode='test'),created_at timestamptz not null default now()
);
create index payment_events_intent_idx on gef_private.payment_events(payment_intent_id);
alter table gef_private.payment_events enable row level security;
revoke all on gef_private.payment_events from public,anon,authenticated;
grant select,insert on gef_private.payment_events to service_role;
create trigger immutable_payment_events before update or delete on gef_private.payment_events for each row execute function gef_private.reject_change();
create function public.gef_confirm_test_topup(p_intent uuid,p_event text,p_payment text,p_amount bigint,p_currency text,p_mode text) returns jsonb language plpgsql set search_path='' as $$
declare i gef_private.payment_intents%rowtype;e gef_private.payment_events%rowtype;
begin
 if p_mode is distinct from 'test' then raise exception 'Live payment processing is disabled';end if;
 if p_event is null or p_payment is null or length(p_event) not between 8 and 120 or length(p_payment) not between 8 and 120 then raise exception 'Invalid provider reference';end if;
 select * into i from gef_private.payment_intents where id=p_intent for update;
 if not found or i.purpose<>'wallet_topup' or i.provider<>'stripe_test' or p_currency is distinct from 'USD' or p_amount is distinct from i.amount_cents then raise exception 'Payment does not match pending top-up';end if;
 select * into e from gef_private.payment_events where provider_event_id=p_event;
 if found then
  if e.payment_intent_id<>p_intent or e.provider_payment_id<>p_payment or e.amount_cents<>p_amount or e.currency<>p_currency or e.mode<>p_mode then raise exception 'Provider event payload conflict'; end if;
  return jsonb_build_object('created',false,'status',i.status);
 end if;
 if i.status='confirmed' then
  if i.provider_payment_id is distinct from p_payment then raise exception 'Top-up already paid by another payment';end if;
  insert into gef_private.payment_events values(p_event,p_intent,p_payment,p_amount,p_currency,p_mode,now());
  return jsonb_build_object('created',false,'status','confirmed');
 end if;
 if i.status<>'pending' then raise exception 'Top-up is no longer pending'; end if;
 insert into gef_private.wallets(contractor_id) values(i.contractor_id) on conflict do nothing;
 perform 1 from gef_private.wallets where contractor_id=i.contractor_id for update;
 insert into gef_private.ledger(contractor_id,bucket,amount_cents,kind,operation_key,reference_id,reason)
 values(i.contractor_id,'paid',i.amount_cents,'topup','stripe-test-paid:'||i.id::text,i.id,'Verified synthetic Stripe test top-up');
 if i.bonus_cents>0 then
  if i.promotion_id is null then raise exception 'Bonus promotion snapshot required';end if;
  if not exists(select 1 from public.marketplace_promotions where id=i.promotion_id and amount_cents=i.amount_cents and bonus_cents=i.bonus_cents and enabled and starts_at<=i.created_at and ends_at>i.created_at) then raise exception 'Invalid promotion snapshot';end if;
  insert into gef_private.ledger(contractor_id,bucket,amount_cents,kind,operation_key,reference_id,reason)
  values(i.contractor_id,'promotional',i.bonus_cents,'bonus','stripe-test-bonus:'||i.id::text,i.id,'Verified synthetic promotional credit');
 end if;
 update gef_private.payment_intents set status='confirmed',provider_payment_id=p_payment where id=p_intent;
 insert into gef_private.payment_events values(p_event,p_intent,p_payment,p_amount,p_currency,p_mode,now());
 return jsonb_build_object('created',true,'status','confirmed');
end $$;
grant update(status,provider_payment_id) on gef_private.payment_intents to service_role;
revoke all on function public.gef_confirm_test_topup(uuid,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.gef_confirm_test_topup(uuid,text,text,bigint,text,text) to service_role;
commit;
