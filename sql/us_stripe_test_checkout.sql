-- PREPARED ONLY. Isolated development database, after all six PR #50 scripts.
-- No endpoint is enabled without explicit future test-checkout approval and test secrets.
begin;
-- Existing isolated installations of #50 also receive the additive column.
alter table gef_private.contact_purchases add column if not exists funding_source text not null default 'wallet' check(funding_source in ('wallet','stripe_test'));
-- Protect already-applied #50 refund RPCs too: direct payments cannot turn into wallet credits.
create function gef_private.guard_direct_refund() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='refund' and exists(select 1 from gef_private.contact_purchases where id=new.reference_id and funding_source='stripe_test') then raise exception 'Provider refund required for direct test payment';end if;
 return new;
end $$;
create trigger guard_direct_refund before insert on gef_private.ledger for each row execute function gef_private.guard_direct_refund();
create table gef_private.test_checkout_orders(
 id uuid primary key default gen_random_uuid(),contractor_id uuid not null references public.contractor_profiles(user_id),
 purpose text not null check(purpose in ('contact','profile_service')),
 quote_id uuid references gef_private.contact_quotes(id),opportunity_id uuid references public.opportunity_previews(id),
 service_price_id uuid references public.profile_service_prices(id),
 amount_cents bigint not null check(amount_cents between 1 and 100000000),currency text not null default 'USD' check(currency='USD'),
 status text not null default 'reserved' check(status in ('reserved','paid','failed','expired','refund_required','refunded')),
 operation_key text not null,session_id text unique,payment_id text unique,purchase_id uuid unique references gef_private.contact_purchases(id),
 reserved_until timestamptz not null,created_at timestamptz not null default now(),
 unique(contractor_id,operation_key),
 check((purpose='contact' and quote_id is not null and opportunity_id is not null and service_price_id is null) or (purpose='profile_service' and quote_id is null and opportunity_id is null and service_price_id is not null))
);
create index test_checkout_owner_idx on gef_private.test_checkout_orders(contractor_id,created_at desc);
create index test_checkout_quote_idx on gef_private.test_checkout_orders(quote_id);
create index test_checkout_opportunity_idx on gef_private.test_checkout_orders(opportunity_id,status,reserved_until);
create index test_checkout_service_price_idx on gef_private.test_checkout_orders(service_price_id);
create table gef_private.test_checkout_events(
 event_id text primary key,order_id uuid not null references gef_private.test_checkout_orders(id),
 session_id text not null,payment_id text,outcome text not null check(outcome in ('paid','failed','expired')),
 amount_cents bigint not null,currency text not null check(currency='USD'),mode text not null check(mode='test'),created_at timestamptz not null default now()
);
create index test_checkout_events_order_idx on gef_private.test_checkout_events(order_id);
create trigger immutable_test_checkout_events before update or delete on gef_private.test_checkout_events for each row execute function gef_private.reject_change();

create function public.gef_test_quote_context(p_opportunity uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('opportunity',jsonb_build_object('opportunity_id',op.id,'service_category',op.service_category,'city',op.city,'zip_code',op.zip_code,'published_at',op.published_at),
 'terms_id',t.id,'scope',t.scope_key,'urgency',t.urgency_key,'rule',to_jsonb(r),'buyer_count',
 (select count(*) from gef_private.contact_purchases where opportunity_id=op.id and status='acquired')+(select count(*) from gef_private.test_checkout_orders where opportunity_id=op.id and status='reserved' and reserved_until>now()))
 from public.opportunity_previews op join public.leads l on l.id=op.lead_id join gef_private.opportunity_terms t on t.opportunity_id=op.id and t.published_at_snapshot=op.published_at join public.marketplace_price_rules r on r.id=t.rule_id where op.id=p_opportunity and l.status='published';
$$;
create function public.gef_test_quote_read(p_contractor uuid,p_quote uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('opportunity_id',opportunity_id) from gef_private.contact_quotes where id=p_quote and contractor_id=p_contractor;
$$;
create or replace function public.gef_commercial_previews(p_ids uuid[]) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',o.id,'terms_id',t.id,'scope',t.scope_key,'urgency',t.urgency_key,'rule',to_jsonb(r),'buyer_count',
 (select count(*) from gef_private.contact_purchases p where p.opportunity_id=o.id and p.status='acquired')+(select count(*) from gef_private.test_checkout_orders co where co.opportunity_id=o.id and co.status='reserved' and co.reserved_until>now()))),'[]')
 from public.opportunity_previews o join gef_private.opportunity_terms t on t.opportunity_id=o.id and t.published_at_snapshot=o.published_at join public.marketplace_price_rules r on r.id=t.rule_id where o.id=any(p_ids);
$$;

create function public.gef_create_test_quote(p_contractor uuid,p_terms uuid,p_amount bigint,p_valid_until timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare t gef_private.opportunity_terms%rowtype;v_id uuid;
begin
 select * into t from gef_private.opportunity_terms where id=p_terms;
 if not found or p_valid_until is null or p_valid_until<=now() or p_valid_until>now()+interval '5 minutes' or p_valid_until>t.opportunity_expires_at then raise exception 'Invalid server quote';end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null) then raise exception 'Active contractor required';end if;
 insert into gef_private.contact_quotes(contractor_id,opportunity_id,rule_id,terms_id,amount_cents,max_buyers,valid_until,opportunity_expires_at,published_at_snapshot)
 values(p_contractor,t.opportunity_id,t.rule_id,t.id,p_amount,t.max_buyers,p_valid_until,t.opportunity_expires_at,t.published_at_snapshot) returning id into v_id;
 return jsonb_build_object('quote_id',v_id);
end $$;

create function public.gef_create_test_order(p_contractor uuid,p_purpose text,p_quote uuid,p_key text) returns jsonb language plpgsql set search_path='' as $$
declare q gef_private.contact_quotes%rowtype;o gef_private.test_checkout_orders%rowtype;s public.profile_service_prices%rowtype;
 v_status text;v_published timestamptz;v_count integer;v_id uuid;
begin
 if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' or p_purpose is null or p_purpose not in ('contact','profile_service') then raise exception 'Invalid test order';end if;
 -- Serialize retries first; every contact path then follows lead -> opportunity -> order -> wallet.
 perform pg_advisory_xact_lock(hashtextextended('gef-test-order:'||p_contractor::text||':'||p_key,0));
 select * into o from gef_private.test_checkout_orders where contractor_id=p_contractor and operation_key=p_key;
 if found then
  if o.purpose<>p_purpose or o.quote_id is distinct from p_quote then raise exception 'Idempotency payload conflict';end if;
  return to_jsonb(o);
 end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null and state_code='FL') then raise exception 'Active contractor required';end if;
 if p_purpose='contact' then
  select * into q from gef_private.contact_quotes where id=p_quote and contractor_id=p_contractor;
  if not found then raise exception 'Quote unavailable';end if;
  select l.status,op.published_at into v_status,v_published from public.opportunity_previews op join public.leads l on l.id=op.lead_id where op.id=q.opportunity_id for update of l;
  perform 1 from public.opportunity_previews where id=q.opportunity_id for update;
  if v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot or q.valid_until<=now() or q.opportunity_expires_at<now()+interval '31 minutes' then raise exception 'Opportunity unavailable for Checkout';end if;
  if exists(select 1 from gef_private.contact_purchases where contractor_id=p_contractor and opportunity_id=q.opportunity_id) or exists(select 1 from gef_private.test_checkout_orders where contractor_id=p_contractor and opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now()) then raise exception 'Contact already acquired or reserved';end if;
  select (select count(*) from gef_private.contact_purchases where opportunity_id=q.opportunity_id and status='acquired')+(select count(*) from gef_private.test_checkout_orders where opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now()) into v_count;
  if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;
  insert into gef_private.test_checkout_orders(contractor_id,purpose,quote_id,opportunity_id,amount_cents,operation_key,reserved_until) values(p_contractor,'contact',q.id,q.opportunity_id,q.amount_cents,p_key,now()+interval '31 minutes') returning id into v_id;
 else
  if p_quote is not null then raise exception 'Profile preparation has no contact quote';end if;
  select * into s from public.profile_service_prices where effective_at<=now() order by effective_at desc,created_at desc,id desc limit 1;
  if not found then raise exception 'Profile service price not configured';end if;
  insert into gef_private.test_checkout_orders(contractor_id,purpose,service_price_id,amount_cents,operation_key,reserved_until) values(p_contractor,'profile_service',s.id,s.amount_cents,p_key,now()+interval '31 minutes') returning id into v_id;
 end if;
 select * into o from gef_private.test_checkout_orders where id=v_id;return to_jsonb(o);
end $$;

create function public.gef_test_order_read(p_order uuid) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(o) from gef_private.test_checkout_orders o where id=p_order;
$$;
create function public.gef_bind_test_session(p_order uuid,p_session text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;
begin
 if p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' then raise exception 'Test session required';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if not found or o.status<>'reserved' or o.reserved_until<=now() then raise exception 'Order unavailable';end if;
 if o.session_id is not null and o.session_id<>p_session then raise exception 'Session conflict';end if;
 update gef_private.test_checkout_orders set session_id=p_session where id=p_order;
 return jsonb_build_object('bound',true);
end $$;

-- Applies equally to wallet purchases and direct test payments, under the existing locks.
create function gef_private.guard_purchase_capacity() returns trigger language plpgsql set search_path='' as $$
declare q gef_private.contact_quotes%rowtype;v_count integer;
begin
 select * into q from gef_private.contact_quotes where id=new.quote_id;
 if q.contractor_id is distinct from new.contractor_id or q.opportunity_id is distinct from new.opportunity_id or q.amount_cents is distinct from new.amount_cents then raise exception 'Purchase quote mismatch';end if;
 if new.funding_source='stripe_test' and not exists(select 1 from gef_private.test_checkout_orders where contractor_id=new.contractor_id and quote_id=new.quote_id and status='reserved' and reserved_until>now() and session_id is not null) then raise exception 'Bound test Checkout reservation required';end if;
 perform 1 from public.leads where id=(select lead_id from public.opportunity_previews where id=new.opportunity_id) for update;
 perform 1 from public.opportunity_previews where id=new.opportunity_id for update;
 select (select count(*) from gef_private.contact_purchases where opportunity_id=new.opportunity_id and status='acquired')+(select count(*) from gef_private.test_checkout_orders where opportunity_id=new.opportunity_id and status='reserved' and reserved_until>now() and not(new.funding_source='stripe_test' and quote_id=new.quote_id and contractor_id=new.contractor_id)) into v_count;
 if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;
 if new.funding_source='wallet' and exists(select 1 from gef_private.test_checkout_orders where contractor_id=new.contractor_id and opportunity_id=new.opportunity_id and status='reserved' and reserved_until>now()) then raise exception 'Contact reserved in Checkout';end if;
 return new;
end $$;
create trigger guard_purchase_capacity before insert on gef_private.contact_purchases for each row execute function gef_private.guard_purchase_capacity();

create function public.gef_confirm_test_order(p_order uuid,p_event text,p_session text,p_payment text,p_outcome text,p_amount bigint,p_currency text,p_mode text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;e gef_private.test_checkout_events%rowtype;q gef_private.contact_quotes%rowtype;
 v_status text;v_published timestamptz;v_purchase uuid;v_next text;
begin
 if p_mode is distinct from 'test' or p_currency is distinct from 'USD' or p_event is null or p_event !~ '^evt_[A-Za-z0-9_]+$' or p_session is null or p_session !~ '^cs_test_[A-Za-z0-9_]+$' or p_outcome is null or p_outcome not in ('paid','failed','expired') or (p_outcome='paid' and (p_payment is null or p_payment !~ '^pi_[A-Za-z0-9_]+$')) then raise exception 'Invalid test confirmation';end if;
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
  if e.order_id<>p_order or e.session_id<>p_session or e.payment_id is distinct from p_payment or e.outcome<>p_outcome or e.amount_cents<>p_amount or e.currency<>p_currency or e.mode<>p_mode then raise exception 'Event payload conflict';end if;
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
  elsif o.status='reserved' then v_next:=p_outcome;
  end if;
  update gef_private.test_checkout_orders set status=v_next,payment_id=case when p_outcome='paid' then p_payment else payment_id end,purchase_id=coalesce(v_purchase,purchase_id) where id=p_order;
 end if;
 insert into gef_private.test_checkout_events(event_id,order_id,session_id,payment_id,outcome,amount_cents,currency,mode) values(p_event,p_order,p_session,p_payment,p_outcome,p_amount,p_currency,p_mode);
 return jsonb_build_object('created',true,'status',v_next,'contact_release_enabled',false);
end $$;

-- Internal synthetic refund acknowledgment only. No Stripe refund API/network call.
create function public.gef_refund_test_order(p_actor uuid,p_order uuid,p_key text,p_reason text) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.test_checkout_orders%rowtype;a gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) or p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Administrator and reason required';end if;
 select * into o from gef_private.test_checkout_orders where id=p_order;
 if o.opportunity_id is not null then perform 1 from public.leads where id=(select lead_id from public.opportunity_previews where id=o.opportunity_id) for update;perform 1 from public.opportunity_previews where id=o.opportunity_id for update;end if;
 select * into o from gef_private.test_checkout_orders where id=p_order for update;
 if not found then raise exception 'Order unavailable';end if;
 select * into a from gef_private.admin_audit where operation_key=p_key;
 if found then
  if a.action<>'test_order_refund' or a.target_id<>p_order or a.actor_id<>p_actor or a.reason<>p_reason then raise exception 'Idempotency payload conflict';end if;
  return jsonb_build_object('created',false);
 end if;
 if o.status not in ('paid','refund_required') then raise exception 'Order cannot be refunded';end if;
 update gef_private.test_checkout_orders set status='refunded' where id=p_order;
 if o.purchase_id is not null then update gef_private.contact_purchases set status='refunded' where id=o.purchase_id;end if;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason) values(p_actor,'test_order_refund',p_order,p_key,jsonb_build_object('amount_cents',o.amount_cents,'synthetic_only',true),p_reason);
 return jsonb_build_object('created',true,'synthetic_only',true);
end $$;

alter table gef_private.test_checkout_orders enable row level security;
alter table gef_private.test_checkout_events enable row level security;
revoke all on gef_private.test_checkout_orders,gef_private.test_checkout_events from public,anon,authenticated;
grant select,insert on gef_private.test_checkout_orders,gef_private.test_checkout_events to service_role;
grant update(status,session_id,payment_id,purchase_id) on gef_private.test_checkout_orders to service_role;
revoke all on function public.gef_create_test_quote(uuid,uuid,bigint,timestamptz),public.gef_create_test_order(uuid,text,uuid,text),public.gef_test_order_read(uuid),public.gef_bind_test_session(uuid,text),public.gef_confirm_test_order(uuid,text,text,text,text,bigint,text,text),public.gef_refund_test_order(uuid,uuid,text,text),gef_private.guard_purchase_capacity() from public,anon,authenticated;
grant execute on function public.gef_create_test_quote(uuid,uuid,bigint,timestamptz),public.gef_create_test_order(uuid,text,uuid,text),public.gef_test_order_read(uuid),public.gef_bind_test_session(uuid,text),public.gef_confirm_test_order(uuid,text,text,text,text,bigint,text,text),public.gef_refund_test_order(uuid,uuid,text,text),gef_private.guard_purchase_capacity() to service_role;
revoke all on function public.gef_test_quote_context(uuid),public.gef_test_quote_read(uuid,uuid),gef_private.guard_direct_refund() from public,anon,authenticated;
grant execute on function public.gef_test_quote_context(uuid),public.gef_test_quote_read(uuid,uuid),gef_private.guard_direct_refund() to service_role;
commit;
