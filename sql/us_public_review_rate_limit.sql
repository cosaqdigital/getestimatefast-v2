-- PREPARED ONLY. Persistent anonymous submission limit, salted client address hash.
begin;
create table gef_private.public_request_limits(
 subject_hash text not null check(subject_hash~'^[a-f0-9]{64}$'),
 hour_start timestamptz not null,requests integer not null,
 primary key(subject_hash,hour_start)
);
alter table gef_private.public_request_limits enable row level security;
revoke all on gef_private.public_request_limits from public,anon,authenticated;
grant select,insert,update on gef_private.public_request_limits to service_role;
create function public.gef_public_request_allowed(p_hash text,p_limit integer) returns boolean language plpgsql set search_path='' as $$
declare v_count integer;
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid rate limit';end if;
 insert into gef_private.public_request_limits(subject_hash,hour_start,requests) values(p_hash,date_trunc('hour',now()),1)
 on conflict(subject_hash,hour_start) do update set requests=gef_private.public_request_limits.requests+1 returning requests into v_count;
 return v_count<=p_limit;
end $$;
revoke all on function public.gef_public_request_allowed(text,integer) from public,anon,authenticated;
grant execute on function public.gef_public_request_allowed(text,integer) to service_role;
commit;
