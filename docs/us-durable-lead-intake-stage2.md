# Stage 2: durable GetEstimateFast intake (US only)

## Purpose
Make database persistence mandatory before acknowledging a real lead. This branch is **not deployed**.

## Changes
- Fail closed if `LEAD_PERSISTENCE_ENABLED` is not explicitly `true`.
- Verify US-only Supabase project based on environment (`getestimatefast-development` for non-production, `getestimatefast-prod` for production). Other destinations are rejected.
- All supported native quote flows generate a UUID submission token. The API rejects missing/invalid tokens to avoid non-idempotent inserts.
- Insert with `on_conflict=submission_token`; duplicate results require a second DB read before a success redirect. Successful writes include a persistent UUID.
- Validate attachments before inserting. Email occurs after storage, is supplementary, and an email failure does not falsely tell a customer to submit again.
- No notification provider error body, customer PII or secret is logged by the new failure path.
- No changes to Supabase databases, production deployments, payment processing, SMS or any other platform.

## Release blockers
- **Email outbox** is not durable. Persisted requests still need a separate retry mechanism and admin visibility for notification failures.
- **Attachments are not stored** in private Supabase Storage. If email fails, the lead exists but its files are not recoverable. Address before commercial release.
- Rate limiting, consent UX, runtime browser tests and original-form behavior are not yet verified end to end.
- Only deploy after verifying production schema parity, indexed unique token, credentials, consent, backup, verified email sender and roll-back readiness.

## Tests
`node --test tests/us-durable-lead-intake.test.js tests/us-legacy-intake-routing.test.js`
All API network calls in these tests are mocked; no real data is submitted.
