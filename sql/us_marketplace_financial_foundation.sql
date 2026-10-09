-- PREPARED ONLY. Apply to an isolated GetEstimateFast development database.
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
 created_by uuid not null references public.admin_users(user_id),
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
 created_by uuid not null references public.admin_users(user_id),
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
 actor_id uuid not null references public.admin_users(user_id),
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
commit;
