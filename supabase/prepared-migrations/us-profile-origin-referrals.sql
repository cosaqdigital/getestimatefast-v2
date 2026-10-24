-- GetEstimateFast US Development: professional-profile lead origin, immutable assignment.
-- PREPARED MIGRATION. Apply ONLY to Supabase Development after offline review.
-- No Brazil databases, integrations, real notifications, or financial operations.
begin;
alter table public.leads add column if not exists origin_contractor_id uuid;

do $ddl$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.leads'::regclass and conname='gef_leads_origin_profile_fkey') then
    alter table public.leads add constraint gef_leads_origin_profile_fkey
      foreign key (origin_contractor_id) references public.contractor_profiles(user_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.leads'::regclass and conname='gef_leads_profile_source_check') then
    alter table public.leads add constraint gef_leads_profile_source_check
      check (origin_contractor_id is null or source = 'professional_profile');
  end if;
end $ddl$;

create index if not exists gef_leads_origin_lookup
  on public.leads (origin_contractor_id, created_at desc)
  where origin_contractor_id is not null;

create or replace function gef_private.guard_immutable_lead_origin()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.origin_contractor_id is distinct from new.origin_contractor_id then
    raise exception 'Profile lead origin is immutable';
  end if;
  return new;
end;
$function$;
drop trigger if exists gef_lead_origin_immutable on public.leads;
create trigger gef_lead_origin_immutable
  before update of origin_contractor_id on public.leads
  for each row execute function gef_private.guard_immutable_lead_origin();

-- Prevent an originating professional from accidentally paying for their own referral.
-- An attempted paid transaction rolls back in full, including wallet debit.
create or replace function gef_private.reject_paid_origin_contact()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if exists (
    select 1 from public.opportunity_previews o
    join public.leads l on l.id=o.lead_id
    where o.id=new.opportunity_id and l.origin_contractor_id=new.contractor_id
  ) then
    raise exception 'The originating professional receives this contact without charge';
  end if;
  return new;
end;
$function$;
drop trigger if exists gef_no_paid_origin_contact on gef_private.contact_purchases;
create trigger gef_no_paid_origin_contact
  before insert on gef_private.contact_purchases
  for each row execute function gef_private.reject_paid_origin_contact();

revoke all on function gef_private.guard_immutable_lead_origin() from public,anon,authenticated;
revoke all on function gef_private.reject_paid_origin_contact() from public,anon,authenticated;
-- This migration adds no anon/authenticated grants to public.leads.
commit;
