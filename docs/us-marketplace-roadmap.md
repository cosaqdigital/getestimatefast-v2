# GetEstimateFast — Independent US marketplace implementation plan

## Non-negotiable separation
GetEstimateFast is a standalone United States marketplace. Do not communicate with, import from, or reuse any database, authentication, payments, API endpoint, account, user data, or runtime dependency of Orcamentos Brasil. Its business model may inspire features, but its infrastructure and operations remain independent.

## Delivery order and release gates

### Phase 1 — Reliable inbound requests (in progress)
- Dedicated `getestimatefast-prod` Supabase project, US East.
- Leads table with RLS enabled and backend-only insert access.
- Quote flow -> database -> email -> confirmation, validated in Preview with a synthetic lead.
- Before production: ensure safe duplicate prevention and abusive submission limits; add genuine consent and linked privacy information; test rejection and failure cases.
- Migrate eight old FormSubmit landing-page forms to the same backend one by one without breaking existing acquisition paths.
- Production acceptance: all live forms persist leads exactly once on normal retry, log a server-side request ID, and expose no customer PII publicly. Email is advisory; persistent lead record is primary.

### Phase 2 — Admin console (next)
- Separate administrator authentication and role authorization (server verified; never browser-only).
- Lead queue statuses: new -> qualified -> published -> closed; rejected separately.
- Qualification: client reachable, service category, location, project timing.
- Search by ZIP/city/service, audit actions, date filters; protect personal contact details.
- No public lead listing until access rules and abuse controls are in place.

### Phase 3 — Contractors
- Dedicated contractor registration/login, email verification, category selection.
- Operating area by ZIP and adjustable miles radius; distinguish unverified from verified license/insurance claims.
- Public professional profile including work photos and external-client review invitations, with review anti-fraud moderation.
- Separate contractor access to available lead summaries; never expose purchased contact before payment.

### Phase 4 — Pay-per-lead marketplace
- Opportunity matching by service and coverage area; alert only eligible contractors.
- Configurable limited purchase slots, fair lead expiry rules, and admin exceptions.
- USD checkout via an authorized US provider; signed webhook verifies settlement and prevents duplicate unlocking.
- Keep payment/lead access ledger and refund/dispute workflows.

### Phase 5 — Operations and trust
- Contractor ratings, report/moderation, complaint handling, privacy retention and deletion.
- Delivery reliability for email/SMS; messaging consent recorded.
- Automated regression tests, monitoring and deployment rollback strategy.

### Phase 6 — Go-live; then acquisition
- End-to-end customer -> admin -> contractor -> payment test, plus security and accessibility review.
- Launch after gated acceptance.
- Only then prioritize SEO/content, Google Business Profile, organic traffic, ads and city expansion.

## Current actual state — 2026-10-08
- Dedicated database and one Preview request persistence test are confirmed.
- Email notification of that test was observed.
- GitHub PR #31 remains a draft; production is NOT switched to persistent storage.
- Security/privacy/duplicate handling, older forms and marketplace remain incomplete.
- The live site has not received real customer leads as reported by the owner.

## Rule for every delivery
Use branch -> preview -> verification -> authorized production release, with no changes to Orcamentos Brasil.
