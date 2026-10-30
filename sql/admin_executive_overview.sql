-- Executive admin dashboard read model.
-- Production function is service-role only and requires an approved admin actor.
create or replace function public.gef_admin_executive_overview(p_actor uuid)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  v_today date := timezone('America/New_York', now())::date;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    raise exception 'Administrator required';
  end if;

  return jsonb_build_object(
    'requests_today',(select count(*) from public.leads l where timezone('America/New_York',l.created_at)::date=v_today and coalesce(l.source,'') not like 'synthetic-%'),
    'waiting_review',(select count(*) from public.leads l where l.status='new' and coalesce(l.source,'') not like 'synthetic-%'),
    'active_opportunities',(select count(*) from public.leads l where l.status='published' and coalesce(l.source,'') not like 'synthetic-%'),
    'published_today',(select count(*) from public.leads l where l.status='published' and timezone('America/New_York',l.reviewed_at)::date=v_today and coalesce(l.source,'') not like 'synthetic-%'),
    'active_professionals',(select count(*) from public.contractor_profiles p where p.account_status='active'),
    'registered_professionals',(select count(*) from public.contractor_profiles),
    'public_profiles',(select count(*) from public.contractor_public_profiles pp where pp.published),
    'contacts_sold',(select count(*) from gef_private.contact_purchases p where p.status='acquired'),
    'contacts_sold_today',(select count(*) from gef_private.contact_purchases p where p.status='acquired' and timezone('America/New_York',p.created_at)::date=v_today),
    'revenue_today_cents',(select coalesce(sum(p.amount_cents),0) from gef_private.contact_purchases p where p.status='acquired' and timezone('America/New_York',p.created_at)::date=v_today),
    'revenue_7d_cents',(select coalesce(sum(p.amount_cents),0) from gef_private.contact_purchases p where p.status='acquired' and timezone('America/New_York',p.created_at)::date between v_today-6 and v_today),
    'refunds',(select count(*) from gef_private.contact_purchases p where p.status='refunded'),
    'pending_payments',(select count(*) from gef_private.payment_intents p where p.status='pending'),
    'sms_sent_24h',(
      select count(*) from public.opportunity_sms_queue q
      join public.opportunity_previews o on o.id=q.opportunity_id
      join public.leads l on l.id=o.lead_id
      where q.sent_at>=now()-interval '24 hours' and coalesce(l.source,'') not like 'synthetic-%'
    ),
    'sms_delivered_24h',(
      select count(*) from public.opportunity_sms_queue q
      join public.opportunity_previews o on o.id=q.opportunity_id
      join public.leads l on l.id=o.lead_id
      where q.delivered_at>=now()-interval '24 hours' and coalesce(l.source,'') not like 'synthetic-%'
    ),
    'sms_failed',(
      select count(*) from public.opportunity_sms_queue q
      join public.opportunity_previews o on o.id=q.opportunity_id
      join public.leads l on l.id=o.lead_id
      where q.status='FAILED' and coalesce(l.source,'') not like 'synthetic-%'
    ),
    'opportunities_without_sms',(
      select count(*) from public.leads l
      join public.opportunity_previews o on o.lead_id=l.id
      where l.status='published' and coalesce(l.source,'') not like 'synthetic-%'
        and not exists(select 1 from public.opportunity_sms_queue q where q.opportunity_id=o.id)
    ),
    'purchase_conversion_pct',(
      select case when count(*)=0 then 0 else round(
        100.0*count(*) filter(where exists(
          select 1 from gef_private.contact_purchases p
          where p.opportunity_id=o.id and p.status='acquired'
        ))/count(*),1
      ) end
      from public.opportunity_previews o
      join public.leads l on l.id=o.lead_id
      where coalesce(l.source,'') not like 'synthetic-%'
    )
  );
end
$$;

revoke all on function public.gef_admin_executive_overview(uuid) from public,anon,authenticated;
grant execute on function public.gef_admin_executive_overview(uuid) to service_role;
