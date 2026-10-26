-- PREPARED ONLY. Do not apply to Production until the staged live-payment review is complete.
-- Direct contact purchase flow for Stripe live mode. No secret values are stored here.
begin;

alter table gef_private.contact_purchases
  drop constraint if exists contact_purchases_funding_source_check;
alter table gef_private.contact_purchases
  add constraint contact_purchases_funding_source_check
  check (funding_source in ('wallet','stripe_test','stripe_live'));

create table if not exists gef_private.live_checkout_orders(
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractor_profiles(user_id),
  quote_id uuid not null references gef_private.contact_quotes(id),
  opportunity_id uuid not null references public.opportunity_previews(id),
  amount_cents bigint not null check(amount_cents between 1 and 100000000),
  currency text not null default 'USD' check(currency='USD'),
  status text not null default 'reserved'
    check(status in ('reserved','paid','failed','expired','refund_required','refunded')),
  operation_key text not null,
  session_id text unique,
  payment_id text unique,
  purchase_id uuid unique references gef_private.contact_purchases(id),
  reserved_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique(contractor_id,operation_key)
);
create index if not exists live_checkout_owner_idx on gef_private.live_checkout_orders(contractor_id,created_at desc);
create index if not exists live_checkout_quote_idx on gef_private.live_checkout_orders(quote_id);
create index if not exists live_checkout_opportunity_idx on gef_private.live_checkout_orders(opportunity_id,status,reserved_until);

create table if not exists gef_private.live_checkout_events(
  event_id text primary key,
  order_id uuid not null references gef_private.live_checkout_orders(id),
  session_id text not null,
  payment_id text,
  outcome text not null check(outcome in ('paid','failed','expired')),
  amount_cents bigint not null,
  currency text not null check(currency='USD'),
  mode text not null check(mode='live'),
  created_at timestamptz not null default now()
);
create index if not exists live_checkout_events_order_idx on gef_private.live_checkout_events(order_id);
create trigger immutable_live_checkout_events before update or delete on gef_private.live_checkout_events
for each row execute function gef_private.reject_change();

create or replace function public.gef_live_quote_context(p_opportunity uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
   'opportunity',jsonb_build_object('opportunity_id',op.id,'service_category',op.service_category,'city',op.city,'zip_code',op.zip_code,'published_at',op.published_at),
   'terms_id',t.id,'scope',t.scope_key,'urgency',t.urgency_key,'rule',to_jsonb(r),
   'buyer_count',
      (select count(*) from gef_private.contact_purchases p where p.opportunity_id=op.id and p.status='acquired')
      +(select count(*) from gef_private.live_checkout_orders lo where lo.opportunity_id=op.id and lo.status='reserved' and lo.reserved_until>now())
 )
 from public.opportunity_previews op
 join public.leads l on l.id=op.lead_id
 join gef_private.opportunity_terms t on t.opportunity_id=op.id and t.published_at_snapshot=op.published_at
 join public.marketplace_price_rules r on r.id=t.rule_id
 where op.id=p_opportunity and l.status='published';
$$;

create or replace function public.gef_create_live_quote(p_contractor uuid,p_terms uuid,p_amount bigint,p_valid_until timestamptz)
returns jsonb language plpgsql set search_path='' as $$
declare t gef_private.opportunity_terms%rowtype;v_id uuid;
begin
 select * into t from gef_private.opportunity_terms where id=p_terms;
 if not found or p_amount is null or p_amount<1 or p_valid_until is null or p_valid_until<=now()
    or p_valid_until>now()+interval '5 minutes' or p_valid_until>t.opportunity_expires_at then
   raise exception 'Invalid server quote';
 end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null and state_code='FL')
   then raise exception 'Active contractor required'; end if;
 insert into gef_private.contact_quotes(contractor_id,opportunity_id,rule_id,terms_id,amount_cents,max_buyers,valid_until,opportunity_expires_at,published_at_snapshot)
 values(p_contractor,t.opportunity_id,t.rule_id,t.id,p_amount,t.max_buyers,p_valid_until,t.opportunity_expires_at,t.published_at_snapshot)
 returning id into v_id;
 return jsonb_build_object('quote_id',v_id);
end $$;

create or replace function public.gef_prepare_live_order(p_contractor uuid,p_quote uuid,p_key text)
returns jsonb language plpgsql set search_path='' as $$
declare q gef_private.contact_quotes%rowtype;o gef_private.live_checkout_orders%rowtype;
 v_status text;v_published timestamptz;v_count integer;v_id uuid;
begin
 if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid live order';end if;
 perform pg_advisory_xact_lock(hashtextextended('gef-live-order:'||p_contractor::text||':'||p_key,0));
 select * into o from gef_private.live_checkout_orders where contractor_id=p_contractor and operation_key=p_key;
 if found then
   if o.quote_id<>p_quote then raise exception 'Idempotency payload conflict';end if;
   return to_jsonb(o);
 end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null and state_code='FL')
   then raise exception 'Active contractor required';end if;
 select * into q from gef_private.contact_quotes where id=p_quote and contractor_id=p_contractor;
 if not found then raise exception 'Quote unavailable';end if;
 select l.status,op.published_at into v_status,v_published
 from public.opportunity_previews op join public.leads l on l.id=op.lead_id
 where op.id=q.opportunity_id for update of l;
 perform 1 from public.opportunity_previews where id=q.opportunity_id for update;
 if v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot
    or q.valid_until<=now() or q.opportunity_expires_at<now()+interval '35 minutes'
   then raise exception 'Opportunity unavailable for Checkout';end if;
 if exists(select 1 from gef_private.contact_purchases where contractor_id=p_contractor and opportunity_id=q.opportunity_id)
    or exists(select 1 from gef_private.live_checkout_orders where contractor_id=p_contractor and opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now())
   then raise exception 'Contact already acquired or reserved';end if;
 select
   (select count(*) from gef_private.contact_purchases where opportunity_id=q.opportunity_id and status='acquired')
   +(select count(*) from gef_private.live_checkout_orders where opportunity_id=q.opportunity_id and status='reserved' and reserved_until>now())
 into v_count;
 if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;
 insert into gef_private.live_checkout_orders(contractor_id,quote_id,opportunity_id,amount_cents,operation_key,reserved_until)
 values(p_contractor,q.id,q.opportunity_id,q.amount_cents,p_key,now()+interval '35 minutes') returning id into v_id;
 select * into o from gef_private.live_checkout_orders where id=v_id;
 return to_jsonb(o);
end $$;

create or replace function public.gef_live_order_read(p_order uuid) returns jsonb
language sql stable set search_path='' as $$
 select to_jsonb(o) from gef_private.live_checkout_orders o where id=p_order;
$$;

create or replace function public.gef_bind_live_session(p_order uuid,p_session text) returns jsonb
language plpgsql set search_path='' as $$
declare o gef_private.live_checkout_orders%rowtype;
begin
 if p_session is null or p_session !~ '^cs_live_[A-Za-z0-9_]+$' then raise exception 'Live session required';end if;
 select * into o from gef_private.live_checkout_orders where id=p_order for update;
 if not found or o.status<>'reserved' or o.reserved_until<=now() then raise exception 'Order unavailable';end if;
 if o.session_id is not null and o.session_id<>p_session then raise exception 'Session conflict';end if;
 update gef_private.live_checkout_orders set session_id=p_session where id=p_order;
 return jsonb_build_object('bound',true);
end $$;

create or replace function public.gef_confirm_live_order(
 p_order uuid,p_event text,p_session text,p_payment text,p_outcome text,p_amount bigint,p_currency text,p_mode text
) returns jsonb language plpgsql set search_path='' as $$
declare o gef_private.live_checkout_orders%rowtype;e gef_private.live_checkout_events%rowtype;
 q gef_private.contact_quotes%rowtype;v_status text;v_published timestamptz;v_purchase uuid;v_next text;v_count integer;
begin
 if p_mode is distinct from 'live' or p_currency is distinct from 'USD'
    or p_event is null or p_event !~ '^evt_[A-Za-z0-9_]+$'
    or p_session is null or p_session !~ '^cs_live_[A-Za-z0-9_]+$'
    or p_outcome is null or p_outcome not in ('paid','failed','expired')
    or (p_outcome='paid' and (p_payment is null or p_payment !~ '^pi_[A-Za-z0-9_]+$'))
   then raise exception 'Invalid live confirmation';end if;
 select * into o from gef_private.live_checkout_orders where id=p_order;
 if not found then raise exception 'Order unavailable';end if;
 select l.status,op.published_at into v_status,v_published
 from public.opportunity_previews op join public.leads l on l.id=op.lead_id
 where op.id=o.opportunity_id for update of l;
 perform 1 from public.opportunity_previews where id=o.opportunity_id for update;
 select * into o from gef_private.live_checkout_orders where id=p_order for update;
 if o.session_id is distinct from p_session or o.amount_cents is distinct from p_amount
   then raise exception 'Confirmation does not match order';end if;
 perform pg_advisory_xact_lock(hashtextextended('gef-live-event:'||p_event,0));
 select * into e from gef_private.live_checkout_events where event_id=p_event;
 if found then
   if e.order_id<>p_order or e.session_id<>p_session or e.payment_id is distinct from p_payment
      or e.outcome<>p_outcome or e.amount_cents<>p_amount or e.currency<>p_currency or e.mode<>p_mode
      then raise exception 'Event payload conflict';end if;
   return jsonb_build_object('created',false,'status',o.status,'purchase_id',o.purchase_id,'contact_release_enabled',o.status='paid' and o.purchase_id is not null);
 end if;
 if o.payment_id is not null and p_outcome='paid' and o.payment_id is distinct from p_payment then raise exception 'Payment conflict';end if;
 v_next:=o.status;
 if o.status not in ('paid','refunded','refund_required') then
   if p_outcome='paid' then
     v_next:='paid';
     select * into q from gef_private.contact_quotes where id=o.quote_id;
     if o.status<>'reserved' or o.reserved_until<=now() or q.opportunity_expires_at<=now()
        or v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot
        or not exists(select 1 from public.contractor_profiles where user_id=o.contractor_id and account_status='active' and email_verified_at is not null)
       then v_next:='refund_required';
     else
       select
         (select count(*) from gef_private.contact_purchases
          where opportunity_id=o.opportunity_id and status='acquired')
         +
         (select count(*) from gef_private.live_checkout_orders
          where opportunity_id=o.opportunity_id and status='reserved' and reserved_until>now() and id<>o.id)
       into v_count;
       if v_count>=q.max_buyers then
         v_next:='refund_required';
       else
         insert into gef_private.wallets(contractor_id) values(o.contractor_id) on conflict do nothing;
         insert into gef_private.contact_purchases(contractor_id,opportunity_id,quote_id,amount_cents,operation_key,funding_source)
         values(o.contractor_id,o.opportunity_id,o.quote_id,o.amount_cents,'stripe-live:'||o.id::text,'stripe_live')
         returning id into v_purchase;
       end if;
     end if;
   elsif o.status='reserved' then v_next:=p_outcome;end if;
   update gef_private.live_checkout_orders
   set status=v_next,payment_id=case when p_outcome='paid' then p_payment else payment_id end,
       purchase_id=coalesce(v_purchase,purchase_id)
   where id=p_order;
 end if;
 insert into gef_private.live_checkout_events(event_id,order_id,session_id,payment_id,outcome,amount_cents,currency,mode)
 values(p_event,p_order,p_session,p_payment,p_outcome,p_amount,p_currency,p_mode);
 return jsonb_build_object('created',true,'status',v_next,'purchase_id',v_purchase,'contact_release_enabled',v_next='paid' and v_purchase is not null);
end $$;

create or replace function public.gef_live_event_read(p_event text) returns jsonb
language sql stable set search_path='' as $$
 select to_jsonb(e) from gef_private.live_checkout_events e where event_id=p_event;
$$;

create or replace function public.gef_contact_access(p_contractor uuid,p_opportunity uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
   'opportunity_id',o.id,'service_type',l.service_type,'full_name',l.full_name,
   'email',l.email,'phone',l.phone,'contact_method',l.contact_method,'city',l.city,'zip_code',l.zip_code,
   'project_details',coalesce(l.details,'{}'::jsonb)-'_platform_review',
   'access_source',case when l.origin_contractor_id=p_contractor then 'origin' else 'purchase' end
 )
 from public.opportunity_previews o join public.leads l on l.id=o.lead_id
 where o.id=p_opportunity and (
   l.origin_contractor_id=p_contractor
   or exists(
     select 1 from gef_private.contact_purchases p
     where p.contractor_id=p_contractor and p.opportunity_id=o.id
       and p.status='acquired' and p.funding_source in ('wallet','stripe_live')
   )
 );
$$;

alter table gef_private.live_checkout_orders enable row level security;
alter table gef_private.live_checkout_events enable row level security;
revoke all on gef_private.live_checkout_orders,gef_private.live_checkout_events from public,anon,authenticated;
grant select,insert on gef_private.live_checkout_orders,gef_private.live_checkout_events to service_role;
grant update(status,session_id,payment_id,purchase_id) on gef_private.live_checkout_orders to service_role;

revoke all on function public.gef_live_quote_context(uuid),public.gef_create_live_quote(uuid,uuid,bigint,timestamptz),
 public.gef_prepare_live_order(uuid,uuid,text),public.gef_live_order_read(uuid),public.gef_bind_live_session(uuid,text),
 public.gef_confirm_live_order(uuid,text,text,text,text,bigint,text,text),public.gef_live_event_read(text),
 public.gef_contact_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gef_live_quote_context(uuid),public.gef_create_live_quote(uuid,uuid,bigint,timestamptz),
 public.gef_prepare_live_order(uuid,uuid,text),public.gef_live_order_read(uuid),public.gef_bind_live_session(uuid,text),
 public.gef_confirm_live_order(uuid,text,text,text,text,bigint,text,text),public.gef_live_event_read(text),
 public.gef_contact_access(uuid,uuid) to service_role;

commit;
