begin;

create table public.work_profiles(
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique
    check (length(slug) between 3 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null
    check (length(btrim(display_name)) between 2 and 120),
  contact_phone text not null
    check (length(btrim(contact_phone)) between 7 and 35),
  base_zip text not null
    check (base_zip ~ '^[0-9]{5}$'),
  state_code text not null default 'FL'
    check (state_code = 'FL'),
  service_radius_miles integer not null default 25
    check (service_radius_miles between 1 and 100),
  service_categories text[] not null default '{}'::text[]
    check (cardinality(service_categories) <= 20),
  languages text[] not null default '{}'::text[]
    check (cardinality(languages) <= 3 and languages <@ array['en','pt','es']::text[]),
  opportunity_types text[] not null default '{}'::text[]
    check (cardinality(opportunity_types) <= 2 and opportunity_types <@ array['helper','professional']::text[]),
  bio text not null default ''
    check (length(bio) <= 1000),
  profile_image_path text,
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  email_notifications boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'active'
    or (
      profile_image_path is not null
      and length(btrim(profile_image_path)) > 0
      and cardinality(service_categories) >= 1
      and cardinality(languages) >= 1
      and cardinality(opportunity_types) >= 1
      and length(btrim(bio)) >= 10
    )
  ),
  check (not sms_opt_in or sms_opt_in_at is not null)
);

create table public.work_opportunities(
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.contractor_profiles(user_id) on delete restrict,
  opportunity_type text not null check (opportunity_type in ('helper','professional')),
  service_category text not null check (length(btrim(service_category)) between 2 and 120),
  task_label text check (task_label is null or length(btrim(task_label)) between 2 and 120),
  zip_code text not null check (zip_code ~ '^[0-9]{5}$'),
  description text not null check (length(btrim(description)) between 20 and 1500),
  pay_cents bigint not null check (pay_cents between 100 and 100000000),
  pay_basis text not null default 'day' check (pay_basis in ('day','hour','fixed')),
  work_date date not null,
  start_time time,
  workers_needed smallint not null default 1 check (workers_needed between 1 and 20),
  max_contacts smallint not null default 3 check (max_contacts between 1 and 25),
  contacts_used smallint not null default 0 check (contacts_used >= 0),
  positions_filled smallint not null default 0 check (positions_filled >= 0),
  languages text[] not null
    check (cardinality(languages) between 1 and 3 and languages <@ array['en','pt','es']::text[]),
  posting_source text not null default 'monthly_free'
    check (posting_source in ('monthly_free','purchased_credit','admin')),
  status text not null default 'open'
    check (status in ('open','applications_closed','filled','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (max_contacts >= workers_needed),
  check (contacts_used <= max_contacts),
  check (positions_filled <= workers_needed),
  check (
    (status in ('open','applications_closed') and closed_at is null)
    or (status in ('filled','cancelled','expired') and closed_at is not null)
  )
);

create table public.work_applications(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.work_opportunities(id) on delete cascade,
  applicant_id uuid not null references public.work_profiles(user_id) on delete restrict,
  status text not null default 'interested'
    check (status in ('interested','selected','declined','withdrawn','cancelled')),
  contact_released_at timestamptz,
  selected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id,applicant_id),
  check ((status = 'selected' and selected_at is not null) or status <> 'selected')
);

create table public.work_assignments(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.work_opportunities(id) on delete cascade,
  application_id uuid not null unique references public.work_applications(id) on delete cascade,
  worker_id uuid not null references public.work_profiles(user_id) on delete restrict,
  status text not null default 'selected' check (status in ('selected','cancelled','completed')),
  selected_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(opportunity_id,worker_id),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create table public.work_user_blocks(
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);

create table gef_private.work_reports(
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reported_user_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid references public.work_opportunities(id) on delete set null,
  reason text not null check (reason in ('spam','fake_profile','misleading_job','payment_issue','no_show','harassment','other')),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check (reported_user_id is not null or opportunity_id is not null)
);

create table gef_private.work_post_credit_packages(
  package_code text primary key check (package_code ~ '^[a-z0-9_]+$'),
  posts integer not null check (posts between 1 and 1000),
  amount_cents bigint not null check (amount_cents between 100 and 1000000),
  currency text not null default 'USD' check (currency = 'USD'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into gef_private.work_post_credit_packages(package_code,posts,amount_cents)
values ('extra_4',4,700),('extra_15',15,1500)
on conflict(package_code) do update
set posts=excluded.posts,amount_cents=excluded.amount_cents,currency='USD';

create table gef_private.work_post_credit_balances(
  contractor_id uuid primary key references public.contractor_profiles(user_id) on delete cascade,
  purchased_posts integer not null default 0 check (purchased_posts >= 0),
  updated_at timestamptz not null default now()
);

create table gef_private.work_post_credit_ledger(
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractor_profiles(user_id) on delete restrict,
  amount_posts integer not null check (amount_posts <> 0 and abs(amount_posts) <= 1000),
  entry_type text not null check (entry_type in ('purchase','consume','refund','admin_adjustment')),
  package_code text references gef_private.work_post_credit_packages(package_code) on delete restrict,
  opportunity_id uuid references public.work_opportunities(id) on delete restrict,
  operation_key text not null unique check (length(operation_key) between 8 and 160),
  created_at timestamptz not null default now(),
  check (
    (entry_type = 'purchase' and amount_posts > 0)
    or (entry_type = 'refund' and amount_posts > 0)
    or (entry_type = 'consume' and amount_posts < 0)
    or entry_type = 'admin_adjustment'
  )
);

create or replace function gef_private.work_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=now(); return new; end $$;

create or replace function gef_private.work_credit_ledger_apply()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_balance integer;
begin
  insert into gef_private.work_post_credit_balances(contractor_id,purchased_posts)
  values(new.contractor_id,0) on conflict(contractor_id) do nothing;
  select purchased_posts into v_balance
  from gef_private.work_post_credit_balances
  where contractor_id=new.contractor_id for update;
  if v_balance + new.amount_posts < 0 then
    raise exception 'Insufficient work post credit balance';
  end if;
  update gef_private.work_post_credit_balances
  set purchased_posts=v_balance+new.amount_posts,updated_at=now()
  where contractor_id=new.contractor_id;
  return new;
end $$;

create or replace function gef_private.prevent_work_credit_ledger_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin raise exception 'Work post credit ledger is immutable'; end $$;

create trigger work_profiles_touch_updated_at before update on public.work_profiles
for each row execute function gef_private.work_touch_updated_at();
create trigger work_opportunities_touch_updated_at before update on public.work_opportunities
for each row execute function gef_private.work_touch_updated_at();
create trigger work_applications_touch_updated_at before update on public.work_applications
for each row execute function gef_private.work_touch_updated_at();
create trigger work_post_credit_ledger_apply after insert on gef_private.work_post_credit_ledger
for each row execute function gef_private.work_credit_ledger_apply();
create trigger prevent_work_post_credit_ledger_update before update on gef_private.work_post_credit_ledger
for each row execute function gef_private.prevent_work_credit_ledger_mutation();
create trigger prevent_work_post_credit_ledger_delete before delete on gef_private.work_post_credit_ledger
for each row execute function gef_private.prevent_work_credit_ledger_mutation();

create index work_profiles_match_idx on public.work_profiles(status,base_zip,service_radius_miles);
create index work_profiles_categories_gin on public.work_profiles using gin(service_categories);
create index work_opportunities_feed_idx on public.work_opportunities(status,work_date,zip_code,created_at desc);
create index work_opportunities_category_idx on public.work_opportunities(service_category,status,work_date);
create index work_opportunities_poster_idx on public.work_opportunities(posted_by,created_at desc);
create index work_applications_opportunity_idx on public.work_applications(opportunity_id,status,created_at);
create index work_applications_applicant_idx on public.work_applications(applicant_id,created_at desc);
create index work_assignments_opportunity_idx on public.work_assignments(opportunity_id,status);
create index work_reports_status_idx on gef_private.work_reports(status,created_at);
create index work_post_credit_ledger_contractor_idx on gef_private.work_post_credit_ledger(contractor_id,created_at desc);

alter table public.work_profiles enable row level security;
alter table public.work_opportunities enable row level security;
alter table public.work_applications enable row level security;
alter table public.work_assignments enable row level security;
alter table public.work_user_blocks enable row level security;
alter table gef_private.work_reports enable row level security;
alter table gef_private.work_post_credit_packages enable row level security;
alter table gef_private.work_post_credit_balances enable row level security;
alter table gef_private.work_post_credit_ledger enable row level security;

revoke all on public.work_profiles from public,anon,authenticated;
revoke all on public.work_opportunities from public,anon,authenticated;
revoke all on public.work_applications from public,anon,authenticated;
revoke all on public.work_assignments from public,anon,authenticated;
revoke all on public.work_user_blocks from public,anon,authenticated;
grant select,insert,update on public.work_profiles to service_role;
grant select,insert,update on public.work_opportunities to service_role;
grant select,insert,update on public.work_applications to service_role;
grant select,insert,update on public.work_assignments to service_role;
grant select,insert,delete on public.work_user_blocks to service_role;

revoke all on gef_private.work_reports from public,anon,authenticated;
revoke all on gef_private.work_post_credit_packages from public,anon,authenticated;
revoke all on gef_private.work_post_credit_balances from public,anon,authenticated;
revoke all on gef_private.work_post_credit_ledger from public,anon,authenticated;
grant select,insert,update on gef_private.work_reports to service_role;
grant select on gef_private.work_post_credit_packages to service_role;
grant select,insert,update on gef_private.work_post_credit_balances to service_role;
grant select,insert on gef_private.work_post_credit_ledger to service_role;

revoke all on function gef_private.work_touch_updated_at() from public,anon,authenticated;
revoke all on function gef_private.work_credit_ledger_apply() from public,anon,authenticated;
revoke all on function gef_private.prevent_work_credit_ledger_mutation() from public,anon,authenticated;

commit;
