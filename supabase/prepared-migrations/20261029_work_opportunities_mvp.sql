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

create table public.work_signup_consents(
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text not null,
  contact_phone text not null,
  sms_phone_e164 text not null,
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  privacy_accepted_at timestamptz not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now()
);

create index work_signup_consents_phone_idx
on public.work_signup_consents(sms_phone_e164);

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
  operation_key text not null unique check (length(operation_key) between 12 and 160),
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

create table public.work_notifications(
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  opportunity_id uuid references public.work_opportunities(id) on delete cascade,
  application_id uuid references public.work_applications(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('application_received','work_match','application_selected','application_closed')),
  event_key text not null unique
    check (length(event_key) between 12 and 180),
  read_at timestamptz,
  created_at timestamptz not null default now()
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
create index work_notifications_recipient_idx on public.work_notifications(recipient_id,read_at,created_at desc);
create index work_notifications_opportunity_idx on public.work_notifications(opportunity_id,created_at desc);
create index work_reports_status_idx on gef_private.work_reports(status,created_at);
create index work_post_credit_ledger_contractor_idx on gef_private.work_post_credit_ledger(contractor_id,created_at desc);

alter table public.work_profiles enable row level security;
alter table public.work_signup_consents enable row level security;
alter table public.work_opportunities enable row level security;
alter table public.work_applications enable row level security;
alter table public.work_assignments enable row level security;
alter table public.work_user_blocks enable row level security;
alter table public.work_notifications enable row level security;
alter table gef_private.work_reports enable row level security;
alter table gef_private.work_post_credit_packages enable row level security;
alter table gef_private.work_post_credit_balances enable row level security;
alter table gef_private.work_post_credit_ledger enable row level security;

revoke all on public.work_profiles from public,anon,authenticated;
revoke all on public.work_signup_consents from public,anon,authenticated;
revoke all on public.work_opportunities from public,anon,authenticated;
revoke all on public.work_applications from public,anon,authenticated;
revoke all on public.work_assignments from public,anon,authenticated;
revoke all on public.work_user_blocks from public,anon,authenticated;
revoke all on public.work_notifications from public,anon,authenticated;
grant select,insert,update on public.work_profiles to service_role;
grant select,insert,update on public.work_signup_consents to service_role;
grant select,insert,update on public.work_opportunities to service_role;
grant select,insert,update on public.work_applications to service_role;
grant select,insert,update on public.work_assignments to service_role;
grant select,insert,delete on public.work_user_blocks to service_role;
grant select,insert,update on public.work_notifications to service_role;

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


create or replace function public.gef_work_post_summary(p_contractor uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_profile public.contractor_profiles%rowtype;
  v_public public.contractor_public_profiles%rowtype;
  v_free_used integer := 0;
  v_purchased integer := 0;
  v_month_start timestamptz;
  v_profile_complete boolean := false;
  v_public_ready boolean := false;
  v_code text := 'account_inactive';
  v_packages jsonb := '[]'::jsonb;
begin
  v_month_start := (date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York');

  select * into v_profile
  from public.contractor_profiles
  where user_id=p_contractor;

  if found then
    v_profile_complete :=
      v_profile.account_status='active'
      and length(btrim(coalesce(v_profile.display_name,'')))>=2
      and length(btrim(coalesce(v_profile.contact_phone,'')))>=7
      and coalesce(v_profile.base_zip,'') ~ '^[0-9]{5}$'
      and length(btrim(coalesce(v_profile.city,'')))>=2
      and v_profile.state_code='FL'
      and cardinality(v_profile.service_categories)>=1;

    if v_profile.account_status<>'active' then
      v_code:='account_inactive';
    elsif not v_profile_complete then
      v_code:='professional_profile_incomplete';
    else
      v_code:='public_profile_required';
    end if;
  end if;

  select * into v_public
  from public.contractor_public_profiles
  where contractor_id=p_contractor
  limit 1;

  v_public_ready := found and v_public.published=true;

  if v_profile_complete and v_public_ready then
    v_code:='eligible';
  end if;

  select count(*)::integer into v_free_used
  from public.work_opportunities
  where posted_by=p_contractor
    and posting_source='monthly_free'
    and created_at>=v_month_start;

  select coalesce(purchased_posts,0) into v_purchased
  from gef_private.work_post_credit_balances
  where contractor_id=p_contractor;
  v_purchased := coalesce(v_purchased,0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'package_code',package_code,
        'posts',posts,
        'amount_cents',amount_cents,
        'currency',currency
      )
      order by posts
    ),
    '[]'::jsonb
  ) into v_packages
  from gef_private.work_post_credit_packages
  where active=true;

  return jsonb_build_object(
    'eligible',v_code='eligible',
    'eligibility_code',v_code,
    'public_profile_slug',case when v_public_ready then v_public.slug else null end,
    'free_limit',4,
    'free_used',v_free_used,
    'free_remaining',greatest(0,4-v_free_used),
    'purchased_remaining',v_purchased,
    'packages',v_packages
  );
end
$$;

create or replace function public.gef_create_work_opportunity(
  p_contractor uuid,
  p_operation_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_existing public.work_opportunities%rowtype;
  v_summary jsonb;
  v_free_used integer;
  v_purchased integer;
  v_source text;
  v_id uuid;
  v_languages text[];
  v_today date;
begin
  if p_contractor is null
     or p_operation_key is null
     or length(p_operation_key) not between 12 and 160
     or p_payload is null then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gef-work-post:'||p_contractor::text,0));

  select * into v_existing
  from public.work_opportunities
  where operation_key=p_operation_key
  limit 1;

  if found then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'opportunity_id',v_existing.id,
      'posting_source',v_existing.posting_source,
      'status',v_existing.status
    );
  end if;

  v_summary := public.gef_work_post_summary(p_contractor);
  if coalesce((v_summary->>'eligible')::boolean,false) is not true then
    return jsonb_build_object(
      'ok',false,
      'code',v_summary->>'eligibility_code',
      'summary',v_summary
    );
  end if;

  v_today := (now() at time zone 'America/New_York')::date;
  if nullif(p_payload->>'work_date','')::date < v_today then
    return jsonb_build_object('ok',false,'code','work_date_in_past');
  end if;

  select coalesce(array_agg(value),array[]::text[]) into v_languages
  from jsonb_array_elements_text(coalesce(p_payload->'languages','[]'::jsonb)) t(value);

  v_free_used := coalesce((v_summary->>'free_used')::integer,0);
  v_purchased := coalesce((v_summary->>'purchased_remaining')::integer,0);

  if v_free_used < 4 then
    v_source:='monthly_free';
  elsif v_purchased > 0 then
    v_source:='purchased_credit';
  else
    return jsonb_build_object(
      'ok',false,
      'code','quota_exceeded',
      'summary',v_summary
    );
  end if;

  insert into public.work_opportunities(
    posted_by,operation_key,opportunity_type,service_category,task_label,
    zip_code,description,pay_cents,pay_basis,work_date,start_time,
    workers_needed,max_contacts,languages,posting_source,status
  )
  values(
    p_contractor,
    p_operation_key,
    p_payload->>'opportunity_type',
    p_payload->>'service_category',
    nullif(btrim(p_payload->>'task_label'),''),
    p_payload->>'zip_code',
    p_payload->>'description',
    (p_payload->>'pay_cents')::bigint,
    coalesce(nullif(p_payload->>'pay_basis',''),'day'),
    (p_payload->>'work_date')::date,
    nullif(p_payload->>'start_time','')::time,
    (p_payload->>'workers_needed')::smallint,
    (p_payload->>'max_contacts')::smallint,
    v_languages,
    v_source,
    'open'
  )
  returning id into v_id;

  if v_source='purchased_credit' then
    insert into gef_private.work_post_credit_ledger(
      contractor_id,amount_posts,entry_type,opportunity_id,operation_key
    )
    values(
      p_contractor,-1,'consume',v_id,'consume:'||p_operation_key
    );
    v_purchased := v_purchased-1;
  end if;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'opportunity_id',v_id,
    'posting_source',v_source,
    'status','open',
    'free_limit',4,
    'free_used',v_free_used + case when v_source='monthly_free' then 1 else 0 end,
    'free_remaining',greatest(0,4-(v_free_used + case when v_source='monthly_free' then 1 else 0 end)),
    'purchased_remaining',v_purchased
  );
exception
  when invalid_text_representation or numeric_value_out_of_range or check_violation then
    return jsonb_build_object('ok',false,'code','invalid_request');
end
$$;

revoke all on function public.gef_work_post_summary(uuid) from public,anon,authenticated;
revoke all on function public.gef_create_work_opportunity(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gef_work_post_summary(uuid) to service_role;
grant execute on function public.gef_create_work_opportunity(uuid,text,jsonb) to service_role;


create or replace function public.gef_apply_work_opportunity(
  p_applicant uuid,
  p_opportunity uuid,
  p_operation_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_profile public.work_profiles%rowtype;
  v_op public.work_opportunities%rowtype;
  v_existing public.work_applications%rowtype;
  v_application uuid;
  v_contacts smallint;
  v_status text;
begin
  if p_applicant is null
     or p_opportunity is null
     or p_operation_key is null
     or length(p_operation_key) not between 12 and 160 then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gef-work-apply:'||p_opportunity::text,0));

  select * into v_existing
  from public.work_applications
  where operation_key=p_operation_key
  limit 1;

  if found then
    if v_existing.applicant_id<>p_applicant or v_existing.opportunity_id<>p_opportunity then
      return jsonb_build_object('ok',false,'code','operation_key_conflict');
    end if;
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'already_applied',true,
      'application_id',v_existing.id,
      'status',v_existing.status
    );
  end if;

  select * into v_existing
  from public.work_applications
  where applicant_id=p_applicant and opportunity_id=p_opportunity
  limit 1;

  if found then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'already_applied',true,
      'application_id',v_existing.id,
      'status',v_existing.status
    );
  end if;

  select * into v_profile
  from public.work_profiles
  where user_id=p_applicant
  limit 1;

  if not found or v_profile.status<>'active' then
    return jsonb_build_object('ok',false,'code','work_profile_required');
  end if;

  select * into v_op
  from public.work_opportunities
  where id=p_opportunity
  for update;

  if not found then
    return jsonb_build_object('ok',false,'code','not_found');
  end if;

  if v_op.posted_by=p_applicant then
    return jsonb_build_object('ok',false,'code','self_application');
  end if;

  if v_op.status<>'open' then
    return jsonb_build_object('ok',false,'code','applications_closed');
  end if;

  if v_op.work_date < (now() at time zone 'America/New_York')::date then
    return jsonb_build_object('ok',false,'code','expired');
  end if;

  if v_op.contacts_used>=v_op.max_contacts or v_op.positions_filled>=v_op.workers_needed then
    return jsonb_build_object('ok',false,'code','applications_closed');
  end if;

  if not (v_op.service_category = any(v_profile.service_categories))
     or not (v_op.opportunity_type = any(v_profile.opportunity_types))
     or not (v_profile.languages && v_op.languages) then
    return jsonb_build_object('ok',false,'code','not_eligible');
  end if;

  if exists(
    select 1 from public.work_user_blocks b
    where (b.blocker_id=p_applicant and b.blocked_id=v_op.posted_by)
       or (b.blocker_id=v_op.posted_by and b.blocked_id=p_applicant)
  ) then
    return jsonb_build_object('ok',false,'code','blocked');
  end if;

  insert into public.work_applications(
    opportunity_id,applicant_id,operation_key,status,contact_released_at
  )
  values(
    p_opportunity,p_applicant,p_operation_key,'interested',now()
  )
  returning id into v_application;

  v_contacts := v_op.contacts_used + 1;
  v_status := case when v_contacts>=v_op.max_contacts then 'applications_closed' else 'open' end;

  update public.work_opportunities
  set contacts_used=v_contacts,status=v_status
  where id=p_opportunity;

  insert into public.work_notifications(
    recipient_id,actor_id,opportunity_id,application_id,notification_type,event_key
  )
  values(
    v_op.posted_by,p_applicant,p_opportunity,v_application,
    'application_received','work-application:'||v_application::text
  )
  on conflict(event_key) do nothing;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'already_applied',false,
    'application_id',v_application,
    'status','interested',
    'contacts_used',v_contacts,
    'max_contacts',v_op.max_contacts,
    'applications_closed',v_status='applications_closed'
  );
end
$$;

revoke all on function public.gef_apply_work_opportunity(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.gef_apply_work_opportunity(uuid,uuid,text) to service_role;


create or replace function public.gef_select_work_applicant(
  p_contractor uuid,
  p_application uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_app public.work_applications%rowtype;
  v_op public.work_opportunities%rowtype;
  v_worker public.work_profiles%rowtype;
  v_assignment public.work_assignments%rowtype;
  v_filled integer;
  v_new_status text;
  v_now timestamptz := now();
begin
  if p_contractor is null or p_application is null then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;

  select * into v_app
  from public.work_applications
  where id=p_application
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'code','application_not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gef-work-select:'||v_app.opportunity_id::text,0));

  select * into v_op
  from public.work_opportunities
  where id=v_app.opportunity_id
  for update;

  if not found or v_op.posted_by<>p_contractor then
    return jsonb_build_object('ok',false,'code','not_owner');
  end if;

  select * into v_assignment
  from public.work_assignments
  where application_id=p_application
  limit 1;

  if found then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'assignment_id',v_assignment.id,
      'opportunity_id',v_op.id,
      'application_id',v_app.id,
      'worker_id',v_app.applicant_id,
      'positions_filled',v_op.positions_filled,
      'workers_needed',v_op.workers_needed,
      'opportunity_status',v_op.status
    );
  end if;

  if v_op.status in ('filled','cancelled','expired') then
    return jsonb_build_object('ok',false,'code','opportunity_closed');
  end if;

  if v_app.status<>'interested' then
    return jsonb_build_object('ok',false,'code','application_not_selectable');
  end if;

  select * into v_worker
  from public.work_profiles
  where user_id=v_app.applicant_id
  limit 1;

  if not found or v_worker.status<>'active' then
    return jsonb_build_object('ok',false,'code','worker_unavailable');
  end if;

  select count(*)::integer into v_filled
  from public.work_assignments
  where opportunity_id=v_op.id
    and status in ('selected','completed');

  if v_filled>=v_op.workers_needed then
    update public.work_opportunities
    set positions_filled=v_filled,status='filled',closed_at=coalesce(closed_at,v_now)
    where id=v_op.id;
    return jsonb_build_object('ok',false,'code','positions_already_filled');
  end if;

  insert into public.work_assignments(
    opportunity_id,application_id,worker_id,status,selected_at
  )
  values(
    v_op.id,v_app.id,v_app.applicant_id,'selected',v_now
  )
  returning * into v_assignment;

  update public.work_applications
  set status='selected',selected_at=v_now
  where id=v_app.id;

  v_filled := v_filled + 1;

  if v_filled>=v_op.workers_needed then
    v_new_status := 'filled';

    update public.work_opportunities
    set positions_filled=v_filled,status='filled',closed_at=v_now
    where id=v_op.id;

    update public.work_applications
    set status='declined'
    where opportunity_id=v_op.id
      and status='interested'
      and id<>v_app.id;

    insert into public.work_notifications(
      recipient_id,actor_id,opportunity_id,application_id,notification_type,event_key
    )
    select
      a.applicant_id,
      p_contractor,
      v_op.id,
      a.id,
      'application_closed',
      'work-closed:'||v_op.id::text||':'||a.id::text
    from public.work_applications a
    where a.opportunity_id=v_op.id
      and a.status='declined'
    on conflict(event_key) do nothing;
  else
    v_new_status := case
      when v_op.contacts_used>=v_op.max_contacts then 'applications_closed'
      else 'open'
    end;

    update public.work_opportunities
    set positions_filled=v_filled,status=v_new_status,closed_at=null
    where id=v_op.id;
  end if;

  insert into public.work_notifications(
    recipient_id,actor_id,opportunity_id,application_id,notification_type,event_key
  )
  values(
    v_app.applicant_id,
    p_contractor,
    v_op.id,
    v_app.id,
    'application_selected',
    'work-selected:'||v_app.id::text
  )
  on conflict(event_key) do nothing;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'assignment_id',v_assignment.id,
    'opportunity_id',v_op.id,
    'application_id',v_app.id,
    'worker_id',v_app.applicant_id,
    'positions_filled',v_filled,
    'workers_needed',v_op.workers_needed,
    'opportunity_status',v_new_status,
    'filled',v_new_status='filled'
  );
end
$$;

revoke all on function public.gef_select_work_applicant(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gef_select_work_applicant(uuid,uuid) to service_role;


create table gef_private.work_match_jobs(
  opportunity_id uuid primary key references public.work_opportunities(id) on delete cascade,
  status text not null default 'pending'
    check(status in ('pending','processing','processed','failed','cancelled')),
  attempts integer not null default 0 check(attempts between 0 and 100),
  matched_count integer not null default 0 check(matched_count >= 0),
  email_queued_count integer not null default 0 check(email_queued_count >= 0),
  sms_queued_count integer not null default 0 check(sms_queued_count >= 0),
  last_error_code text check(last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create table gef_private.work_notification_outbox(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.work_opportunities(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid references public.work_notifications(id) on delete cascade,
  channel text not null check(channel in ('email','sms')),
  status text not null default 'pending'
    check(status in (
      'pending','processing','dry_run','sent','blocked_no_consent',
      'blocked_missing_destination','skipped_not_urgent','cancelled','failed'
    )),
  event_key text not null unique check(length(event_key) between 12 and 200),
  attempts integer not null default 0 check(attempts between 0 and 100),
  provider text,
  provider_message_id text,
  last_error_code text check(last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index work_match_jobs_status_idx on gef_private.work_match_jobs(status,updated_at);
create index work_notification_outbox_pending_idx on gef_private.work_notification_outbox(status,created_at);
create index work_notification_outbox_recipient_idx on gef_private.work_notification_outbox(recipient_id,channel,created_at desc);
create index work_notification_outbox_opportunity_idx on gef_private.work_notification_outbox(opportunity_id,channel,status);

alter table gef_private.work_match_jobs enable row level security;
alter table gef_private.work_notification_outbox enable row level security;
revoke all on gef_private.work_match_jobs from public,anon,authenticated;
revoke all on gef_private.work_notification_outbox from public,anon,authenticated;
grant select,insert,update on gef_private.work_match_jobs to service_role;
grant select,insert,update on gef_private.work_notification_outbox to service_role;

create trigger work_match_jobs_touch_updated_at
before update on gef_private.work_match_jobs
for each row execute function gef_private.work_touch_updated_at();

create trigger work_notification_outbox_touch_updated_at
before update on gef_private.work_notification_outbox
for each row execute function gef_private.work_touch_updated_at();

create or replace function gef_private.enqueue_work_match_job()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  insert into gef_private.work_match_jobs(opportunity_id,status)
  values(new.id,'pending')
  on conflict(opportunity_id) do nothing;
  return new;
end
$$;

create or replace function gef_private.cancel_work_delivery_on_close()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.status <> 'open' and old.status is distinct from new.status then
    update gef_private.work_match_jobs
    set status='cancelled',processed_at=coalesce(processed_at,now()),last_error_code=null
    where opportunity_id=new.id and status in ('pending','processing','failed');

    update gef_private.work_notification_outbox
    set status='cancelled',delivered_at=coalesce(delivered_at,now()),last_error_code=null
    where opportunity_id=new.id and status in ('pending','processing');
  end if;
  return new;
end
$$;

create trigger work_opportunities_enqueue_match_job
after insert on public.work_opportunities
for each row execute function gef_private.enqueue_work_match_job();

create trigger work_opportunities_cancel_pending_delivery
after update of status on public.work_opportunities
for each row execute function gef_private.cancel_work_delivery_on_close();

create or replace function public.gef_claim_work_match_job(p_opportunity uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_job gef_private.work_match_jobs%rowtype;
  v_op public.work_opportunities%rowtype;
begin
  if p_opportunity is null then
    return jsonb_build_object('claimed',false,'code','invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gef-work-match:'||p_opportunity::text,0));

  select * into v_op
  from public.work_opportunities
  where id=p_opportunity
  limit 1;

  if not found then
    return jsonb_build_object('claimed',false,'code','not_found');
  end if;

  select * into v_job
  from gef_private.work_match_jobs
  where opportunity_id=p_opportunity
  for update;

  if not found then
    insert into gef_private.work_match_jobs(opportunity_id,status)
    values(p_opportunity,'pending')
    returning * into v_job;
  end if;

  if v_op.status<>'open'
     or v_op.contacts_used>=v_op.max_contacts
     or v_op.positions_filled>=v_op.workers_needed then
    update gef_private.work_match_jobs
    set status='cancelled',processed_at=coalesce(processed_at,now()),last_error_code=null
    where opportunity_id=p_opportunity;
    return jsonb_build_object('claimed',false,'code','opportunity_closed');
  end if;

  if v_job.status='processed' or v_job.status='cancelled' then
    return jsonb_build_object('claimed',false,'code',v_job.status);
  end if;

  if v_job.status='processing' and v_job.updated_at > now()-interval '5 minutes' then
    return jsonb_build_object('claimed',false,'code','already_processing');
  end if;

  update gef_private.work_match_jobs
  set status='processing',attempts=attempts+1,last_error_code=null,processed_at=null
  where opportunity_id=p_opportunity
  returning * into v_job;

  return jsonb_build_object(
    'claimed',true,
    'attempt',v_job.attempts,
    'opportunity_id',p_opportunity
  );
end
$$;

create or replace function public.gef_record_work_match(
  p_opportunity uuid,
  p_recipient uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_op public.work_opportunities%rowtype;
  v_profile public.work_profiles%rowtype;
  v_consent public.work_signup_consents%rowtype;
  v_notification uuid;
  v_email_status text;
  v_sms_status text;
  v_urgent boolean;
begin
  if p_opportunity is null or p_recipient is null then
    return jsonb_build_object('ok',false,'code','invalid_request');
  end if;

  select * into v_op
  from public.work_opportunities
  where id=p_opportunity
  limit 1;

  if not found
     or v_op.status<>'open'
     or v_op.contacts_used>=v_op.max_contacts
     or v_op.positions_filled>=v_op.workers_needed then
    return jsonb_build_object('ok',false,'code','opportunity_closed');
  end if;

  if v_op.posted_by=p_recipient then
    return jsonb_build_object('ok',false,'code','self_match');
  end if;

  select * into v_profile
  from public.work_profiles
  where user_id=p_recipient
  limit 1;

  if not found or v_profile.status<>'active' then
    return jsonb_build_object('ok',false,'code','profile_inactive');
  end if;

  if not (v_op.service_category = any(v_profile.service_categories))
     or not (v_op.opportunity_type = any(v_profile.opportunity_types))
     or not (v_profile.languages && v_op.languages) then
    return jsonb_build_object('ok',false,'code','profile_mismatch');
  end if;

  if exists(
    select 1 from public.work_user_blocks b
    where (b.blocker_id=p_recipient and b.blocked_id=v_op.posted_by)
       or (b.blocker_id=v_op.posted_by and b.blocked_id=p_recipient)
  ) then
    return jsonb_build_object('ok',false,'code','blocked');
  end if;

  select * into v_consent
  from public.work_signup_consents
  where user_id=p_recipient
  limit 1;

  insert into public.work_notifications(
    recipient_id,actor_id,opportunity_id,application_id,notification_type,event_key
  )
  values(
    p_recipient,
    v_op.posted_by,
    p_opportunity,
    null,
    'work_match',
    'work-match:'||p_opportunity::text||':'||p_recipient::text
  )
  on conflict(event_key) do update
  set event_key=excluded.event_key
  returning id into v_notification;

  v_email_status := case
    when v_profile.email_notifications is not true then 'blocked_no_consent'
    when v_consent.user_id is null or length(btrim(coalesce(v_consent.contact_email,'')))<5 then 'blocked_missing_destination'
    else 'pending'
  end;

  v_urgent := v_op.work_date <= ((now() at time zone 'America/New_York')::date + 1);

  v_sms_status := case
    when not v_urgent then 'skipped_not_urgent'
    when v_profile.sms_opt_in is not true or v_profile.sms_opt_in_at is null then 'blocked_no_consent'
    when v_consent.user_id is null or v_consent.sms_opt_in is not true or v_consent.sms_opt_in_at is null then 'blocked_no_consent'
    when length(btrim(coalesce(v_consent.sms_phone_e164,'')))<10 then 'blocked_missing_destination'
    else 'pending'
  end;

  insert into gef_private.work_notification_outbox(
    opportunity_id,recipient_id,notification_id,channel,status,event_key
  )
  values(
    p_opportunity,p_recipient,v_notification,'email',v_email_status,
    'work-email:'||p_opportunity::text||':'||p_recipient::text
  )
  on conflict(event_key) do nothing;

  insert into gef_private.work_notification_outbox(
    opportunity_id,recipient_id,notification_id,channel,status,event_key
  )
  values(
    p_opportunity,p_recipient,v_notification,'sms',v_sms_status,
    'work-sms:'||p_opportunity::text||':'||p_recipient::text
  )
  on conflict(event_key) do nothing;

  return jsonb_build_object(
    'ok',true,
    'notification_id',v_notification,
    'email_queued',v_email_status='pending',
    'sms_queued',v_sms_status='pending',
    'email_status',v_email_status,
    'sms_status',v_sms_status
  );
end
$$;

create or replace function public.gef_finish_work_match_job(
  p_opportunity uuid,
  p_matched integer,
  p_email_queued integer,
  p_sms_queued integer,
  p_success boolean,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_opportunity is null then
    return jsonb_build_object('ok',false);
  end if;

  update gef_private.work_match_jobs
  set
    status=case when p_success then 'processed' else 'failed' end,
    matched_count=greatest(0,coalesce(p_matched,0)),
    email_queued_count=greatest(0,coalesce(p_email_queued,0)),
    sms_queued_count=greatest(0,coalesce(p_sms_queued,0)),
    last_error_code=case when p_success then null else left(coalesce(p_error_code,'processing_failed'),120) end,
    processed_at=case when p_success then now() else null end
  where opportunity_id=p_opportunity
    and status<>'cancelled';

  return jsonb_build_object('ok',true);
end
$$;

create or replace function public.gef_claim_work_deliveries(p_opportunity uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_open boolean;
  v_rows jsonb;
begin
  select (
    status='open'
    and contacts_used<max_contacts
    and positions_filled<workers_needed
  ) into v_open
  from public.work_opportunities
  where id=p_opportunity;

  if coalesce(v_open,false) is not true then
    update gef_private.work_notification_outbox
    set status='cancelled',delivered_at=coalesce(delivered_at,now())
    where opportunity_id=p_opportunity
      and status in ('pending','processing');

    return '[]'::jsonb;
  end if;

  with picked as (
    select id
    from gef_private.work_notification_outbox
    where opportunity_id=p_opportunity
      and (
        status='pending'
        or (status='processing' and updated_at <= now()-interval '5 minutes')
      )
    order by created_at,id
    limit 200
    for update skip locked
  ),
  claimed as (
    update gef_private.work_notification_outbox o
    set status='processing',attempts=o.attempts+1,last_error_code=null
    from picked p
    where o.id=p.id
    returning o.id,o.opportunity_id,o.recipient_id,o.notification_id,o.channel,o.event_key,o.attempts
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb)
  into v_rows
  from claimed;

  return v_rows;
end
$$;

create or replace function public.gef_complete_work_delivery(
  p_delivery uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_status not in ('dry_run','sent','cancelled','failed') then
    return jsonb_build_object('ok',false,'code','invalid_status');
  end if;

  update gef_private.work_notification_outbox
  set
    status=p_status,
    provider=left(nullif(p_provider,''),80),
    provider_message_id=left(nullif(p_provider_message_id,''),200),
    last_error_code=left(nullif(p_error_code,''),120),
    delivered_at=case when p_status in ('dry_run','sent','cancelled') then now() else null end
  where id=p_delivery
    and status='processing';

  return jsonb_build_object('ok',found);
end
$$;

revoke all on function gef_private.enqueue_work_match_job() from public,anon,authenticated;
revoke all on function gef_private.cancel_work_delivery_on_close() from public,anon,authenticated;
revoke all on function public.gef_claim_work_match_job(uuid) from public,anon,authenticated;
revoke all on function public.gef_record_work_match(uuid,uuid) from public,anon,authenticated;
revoke all on function public.gef_finish_work_match_job(uuid,integer,integer,integer,boolean,text) from public,anon,authenticated;
revoke all on function public.gef_claim_work_deliveries(uuid) from public,anon,authenticated;
revoke all on function public.gef_complete_work_delivery(uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.gef_claim_work_match_job(uuid) to service_role;
grant execute on function public.gef_record_work_match(uuid,uuid) to service_role;
grant execute on function public.gef_finish_work_match_job(uuid,integer,integer,integer,boolean,text) to service_role;
grant execute on function public.gef_claim_work_deliveries(uuid) to service_role;
grant execute on function public.gef_complete_work_delivery(uuid,text,text,text,text) to service_role;

commit;
