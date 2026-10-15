-- PREPARED ONLY. CLI unavailable; do not apply without separate approval.
-- Requires revised us-lead-notification-outbox.sql and public.leads.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create schema gef_attachments;
revoke all on schema gef_attachments from public,anon,authenticated;
grant usage on schema gef_attachments to service_role;
create table gef_attachments.batches(
 id uuid primary key,
 objects jsonb not null check(jsonb_typeof(objects)='array' and jsonb_array_length(objects) between 1 and 3),
 state text not null default 'pending' check(state in('pending','committed','cleanup','deleted')),
 created_at timestamptz not null default clock_timestamp(),
 cleaned_at timestamptz,
 expires_at timestamptz not null default clock_timestamp()+interval '10 minutes'
);
create index attachment_cleanup_due on gef_attachments.batches(expires_at) where state<>'committed';
create table gef_attachments.files(
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete restrict,
 batch_id uuid not null references gef_attachments.batches(id),
 object_path text not null unique,
 mime text not null check(mime in('image/jpeg','image/png','image/webp','application/pdf')),
 bytes integer not null check(bytes between 1 and 5242880),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 scan_state text not null default 'quarantined' check(scan_state in('quarantined','clean','rejected')),
 created_at timestamptz not null default clock_timestamp()
);
create index attachment_lead on gef_attachments.files(lead_id);
alter table gef_attachments.files enable row level security;
alter table gef_attachments.batches enable row level security;
revoke all on gef_attachments.files,gef_attachments.batches from public,anon,authenticated,service_role;
grant select,insert,update on gef_attachments.files,gef_attachments.batches to service_role;
-- No anon/authenticated policies. A private bucket alone is not enough if
-- existing broad storage policies allow access: restrictive guards below apply.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gef-lead-attachments','gef-lead-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy gef_attachment_no_client_access on storage.objects as restrictive
for all to public using(bucket_id<>'gef-lead-attachments') with check(bucket_id<>'gef-lead-attachments');

create function public.gef_reserve_attachment_batch(p_batch uuid,p_objects jsonb) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare o jsonb;
begin
 lock table gef_attachments.batches in share row exclusive mode;
 if (select count(*) from gef_attachments.batches where state<>'deleted')>=200 then raise exception 'ATTACHMENT_CAPACITY_REACHED';end if;
 if jsonb_typeof(p_objects) is distinct from 'array' or jsonb_array_length(p_objects) not between 1 and 3 then raise exception 'INVALID_MANIFEST';end if;
 for o in select value from jsonb_array_elements(p_objects) loop
  if not(o ?& array['path','mime','size','sha256']) or
   (o->>'path') !~ ('^'||p_batch::text||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|pdf)$') or
   o->>'mime' not in('image/jpeg','image/png','image/webp','application/pdf') or
   (o->>'size')::int not between 1 and 5242880 or (o->>'sha256') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_MANIFEST';end if;
 end loop;
 if (select count(distinct value->>'path') from jsonb_array_elements(p_objects))<>jsonb_array_length(p_objects) then raise exception 'INVALID_MANIFEST';end if;
 insert into gef_attachments.batches(id,objects) values(p_batch,p_objects);
 return true;
end $$;
create function public.gef_commit_attachment_batch(p_batch uuid,p_lead jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare b gef_attachments.batches;receipt jsonb;o jsonb;
begin
 select * into b from gef_attachments.batches where id=p_batch for update;
 if not found or b.state<>'pending' or clock_timestamp()>b.created_at+interval '2 minutes' then raise exception 'BATCH_UNAVAILABLE';end if;
 -- Replays never append, replace, disclose or adopt another visitor's files.
 receipt:=public.gef_persist_lead_and_notify(p_lead);
 if (receipt->>'duplicate')::boolean then raise exception 'DUPLICATE_ATTACHMENT_SUBMISSION';end if;
 for o in select value from jsonb_array_elements(b.objects) loop
  -- Storage committed object must exist under the reserved random key.
  if not exists(select 1 from storage.objects where bucket_id='gef-lead-attachments' and name=o->>'path'
    and (metadata->>'size')::bigint=(o->>'size')::bigint and metadata->>'mimetype'=o->>'mime') then raise exception 'UPLOAD_NOT_CONFIRMED';end if;
  insert into gef_attachments.files(lead_id,batch_id,object_path,mime,bytes,sha256)
  values((receipt->>'id')::uuid,p_batch,o->>'path',o->>'mime',(o->>'size')::int,o->>'sha256');
 end loop;
 update gef_attachments.batches set state='committed' where id=p_batch;
 return receipt||jsonb_build_object('attachments_complete',true);
end $$;
create function public.gef_claim_attachment_cleanup(p_batch uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare b gef_attachments.batches;
begin
 select * into b from gef_attachments.batches where id=p_batch for update;
 if not found or b.state='committed' or b.expires_at>clock_timestamp() then raise exception 'CLEANUP_DENIED';end if;
 update gef_attachments.batches set state='cleanup' where id=p_batch;
 return(select jsonb_agg(value->>'path') from jsonb_array_elements(b.objects));
end $$;
create function public.gef_finish_attachment_cleanup(p_batch uuid) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 update gef_attachments.batches set state='deleted',cleaned_at=clock_timestamp() where id=p_batch and state='cleanup';
 if not found then raise exception 'CLEANUP_DENIED';end if;
 return true;
end $$;
create function public.gef_admin_attachment(p_lead uuid,p_attachment uuid) returns jsonb
language sql security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('path',f.object_path,'scan_state',f.scan_state)
 from gef_attachments.files f join gef_attachments.batches b on b.id=f.batch_id
 where f.id=p_attachment and f.lead_id=p_lead and b.state='committed' and f.scan_state='clean'
$$;
create function public.gef_pending_attachment_cleanup() returns jsonb
language sql security invoker set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(id),'[]'::jsonb) from
 (select id from gef_attachments.batches where state<>'committed' and expires_at<clock_timestamp()
   and (state<>'deleted' or coalesce(cleaned_at,expires_at)>clock_timestamp()-interval '7 days')
   order by (state='deleted'),coalesce(cleaned_at,expires_at) limit 50) due
$$;
revoke all on function public.gef_pending_attachment_cleanup() from public,anon,authenticated;
grant execute on function public.gef_pending_attachment_cleanup() to service_role;
create function public.gef_list_lead_attachments(p_lead uuid) returns jsonb
language sql security invoker set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'mime',mime,'bytes',bytes,'scanState',scan_state)),'[]'::jsonb)
 from (select f.id,f.mime,f.bytes,f.scan_state from gef_attachments.files f
 join gef_attachments.batches b on b.id=f.batch_id where f.lead_id=p_lead and b.state='committed' order by f.id limit 3) files
$$;
revoke all on function public.gef_list_lead_attachments(uuid) from public,anon,authenticated;
grant execute on function public.gef_list_lead_attachments(uuid) to service_role;
revoke all on function public.gef_reserve_attachment_batch(uuid,jsonb),public.gef_commit_attachment_batch(uuid,jsonb),public.gef_claim_attachment_cleanup(uuid),public.gef_finish_attachment_cleanup(uuid),public.gef_admin_attachment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gef_reserve_attachment_batch(uuid,jsonb),public.gef_commit_attachment_batch(uuid,jsonb),public.gef_claim_attachment_cleanup(uuid),public.gef_finish_attachment_cleanup(uuid),public.gef_admin_attachment(uuid,uuid) to service_role;
commit;
