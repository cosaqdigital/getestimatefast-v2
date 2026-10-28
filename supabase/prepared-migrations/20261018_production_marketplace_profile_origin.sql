-- GetEstimateFast Production candidate migration
-- Generated from the Development schema that passed hosted + automated validation.
-- Scope: marketplace core, public professional profiles, rate limiting, portfolio storage,
--       profile-origin attribution/free-contact guard, and atomic pricing assignment.
-- Excluded intentionally: Stripe Sandbox/test tables, Zenvia live sending, Google-authenticated
--       review identity tables/functions, Development admin recovery, and all synthetic data.
-- IMPORTANT: review and test this file before applying to Production.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.leads') IS NULL
     OR to_regclass('public.contractor_profiles') IS NULL
     OR to_regclass('public.opportunity_previews') IS NULL
     OR to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'GetEstimateFast Production baseline is incomplete';
  END IF;

  IF to_regclass('public.marketplace_price_rules') IS NOT NULL
     OR to_regclass('public.contractor_public_profiles') IS NOT NULL
     OR to_regclass('gef_private.wallets') IS NOT NULL THEN
    RAISE EXCEPTION 'Marketplace/profile schema already exists; stop and re-audit before applying';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users) THEN
    RAISE EXCEPTION 'At least one Production administrator is required';
  END IF;
END
$preflight$;

-- Source: sql/us_marketplace_financial_foundation.sql
-- No prices, money, payment credentials or customer records are seeded.
begin;
create schema if not exists gef_private;
revoke all on schema gef_private from public,anon,authenticated;
grant usage on schema gef_private to service_role;

create table public.marketplace_price_rules(
 id uuid primary key default gen_random_uuid(),
 category text not null,
 version text not null unique,
 currency text not null default 'USD' check(currency='USD'),
 base_cents bigint not null check(base_cents between 1 and 100000000),
 floor_cents bigint not null check(floor_cents between 1 and base_cents),
 max_buyers integer not null check(max_buyers between 1 and 100),
 lifetime_hours integer not null check(lifetime_hours between 1 and 2160),
 scope_bps jsonb not null default '{}'::jsonb,
 urgency_bps jsonb not null default '{}'::jsonb,
 discounts jsonb not null default '[]'::jsonb,
 effective_at timestamptz not null,
 created_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 created_at timestamptz not null default now()
);
create index marketplace_price_rules_category_idx on public.marketplace_price_rules(category,effective_at desc);
create index marketplace_price_rules_admin_idx on public.marketplace_price_rules(created_by);
create table public.marketplace_promotions(
 id uuid primary key default gen_random_uuid(),
 version text not null unique,
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 bonus_cents bigint not null check(bonus_cents between 0 and 100000000),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 enabled boolean not null default false,
 created_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 created_at timestamptz not null default now()
);
create index marketplace_promotions_admin_idx on public.marketplace_promotions(created_by);
create table gef_private.wallets(
 contractor_id uuid primary key references public.contractor_profiles(user_id) on delete restrict,
 currency text not null default 'USD' check(currency='USD'),
 created_at timestamptz not null default now()
);
create table gef_private.ledger(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references gef_private.wallets(contractor_id),
 bucket text not null check(bucket in ('paid','promotional','refund')),
 amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=100000000),
 kind text not null check(kind in ('topup','bonus','purchase','refund','adjustment')),
 operation_key text not null check(length(operation_key) between 8 and 180),
 reference_id uuid,
 actor_id uuid references auth.users(id),
 reason text not null check(length(btrim(reason)) between 5 and 500),
 created_at timestamptz not null default now(),
 unique(contractor_id,operation_key,bucket)
);
create index ledger_owner_created_idx on gef_private.ledger(contractor_id,created_at desc);
create index ledger_reference_idx on gef_private.ledger(reference_id);
create index ledger_actor_idx on gef_private.ledger(actor_id);
create table gef_private.opportunity_terms(
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.opportunity_previews(id),
 rule_id uuid not null references public.marketplace_price_rules(id),
 scope_key text,urgency_key text,
 max_buyers integer not null check(max_buyers between 1 and 100),
 opportunity_expires_at timestamptz not null,
 published_at_snapshot timestamptz not null,
 unique(opportunity_id,published_at_snapshot),
 unique(id,opportunity_id,rule_id,max_buyers,opportunity_expires_at,published_at_snapshot)
);
create index opportunity_terms_rule_idx on gef_private.opportunity_terms(rule_id);
create table gef_private.contact_quotes(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references public.contractor_profiles(user_id),
 opportunity_id uuid not null references public.opportunity_previews(id) on delete restrict,
 rule_id uuid not null references public.marketplace_price_rules(id),
 terms_id uuid not null,
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 max_buyers integer not null check(max_buyers between 1 and 100),
 valid_until timestamptz not null,
 opportunity_expires_at timestamptz not null check(opportunity_expires_at>=valid_until),
 published_at_snapshot timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key(terms_id,opportunity_id,rule_id,max_buyers,opportunity_expires_at,published_at_snapshot)
 references gef_private.opportunity_terms(id,opportunity_id,rule_id,max_buyers,opportunity_expires_at,published_at_snapshot)
);
create index contact_quotes_owner_idx on gef_private.contact_quotes(contractor_id);
create index contact_quotes_opportunity_idx on gef_private.contact_quotes(opportunity_id);
create index contact_quotes_rule_idx on gef_private.contact_quotes(rule_id);
create index contact_quotes_terms_idx on gef_private.contact_quotes(terms_id);
create table gef_private.contact_purchases(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references gef_private.wallets(contractor_id),
 opportunity_id uuid not null references public.opportunity_previews(id) on delete restrict,
 quote_id uuid not null unique references gef_private.contact_quotes(id),
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 status text not null default 'acquired' check(status in ('acquired','refunded')),
 funding_source text not null default 'wallet' check(funding_source in ('wallet','stripe_test')),
 operation_key text not null,
 created_at timestamptz not null default now(),
 unique(contractor_id,opportunity_id),unique(contractor_id,operation_key)
);
create index contact_purchases_opportunity_idx on gef_private.contact_purchases(opportunity_id,status);
create table gef_private.payment_intents(
 id uuid primary key default gen_random_uuid(),
 contractor_id uuid not null references public.contractor_profiles(user_id),
 purpose text not null check(purpose in ('wallet_topup','profile_service')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000),
 bonus_cents bigint not null default 0 check(bonus_cents between 0 and 100000000),
 promotion_id uuid references public.marketplace_promotions(id),
 currency text not null default 'USD' check(currency='USD'),
 status text not null default 'pending' check(status in ('pending','confirmed','failed','canceled','expired')),
 provider text not null default 'unconfigured',provider_payment_id text unique,
 operation_key text not null,created_at timestamptz not null default now(),
 check(purpose='wallet_topup' or (bonus_cents=0 and promotion_id is null)),
 unique(contractor_id,operation_key)
);
create index payment_intents_owner_idx on gef_private.payment_intents(contractor_id,created_at desc);
create index payment_intents_promotion_idx on gef_private.payment_intents(promotion_id);
create table gef_private.admin_audit(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 action text not null,target_id uuid,
 operation_key text not null unique,
 details jsonb not null,
 reason text not null check(length(btrim(reason)) between 5 and 500),
 created_at timestamptz not null default now()
);
create index admin_audit_actor_idx on gef_private.admin_audit(actor_id,created_at desc);

-- Append-only financial events and pricing revisions; corrections are compensating entries.
create function gef_private.reject_change() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable history: append a compensating record'; end $$;
create trigger immutable_ledger before update or delete on gef_private.ledger for each row execute function gef_private.reject_change();
create trigger immutable_price_rules before update or delete on public.marketplace_price_rules for each row execute function gef_private.reject_change();
create trigger immutable_promotions before update or delete on public.marketplace_promotions for each row execute function gef_private.reject_change();
create trigger immutable_admin_audit before update or delete on gef_private.admin_audit for each row execute function gef_private.reject_change();
create trigger immutable_terms before update or delete on gef_private.opportunity_terms for each row execute function gef_private.reject_change();
create trigger immutable_quotes before update or delete on gef_private.contact_quotes for each row execute function gef_private.reject_change();

-- Serialize every ledger insert on its owner's wallet, including trusted manual entries.
create function gef_private.guard_ledger() returns trigger language plpgsql set search_path='' as $$
declare v_balance bigint;v_total bigint;
begin
 perform 1 from gef_private.wallets where contractor_id=new.contractor_id for update;
 if not found then raise exception 'Wallet required'; end if;
 select coalesce(sum(amount_cents),0) into v_balance from gef_private.ledger where contractor_id=new.contractor_id and bucket=new.bucket;
 if v_balance+new.amount_cents<0 then raise exception 'Insufficient bucket balance'; end if;
 select coalesce(sum(amount_cents),0) into v_total from gef_private.ledger where contractor_id=new.contractor_id;
 if v_total+new.amount_cents>100000000 then raise exception 'Wallet safety limit exceeded'; end if;
 return new;
end $$;
create trigger guard_ledger before insert on gef_private.ledger for each row execute function gef_private.guard_ledger();

create function public.gef_wallet_summary(p_contractor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('currency','USD','paid_cents',coalesce(sum(amount_cents) filter(where bucket='paid'),0),
 'promotional_cents',coalesce(sum(amount_cents) filter(where bucket='promotional'),0),
 'refund_cents',coalesce(sum(amount_cents) filter(where bucket='refund'),0),
 'available_cents',coalesce(sum(amount_cents),0)) from gef_private.ledger where contractor_id=p_contractor;
$$;

-- Internal transaction engine ONLY. No HTTP route can invoke it in this delivery.
-- It consumes a server-created quote; it never accepts a client-supplied debit price.
create function public.gef_purchase_contact(p_contractor uuid,p_quote uuid,p_operation_key text) returns jsonb
language plpgsql set search_path='' as $$
declare q gef_private.contact_quotes%rowtype; prev gef_private.contact_purchases%rowtype;
 v_purchase uuid;v_remaining bigint;v_take bigint;v_bucket text;v_status text;v_published timestamptz;v_count integer;
begin
 if p_operation_key is null or p_operation_key !~ '^[a-zA-Z0-9:_-]{8,120}$' then raise exception 'Invalid operation key'; end if;
 select * into q from gef_private.contact_quotes where id=p_quote and contractor_id=p_contractor;
 if not found then raise exception 'Quote unavailable'; end if;
 -- Lead -> opportunity -> wallet follows the existing publication lock order.
 select l.status,o.published_at into v_status,v_published from public.opportunity_previews o join public.leads l on l.id=o.lead_id where o.id=q.opportunity_id for update of l;
 perform 1 from public.opportunity_previews where id=q.opportunity_id for update;
 insert into gef_private.wallets(contractor_id) values(p_contractor) on conflict do nothing;
 perform 1 from gef_private.wallets where contractor_id=p_contractor for update;
 select * into prev from gef_private.contact_purchases where contractor_id=p_contractor and operation_key=p_operation_key;
 if found then
  if prev.quote_id<>p_quote then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('purchase_id',prev.id,'created',false,'status',prev.status);
 end if;
 if exists(select 1 from gef_private.contact_purchases where contractor_id=p_contractor and opportunity_id=q.opportunity_id) then raise exception 'Contact already purchased'; end if;
 if v_status is distinct from 'published' or v_published is distinct from q.published_at_snapshot or q.valid_until<=now() or q.opportunity_expires_at<=now() then raise exception 'Quote expired or opportunity unavailable'; end if;
 if not exists(select 1 from public.contractor_profiles where user_id=p_contractor and account_status='active' and email_verified_at is not null and state_code='FL') then raise exception 'Active contractor required'; end if;
 select count(*) into v_count from gef_private.contact_purchases where opportunity_id=q.opportunity_id and status='acquired';
 if v_count>=q.max_buyers then raise exception 'Buyer limit reached'; end if;
 v_remaining:=q.amount_cents;
 select gen_random_uuid() into v_purchase;
 -- Promotional credit, then refunds, then paid funds. Each origin stays auditable.
 foreach v_bucket in array array['promotional','refund','paid'] loop
  select least(v_remaining,coalesce(sum(amount_cents),0)) into v_take from gef_private.ledger where contractor_id=p_contractor and bucket=v_bucket;
  if v_take>0 then
   insert into gef_private.ledger(contractor_id,bucket,amount_cents,kind,operation_key,reference_id,reason)
    values(p_contractor,v_bucket,-v_take,'purchase','purchase:'||p_operation_key,v_purchase,'Contact access purchase');
   v_remaining:=v_remaining-v_take;
  end if;
 end loop;
 if v_remaining<>0 then raise exception 'Insufficient available credits'; end if;
 insert into gef_private.contact_purchases(id,contractor_id,opportunity_id,quote_id,amount_cents,operation_key)
 values(v_purchase,p_contractor,q.opportunity_id,p_quote,q.amount_cents,p_operation_key);
 return jsonb_build_object('purchase_id',v_purchase,'created',true,'status','acquired');
end $$;

create function public.gef_refund_contact(p_actor uuid,p_purchase uuid,p_reason text,p_operation_key text) returns jsonb
language plpgsql set search_path='' as $$
declare p gef_private.contact_purchases%rowtype;v_audit gef_private.admin_audit%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_operation_key is null or p_operation_key !~ '^[a-zA-Z0-9:_-]{8,120}$' or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Invalid refund request'; end if;
 select * into p from gef_private.contact_purchases where id=p_purchase;
 if not found then raise exception 'Purchase unavailable'; end if;
 perform 1 from public.opportunity_previews where id=p.opportunity_id for update;
 perform 1 from gef_private.wallets where contractor_id=p.contractor_id for update;
 select * into p from gef_private.contact_purchases where id=p_purchase for update;
 if p.funding_source<>'wallet' then raise exception 'Direct Stripe payments require a separate provider refund flow'; end if;
 select * into v_audit from gef_private.admin_audit where operation_key=p_operation_key;
 if found then
  if v_audit.actor_id<>p_actor or v_audit.action<>'contact_refund' or v_audit.target_id<>p_purchase or v_audit.reason<>p_reason then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('refunded',true,'created',false);
 end if;
 if p.status<>'acquired' then raise exception 'Already refunded'; end if;
 insert into gef_private.ledger(contractor_id,bucket,amount_cents,kind,operation_key,reference_id,actor_id,reason)
 values(p.contractor_id,'refund',p.amount_cents,'refund','refund:'||p_purchase::text,p_purchase,p_actor,p_reason);
 update gef_private.contact_purchases set status='refunded' where id=p_purchase;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason)
 values(p_actor,'contact_refund',p_purchase,p_operation_key,jsonb_build_object('amount_cents',p.amount_cents),p_reason);
 return jsonb_build_object('refunded',true,'created',true);
end $$;

create function public.gef_adjust_wallet(p_actor uuid,p_contractor uuid,p_bucket text,p_amount_cents bigint,p_reason text,p_operation_key text) returns jsonb
language plpgsql set search_path='' as $$
declare v_old gef_private.admin_audit%rowtype;v_entry uuid;v_details jsonb;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Administrator required'; end if;
 if p_amount_cents is null or p_amount_cents=0 or abs(p_amount_cents)>100000000 or p_bucket not in ('paid','promotional','refund') or p_bucket is null or p_reason is null or length(btrim(p_reason)) not between 5 and 500 or p_operation_key is null or p_operation_key !~ '^[a-zA-Z0-9:_-]{8,120}$' then raise exception 'Invalid adjustment'; end if;
 insert into gef_private.wallets(contractor_id) values(p_contractor) on conflict do nothing;
 perform 1 from gef_private.wallets where contractor_id=p_contractor for update;
 v_details:=jsonb_build_object('contractor_id',p_contractor,'bucket',p_bucket,'amount_cents',p_amount_cents);
 select * into v_old from gef_private.admin_audit where operation_key=p_operation_key;
 if found then
  if v_old.actor_id<>p_actor or v_old.action<>'wallet_adjustment' or v_old.details<>v_details or v_old.reason<>p_reason then raise exception 'Idempotency payload conflict'; end if;
  return jsonb_build_object('created',false);
 end if;
 insert into gef_private.ledger(contractor_id,bucket,amount_cents,kind,operation_key,actor_id,reason)
 values(p_contractor,p_bucket,p_amount_cents,'adjustment','adjust:'||p_operation_key,p_actor,p_reason) returning id into v_entry;
 insert into gef_private.admin_audit(actor_id,action,target_id,operation_key,details,reason)
 values(p_actor,'wallet_adjustment',v_entry,p_operation_key,v_details,p_reason);
 return jsonb_build_object('created',true,'entry_id',v_entry);
end $$;

-- All APIs remain server mediated. No browser role can read or mutate finance tables.
do $$ declare t text;begin
 foreach t in array array['marketplace_price_rules','marketplace_promotions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert on public.%I to service_role',t);
 end loop;
 foreach t in array array['wallets','ledger','opportunity_terms','contact_quotes','contact_purchases','payment_intents','admin_audit'] loop
  execute format('alter table gef_private.%I enable row level security',t);
  execute format('revoke all on gef_private.%I from public,anon,authenticated',t);
  execute format('grant select,insert on gef_private.%I to service_role',t);
 end loop;
end $$;
grant update(status) on gef_private.contact_purchases to service_role;
-- FOR UPDATE locks require UPDATE privilege; USD-only currency cannot change value.
grant update(currency) on gef_private.wallets to service_role;
revoke all on function public.gef_wallet_summary(uuid),public.gef_purchase_contact(uuid,uuid,text),public.gef_refund_contact(uuid,uuid,text,text),public.gef_adjust_wallet(uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.gef_wallet_summary(uuid),public.gef_purchase_contact(uuid,uuid,text),public.gef_refund_contact(uuid,uuid,text,text),public.gef_adjust_wallet(uuid,uuid,text,bigint,text,text) to service_role;
revoke all on all functions in schema gef_private from public,anon,authenticated;
grant execute on all functions in schema gef_private to service_role;

-- -----------------------------------------------------------------------------

-- Source: sql/us_public_profiles_reviews.sql
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
 effective_at timestamptz not null,created_by uuid not null references auth.users(id),
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

-- -----------------------------------------------------------------------------

-- Source: sql/us_marketplace_read_models.sql
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

-- -----------------------------------------------------------------------------

-- Source: sql/us_public_review_rate_limit.sql
create table gef_private.public_request_limits(
 subject_hash text not null check(subject_hash~'^[a-f0-9]{64}$'),
 hour_start timestamptz not null,requests integer not null,
 primary key(subject_hash,hour_start)
);
alter table gef_private.public_request_limits enable row level security;
revoke all on gef_private.public_request_limits from public,anon,authenticated;
grant select,insert,update on gef_private.public_request_limits to service_role;
create function public.gef_public_request_allowed(p_hash text,p_limit integer) returns boolean language plpgsql set search_path='' as $$
declare v_count integer;
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid rate limit';end if;
 insert into gef_private.public_request_limits(subject_hash,hour_start,requests) values(p_hash,date_trunc('hour',now()),1)
 on conflict(subject_hash,hour_start) do update set requests=gef_private.public_request_limits.requests+1 returning requests into v_count;
 return v_count<=p_limit;
end $$;
revoke all on function public.gef_public_request_allowed(text,integer) from public,anon,authenticated;
grant execute on function public.gef_public_request_allowed(text,integer) to service_role;

-- -----------------------------------------------------------------------------

-- Source: sql/us_portfolio_storage.sql
-- Local tests validate this DDL with a bucket schema stub, not the Storage service.
-- Images are public ONLY after explicit upload permission; never use this bucket for private documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gef-portfolio','gef-portfolio',true,3000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Uploads are backend mediated. No browser INSERT/UPDATE/DELETE policies are added.
-- Object paths are generated as authenticated contractor UUID/random UUID.extension.

-- -----------------------------------------------------------------------------

-- Source: supabase/prepared-migrations/us-profile-origin-referrals.sql
-- PREPARED MIGRATION. Apply ONLY to Supabase Development after offline review.
-- No Brazil databases, integrations, real notifications, or financial operations.
begin;
alter table public.leads add column if not exists origin_contractor_id uuid;

do $ddl$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.leads'::regclass and conname='gef_leads_origin_profile_fkey') then
    alter table public.leads add constraint gef_leads_origin_profile_fkey
      foreign key (origin_contractor_id) references public.contractor_profiles(user_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.leads'::regclass and conname='gef_leads_profile_source_check') then
    alter table public.leads add constraint gef_leads_profile_source_check
      check (origin_contractor_id is null or source = 'professional_profile');
  end if;
end $ddl$;

create index if not exists gef_leads_origin_lookup
  on public.leads (origin_contractor_id, created_at desc)
  where origin_contractor_id is not null;

create or replace function gef_private.guard_immutable_lead_origin()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.origin_contractor_id is distinct from new.origin_contractor_id then
    raise exception 'Profile lead origin is immutable';
  end if;
  return new;
end;
$function$;
drop trigger if exists gef_lead_origin_immutable on public.leads;
create trigger gef_lead_origin_immutable
  before update of origin_contractor_id on public.leads
  for each row execute function gef_private.guard_immutable_lead_origin();

-- Prevent an originating professional from accidentally paying for their own referral.
-- An attempted paid transaction rolls back in full, including wallet debit.
create or replace function gef_private.reject_paid_origin_contact()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if exists (
    select 1 from public.opportunity_previews o
    join public.leads l on l.id=o.lead_id
    where o.id=new.opportunity_id and l.origin_contractor_id=new.contractor_id
  ) then
    raise exception 'The originating professional receives this contact without charge';
  end if;
  return new;
end;
$function$;
drop trigger if exists gef_no_paid_origin_contact on gef_private.contact_purchases;
create trigger gef_no_paid_origin_contact
  before insert on gef_private.contact_purchases
  for each row execute function gef_private.reject_paid_origin_contact();

revoke all on function gef_private.guard_immutable_lead_origin() from public,anon,authenticated;
revoke all on function gef_private.reject_paid_origin_contact() from public,anon,authenticated;
-- This migration adds no anon/authenticated grants to public.leads.

-- -----------------------------------------------------------------------------

-- Source: supabase/prepared-migrations/us-profile-origin-auto-pricing.sql
-- An active USD pricing rule is required for the approved category.
-- The originating professional remains free and is NOT included in paid-buyer capacity.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_publish_profile_opportunity_priced(
  p_lead_id uuid,
  p_public_summary text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_source text;
  v_origin uuid;
  v_category text;
  v_rule uuid;
  v_published jsonb;
  v_opportunity uuid;
  v_terms jsonb;
  v_terms_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=p_actor) THEN
    RAISE EXCEPTION 'Administrator not authorized';
  END IF;

  SELECT l.source,l.origin_contractor_id,l.service_type
  INTO v_source,v_origin,v_category
  FROM public.leads l
  WHERE l.id=p_lead_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_source IS DISTINCT FROM 'professional_profile' OR v_origin IS NULL THEN
    RAISE EXCEPTION 'Not a professional-profile-origin request';
  END IF;

  SELECT r.id INTO v_rule
  FROM public.marketplace_price_rules r
  WHERE r.category=v_category
    AND r.currency='USD'
    AND r.effective_at<=now()
  ORDER BY r.effective_at DESC,r.created_at DESC,r.id DESC
  LIMIT 1;
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Configure an active USD contact-price rule for this service before publishing';
  END IF;

  v_published:=public.admin_publish_opportunity(p_lead_id,p_public_summary,p_actor);
  v_opportunity:=(v_published->>'opportunity_id')::uuid;
  IF v_opportunity IS NULL THEN RAISE EXCEPTION 'No published opportunity returned'; END IF;

  -- Production may already assign commercial terms through the publish trigger.
  -- Reuse that immutable row; only create terms if the trigger did not.
  SELECT t.id INTO v_terms_id
  FROM gef_private.opportunity_terms t
  JOIN public.opportunity_previews o ON o.id=t.opportunity_id
  WHERE t.opportunity_id=v_opportunity
    AND t.published_at_snapshot=o.published_at
  ORDER BY t.id
  LIMIT 1;

  IF v_terms_id IS NULL THEN
    v_terms:=public.gef_admin_configuration(
      p_actor,
      'opportunity_terms',
      jsonb_build_object(
        'opportunity_id',v_opportunity,
        'rule_id',v_rule,
        'scope_key',null,
        'urgency_key',null
      ),
      'Automatic USD contact pricing for profile-origin opportunity',
      'profile-terms:'||v_opportunity::text
    );
    v_terms_id:=(v_terms->>'id')::uuid;
  END IF;

  IF v_terms_id IS NULL THEN RAISE EXCEPTION 'Failed to assign commercial terms'; END IF;
  RETURN v_published || jsonb_build_object(
    'origin_professional_free',true,
    'commercial_terms_assigned',true,
    'commercial_terms_id',v_terms_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_publish_profile_opportunity_priced(uuid,text,uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_profile_opportunity_priced(uuid,text,uuid)
TO service_role;


-- Production launch hardening: all new browser-facing marketplace objects stay server mediated.
REVOKE ALL ON SCHEMA gef_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA gef_private TO service_role;

-- Profile-origin publication remains fail-closed without an active USD category rule.
-- No pricing rows, wallet credits, promotions, payment records, reviews, customers or test data are seeded.


COMMIT;
