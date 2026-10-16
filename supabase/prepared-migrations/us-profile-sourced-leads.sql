-- PREPARED ONLY: Independent US Development. DO NOT run against any hosted DB without authorization.
-- Profile-sourced customer requests give the originating active professional
-- free access after admin qualification. Other contractors buy the same
-- published opportunity under existing marketplace pricing/buyer limits.
-- No Brazil data, connections or credentials are involved.

create table if not exists gef_private.profile_lead_origins (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete restrict,
  profile_slug text not null,
  marketplace_consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists profile_lead_origins_contractor_created_idx
  on gef_private.profile_lead_origins(contractor_id,created_at desc);
alter table gef_private.profile_lead_origins enable row level security;
revoke all on gef_private.profile_lead_origins from public, anon, authenticated;
grant select,insert,update on gef_private.profile_lead_origins to service_role;

create table if not exists gef_private.profile_lead_contact_access (
  lead_id uuid not null references gef_private.profile_lead_origins(lead_id) on delete cascade,
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete restrict,
  first_accessed_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  view_count integer not null default 1 check(view_count>=1),
  primary key(lead_id,contractor_id)
);
alter table gef_private.profile_lead_contact_access enable row level security;
revoke all on gef_private.profile_lead_contact_access from public, anon, authenticated;
grant select,insert,update on gef_private.profile_lead_contact_access to service_role;

create or replace function public.gef_create_profile_lead(
  p_slug text,
  p_token uuid,
  p_service text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_zip text,
  p_description text,
  p_contact_method text,
  p_marketplace_consent boolean
) returns jsonb language plpgsql set search_path to '' as $body$
declare
  v_owner uuid;
  v_lead uuid;
  v_duplicate boolean := false;
  v_slug text := btrim(coalesce(p_slug,''));
  v_service text := btrim(coalesce(p_service,''));
begin
  if p_marketplace_consent is distinct from true then
    raise exception 'Marketplace sharing consent is required';
  end if;
  if p_token is null or length(v_slug) not between 3 and 80
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(v_service) not between 2 and 120
     or length(btrim(coalesce(p_full_name,''))) not between 2 and 120
     or length(btrim(coalesce(p_email,''))) not between 6 and 254
     or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(btrim(coalesce(p_phone,''))) not between 10 and 18
     or length(btrim(coalesce(p_city,''))) not between 2 and 80
     or p_city !~ '^[A-Za-z][A-Za-z .-]{1,79}$'
     or p_zip !~ '^(32|33|34)[0-9]{3}$'
     or length(btrim(coalesce(p_description,''))) not between 20 and 2000
     or coalesce(p_contact_method,'') not in ('email','phone')
  then raise exception 'Invalid profile request'; end if;

  -- The slug resolves to the authoritative published and active profile.
  -- The visitor never sends a contractor user ID, price or grant flag.
  select pp.contractor_id into v_owner
    from public.contractor_public_profiles pp
    join public.contractor_profiles cp on cp.user_id=pp.contractor_id
   where pp.slug=v_slug
     and pp.published=true
     and cp.account_status='active'
     and cp.email_verified_at is not null
     and cp.state_code='FL'
     and pp.categories ? v_service;
  if v_owner is null then raise exception 'Profile or service unavailable'; end if;

  insert into public.leads(
    submission_token,service_type,full_name,email,phone,city,zip_code,
    contact_method,details,source,status
  ) values (
    p_token,v_service,btrim(p_full_name),lower(btrim(p_email)),btrim(p_phone),
    btrim(p_city),p_zip,p_contact_method,
    jsonb_build_object(
      'Project Description',btrim(p_description),
      'Service Type',v_service,
      '_platform_review',jsonb_build_object(
        'required',true,'reason','profile_sourced','original_service',v_service
      ),
      '_profile_source',jsonb_build_object(
        'slug',v_slug,'marketplace_consent',true
      )
    ),
    'professional_profile','new'
  ) on conflict(submission_token) do nothing returning id into v_lead;

  if v_lead is null then
    v_duplicate := true;
    select o.lead_id into v_lead
      from public.leads l join gef_private.profile_lead_origins o on o.lead_id=l.id
     where l.submission_token=p_token
       and o.contractor_id=v_owner
       and o.profile_slug=v_slug
       and l.details #>> '{_platform_review,original_service}' = v_service
       and lower(l.email)=lower(btrim(p_email));
    if v_lead is null then
      raise exception 'Submission token conflict';
    end if;
  else
    insert into gef_private.profile_lead_origins(lead_id,contractor_id,profile_slug)
    values(v_lead,v_owner,v_slug);
  end if;
  return jsonb_build_object('lead_id',v_lead,'duplicate',v_duplicate,'status','new');
end;
$body$;

-- This list deliberately exposes no personal phone/email before review.
create or replace function public.gef_profile_origin_leads(
  p_contractor uuid
) returns jsonb language sql stable set search_path to '' as $body$
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
  from (
    select l.id as lead_id,opp.id as opportunity_id,l.created_at,l.service_type,l.city,l.zip_code,l.status,
           (l.status in ('qualified','published')
              and l.details #>> '{_platform_review,review_status}' = 'approved'
              and l.details #> '{_platform_review,contact_reviewed}' = 'true'::jsonb
            ) as contact_available
      from gef_private.profile_lead_origins o
      join public.leads l on l.id=o.lead_id
      left join public.opportunity_previews opp on opp.lead_id=l.id
      join public.contractor_profiles cp on cp.user_id=o.contractor_id
     where o.contractor_id=p_contractor
       and cp.account_status='active'
       and cp.email_verified_at is not null
     order by l.created_at desc,l.id desc
     limit 50
  ) x;
$body$;

-- Separate auditable $0 entitlement. No wallet/credits/quote record is created.
create or replace function public.gef_profile_origin_contact(
  p_contractor uuid,
  p_lead uuid
) returns jsonb language plpgsql set search_path to '' as $body$
declare v_lead record;
begin
  select l.id,l.full_name,l.email,l.phone,l.contact_method,l.service_type,
         l.city,l.zip_code
    into v_lead
    from gef_private.profile_lead_origins o
    join public.leads l on l.id=o.lead_id
    join public.contractor_profiles cp on cp.user_id=o.contractor_id
   where o.lead_id=p_lead
     and o.contractor_id=p_contractor
     and cp.account_status='active'
     and cp.email_verified_at is not null
     and o.marketplace_consent_at is not null
     and l.status in ('qualified','published')
     and l.details #>> '{_platform_review,review_status}' = 'approved'
     and l.details #> '{_platform_review,contact_reviewed}' = 'true'::jsonb
   for update of o;
  if not found then raise exception 'Contact not available'; end if;
  insert into gef_private.profile_lead_contact_access(lead_id,contractor_id)
    values(p_lead,p_contractor)
    on conflict(lead_id,contractor_id) do update set
      view_count=gef_private.profile_lead_contact_access.view_count+1,
      last_accessed_at=now();
  return jsonb_build_object(
    'full_name',v_lead.full_name,'email',v_lead.email,'phone',v_lead.phone,
    'contact_method',v_lead.contact_method,'service_type',v_lead.service_type,
    'city',v_lead.city,'zip_code',v_lead.zip_code,
    'amount_cents',0,'source','own_public_profile'
  );
end;
$body$;

-- Financial fail-safe: even if the owner tries any existing checkout path,
-- the wallet purchase transaction aborts before committing a charge.
create or replace function gef_private.prevent_origin_owner_purchase()
returns trigger language plpgsql set search_path to '' as $body$
begin
  if exists(
    select 1 from gef_private.profile_lead_origins o
    join public.opportunity_previews preview on preview.lead_id=o.lead_id
    where preview.id=new.opportunity_id
      and o.contractor_id=new.contractor_id
  ) then
    raise exception 'Your own profile-generated contact is free; purchase blocked';
  end if;
  return new;
end;
$body$;

drop trigger if exists prevent_origin_owner_purchase_trigger on gef_private.contact_purchases;
create trigger prevent_origin_owner_purchase_trigger
 before insert or update of contractor_id, opportunity_id
 on gef_private.contact_purchases
 for each row execute function gef_private.prevent_origin_owner_purchase();

revoke all on function public.gef_create_profile_lead(text,uuid,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.gef_profile_origin_leads(uuid) from public,anon,authenticated;
revoke all on function public.gef_profile_origin_contact(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gef_create_profile_lead(text,uuid,text,text,text,text,text,text,text,text,boolean) to service_role;
grant execute on function public.gef_profile_origin_leads(uuid) to service_role;
grant execute on function public.gef_profile_origin_contact(uuid,uuid) to service_role;
revoke all on function gef_private.prevent_origin_owner_purchase() from public,anon,authenticated;
