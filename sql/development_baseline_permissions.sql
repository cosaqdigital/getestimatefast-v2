-- PREPARED ONLY: getestimatefast-development / cpjsbijgijeyrwjpuciv.
-- Review and approve before remote execution. Preserve the built-in RLS event trigger.
begin;
do $$
declare v_oid oid;
begin
 v_oid:=to_regprocedure('public.rls_auto_enable()');
 if v_oid is not null then
  if (select prorettype from pg_proc where oid=v_oid)<>'event_trigger'::regtype then
   raise exception 'Unexpected rls_auto_enable function; review before changing grants';
  end if;
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
commit;
