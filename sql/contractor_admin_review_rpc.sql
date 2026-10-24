create or replace function public.admin_review_contractor(p_contractor_id uuid,p_next_status text,p_note text,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_status text;
begin
 if p_next_status not in ('active','suspended','rejected','pending_review') then raise exception 'Invalid status'; end if;
 if p_note is not null and length(p_note)>1000 then raise exception 'Note too long'; end if;
 if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Not an administrator'; end if;
 select account_status into old_status from public.contractor_profiles where user_id=p_contractor_id for update;
 if not found then raise exception 'Contractor not found'; end if;
 if old_status=p_next_status and coalesce(trim(p_note),'')='' then return jsonb_build_object('unchanged',true,'status',old_status); end if;
 update public.contractor_profiles set account_status=p_next_status,updated_at=now() where user_id=p_contractor_id;
 insert into public.contractor_verification_events(contractor_id,actor_admin_id,prior_status,next_status,note)
 values(p_contractor_id,p_actor,old_status,p_next_status,p_note);
 return jsonb_build_object('status',p_next_status,'previous',old_status);
end;
$$;
revoke all on function public.admin_review_contractor(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_review_contractor(uuid,text,text,uuid) to service_role;