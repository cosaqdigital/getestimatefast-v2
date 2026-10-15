# US GetEstimateFast: independent legacy intake routing — stage 1

**Scope:** `cosaqdigital/getestimatefast-v2` only. No runtime dependencies on another platform, its repository, database, API, user accounts or billing.

## Confirmed problem
Eight legacy service landing pages rendered `#serviceLeadForm` and an empty `#stepsContainer`, while the loaded `assets/service-landing.js` expects `#serviceForm`, `.step` elements and a `data-service-key` body attribute. Their question UI did not match the loaded JS.

## This isolated change
- Replace eight obsolete form shells with accessible static links to the existing US guided request flows.
- Flooring and painting use the standard flow; kitchen uses its specialist flow.
- Bathroom uses an independent **manual-review** intake path and is not promoted as an automatically matched category.
- Preserve SEO titles, URLs, canonical links and informational copy.
- Record the originating landing filename in an allowlisted `Original Landing Page` field; the existing US API handles the data.
- Preserve existing server-side spam protection and database persistence controls.
- Disable Vercel automatic deployment on this branch; block preview lead submissions if manually built.

## Release gates (not performed)
1. Review changes and run `node --test tests/us-legacy-intake-routing.test.js` and `npm test` using synthetic fixtures.
2. Check desktop/mobile journeys, including bathroom manual review, ZIP, contact validation and landing-source attribution.
3. Verify write/duplicate protection in the isolated GetEstimateFast Development Supabase only, using synthetic data.
4. Before commercial release, verify US-only database credentials, Resend sender, privacy/consent copy, attachment handling, anti-spam, and `LEAD_PERSISTENCE_ENABLED=true`. When it is off, the API may email a request without storing it; **do not deploy this migration until that is resolved and tested**.
5. Verify conversion analytics after actual accepted submissions and define rollback.

**Explicit exclusions:** No merge, no deployment, no real lead submission, no email/SMS, no money movement, no Supabase database changes, no credentials read, no Brazilian source modification or data sharing.
