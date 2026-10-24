-- GetEstimateFast: manual publication + confidential contractor previews.
-- This table holds ONLY admin-curated display fields; it does not hold contacts or raw lead details.
create table if not exists public.opportunity_previews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  service_category text not null,
  public_summary text not null check (char_length(btrim(public_summary)) between 20 and 1400),
  city text not null,
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null
);
create index if not exists opportunity_previews_category_published_idx
  on public.opportunity_previews(service_category, published_at desc);
alter table public.opportunity_previews enable row level security;
revoke all on table public.opportunity_previews from public, anon, authenticated;
grant select,insert,update,delete on table public.opportunity_previews to service_role;

-- One deliberate admin action; never auto-publish on qualification.
create or replace function public.admin_publish_opportunity(
  p_lead_id uuid, p_public_summary text, p_actor uuid
) returns jsonb
language plpgsql
set search_path = ''
as $publish$
declare
  v_status text;
  v_service text;
  v_city text;
  v_zip text;
  v_phone text;
  v_email text;
  v_name text;
  v_details jsonb;
  v_summary text := btrim(coalesce(p_public_summary,''));
  v_id uuid;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    raise exception 'Administrator not authorized';
  end if;
  if char_length(v_summary) < 20 or char_length(v_summary) > 1400 then
    raise exception 'Public summary must contain 20 to 1400 characters';
  end if;
  if v_summary ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
     or v_summary ~* '(https?://|www\.)'
     or v_summary ~* '(^|[^0-9])(\+?1[-.[:space:]]*)?\(?[0-9]{3}\)?[-.[:space:]]*[0-9]{3}[-.[:space:]]*[0-9]{4}([^0-9]|$)'
     or v_summary ~* '\m[0-9]{1,6}[[:space:]]+[[:alnum:] .,-]{3,60}[[:space:]]+(st(reet)?|ave(nue)?|rd|road|dr|drive|blvd|boulevard|lane|ln|court|ct)\M' then
    raise exception 'Remove email, telephone, website or street address from public summary';
  end if;
  select status,service_type,city,zip_code,phone,email,full_name,details
    into v_status,v_service,v_city,v_zip,v_phone,v_email,v_name,v_details
    from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_status <> 'qualified' then
    raise exception 'Only approved, unpublished requests can be published';
  end if;
  if v_details #>> '{_platform_review,review_status}' is distinct from 'approved'
     or v_details #> '{_platform_review,contact_reviewed}' is distinct from 'true'::jsonb
     or v_details #> '{_platform_review,scope_reviewed}' is distinct from 'true'::jsonb
     or v_details #>> '{_platform_review,approved_category}' is distinct from v_service then
    raise exception 'Request requires the completed manual review before publication';
  end if;
  if v_zip !~ '^(32|33|34)[0-9]{3}$' then
    raise exception 'Only Florida-area requests can be published in this preview';
  end if;
  if btrim(v_city) !~ '^[A-Za-z][A-Za-z .-]{1,79}$' then
    raise exception 'Review the city before publishing; no street addresses';
  end if;
  if char_length(btrim(v_name)) >= 4 and position(lower(btrim(v_name)) in lower(v_summary)) > 0 then
    raise exception 'Remove customer name from public summary';
  end if;
  if v_email is not null and position(lower(v_email) in lower(v_summary)) > 0 then
    raise exception 'Remove customer contact from public summary';
  end if;
  if length(regexp_replace(coalesce(v_phone,''),'\D','','g')) >= 8
     and position(regexp_replace(v_phone,'\D','','g') in regexp_replace(v_summary,'\D','','g')) > 0 then
    raise exception 'Remove customer telephone from public summary';
  end if;
  insert into public.opportunity_previews (
    lead_id,service_category,public_summary,city,zip_code,published_at,published_by
  ) values (p_lead_id,v_service,v_summary,btrim(v_city),v_zip,now(),p_actor)
  on conflict(lead_id) do update set
    service_category=excluded.service_category,
    public_summary=excluded.public_summary,
    city=excluded.city,
    zip_code=excluded.zip_code,
    published_at=excluded.published_at,
    published_by=excluded.published_by
  returning id into v_id;
  update public.leads set status='published' where id=p_lead_id;
  insert into public.lead_status_events(lead_id,actor_user_id,previous_status,next_status,note)
    values(p_lead_id,p_actor,'qualified','published','Published opportunity preview without contact information');
  return jsonb_build_object('opportunity_id',v_id,'status','published','contact_shared',false);
end;
$publish$;

create or replace function public.admin_withdraw_opportunity(
  p_lead_id uuid,p_note text,p_actor uuid
) returns jsonb
language plpgsql
set search_path = ''
as $withdraw$
declare
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    raise exception 'Administrator not authorized';
  end if;
  if char_length(coalesce(p_note,'')) > 1000 then raise exception 'Note too long'; end if;
  select status into v_status from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_status <> 'published' then raise exception 'Request is not published'; end if;
  update public.leads set status='qualified' where id=p_lead_id;
  insert into public.lead_status_events(lead_id,actor_user_id,previous_status,next_status,note)
    values(p_lead_id,p_actor,'published','qualified',
      'Opportunity withdrawn from contractor listings'
      ||case when v_note is null then '' else ': '||v_note end);
  return jsonb_build_object('id',p_lead_id,'status','qualified','visible',false);
end;
$withdraw$;

-- Only named professionals with a confirmed account and active profile can view sanitized cards.
-- No join result ever includes private lead/customer fields.
create or replace function public.list_contractor_opportunities(
  p_contractor uuid,p_page integer default 0,p_city text default null
) returns table(
  opportunity_id uuid,
  service_category text,
  public_summary text,
  city text,
  zip_code text,
  published_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $browse$
begin
  if p_page is null or p_page < 0 or p_page > 100 then
    raise exception 'Invalid page';
  end if;
  return query
    select o.id,o.service_category,o.public_summary,o.city,o.zip_code,o.published_at
    from public.opportunity_previews o
    join public.leads l on l.id=o.lead_id and l.status='published'
    join public.contractor_profiles p on p.user_id=p_contractor
    where p.account_status='active'
      and p.email_verified_at is not null
      and p.state_code='FL'
      and o.zip_code ~ '^(32|33|34)[0-9]{3}$'
      and (o.service_category='Other Services'
           or o.service_category=any(p.service_categories))
      and (p_city is null or btrim(p_city)='' or lower(btrim(p_city))=lower(btrim(o.city)))
    order by o.published_at desc,o.id desc
    limit 25 offset p_page*25;
end;
$browse$;

revoke all on function public.admin_publish_opportunity(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.admin_withdraw_opportunity(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.list_contractor_opportunities(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.admin_publish_opportunity(uuid,text,uuid) to service_role;
grant execute on function public.admin_withdraw_opportunity(uuid,text,uuid) to service_role;
grant execute on function public.list_contractor_opportunities(uuid,integer,text) to service_role;
