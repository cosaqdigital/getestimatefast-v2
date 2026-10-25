begin;

create table if not exists gef_private.review_email_verifications(
  review_id uuid primary key references public.contractor_reviews(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  request_ip_hash text check(request_ip_hash is null or request_ip_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table gef_private.review_email_verifications enable row level security;
revoke all on gef_private.review_email_verifications from public,anon,authenticated;
grant select,insert,update on gef_private.review_email_verifications to service_role;

create index if not exists review_email_verifications_sent_idx
  on gef_private.review_email_verifications(sent_at desc);

create or replace function public.gef_prepare_email_review(
  p_invite_hash text,
  p_identity_hash text,
  p_display_name text,
  p_rating integer,
  p_comment text,
  p_verification_hash text,
  p_request_hash text
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_inv gef_private.review_invitations%rowtype;
  v_review public.contractor_reviews%rowtype;
  v_review_id uuid;
  v_display_name text;
begin
  if p_invite_hash !~ '^[a-f0-9]{64}$'
     or p_identity_hash !~ '^[a-f0-9]{64}$'
     or p_verification_hash !~ '^[a-f0-9]{64}$'
     or (p_request_hash is not null and p_request_hash !~ '^[a-f0-9]{64}$')
     or length(btrim(coalesce(p_display_name,''))) not between 2 and 80
     or p_rating not between 1 and 5
     or length(btrim(coalesce(p_comment,''))) not between 10 and 1500
  then raise exception 'Invalid review submission'; end if;

  select * into v_inv
  from gef_private.review_invitations
  where token_hash=p_invite_hash
  for update;

  if not found or v_inv.used_at is not null or v_inv.expires_at<=now() then
    raise exception 'Review invitation is unavailable or expired';
  end if;

  select pp.display_name into v_display_name
  from public.contractor_public_profiles pp
  join public.contractor_profiles cp on cp.user_id=pp.contractor_id
  where pp.contractor_id=v_inv.contractor_id
    and pp.published
    and cp.account_status='active'
    and cp.email_verified_at is not null;

  if v_display_name is null then raise exception 'Professional profile unavailable'; end if;

  select * into v_review
  from public.contractor_reviews
  where invitation_id=v_inv.id
  for update;

  if found then
    if v_review.identity_hash is distinct from p_identity_hash then
      raise exception 'Review invitation already claimed';
    end if;
    if v_review.status<>'pending' then
      raise exception 'Review already submitted';
    end if;
    update public.contractor_reviews
       set display_name=btrim(p_display_name),
           rating=p_rating,
           comment=btrim(p_comment)
     where id=v_review.id
     returning id into v_review_id;
  else
    if exists(
      select 1 from public.contractor_reviews
      where contractor_id=v_inv.contractor_id
        and identity_hash=p_identity_hash
    ) then
      raise exception 'Review already submitted for this professional';
    end if;

    insert into public.contractor_reviews(
      contractor_id,invitation_id,identity_hash,display_name,rating,comment,source,status
    ) values(
      v_inv.contractor_id,v_inv.id,p_identity_hash,btrim(p_display_name),p_rating,btrim(p_comment),v_inv.source,'pending'
    ) returning id into v_review_id;
  end if;

  insert into gef_private.review_email_verifications(
    review_id,token_hash,request_ip_hash,expires_at,sent_at,verified_at
  ) values(
    v_review_id,p_verification_hash,p_request_hash,now()+interval '24 hours',now(),null
  )
  on conflict(review_id) do update set
    token_hash=excluded.token_hash,
    request_ip_hash=excluded.request_ip_hash,
    expires_at=excluded.expires_at,
    sent_at=excluded.sent_at,
    verified_at=null;

  return jsonb_build_object(
    'review_id',v_review_id,
    'contractor_id',v_inv.contractor_id,
    'display_name',v_display_name,
    'source',v_inv.source
  );
end $$;

create or replace function public.gef_confirm_email_review(p_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_ver gef_private.review_email_verifications%rowtype;
  v_review public.contractor_reviews%rowtype;
  v_inv gef_private.review_invitations%rowtype;
  v_slug text;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('result','invalid');
  end if;

  select * into v_ver
  from gef_private.review_email_verifications
  where token_hash=p_token_hash
  for update;

  if not found then return jsonb_build_object('result','invalid'); end if;

  select * into v_review from public.contractor_reviews where id=v_ver.review_id for update;
  if not found then return jsonb_build_object('result','invalid'); end if;

  select * into v_inv from gef_private.review_invitations where id=v_review.invitation_id for update;
  if not found then return jsonb_build_object('result','invalid'); end if;

  select slug into v_slug
  from public.contractor_public_profiles
  where contractor_id=v_review.contractor_id;

  if v_ver.verified_at is not null then
    return jsonb_build_object('result','already_confirmed','slug',v_slug);
  end if;
  if v_ver.expires_at<=now() then
    return jsonb_build_object('result','expired','slug',v_slug);
  end if;
  if v_review.status<>'pending' or v_inv.used_at is not null then
    return jsonb_build_object('result','invalid','slug',v_slug);
  end if;

  update gef_private.review_email_verifications
     set verified_at=now()
   where review_id=v_review.id;

  update gef_private.review_invitations
     set used_at=now()
   where id=v_inv.id;

  return jsonb_build_object('result','confirmed','slug',v_slug);
end $$;

create or replace function public.gef_public_profile(p_slug text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'profile',jsonb_build_object(
   'slug',pp.slug,'display_name',pp.display_name,'headline',pp.headline,'about',pp.about,
   'city',pp.city,'state_code',pp.state_code,'zip_code',pp.zip_code,'radius_miles',pp.radius_miles,
   'categories',pp.categories,'languages',pp.languages,'social_links',pp.social_links,'portfolio',pp.portfolio,
   'public_email',case when pp.publish_email then pp.public_email else null end,
   'public_phone',case when pp.publish_phone then pp.public_phone else null end
  ),
  'reviews',coalesce((
    select jsonb_agg(to_jsonb(r))
    from (
      select r.id,r.display_name,r.rating,r.comment,r.source,r.created_at
      from public.contractor_reviews r
      where r.contractor_id=pp.contractor_id
        and r.status='approved'
        and (
          exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=r.id)
          or exists(select 1 from gef_private.review_email_verifications ev where ev.review_id=r.id and ev.verified_at is not null)
        )
      order by r.created_at desc,r.id
      limit 100
    ) r
  ),'[]'),
  'review_summary',(
    select jsonb_build_object('approved_count',count(*),'average_rating',avg(r.rating))
    from public.contractor_reviews r
    where r.contractor_id=pp.contractor_id
      and r.status='approved'
      and (
        exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=r.id)
        or exists(select 1 from gef_private.review_email_verifications ev where ev.review_id=r.id and ev.verified_at is not null)
      )
  )
 )
 from public.contractor_public_profiles pp
 join public.contractor_profiles p on p.user_id=pp.contractor_id
 where pp.slug=p_slug and pp.published and p.account_status='active' and p.email_verified_at is not null;
$$;

create or replace function public.gef_admin_marketplace(p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required';end if;
 return jsonb_build_object(
 'rules',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_price_rules order by created_at desc limit 100)t),'[]'),
 'promotions',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.marketplace_promotions order by created_at desc limit 100)t),'[]'),
 'reviews',coalesce((select jsonb_agg(to_jsonb(t)) from(
   select r.id,r.contractor_id,r.display_name,r.rating,r.comment,r.source,r.status,r.created_at,
     (
       exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=r.id)
       or exists(select 1 from gef_private.review_email_verifications ev where ev.review_id=r.id and ev.verified_at is not null)
     ) identity_verified
   from public.contractor_reviews r order by created_at desc limit 100
 )t),'[]'),
 'reports',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,review_id,reason,status,created_at from gef_private.review_reports order by created_at desc limit 100)t),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(t)) from(select id,action,target_id,reason,created_at from gef_private.admin_audit order by created_at desc limit 100)t),'[]'),
 'profile_service_prices',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from public.profile_service_prices order by created_at desc limit 100)t),'[]'),
 'opportunities',coalesce((select jsonb_agg(to_jsonb(t)) from(select o.id,o.service_category,o.city,o.published_at from public.opportunity_previews o join public.leads l on l.id=o.lead_id where l.status='published' order by o.published_at desc limit 100)t),'[]'),
 'metrics',jsonb_build_object(
   'public_profiles',(select count(*) from public.contractor_public_profiles where published),
   'pending_reviews',(select count(*) from public.contractor_reviews where status='pending'),
   'purchases',(select count(*) from gef_private.contact_purchases),
   'refunds',(select count(*) from gef_private.contact_purchases where status='refunded'),
   'pending_payments',(select count(*) from gef_private.payment_intents where status='pending')
 ));
end $$;

create or replace function public.gef_moderate_review(p_actor uuid,p_review uuid,p_status text,p_reason text,p_key text)
returns jsonb
language plpgsql
security invoker
set search_path='' as $$
declare v_previous text;v_old gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_status is null or p_status not in ('approved','rejected','hidden')
    or p_reason is null or length(btrim(p_reason)) not between 5 and 500
    or p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$'
 then raise exception 'Invalid moderation'; end if;

 select status into v_previous from public.contractor_reviews where id=p_review for update;
 if not found then raise exception 'Review not found'; end if;

 if p_status='approved' and not (
   exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=p_review)
   or exists(select 1 from gef_private.review_email_verifications ev where ev.review_id=p_review and ev.verified_at is not null)
 ) then raise exception 'Review identity is not verified'; end if;

 select * into v_old from gef_private.admin_audit where operation_key=p_key;
 if found then
  if v_old.actor_id<>p_actor or v_old.action<>'review_moderated' or v_old.target_id<>p_review
     or v_old.details->>'next_status'<>p_status or v_old.reason<>p_reason
  then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('changed',false);
 end if;

 update public.contractor_reviews set status=p_status where id=p_review;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason)
 values(p_actor,'review_moderated',p_review,p_key,jsonb_build_object('prior_status',v_previous,'next_status',p_status),p_reason);
 return jsonb_build_object('changed',true);
end $$;

revoke all on function public.gef_prepare_email_review(text,text,text,integer,text,text,text) from public,anon,authenticated;
revoke all on function public.gef_confirm_email_review(text) from public,anon,authenticated;
grant execute on function public.gef_prepare_email_review(text,text,text,integer,text,text,text) to service_role;
grant execute on function public.gef_confirm_email_review(text) to service_role;

commit;
