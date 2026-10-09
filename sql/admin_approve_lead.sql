-- Atomic, administrator-only manual lead approval.
-- This function does not publish or distribute a lead: qualified != published.
create or replace function public.admin_approve_lead(
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
as $function$
declare
  v_old_status text;
  v_original_service text;
  v_details jsonb;
  v_category text := btrim(coalesce(p_service_type, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_approved_at timestamptz := now();
begin
  if not exists(select 1 from public.admin_users where user_id = p_actor) then
    raise exception 'Administrator not authorized';
  end if;
  if p_contact_reviewed is distinct from true or p_scope_reviewed is distinct from true then
    raise exception 'Review both contact details and requested service before approval';
  end if;
  if length(v_category) < 2 or length(v_category) > 120 then
    raise exception 'Choose a valid category';
  end if;
  if length(coalesce(p_note, '')) > 1000 then
    raise exception 'Note too long';
  end if;

  select status, service_type, details
    into v_old_status, v_original_service, v_details
    from public.leads
    where id = p_lead_id
    for update;

  if not found then raise exception 'Lead not found'; end if;
  if v_old_status <> 'new' then
    raise exception 'Lead has already been reviewed or changed; reload before proceeding';
  end if;

  update public.leads
     set service_type = v_category,
         status = 'qualified',
         reviewed_at = v_approved_at,
         admin_note = coalesce(v_note, admin_note),
         details = coalesce(v_details, '{}'::jsonb)
           || jsonb_build_object(
              '_platform_review',
              coalesce(v_details -> '_platform_review', '{}'::jsonb)
              || jsonb_build_object(
                 'required', false,
                 'review_status', 'approved',
                 'approved_at', v_approved_at,
                 'approved_by', p_actor,
                 'contact_reviewed', true,
                 'scope_reviewed', true,
                 'approved_category', v_category,
                 'original_service', coalesce(
                   v_details #>> '{_platform_review,original_service}',
                   v_details ->> 'Service Type',
                   v_original_service)
              )
           )
   where id = p_lead_id;

  insert into public.lead_status_events(
    lead_id, actor_user_id, previous_status, next_status, note
  ) values (
    p_lead_id, p_actor, v_old_status, 'qualified',
    'Approved after contact and scope review; category: '
      || v_original_service || ' -> ' || v_category
      || case when v_note is null then '' else '; note: ' || v_note end
  );

  return jsonb_build_object(
    'id', p_lead_id,
    'status', 'qualified',
    'previous', v_old_status,
    'approved_category', v_category,
    'published', false
  );
end;
$function$;

revoke all on function public.admin_approve_lead(
  uuid, text, boolean, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.admin_approve_lead(
  uuid, text, boolean, boolean, text, uuid
) to service_role;
