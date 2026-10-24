# Contractor onboarding preview — GetEstimateFast only

## Implemented
- `contractor-portal.html` preview user interface, with secure login and profile details.
- `/api/contractor/login`: Supabase email/password sign in, requires verified email.
- `/api/contractor/profile`: backend verifies JWT with Supabase Auth, returns only the current user's profile; edit requests use server-derived user ID, category allowlist, ZIP validation and server-owned account status.
- `/api/contractor/signup`: preview endpoint using Supabase Auth signup, intentionally DISABLED until release gates met.
- `/api/admin/contractors`: admin-only list. `/api/admin/contractor-review`: admin-only approval/rejection through a transaction-safe RPC and audit records.
- Consent version/date columns added to private contractor_profiles table.

## Important preview gates
- `CONTRACTOR_SIGNUP_ENABLED` is unset and defaults to false. Public signup form stays hidden.
- `CONTRACTOR_PROFILE_EDITING_ENABLED` is unset and defaults to false. Profile writes return 503.
- Privacy notice and legally reviewed contractor terms have NOT been published. Do not turn on signup or editing before completing these policies; placeholder checkboxes are not adequate for production.
- No user can self-activate. All profiles remain pending until approved by admin.
- No access to leads or buyer contact data is created.
- User must have Supabase email confirmation completed to log in; URL allowlisting and email delivery should be tested before opening registration.
- Do not share Supabase service keys with browsers.

## Required testing before enabling
- 401 absent/invalid token; 403 unconfirmed email; prevent cross-account profile read/update.
- Register test contractor, verify confirmation, reject duplicate or missing signup fields and improper category/ZIP/radius.
- Verify no ability to pass `account_status` from client and prevent use of admin user ID to modify another person's profile.
- Approval and rejection events match account state transactionally; no leads visible.
- Deploy Preview and verify signup disabled by default.
- Define rate limiting and abuse controls before exposing public signup.
- Review all three nested draft PRs before main deployment.
