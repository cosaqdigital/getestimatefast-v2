-- Apply after sql/us_stripe_live_checkout.sql.
-- Production-only capacity guard: live reservations count against the buyer limit.
begin;

create or replace function gef_private.guard_purchase_capacity()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  q gef_private.contact_quotes%rowtype;
  v_count integer;
begin
  select * into q from gef_private.contact_quotes where id=new.quote_id;
  if q.contractor_id is distinct from new.contractor_id
     or q.opportunity_id is distinct from new.opportunity_id
     or q.amount_cents is distinct from new.amount_cents then
    raise exception 'Purchase quote mismatch';
  end if;

  if new.funding_source='stripe_test' then
    raise exception 'Test purchases are unavailable in the live checkout schema';
  end if;

  if new.funding_source='stripe_live' and not exists(
    select 1 from gef_private.live_checkout_orders
    where contractor_id=new.contractor_id
      and quote_id=new.quote_id
      and status='reserved'
      and reserved_until>now()
      and session_id is not null
  ) then
    raise exception 'Bound live Checkout reservation required';
  end if;

  perform 1 from public.leads
  where id=(select lead_id from public.opportunity_previews where id=new.opportunity_id)
  for update;
  perform 1 from public.opportunity_previews where id=new.opportunity_id for update;

  select
    (select count(*) from gef_private.contact_purchases
      where opportunity_id=new.opportunity_id and status='acquired')
    +
    (select count(*) from gef_private.live_checkout_orders
      where opportunity_id=new.opportunity_id
        and status='reserved'
        and reserved_until>now()
        and not(new.funding_source='stripe_live'
                and quote_id=new.quote_id
                and contractor_id=new.contractor_id))
  into v_count;

  if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;

  if new.funding_source='wallet' and exists(
    select 1 from gef_private.live_checkout_orders
    where contractor_id=new.contractor_id
      and opportunity_id=new.opportunity_id
      and status='reserved'
      and reserved_until>now()
  ) then
    raise exception 'Contact reserved in Checkout';
  end if;

  return new;
end $$;

create or replace function gef_private.guard_direct_refund()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.kind='refund' and exists(
    select 1 from gef_private.contact_purchases
    where id=new.reference_id
      and funding_source in ('stripe_test','stripe_live')
  ) then
    raise exception 'Provider refund required for direct Stripe payment';
  end if;
  return new;
end $$;

revoke all on function gef_private.guard_purchase_capacity(),gef_private.guard_direct_refund()
from public,anon,authenticated;
grant execute on function gef_private.guard_purchase_capacity(),gef_private.guard_direct_refund()
to service_role;

commit;
