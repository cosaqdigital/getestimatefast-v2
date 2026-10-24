-- PREPARED ONLY. Separate installation approval for cpjsbijgijeyrwjpuciv required.
-- Dependencies: the 25 existing migrations, including PR #51 Stripe tables.
begin;
alter table gef_private.test_checkout_orders add column checkout_expires_at timestamptz;
alter table gef_private.test_checkout_orders alter column checkout_expires_at set default (now()+interval '40 minutes');
alter table gef_private.test_checkout_orders add column checkout_origin text;
-- Preserve existing rows, reservations and history. No legacy reservation extension.
alter table gef_private.test_checkout_orders add constraint checkout_expiry_reservation check(checkout_expires_at is null or checkout_expires_at<reserved_until);
alter table gef_private.test_checkout_events add column source text not null default 'stripe_webhook' check(source in ('stripe_webhook','reconciliation'));
alter table gef_private.test_checkout_events drop constraint test_checkout_events_outcome_check;
alter table gef_private.test_checkout_events add constraint test_checkout_events_outcome_check check(outcome in ('paid','failed','expired','pending'));
create table gef_private.test_refund_confirmations(
 refund_id text primary key check(refund_id ~ '^re_[A-Za-z0-9_]+$'),
 order_id uuid not null unique references gef_private.test_checkout_orders(id),
 payment_id text not null,amount_cents bigint not null check(amount_cents>0),
 currency text not null check(currency='USD'),mode text not null check(mode='test'),confirmed_at timestamptz not null default now()
);
alter table gef_private.test_refund_confirmations enable row level security;
create trigger immutable_test_refund_confirmations before update or delete on gef_private.test_refund_confirmations for each row execute function gef_private.reject_change();
revoke all on gef_private.test_refund_confirmations from public,anon,authenticated;
grant select,insert on gef_private.test_refund_confirmations to service_role;
-- Keep persisted creation terms immutable to the backend: existing column-only
-- UPDATE grants cover status/session/payment/purchase, not expiry/origin/reservation.
create or replace function public.gef_create_test_order(p_contractor uuid,p_purpose text,p_quote uuid,p_key text) returns jsonb language plpgsql set search_path='' as $$
begin raise exception 'Safety migration requires gef_prepare_test_order';end $$;

create function public.gef_prepare_test_order(p_contractor uuid,p_purpose text,p_quote uuid,p_key text,p_origin text) returns jsonb language plpgsql set search_path='' as $$
declare q gef_private.contact_quotes%rowtype;o gef_private.test_checkout_orders%rowtype;s public.profile_service_prices%rowtype;
 v_status text;v_published timestamptz;v_count integer;v_id uuid;
begin
 if p_origin is null or p_origin !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'Trusted origin required';end if;
 if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' or p_purpose is null or p_purpose not in ('contact','profile_service') then raise exception 'Invalid test order';end if;
 -- Serialize retries first; every contact path then follows lead -> opportunity -> order -> wallet.
 perform pg_advisory_xact_lock(hashtextextended('gef-test-order:'||p_contractor::text||':'||p_key,0));
 select * into o from gef_private.test_checkout_orders where contractor_id=p_contractor and operation_key=p_key;
 if found then
  if o.checkout_origin is distinct from p_origin or o.checkout_expires_at is null or o.purpose<>p_purpose or o.quote_id is distinct from p_quote then raise exception 'Idempotency payload conflict';end if;
  return to_jsonb(o);
 end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null and state_code='FL') then raise exception 'Active contractor required';end if;
 if p_purpose='contact' then
  select * into q from gef_private.contact_quotes where id=p_quote and contractor_id=p_contractor;
  if not found then raise exception 'Quote unavailable';end if;
  if q.amount_cents not between 50 and 99999999 then raise exception 'Amount outside Stripe USD limits';end if;
  select l.status,op.published_at into v_status,v_published from public.opportunity_previews op join public.leads l on l.id=op.lead_id where op.id=q.opportunity_id for update of l;
  perform 1 from public.opportunity_previews where id=q.opportunity_id for update;
  if v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot or q.valid_until<=now() or q.opportunity_expires_at<now()+interval '45 minutes' then raise exception 'Opportunity unavailable for Checkout';end if;
  if exists(select 1 from gef_private.contact_purchases where contractor_id=p_contractor and opportunity_id=q.opportunity_id) or exists(select 1 from gef_private.test_checkout_orders where contractor_id=p_contractor and opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now()) then raise exception 'Contact already acquired or reserved';end if;
  select (select count(*) from gef_private.contact_purchases where opportunity_id=q.opportunity_id and status='acquired')+(select count(*) from gef_private.test_checkout_orders where opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now()) into v_count;
  if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;
  insert into gef_private.test_checkout_orders(contractor_id,purpose,quote_id,opportunity_id,amount_cents,operation_key,reserved_until,checkout_origin) values(p_contractor,'contact',q.id,q.opportunity_id,q.amount_cents,p_key,now()+interval '45 minutes',p_origin) returning id into v_id;
 else
  if p_quote is not null then raise exception 'Profile preparation has no contact quote';end if;
  select * into s from public.profile_service_prices where effective_at<=now() order by effective_at desc,created_at desc,id desc limit 1;
  if not found then raise exception 'Profile service price not configured';end if;
  if s.amount_cents not between 50 and 99999999 then raise exception 'Amount outside Stripe USD limits';end if;
  insert into gef_private.test_checkout_orders(contractor_id,purpose,service_price_id,amount_cents,operation_key,reserved_until,checkout_origin) values(p_contractor,'profile_service',s.id,s.amount_cents,p_key,now()+interval '45 minutes',p_origin) returning id into v_id;
 end if;
 select * into o from gef_private.test_checkout_orders where id=v_id;return to_jsonb(o);
end $$;
create function gef_private.confirm_test_order(p_order uuid,p_event text,p_session text,p_payment text,p_outcome text,p_amount bigint,p_currency text,p_mode text,p_source text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;e gef_private.test_checkout_events%rowtype;q gef_private.contact_quotes%rowtype;
 v_status text;v_published timestamptz;v_purchase uuid;v_next text;
begin
 if p_source not in ('stripe_webhook','reconciliation') or p_source is null then raise exception 'Invalid evidence source';end if;
 if p_mode is distinct from 'test' or p_currency is distinct from 'USD' or p_event is null or p_event !~ '^evt_[A-Za-z0-9_]+$' or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' or p_outcome is null or p_outcome not in ('paid','failed','expired','pending') or (p_outcome='paid' and (p_payment is null or p_payment !~ '^pi_[A-Za-z0-9_]+$')) then raise exception 'Invalid test confirmation';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order;
 if not found then raise exception 'Order unavailable';end if;
 if o.opportunity_id is not null then
  select l.status,op.published_at into v_status,v_published from public.opportunity_previews op join public.leads l on l.id=op.lead_id where op.id=o.opportunity_id for update of l;
  perform 1 from public.opportunity_previews where id=o.opportunity_id for update;
 end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if o.session_id is distinct from p_session or o.amount_cents is distinct from p_amount then raise exception 'Confirmation does not match order';end if;
 -- Equal event IDs across different orders are also serialized, before insertion.
 perform pg_advisory_xact_lock(hashtextextended('gef-test-event:'||p_event,0));
 select * into e from gef_private.test_checkout_events where event_id=p_event;
 if found then
  if e.order_id<>p_order or e.session_id<>p_session or e.payment_id is distinct from p_payment or e.outcome<>p_outcome or e.amount_cents<>p_amount or e.currency<>p_currency or e.mode<>p_mode or e.source<>p_source then raise exception 'Event payload conflict';end if;
  return jsonb_build_object('created',false,'status',o.status);
 end if;
 if o.payment_id is not null and p_outcome='paid' and o.payment_id is distinct from p_payment then raise exception 'Payment conflict';end if;
 v_next:=o.status;
 if o.status not in ('paid','refunded','refund_required') then
  if p_outcome='paid' then
   v_next:='paid';
   if o.purpose='contact' then
    select * into q from gef_private.contact_quotes where id=o.quote_id;
    if o.status<>'reserved' or o.reserved_until<=now() or q.opportunity_expires_at<=now() or v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot or not exists(select 1 from public.contractor_profiles where user_id=o.contractor_id and account_status='active' and email_verified_at is not null) then v_next:='refund_required';
    else
     insert into gef_private.wallets(contractor_id) values(o.contractor_id) on conflict do nothing;
     perform 1 from gef_private.wallets where contractor_id=o.contractor_id for update;
     insert into gef_private.contact_purchases(contractor_id,opportunity_id,quote_id,amount_cents,operation_key,funding_source) values(o.contractor_id,o.opportunity_id,o.quote_id,o.amount_cents,'stripe-test:'||o.id::text,'stripe_test') returning id into v_purchase;
    end if;
   end if;
  elsif o.status='reserved' and p_outcome in ('failed','expired') then v_next:=p_outcome;
  end if;
  update gef_private.test_checkout_orders set status=v_next,payment_id=case when p_outcome='paid' then p_payment else payment_id end,purchase_id=coalesce(v_purchase,purchase_id) where id=p_order;
 end if;
 insert into gef_private.test_checkout_events(event_id,order_id,session_id,payment_id,outcome,amount_cents,currency,mode,source) values(p_event,p_order,p_session,p_payment,p_outcome,p_amount,p_currency,p_mode,p_source);
 return jsonb_build_object('created',true,'status',v_next,'contact_release_enabled',false);
end $$;
create or replace function public.gef_refund_test_order(p_actor uuid,p_order uuid,p_key text,p_reason text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;a gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) or p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Administrator and reason required';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order;
 if o.opportunity_id is not null then perform 1 from public.leads where id=(select lead_id from public.opportunity_previews where id=o.opportunity_id) for update;perform 1 from public.opportunity_previews where id=o.opportunity_id for update;end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if not found then raise exception 'Order unavailable';end if;
 select * into a from gef_private.admin_audit where operation_key=p_key;
 if found then
  if a.action<>'test_order_refund_request' or a.target_id<>p_order or a.actor_id<>p_actor or a.reason<>p_reason then raise exception 'Idempotency payload conflict';end if;
  return jsonb_build_object('created',false,'status',o.status,'processor_refund_confirmed',false);
 end if;
 if o.status not in ('paid','refund_required') then raise exception 'Order cannot be refunded';end if;
 update gef_private.test_checkout_orders set status='refund_required' where id=p_order;
 -- Preserve acquired status/capacity until processor confirmation.
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason) values(p_actor,'test_order_refund_request',p_order,p_key,jsonb_build_object('amount_cents',o.amount_cents,'processor_refund_confirmed',false),p_reason);
 return jsonb_build_object('created',true,'status','refund_required','processor_refund_confirmed',false);
end $$;
create or replace function public.gef_confirm_test_order(p_order uuid,p_event text,p_session text,p_payment text,p_outcome text,p_amount bigint,p_currency text,p_mode text) returns jsonb language plpgsql set search_path='' as $$
begin
 if p_event like 'evt_reconcile_%' then raise exception 'Reserved observation namespace';end if;
 return gef_private.confirm_test_order(p_order,p_event,p_session,p_payment,p_outcome,p_amount,p_currency,p_mode,'stripe_webhook');
end $$;
create function public.gef_test_event_read(p_event text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('session_id',session_id) from gef_private.test_checkout_events where event_id=p_event and source='stripe_webhook';
$$;
-- Recover an ambiguous create/bind failure, without extending the reservation.
create function public.gef_recover_test_session(p_order uuid,p_session text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;
begin
 if p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' then raise exception 'Test session required';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if not found or (o.session_id is not null and o.session_id<>p_session) then raise exception 'Recovery conflict';end if;
 update gef_private.test_checkout_orders set session_id=p_session where id=p_order;
 return jsonb_build_object('bound',true,'reservation_extended',false);
end $$;
-- A persisted observation UUID is an operational fact, not a Stripe event ID.
create function public.gef_reconcile_test_order(p_order uuid,p_observation uuid,p_session text,p_payment text,p_outcome text,p_amount bigint) returns jsonb language plpgsql set search_path='' as $$
begin
 if p_observation is null then raise exception 'Observation required';end if;
 return gef_private.confirm_test_order(p_order,'evt_reconcile_'||replace(p_observation::text,'-',''),p_session,p_payment,p_outcome,p_amount,'USD','test','reconciliation');
end $$;
create function public.gef_confirm_test_refund(p_order uuid,p_refund text,p_payment text,p_amount bigint,p_currency text,p_mode text,p_status text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;r gef_private.test_refund_confirmations%rowtype;
begin
 if p_refund is null or p_refund !~ '^re_[A-Za-z0-9_]+$' or p_currency is distinct from 'USD' or p_mode is distinct from 'test' or p_status is distinct from 'succeeded' then raise exception 'Verified successful test refund required';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order;
 if o.opportunity_id is not null then
  perform 1 from public.leads where id=(select lead_id from public.opportunity_previews where id=o.opportunity_id) for update;
  perform 1 from public.opportunity_previews where id=o.opportunity_id for update;
 end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if not found or o.payment_id is null or o.payment_id is distinct from p_payment or o.amount_cents is distinct from p_amount then raise exception 'Refund does not match order';end if;
 perform pg_advisory_xact_lock(hashtextextended('gef-test-refund:'||p_refund,0));
 select * into r from gef_private.test_refund_confirmations where refund_id=p_refund;
 if found then
  if r.order_id<>p_order or r.payment_id<>p_payment or r.amount_cents<>p_amount then raise exception 'Refund conflict';end if;
  return jsonb_build_object('created',false,'status','refunded');
 end if;
 if o.status not in ('paid','refund_required') then raise exception 'Order cannot be refunded';end if;
 insert into gef_private.test_refund_confirmations(refund_id,order_id,payment_id,amount_cents,currency,mode) values(p_refund,p_order,p_payment,p_amount,p_currency,p_mode);
 update gef_private.test_checkout_orders set status='refunded' where id=p_order;
 if o.purchase_id is not null then update gef_private.contact_purchases set status='refunded' where id=o.purchase_id;end if;
 return jsonb_build_object('created',true,'status','refunded','processor_refund_confirmed',true);
end $$;
revoke all on function public.gef_prepare_test_order(uuid,text,uuid,text,text),gef_private.confirm_test_order(uuid,text,text,text,text,bigint,text,text,text),public.gef_test_event_read(text),public.gef_recover_test_session(uuid,text),public.gef_reconcile_test_order(uuid,uuid,text,text,text,bigint),public.gef_confirm_test_refund(uuid,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.gef_prepare_test_order(uuid,text,uuid,text,text),gef_private.confirm_test_order(uuid,text,text,text,text,bigint,text,text,text),public.gef_test_event_read(text),public.gef_recover_test_session(uuid,text),public.gef_reconcile_test_order(uuid,uuid,text,text,text,bigint),public.gef_confirm_test_refund(uuid,text,text,bigint,text,text,text) to service_role;
commit;
