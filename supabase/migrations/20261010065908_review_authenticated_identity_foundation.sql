-- PREPARED ONLY. Requires all twenty approved Development baseline migrations.
begin;
alter table public.contractor_reviews alter column identity_hash drop not null;
alter table public.contractor_reviews add constraint review_id_owner_unique unique(id,contractor_id);
create table gef_private.review_authenticated_identities(
 review_id uuid primary key,
 contractor_id uuid not null,
 reviewer_user_id uuid references auth.users(id) on delete set null,
 provider text not null check(provider='google'),
 provider_subject text not null check(length(provider_subject) between 1 and 255 and provider_subject !~ '\s'),
 created_at timestamptz not null default now(),
 foreign key(review_id,contractor_id) references public.contractor_reviews(id,contractor_id) on delete restrict,
 constraint review_identity_user_unique unique(contractor_id,reviewer_user_id),
 constraint review_identity_google_unique unique(contractor_id,provider,provider_subject),
 check(reviewer_user_id is null or reviewer_user_id<>contractor_id)
);
alter table gef_private.review_authenticated_identities enable row level security;
revoke all on gef_private.review_authenticated_identities from public,anon,authenticated;
grant select,insert on gef_private.review_authenticated_identities to service_role;
commit;
