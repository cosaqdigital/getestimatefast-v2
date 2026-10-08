-- GetEstimateFast only. Atomic status transitions; private RPC.
create or replace function public.admin_change_lead_status(
 p_lead_id uuid, p_next_status text, p_note text, p_actor uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 current_status text;
begin
 if p_next_status not in ('new','qualified','published','closed','rejected') then
   raise exception 'Invalid next status';
 end if;
 if p_note is not null and length(p_note) > 1000 then
   raise exception 'Note too long';
 end if;
 if not exists(select 1 from public.admin_users where user_id=p_actor) then
   raise exception 'Administrator not authorized';
 end if;
 select status into current_status from public.leads where id=p_lead_id for update;
 if not found then raise exception 'Lead not found'; end if;
 if current_status = p_next_status and p_note is null then
   return jsonb_build_object('id',p_lead_id,'status',current_status,'unchanged',true);
 end if;
 update public.leads set status=p_next_status, admin_note=coalesce(p_note,admin_note),
 reviewed_at=now() where id=p_lead_id;
 insert into public.lead_status_events(lead_id,actor_user_id,previous_status,next_status,note)
 values(p_lead_id,p_actor,current_status,p_next_status,p_note);
 return jsonb_build_object('id',p_lead_id,'status',p_next_status,'previous',current_status);
end;
$$;
revoke all on function public.admin_change_lead_status(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_change_lead_status(uuid,text,text,uuid) to service_role;
