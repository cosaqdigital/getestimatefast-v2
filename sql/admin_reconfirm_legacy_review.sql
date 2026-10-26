-- One-screen re-review of legacy QUALIFIED leads that predate the current manual checks.
-- Never publishes an opportunity. Preserves original request, contact and previous events.
create or replace function public.admin_reconfirm_legacy_lead(
  p_lead_id uuid,
  p_service_type text,
  p_contact_reviewed boolean,
  p_scope_reviewed boolean,
  p_note text,
  p_actor uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $legacy$
declare
  v_status text;
  v_original_service text;
  v_details jsonb;
  v_meta jsonb;
  v_category text := btrim(coalesce(p_service_type,''));
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_prior_reviewed boolean;
begin
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    raise exception 'Administrator not authorized';
  end if;
  if p_contact_reviewed is distinct from true or p_scope_reviewed is distinct from true then
    raise exception 'Review both contact and service before reconfirming';
  end if;
  if length(v_category)<2 or length(v_category)>120 then raise exception 'Invalid service category'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception 'Note too long'; end if;

  select status,service_type,details into v_status,v_original_service,v_details
    from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if v_status<>'qualified' then raise exception 'Only legacy qualified leads may be reconfirmed'; end if;
  if exists(select 1 from public.opportunity_previews where lead_id=p_lead_id) then
    raise exception 'Opportunity already has publication history; manual review is required';
  end if;

  v_meta:=case when jsonb_typeof(coalesce(v_details,'{}'::jsonb)->'_platform_review')='object'
    then v_details->'_platform_review' else '{}'::jsonb end;
  v_prior_reviewed := (
    v_meta->>'review_status'='approved'
    and v_meta->'contact_reviewed'='true'::jsonb
    and v_meta->'scope_reviewed'='true'::jsonb
    and v_meta->>'approved_category'=v_original_service
  );
  if v_prior_reviewed then
    raise exception 'Already reviewed; do not reconfirm a completed request';
  end if;

  update public.leads set
    service_type=v_category,
    reviewed_at=now(),
    admin_note=case
      when v_note is null then admin_note
      when admin_note is null or btrim(admin_note)='' then v_note
      else left(admin_note || ' | ' || v_note,1000)
    end,
    details=coalesce(v_details,'{}'::jsonb)
      || jsonb_build_object('_platform_review',v_meta || jsonb_build_object(
        'required',false,
        'review_status','approved',
        'contact_reviewed',true,
        'scope_reviewed',true,
        'approved_category',v_category,
        'approved_at',now(),
        'approved_by',p_actor,
        'legacy_reconfirmed',true,
        'original_service',coalesce(
          v_meta->>'original_service',v_details->>'Service Type',v_original_service)
      ))
    where id=p_lead_id;

  insert into public.lead_status_events(lead_id,actor_user_id,previous_status,next_status,note)
  values(p_lead_id,p_actor,'qualified','qualified',
    'Legacy review reconfirmed; category: '||v_original_service||' -> '||v_category||
    case when v_note is null then '' else '; note: '||v_note end);

  return jsonb_build_object('id',p_lead_id,'status','qualified',
    'review_reconfirmed',true,'published',false,'approved_category',v_category);
end;
$legacy$;

revoke all on function public.admin_reconfirm_legacy_lead(uuid,text,boolean,boolean,text,uuid)
  from public,anon,authenticated;
grant execute on function public.admin_reconfirm_legacy_lead(uuid,text,boolean,boolean,text,uuid)
  to service_role;
