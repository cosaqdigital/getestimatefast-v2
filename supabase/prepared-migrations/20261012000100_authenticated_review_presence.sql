-- PREPARED ONLY: separate approval required before installing in Development.
-- Requires the four approved Google-review migrations from PR #57.
begin;
create function public.gef_authenticated_review_exists(p_actor uuid,p_google_subject text,p_contractor uuid)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if p_actor is null or p_contractor is null or p_google_subject is null
    or length(p_google_subject) not between 1 and 255 or p_google_subject ~ '\s'
 then raise exception 'Verified Google identity and professional required';end if;
 -- Every persisted identity occupies the slot, regardless of review moderation status.
 -- The Google subject also covers a legitimately recreated Auth user.
 return exists(select 1 from gef_private.review_authenticated_identities i
  where i.contractor_id=p_contractor and i.provider='google'
    and (i.reviewer_user_id=p_actor or i.provider_subject=p_google_subject));
end $$;
revoke all on function public.gef_authenticated_review_exists(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.gef_authenticated_review_exists(uuid,text,uuid) to service_role;
commit;
