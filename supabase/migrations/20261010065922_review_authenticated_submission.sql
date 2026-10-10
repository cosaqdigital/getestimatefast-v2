-- PREPARED ONLY. OAuth/session identity is validated by the trusted server.
begin;
create function public.gef_review_invitation_context(p_hash text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('contractor_id',i.contractor_id,'display_name',p.display_name,'slug',p.slug)
 from gef_private.review_invitations i join public.contractor_public_profiles p on p.contractor_id=i.contractor_id
 join public.contractor_profiles c on c.user_id=i.contractor_id
 where i.token_hash=p_hash and i.used_at is null and i.expires_at>now() and p.published and c.account_status='active';
$$;
create function public.gef_submit_authenticated_review(p_actor uuid,p_google_subject text,p_review jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare inv gef_private.review_invitations%rowtype;v_id uuid;
begin
 if p_actor is null or p_google_subject is null or length(p_google_subject) not between 1 and 255 or p_google_subject~'\s' then raise exception 'Authenticated Google identity required';end if;
 select * into inv from gef_private.review_invitations where token_hash=p_review->>'token_hash' for update;
 if not found or inv.used_at is not null or inv.expires_at<=now() then raise exception 'Review invitation expired or already used';end if;
 if inv.contractor_id=p_actor then raise exception 'Self-review is not allowed';end if;
 if not exists(select 1 from public.contractor_public_profiles pp join public.contractor_profiles c on c.user_id=pp.contractor_id where pp.contractor_id=inv.contractor_id and pp.published and c.account_status='active') then raise exception 'Profile unavailable';end if;
 insert into public.contractor_reviews(contractor_id,invitation_id,identity_hash,display_name,rating,comment,source)
 values(inv.contractor_id,inv.id,null,p_review->>'display_name',(p_review->>'rating')::int,p_review->>'comment',inv.source) returning id into v_id;
 insert into gef_private.review_authenticated_identities(review_id,contractor_id,reviewer_user_id,provider,provider_subject)
 values(v_id,inv.contractor_id,p_actor,'google',p_google_subject);
 update gef_private.review_invitations set used_at=now() where id=inv.id;
 return jsonb_build_object('review_id',v_id,'status','pending');
end $$;
-- Existing deployments must not keep submitting declared-email identities.
create or replace function public.gef_submit_review(p_review jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Google authentication required for reviews';end $$;
revoke all on function public.gef_review_invitation_context(text),public.gef_submit_authenticated_review(uuid,text,jsonb),public.gef_submit_review(jsonb) from public,anon,authenticated;
grant execute on function public.gef_review_invitation_context(text),public.gef_submit_authenticated_review(uuid,text,jsonb),public.gef_submit_review(jsonb) to service_role;
commit;
