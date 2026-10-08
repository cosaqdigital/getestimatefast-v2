-- GetEstimateFast only: automatic contractor onboarding after email confirmation
-- and a complete profile. This is account enablement, NOT trade-license verification.
-- No change to Orçamentos Brasil and no public signup toggle.
alter table public.contractor_profiles
  alter column account_status set default 'active';

-- Even if a future backend accidentally omits a check, incomplete accounts
-- cannot be marked active in the database.
alter table public.contractor_profiles
  add constraint contractor_active_requires_complete_profile
  check (
    account_status <> 'active'
    or (
      email_verified_at is not null
      and privacy_accepted_at is not null
      and terms_accepted_at is not null
      and char_length(trim(display_name)) between 2 and 120
      and char_length(trim(contact_phone)) >= 10
      and cardinality(service_categories) >= 1
      and base_zip ~ '^[0-9]{5}$'
    )
  );

create or replace function public.contractor_auto_enable_event()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.account_status = 'active' then
      insert into public.contractor_verification_events
        (contractor_id, actor_admin_id, prior_status, next_status, note)
      values
        (new.user_id, null, null, 'active',
         'Auto-enabled after verified email and complete profile; license not verified');
    end if;
  elsif tg_op = 'UPDATE' then
    if old.account_status = 'pending_review' and new.account_status = 'active' then
      insert into public.contractor_verification_events
        (contractor_id, actor_admin_id, prior_status, next_status, note)
      values
        (new.user_id, null, old.account_status, 'active',
         'Auto-enabled after verified email and complete profile; license not verified');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.contractor_auto_enable_event()
  from public, anon, authenticated;

drop trigger if exists contractor_auto_enable_event on public.contractor_profiles;
create trigger contractor_auto_enable_event
after insert or update of account_status on public.contractor_profiles
for each row execute function public.contractor_auto_enable_event();

-- Legacy profiles created before this rule: migrate only fully completed ones,
-- never suspended/rejected profiles.
update public.contractor_profiles
set account_status = 'active', updated_at = now()
where account_status = 'pending_review'
  and email_verified_at is not null
  and privacy_accepted_at is not null
  and terms_accepted_at is not null
  and char_length(trim(display_name)) between 2 and 120
  and char_length(trim(contact_phone)) >= 10
  and cardinality(service_categories) >= 1
  and base_zip ~ '^[0-9]{5}$';

-- Admin actions exist for exceptional moderation/restoration only.
-- Initial activation must happen automatically when an eligible profile is saved.
create or replace function public.admin_review_contractor(
  p_contractor_id uuid, p_next_status text, p_note text, p_actor uuid
)
returns jsonb language plpgsql security invoker
set search_path = ''
as $$
declare old_status text;
begin
  if p_next_status not in ('active', 'suspended', 'rejected') then
    raise exception 'Only moderation and reactivation actions are allowed';
  end if;
  if p_note is null or length(trim(p_note)) < 5 or length(p_note) > 1000 then
    raise exception 'A review reason is required';
  end if;
  if not exists(
    select 1 from public.admin_users where user_id = p_actor
  ) then
    raise exception 'Not an administrator';
  end if;

  select account_status into old_status
  from public.contractor_profiles
  where user_id = p_contractor_id
  for update;
  if not found then raise exception 'Contractor not found'; end if;

  if p_next_status = 'active'
     and old_status not in ('suspended', 'rejected') then
    raise exception 'Initial account activation is automatic';
  end if;

  if old_status = p_next_status then
    return jsonb_build_object('unchanged', true, 'status', old_status);
  end if;

  update public.contractor_profiles
    set account_status = p_next_status, updated_at = now()
  where user_id = p_contractor_id;

  insert into public.contractor_verification_events
    (contractor_id, actor_admin_id, prior_status, next_status, note)
  values
    (p_contractor_id, p_actor, old_status, p_next_status, trim(p_note));

  return jsonb_build_object('status', p_next_status, 'previous', old_status);
end;
$$;
revoke all on function public.admin_review_contractor(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_review_contractor(uuid, text, text, uuid)
  to service_role;
