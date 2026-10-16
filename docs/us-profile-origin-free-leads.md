# GetEstimateFast US — Profile-Sourced Free Contact Flow

STATUS: **Draft implementation.** No hosted migration applied, no merge, no Production deploy, no real emails, SMS or payments.

## Business rule

A professional signs up for free, creates a public profile, shares it, and requests authentic reviews. Visitors can use "Request a Free Estimate" without seeing the professional's phone number or email.

The customer is explicitly told that the request will be reviewed by GetEstimateFast, made available to the professional whose profile they visited and may also be offered to other eligible local professionals through the marketplace. Consent to contact regarding that request is separate from marketing SMS.

The server resolves a published, active US professional profile slug into its authoritative owner. No client-supplied contractor ID or price is trusted. In one SQL transaction the server writes the lead and permanent origin association with the submitted consent. The normal admin review process starts at "new" and approves to "qualified" after validation. Once qualified, the profile owner can view the contact through an authenticated, auditable $0 entitlement; this never uses wallet balance or counts as a paid buyer slot. After publication, the same anonymized opportunity is available for normal marketplace pricing to other matching professionals. A database trigger prevents purchase and charging for the origin professional.

## What's implemented in code

- Public professional page always hides direct phone/email at the API and HTML level during the MVP and has an estimate CTA; existing share and review UI remain.
- Independent visitor form with Florida ZIP, category, description, contact details, honeypot, explicit multiple-provider consent and privacy notice.
- Server-side validator, rate limiting, Development-only intake feature flag, and atomic database RPC for profile attribution + lead persistence.
- Prepared private schema for source mapping and free-contact access audit.
- Protected list/reveal API bound to authenticated contractor identity and administrative validation.
- Contractor workspace panel "Requests from my public profile" with pending, qualified and published status and free contact action.
- DB prevention of the originating professional purchasing a paid contact that came from their profile.
- No change to existing US buyer quote/purchase limits or Stripe wallet.
- Specific branch cannot deploy automatically and must pass safety preflight.
- Existing US profile review invitations and moderation remain intact.
- Automated HTTP/policy/static invariants tests in GitHub Actions; SQL remains to be tested in isolated disposable PostgreSQL.

## Before anyone uses it live

1. Complete GitHub review and offline tests.
2. Review all copy and the privacy notice for US-only contact sharing rules.
3. Validate prepared migration in disposable Postgres, especially private RLS/grants, UPSERT idempotency, the debit rollback trigger, and contact access after admin review.
4. With separate authorization, apply migration **only to the GetEstimateFast Development database**, confirm advisor warnings.
5. Configure branch-scoped isolated Preview settings without real SMS or money. The request feature is off by default until GETESTIMATEFAST_PROFILE_REQUESTS_ENABLED=true is explicitly approved.
6. Send one synthetic profile request in Development, verify attribution, admin queue, approval, free owner contact, published opportunity for another pro, and blocked owner checkout.
7. Integrate the separately prepared notification outbox when it has been safely deployed; preview intentionally sends no real messages.
8. After a satisfactory MVP trial, discuss Production rollout separately.

## Platform separation

This is a standalone US implementation with independent code, Vercel project, Supabase project, credentials and US data. No dependencies, cross-links, user sharing or database synchronization with any Brazilian platform.
