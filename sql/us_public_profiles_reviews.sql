-- PREPARED ONLY: isolated GetEstimateFast backend, after financial foundation.
begin;
create table public.contractor_public_profiles(
 contractor_id uuid primary key references public.contractor_profiles(user_id) on delete restrict,
 slug text not null unique check(length(slug) between 3 and 80 and slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),
 display_name text not null check(length(btrim(display_name)) between 2 and 150),
 headline text not null default '',about text not null default '',
 city text not null,state_code text not null check(state_code='FL'),
 zip_code text not null check(zip_code~'^[0-9]{5}$'),
 radius_miles integer not null check(radius_miles between 1 and 100),
 categories jsonb not null,languages jsonb not null default '[]',
 social_links jsonb not null default '[]',portfolio jsonb not null default '[]',
 published boolean not null default false,
 publish_email boolean not null default false,publish_phone boolean not null default false,
 public_email text,public_phone text,
 consent_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(publish_email or public_email is null),check(publish_phone or public_phone is null)
);
create table gef_private.review_invitations(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references public.contractor_public_profiles(contractor_id),
 token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),
 source text not null check(source in ('external','platform_contact')),
 purchase_id uuid unique references gef_private.contact_purchases(id),
 expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now(),
 check((source='external' and purchase_id is null) or (source='platform_contact' and purchase_id is not null))
);
create index review_invitations_owner_idx on gef_private.review_invitations(contractor_id,created_at desc);
create table public.contractor_reviews(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references public.contractor_public_profiles(contractor_id),
 invitation_id uuid not null unique references gef_private.review_invitations(id),
 identity_hash text not null check(identity_hash~'^[a-f0-9]{64}$'),
 display_name text not null check(length(btrim(display_name)) between 2 and 80),
 rating integer not null check(rating between 1 and 5),
 comment text not null check(length(btrim(comment)) between 10 and 1500),
 source text not null check(source in ('external','platform_contact')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','hidden')),
 created_at timestamptz not null default now(),
 unique(contractor_id,identity_hash)
);
create index contractor_reviews_owner_status_idx on public.contractor_reviews(contractor_id,status,created_at desc);
create table gef_private.review_reports(
 id uuid primary key default gen_random_uuid(),review_id uuid not null references public.contractor_reviews(id),
 reporter_hash text not null,reason text not null check(length(btrim(reason)) between 10 and 1000),
 status text not null default 'open' check(status in ('open','resolved','dismissed')),
 created_at timestamptz not null default now(),unique(review_id,reporter_hash)
);
create index review_reports_review_idx on gef_private.review_reports(review_id);
create table public.profile_service_prices(
 id uuid primary key default gen_random_uuid(),version text not null unique,
 amount_cents bigint not null check(amount_cents between 1 and 100000000),currency text not null check(currency='USD'),
 effective_at timestamptz not null,created_by uuid not null references public.admin_users(user_id),
 reason text not null check(length(btrim(reason)) between 5 and 500),created_at timestamptz not null default now()
);
create index profile_service_prices_admin_idx on public.profile_service_prices(created_by);
create trigger immutable_profile_service_prices before update or delete on public.profile_service_prices for each row execute function gef_private.reject_change();

create function public.gef_save_public_profile(p_contractor uuid,p_profile jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare v_slug text;v_item jsonb;
begin
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null) then raise exception 'Active confirmed contractor required'; end if;
 -- Portfolio storage paths must belong to this contractor even when another path is guessed.
 for v_item in select value from jsonb_array_elements(coalesce(p_profile->'portfolio','[]')) loop
  if split_part(v_item->>'image_path','/',1)<>p_contractor::text then raise exception 'Portfolio image ownership mismatch'; end if;
 end loop;
 insert into public.contractor_public_profiles(contractor_id,slug,display_name,headline,about,city,state_code,zip_code,radius_miles,categories,languages,social_links,portfolio,published,publish_email,publish_phone,public_email,public_phone)
 values(p_contractor,p_profile->>'slug',p_profile->>'display_name',p_profile->>'headline',p_profile->>'about',p_profile->>'city',p_profile->>'state_code',p_profile->>'zip_code',(p_profile->>'radius_miles')::int,p_profile->'categories',p_profile->'languages',p_profile->'social_links',p_profile->'portfolio',(p_profile->>'published')::boolean,(p_profile->>'publish_email')::boolean,(p_profile->>'publish_phone')::boolean,p_profile->>'public_email',p_profile->>'public_phone')
 on conflict(contractor_id) do update set slug=excluded.slug,display_name=excluded.display_name,headline=excluded.headline,about=excluded.about,city=excluded.city,state_code=excluded.state_code,zip_code=excluded.zip_code,radius_miles=excluded.radius_miles,categories=excluded.categories,languages=excluded.languages,social_links=excluded.social_links,portfolio=excluded.portfolio,published=excluded.published,publish_email=excluded.publish_email,publish_phone=excluded.publish_phone,public_email=excluded.public_email,public_phone=excluded.public_phone,consent_at=now(),updated_at=now()
 returning slug into v_slug;
 return jsonb_build_object('saved',true,'slug',v_slug);
end $$;

create function public.gef_create_review_invitation(p_contractor uuid,p_hash text,p_purchase uuid default null) returns jsonb
language plpgsql set search_path='' as $$
declare v_id uuid;v_source text;
begin
 perform 1 from public.contractor_public_profiles pp join public.contractor_profiles p on p.user_id=pp.contractor_id where pp.contractor_id=p_contractor and pp.published and p.account_status='active' for update of pp;
 if not found then raise exception 'Publish an active public profile first'; end if;
 if (select count(*) from gef_private.review_invitations where contractor_id=p_contractor and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit reached'; end if;
 v_source:='external';
 if p_purchase is not null then
  if not exists(select 1 from gef_private.contact_purchases where id=p_purchase and contractor_id=p_contractor and status='acquired') then raise exception 'Purchase does not belong to this contractor'; end if;
  v_source:='platform_contact';
 end if;
 insert into gef_private.review_invitations(contractor_id,token_hash,source,purchase_id,expires_at)
 values(p_contractor,p_hash,v_source,p_purchase,now()+interval '30 days') returning id into v_id;
 return jsonb_build_object('invitation_id',v_id,'source',v_source,'expires_in_days',30);
end $$;

create function public.gef_submit_review(p_review jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare inv gef_private.review_invitations%rowtype;v_id uuid;
begin
 select * into inv from gef_private.review_invitations where token_hash=p_review->>'token_hash' for update;
 if not found or inv.used_at is not null or inv.expires_at<=now() then raise exception 'Review invitation expired or already used'; end if;
 if not exists(select 1 from public.contractor_public_profiles pp join public.contractor_profiles p on p.user_id=pp.contractor_id where pp.contractor_id=inv.contractor_id and pp.published and p.account_status='active') then raise exception 'Profile unavailable'; end if;
 insert into public.contractor_reviews(contractor_id,invitation_id,identity_hash,display_name,rating,comment,source)
 values(inv.contractor_id,inv.id,p_review->>'identity_hash',p_review->>'display_name',(p_review->>'rating')::int,p_review->>'comment',inv.source) returning id into v_id;
 update gef_private.review_invitations set used_at=now() where id=inv.id;
 return jsonb_build_object('review_id',v_id,'status','pending');
end $$;

create function public.gef_moderate_review(p_actor uuid,p_review uuid,p_status text,p_reason text,p_key text) returns jsonb
language plpgsql set search_path='' as $$
declare v_previous text;v_old gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_status is null or p_status not in ('approved','rejected','hidden') or p_reason is null or length(btrim(p_reason)) not between 5 and 500 or p_key is null or p_key !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid moderation'; end if;
 select status into v_previous from public.contractor_reviews where id=p_review for update;
 if not found then raise exception 'Review not found'; end if;
 select * into v_old from gef_private.admin_audit where operation_key=p_key;
 if found then
  if v_old.actor_id<>p_actor or v_old.action<>'review_moderated' or v_old.target_id<>p_review or v_old.details->>'next_status'<>p_status or v_old.reason<>p_reason then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('changed',false);
 end if;
 update public.contractor_reviews set status=p_status where id=p_review;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason)
 values(p_actor,'review_moderated',p_review,p_key,jsonb_build_object('prior_status',v_previous,'next_status',p_status),p_reason);
 return jsonb_build_object('changed',true);
end $$;

create function public.gef_report_review(p_review uuid,p_hash text,p_reason text) returns jsonb language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.contractor_reviews r join public.contractor_public_profiles pp on pp.contractor_id=r.contractor_id join public.contractor_profiles p on p.user_id=pp.contractor_id where r.id=p_review and r.status='approved' and pp.published and p.account_status='active') then raise exception 'Review unavailable'; end if;
 insert into gef_private.review_reports(review_id,reporter_hash,reason) values(p_review,p_hash,p_reason) on conflict(review_id,reporter_hash) do nothing;
 return jsonb_build_object('received',true);
end $$;

create function public.gef_dashboard(p_contractor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('wallet',public.gef_wallet_summary(p_contractor),'purchase_count',(select count(*) from gef_private.contact_purchases where contractor_id=p_contractor),
 'transactions',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,bucket,amount_cents,kind,reason,created_at from gef_private.ledger where contractor_id=p_contractor order by created_at desc limit 50)t),'[]'),
 'purchases',coalesce((select jsonb_agg(to_jsonb(t)) from (select p.id,p.opportunity_id,p.amount_cents,p.status,p.created_at,o.service_category,o.city,o.public_summary from gef_private.contact_purchases p join public.opportunity_previews o on o.id=p.opportunity_id where p.contractor_id=p_contractor order by p.created_at desc limit 50)t),'[]'),
 'pending_payments',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,purpose,amount_cents,bonus_cents,currency,status,created_at from gef_private.payment_intents where contractor_id=p_contractor order by created_at desc limit 50)t),'[]'),
 'profile_service',jsonb_build_object('self_service_free',true,'payment_enabled',false,'amount_cents',(select amount_cents from public.profile_service_prices where effective_at<=now() order by effective_at desc limit 1)));
$$;

do $$ declare t text;begin
 foreach t in array array['contractor_public_profiles','contractor_reviews','profile_service_prices'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert on public.%I to service_role',t);
 end loop;
 foreach t in array array['review_invitations','review_reports'] loop
  execute format('alter table gef_private.%I enable row level security',t);
  execute format('revoke all on gef_private.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on gef_private.%I to service_role',t);
 end loop;
end $$;
grant update on public.contractor_public_profiles to service_role;
grant update(status) on public.contractor_reviews to service_role;
revoke all on function public.gef_save_public_profile(uuid,jsonb),public.gef_create_review_invitation(uuid,text,uuid),public.gef_submit_review(jsonb),public.gef_moderate_review(uuid,uuid,text,text,text),public.gef_report_review(uuid,text,text),public.gef_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.gef_save_public_profile(uuid,jsonb),public.gef_create_review_invitation(uuid,text,uuid),public.gef_submit_review(jsonb),public.gef_moderate_review(uuid,uuid,text,text,text),public.gef_report_review(uuid,text,text),public.gef_dashboard(uuid) to service_role;
commit;
