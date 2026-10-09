-- Controlled matching selections; these records NEVER send notifications or reveal customer contacts.
create table if not exists public.opportunity_matching_rounds (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunity_previews(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 5),
  selected_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(opportunity_id,round_number)
);
create table if not exists public.opportunity_matching_recipients (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.opportunity_matching_rounds(id) on delete cascade,
  opportunity_id uuid not null references public.opportunity_previews(id) on delete cascade,
  contractor_user_id uuid not null references public.contractor_profiles(user_id) on delete cascade,
  service_category text not null,
  distance_miles numeric(6,1) not null check(distance_miles between 0 and 100),
  service_radius_miles integer not null check(service_radius_miles between 1 and 100),
  created_at timestamptz not null default now(),
  unique(opportunity_id,contractor_user_id),
  unique(round_id,contractor_user_id)
);
create index if not exists opportunity_matching_recipients_contractor_idx
on public.opportunity_matching_recipients(contractor_user_id);
alter table public.opportunity_matching_rounds enable row level security;
alter table public.opportunity_matching_recipients enable row level security;
revoke all on public.opportunity_matching_rounds,public.opportunity_matching_recipients from public,anon,authenticated;
grant select,insert on public.opportunity_matching_rounds,public.opportunity_matching_recipients to service_role;

create or replace function public.admin_record_matching_round(
 p_lead_id uuid,p_contractor_ids uuid[],p_distances numeric[],p_actor uuid
) returns jsonb language plpgsql set search_path='' as $fn$
declare
 v_opportunity uuid;
 v_category text;
 v_status text;
 v_count integer:=coalesce(cardinality(p_contractor_ids),0);
 v_existing integer;
 v_round integer;
 v_round_id uuid;
 v_i integer;
 v_profile public.contractor_profiles%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor) then
  raise exception 'Administrator not authorized';
 end if;
 if v_count < 1 or v_count > 5 or coalesce(cardinality(p_distances),0) <> v_count then
  raise exception 'Select between 1 and 5 professionals with distances';
 end if;
 select l.status,o.id,o.service_category into v_status,v_opportunity,v_category
 from public.leads l join public.opportunity_previews o on o.lead_id=l.id
 where l.id=p_lead_id for update of l;
 if not found or v_status<>'published' then raise exception 'Opportunity must be published'; end if;
 select count(*) into v_existing from public.opportunity_matching_rounds where opportunity_id=v_opportunity;
 if v_existing>=5 then raise exception 'Maximum five selection rounds'; end if;
 for v_i in 1..v_count loop
  if p_contractor_ids[v_i] is null or p_distances[v_i] is null then raise exception 'Invalid candidate'; end if;
  if p_distances[v_i]<0 or p_distances[v_i]>100 then raise exception 'Invalid distance'; end if;
  select * into v_profile from public.contractor_profiles where user_id=p_contractor_ids[v_i];
  if not found or v_profile.account_status<>'active' or v_profile.email_verified_at is null
   or v_profile.state_code<>'FL' or v_profile.service_radius_miles is null
   or p_distances[v_i]>v_profile.service_radius_miles
   or (v_category<>'Other Services' and not v_category=any(v_profile.service_categories))
  then raise exception 'Candidate no longer eligible'; end if;
  if exists(select 1 from public.opportunity_matching_recipients
            where opportunity_id=v_opportunity and contractor_user_id=p_contractor_ids[v_i])
  then raise exception 'Candidate already selected for this opportunity'; end if;
  if exists(select 1 from unnest(p_contractor_ids[1:v_i-1]) as previous(id) where previous.id=p_contractor_ids[v_i])
  then raise exception 'Duplicate candidate selection'; end if;
 end loop;
 v_round:=v_existing+1;
 insert into public.opportunity_matching_rounds(opportunity_id,round_number,selected_by)
 values(v_opportunity,v_round,p_actor) returning id into v_round_id;
 insert into public.opportunity_matching_recipients(round_id,opportunity_id,contractor_user_id,service_category,distance_miles,service_radius_miles)
 select v_round_id,v_opportunity,p_contractor_ids[i],v_category,round(p_distances[i],1),p.service_radius_miles
 from generate_series(1,v_count) as g(i)
 join public.contractor_profiles p on p.user_id=p_contractor_ids[i];
 return jsonb_build_object('round_id',v_round_id,'round_number',v_round,'selected_count',v_count,'notifications_sent',0,'contact_shared',false);
end;
$fn$;

revoke all on function public.admin_record_matching_round(uuid,uuid[],numeric[],uuid) from public,anon,authenticated;
grant execute on function public.admin_record_matching_round(uuid,uuid[],numeric[],uuid) to service_role;
