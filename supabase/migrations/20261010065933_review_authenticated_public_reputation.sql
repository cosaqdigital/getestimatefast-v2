-- PREPARED ONLY. List pagination never truncates the reputation aggregate.
begin;
create or replace function public.gef_public_profile(p_slug text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('profile',jsonb_build_object('slug',pp.slug,'display_name',pp.display_name,'headline',pp.headline,'about',pp.about,'city',pp.city,'state_code',pp.state_code,'zip_code',pp.zip_code,'radius_miles',pp.radius_miles,'categories',pp.categories,'languages',pp.languages,'social_links',pp.social_links,'portfolio',pp.portfolio,
 'public_email',case when pp.publish_email then pp.public_email else null end,'public_phone',case when pp.publish_phone then pp.public_phone else null end),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from(select r.id,r.display_name,r.rating,r.comment,r.source,r.created_at from public.contractor_reviews r join gef_private.review_authenticated_identities ai on ai.review_id=r.id where r.contractor_id=pp.contractor_id and r.status='approved' order by r.created_at desc,r.id limit 100)r),'[]'),
 'review_summary',(select jsonb_build_object('approved_count',count(*),'average_rating',avg(r.rating)) from public.contractor_reviews r join gef_private.review_authenticated_identities ai on ai.review_id=r.id where r.contractor_id=pp.contractor_id and r.status='approved'))
 from public.contractor_public_profiles pp join public.contractor_profiles p on p.user_id=pp.contractor_id
 where pp.slug=p_slug and pp.published and p.account_status='active' and p.email_verified_at is not null;
$$;
create or replace function public.gef_admin_marketplace(p_actor uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required';end if;
 return jsonb_build_object(
 'rules',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_price_rules order by created_at desc limit 100)t),'[]'),
 'promotions',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_promotions order by created_at desc limit 100)t),'[]'),
 'reviews',coalesce((select jsonb_agg(to_jsonb(t)) from(select r.id,r.contractor_id,r.display_name,r.rating,r.comment,r.source,r.status,r.created_at,exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=r.id) identity_verified from public.contractor_reviews r order by created_at desc limit 100)t),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,review_id,reason,status,created_at from gef_private.review_reports order by created_at desc limit 100)t),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,action,target_id,reason,created_at from gef_private.admin_audit order by created_at desc limit 100)t),'[]'),
 'profile_service_prices',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.profile_service_prices order by created_at desc limit 100)t),'[]'),
 'opportunities',coalesce((select jsonb_agg(to_jsonb(t)) from(select o.id,o.service_category,o.city,o.published_at from public.opportunity_previews o join public.leads l on l.id=o.lead_id where l.status='published' order by o.published_at desc limit 100)t),'[]'),
 'metrics',jsonb_build_object('public_profiles',(select count(*) from public.contractor_public_profiles where published),'pending_reviews',(select count(*) from public.contractor_reviews where status='pending'),'purchases',(select count(*) from gef_private.contact_purchases),'refunds',(select count(*) from gef_private.contact_purchases where status='refunded'),'pending_payments',(select count(*) from gef_private.payment_intents where status='pending')));
end $$;
revoke all on function public.gef_admin_marketplace(uuid) from public,anon,authenticated;
grant execute on function public.gef_admin_marketplace(uuid) to service_role;
revoke all on function public.gef_public_profile(text) from public,anon,authenticated;
grant execute on function public.gef_public_profile(text) to service_role;
commit;
