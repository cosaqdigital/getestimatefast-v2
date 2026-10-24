-- Apply after sql/us_stripe_live_checkout.sql.
-- Counts pending live reservations in the same capacity guard used by completed purchases.
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

  perform 1 from public.leads
  where id=(select lead_id from public.opportunity_previews where id=new.opportunity_id)
  for update;
  perform 1 from public.opportunity_previews where id=new.opportunity_id for update;

  select
    (select count(*) from gef_private.contact_purchases
      where opportunity_id=new.opportunity_id and status='acquired')
    +
    (select count(*) from gef_private.test_checkout_orders
      where opportunity_id=new.opportunity_id and status='reserved' and reserved_until>now()
        and not(new.funding_source='stripe_test' and quote_id=new.quote_id and contractor_id=new.contractor_id))
    +
    (select count(*) from gef_private.live_checkout_orders
      where opportunity_id=new.opportunity_id and status='reserved' and reserved_until>now()
        and not(new.funding_source='stripe_live' and quote_id=new.quote_id and contractor_id=new.contractor_id))
  into v_count;

  if v_count>=q.max_buyers then raise exception 'Buyer limit reached';end if;
  return new;
end $$;

revoke all on function gef_private.guard_purchase_capacity() from public,anon,authenticated;
grant execute on function gef_private.guard_purchase_capacity() to service_role;

commit;
