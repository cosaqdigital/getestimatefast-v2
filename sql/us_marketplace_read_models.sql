-- PREPARED ONLY. Server-only read models; private joins project explicit fields.
begin;
create function public.gef_public_profile(p_slug text) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('profile',jsonb_build_object('slug',pp.slug,'display_name',pp.display_name,'headline',pp.headline,'about',pp.about,'city',pp.city,'state_code',pp.state_code,'zip_code',pp.zip_code,'radius_miles',pp.radius_miles,'categories',pp.categories,'languages',pp.languages,'social_links',pp.social_links,'portfolio',pp.portfolio,
 'public_email',case when pp.publish_email then pp.public_email else null end,'public_phone',case when pp.publish_phone then pp.public_phone else null end),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from(select id,display_name,rating,comment,source,created_at from public.contractor_reviews where contractor_id=pp.contractor_id and status='approved' order by created_at desc limit 100)r),'[]'))
 from public.contractor_public_profiles pp join public.contractor_profiles p on p.user_id=pp.contractor_id
 where pp.slug=p_slug and pp.published and p.account_status='active' and p.email_verified_at is not null;
$$;
create function public.gef_admin_marketplace(p_actor uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required';end if;
 return jsonb_build_object(
 'rules',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_price_rules order by created_at desc limit 100)t),'[]'),
 'promotions',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_promotions order by created_at desc limit 100)t),'[]'),
 'reviews',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,contractor_id,display_name,rating,comment,source,status,created_at from public.contractor_reviews order by created_at desc limit 100)t),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,review_id,reason,status,created_at from gef_private.review_reports order by created_at desc limit 100)t),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,action,target_id,reason,created_at from gef_private.admin_audit order by created_at desc limit 100)t),'[]'),
 'profile_service_prices',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.profile_service_prices order by created_at desc limit 100)t),'[]'),
 'opportunities',coalesce((select jsonb_agg(to_jsonb(t)) from(select o.id,o.service_category,o.city,o.published_at from public.opportunity_previews o join public.leads l on l.id=o.lead_id where l.status='published' order by o.published_at desc limit 100)t),'[]'),
 'metrics',jsonb_build_object('public_profiles',(select count(*) from public.contractor_public_profiles where published),'pending_reviews',(select count(*) from public.contractor_reviews where status='pending'),'purchases',(select count(*) from gef_private.contact_purchases),'refunds',(select count(*) from gef_private.contact_purchases where status='refunded'),'pending_payments',(select count(*) from gef_private.payment_intents where status='pending')));
end $$;
create function public.gef_admin_configuration(p_actor uuid,p_action text,p_payload jsonb,p_reason text,p_key text) returns jsonb language plpgsql set search_path='' as $$
declare v_id uuid;v_old gef_private.admin_audit%rowtype;v_opportunity public.opportunity_previews%rowtype;v_rule public.marketplace_price_rules%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Invalid configuration request'; end if;
 -- Serialize configuration retries, including equal keys across different entity types.
 perform pg_advisory_xact_lock(hashtextextended('gef-admin-config:'||p_key,0));
 select * into v_old from gef_private.admin_audit where operation_key=p_key;
 if found then
  if v_old.actor_id<>p_actor or v_old.action<>p_action or v_old.details<>p_payload or v_old.reason<>p_reason then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('id',v_old.target_id,'created',false);
 end if;
 if p_action='pricing_rule' then
  insert into public.marketplace_price_rules(category,version,base_cents,floor_cents,max_buyers,lifetime_hours,scope_bps,urgency_bps,discounts,effective_at,created_by,reason)
  values(p_payload->>'category',p_payload->>'version',(p_payload->>'base_cents')::bigint,(p_payload->>'floor_cents')::bigint,(p_payload->>'max_buyers')::int,(p_payload->>'lifetime_hours')::int,coalesce(p_payload->'scope_bps','{}'),coalesce(p_payload->'urgency_bps','{}'),p_payload->'discounts',(p_payload->>'effective_at')::timestamptz,p_actor,p_reason) returning id into v_id;
 elsif p_action='promotion' then
  insert into public.marketplace_promotions(version,amount_cents,bonus_cents,starts_at,ends_at,enabled,created_by,reason)
  values(p_payload->>'version',(p_payload->>'amount_cents')::bigint,(p_payload->>'bonus_cents')::bigint,(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,(p_payload->>'enabled')::boolean,p_actor,p_reason) returning id into v_id;
 elsif p_action='opportunity_terms' then
  select * into v_opportunity from public.opportunity_previews where id=(p_payload->>'opportunity_id')::uuid;
  if not found then raise exception 'Opportunity unavailable';end if;
  perform 1 from public.leads where id=v_opportunity.lead_id and status='published' for update;
  if not found then raise exception 'Published opportunity required'; end if;
  perform 1 from public.opportunity_previews where id=v_opportunity.id for update;
  select * into v_rule from public.marketplace_price_rules where id=(p_payload->>'rule_id')::uuid;
  if not found or v_rule.category<>v_opportunity.service_category or v_rule.effective_at>now() then raise exception 'Active category pricing rule required';end if;
  if (p_payload->>'scope_key' is not null and not(v_rule.scope_bps ? (p_payload->>'scope_key'))) or (p_payload->>'urgency_key' is not null and not(v_rule.urgency_bps ? (p_payload->>'urgency_key'))) then raise exception 'Unknown pricing characteristic';end if;
  insert into gef_private.opportunity_terms(opportunity_id,rule_id,scope_key,urgency_key,max_buyers,opportunity_expires_at,published_at_snapshot)
  values(v_opportunity.id,v_rule.id,p_payload->>'scope_key',p_payload->>'urgency_key',v_rule.max_buyers,v_opportunity.published_at+v_rule.lifetime_hours*interval '1 hour',v_opportunity.published_at) returning id into v_id;
 elsif p_action='profile_service_price' then
  insert into public.profile_service_prices(version,amount_cents,currency,effective_at,created_by,reason)
  values(p_payload->>'version',(p_payload->>'amount_cents')::bigint,'USD',(p_payload->>'effective_at')::timestamptz,p_actor,p_reason) returning id into v_id;
 else raise exception 'Unknown configuration action';end if;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason) values(p_actor,p_action,v_id,p_key,p_payload,p_reason);
 return jsonb_build_object('id',v_id,'created',true);
end $$;
create function public.gef_resolve_review_report(p_actor uuid,p_report uuid,p_status text,p_reason text,p_key text) returns jsonb language plpgsql set search_path='' as $$
declare v_old gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_status is null or p_status not in ('resolved','dismissed') or p_reason is null or length(btrim(p_reason)) not between 5 and 500 or p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid report decision'; end if;
 perform 1 from gef_private.review_reports where id=p_report for update;if not found then raise exception 'Report unavailable'; end if;
 select * into v_old from gef_private.admin_audit where operation_key=p_key;
 if found then
  if v_old.actor_id<>p_actor or v_old.action<>'review_report_resolved' or v_old.target_id<>p_report or v_old.details->>'status'<>p_status or v_old.reason<>p_reason then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('changed',false);
 end if;
 update gef_private.review_reports set status=p_status where id=p_report;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason) values(p_actor,'review_report_resolved',p_report,p_key,jsonb_build_object('status',p_status),p_reason);
 return jsonb_build_object('changed',true);
end $$;
revoke all on function public.gef_public_profile(text),public.gef_admin_marketplace(uuid),public.gef_admin_configuration(uuid,text,jsonb,text,text),public.gef_resolve_review_report(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.gef_public_profile(text),public.gef_admin_marketplace(uuid),public.gef_admin_configuration(uuid,text,jsonb,text,text),public.gef_resolve_review_report(uuid,uuid,text,text,text) to service_role;
create function public.gef_commercial_previews(p_ids uuid[]) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',o.id,'terms_id',t.id,'scope',t.scope_key,'urgency',t.urgency_key,'rule',to_jsonb(r),'buyer_count',(select count(*) from gef_private.contact_purchases p where p.opportunity_id=o.id and p.status='acquired'))),'[]')
 from public.opportunity_previews o join gef_private.opportunity_terms t on t.opportunity_id=o.id and t.published_at_snapshot=o.published_at join public.marketplace_price_rules r on r.id=t.rule_id
 where o.id=any(p_ids);
$$;
revoke all on function public.gef_commercial_previews(uuid[]) from public,anon,authenticated;
grant execute on function public.gef_commercial_previews(uuid[]) to service_role;
commit;
