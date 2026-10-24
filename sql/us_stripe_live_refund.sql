-- PREPARED ONLY. Apply after sql/us_stripe_live_checkout.sql and sql/us_stripe_live_capacity_guard.sql.
-- Persists Stripe live refund completion for orders that were paid but could not release contact access.
begin;

alter table gef_private.live_checkout_orders
  add column if not exists refund_id text;

alter table gef_private.live_checkout_orders
  drop constraint if exists live_checkout_orders_refund_id_format_check;
alter table gef_private.live_checkout_orders
  add constraint live_checkout_orders_refund_id_format_check
  check (refund_id is null or refund_id ~ '^re_[A-Za-z0-9_]+$');

create unique index if not exists live_checkout_orders_refund_id_key
  on gef_private.live_checkout_orders(refund_id)
  where refund_id is not null;

create or replace function public.gef_live_refund_read(p_order uuid)
returns jsonb
language sql
stable
set search_path=''
as $$
  select jsonb_build_object(
    'order_id',o.id,
    'status',o.status,
    'refund_id',o.refund_id,
    'payment_id',o.payment_id,
    'amount_cents',o.amount_cents,
    'currency',o.currency
  )
  from gef_private.live_checkout_orders o
  where o.id=p_order
    and o.status in ('refund_required','refunded');
$$;

create or replace function public.gef_confirm_live_refund(
  p_order uuid,
  p_refund text,
  p_payment text,
  p_amount bigint,
  p_currency text,
  p_mode text,
  p_status text
)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  o gef_private.live_checkout_orders%rowtype;
begin
  if p_mode is distinct from 'live'
     or p_currency is distinct from 'USD'
     or p_status is distinct from 'succeeded'
     or p_refund is null
     or p_refund !~ '^re_[A-Za-z0-9_]+$'
     or p_payment is null
     or p_payment !~ '^pi_[A-Za-z0-9_]+$'
     or p_amount is null
     or p_amount < 1 then
    raise exception 'Invalid live refund confirmation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gef-live-refund:'||p_order::text,0));
  select * into o
  from gef_private.live_checkout_orders
  where id=p_order
  for update;

  if not found then
    raise exception 'Order unavailable';
  end if;

  if o.status='refunded' then
    if o.refund_id is distinct from p_refund
       or o.payment_id is distinct from p_payment
       or o.amount_cents is distinct from p_amount
       or o.currency is distinct from p_currency then
      raise exception 'Refund payload conflict';
    end if;
    return jsonb_build_object(
      'created',false,
      'status','refunded',
      'refund_id',o.refund_id,
      'contact_release_enabled',false,
      'processor_refund_confirmed',true
    );
  end if;

  if o.status<>'refund_required'
     or o.purchase_id is not null
     or o.payment_id is distinct from p_payment
     or o.amount_cents is distinct from p_amount
     or o.currency is distinct from p_currency then
    raise exception 'Refund does not match refundable order';
  end if;

  if o.refund_id is not null and o.refund_id<>p_refund then
    raise exception 'Refund conflict';
  end if;

  update gef_private.live_checkout_orders
  set status='refunded',
      refund_id=p_refund
  where id=p_order;

  return jsonb_build_object(
    'created',true,
    'status','refunded',
    'refund_id',p_refund,
    'contact_release_enabled',false,
    'processor_refund_confirmed',true
  );
end $$;

revoke all on function public.gef_live_refund_read(uuid),
  public.gef_confirm_live_refund(uuid,text,text,bigint,text,text,text)
from public,anon,authenticated;

grant execute on function public.gef_live_refund_read(uuid),
  public.gef_confirm_live_refund(uuid,text,text,bigint,text,text,text)
to service_role;

grant update(status,refund_id) on gef_private.live_checkout_orders to service_role;

commit;
