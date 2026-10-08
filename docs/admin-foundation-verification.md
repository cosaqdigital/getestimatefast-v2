# GetEstimateFast admin foundation - phase 2 preparation

- Dedicated Supabase project: `getestimatefast-prod` (US East). No connection to Orçamentos Brasil.
- Database tables: `leads`, `admin_users`, `lead_status_events`; all use RLS, with no public policies.
- Admin access deliberately **not active**: `admin_users` is empty. The next step must use Supabase Auth with verified identities and server-side authorization before any customer data can be read.
- Submission retries: newly loaded quote forms include a random UUID `Submission Token`. Database uniqueness and PostgREST `resolution=ignore-duplicates` prevent a second insert for the *same token*. Missing-token submissions still work for backward compatibility. This is **not** full spam/rate limiting and does not deduplicate two separately started requests.
- Emails: the initial request sends a notification; duplicate replays with the same token return confirmation without resending.
- Code exists only on this feature branch/preview. Do not publish until integration/regression tests pass.
- Required tests: (1) fresh request creates one row and email; (2) exact retry with same submission token creates no new row/email; (3) independent new token creates new row; (4) legacy form without token creates a row; (5) anonymous/authenticated API calls cannot select `leads` or `admin_users`; (6) no service-role/secret key exposed to HTML/JS.
- Next development: verified admin login and secure server-side leads listing, then status changes with audit entries.
