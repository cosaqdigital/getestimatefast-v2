-- PREPARED ONLY. Preserve content/status/audits; no guessed Google identities.
begin;
create table gef_private.review_legacy_classifications(
 review_id uuid primary key references public.contractor_reviews(id) on delete restrict,
 prior_status text not null check(prior_status in ('pending','approved','rejected','hidden')),
 classification text not null check(classification='legacy_declared_identity'),
 classified_at timestamptz not null default now()
);
insert into gef_private.review_legacy_classifications(review_id,prior_status,classification)
 select r.id,r.status,'legacy_declared_identity' from public.contractor_reviews r
 where not exists(select 1 from gef_private.review_authenticated_identities ai where ai.review_id=r.id);
alter table gef_private.review_legacy_classifications enable row level security;
revoke all on gef_private.review_legacy_classifications from public,anon,authenticated;
grant select on gef_private.review_legacy_classifications to service_role;
create trigger immutable_review_legacy_classifications before update or delete on gef_private.review_legacy_classifications
 for each row execute function gef_private.reject_change();
commit;
