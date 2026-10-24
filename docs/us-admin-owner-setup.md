# Administrative account and overview — GetEstimateFast US

Admin login already exists via Supabase Auth and `public.admin_users(user_id)`, with server-side bearer token validation. Read-only Development inspection found **one linked administrator** but the email identity was not confirmed through approved tools. Do not create a duplicate account, claim that `admin@getestimatefast.com` is already authorized, or reset any existing password.

The owner should inspect [GetEstimateFast Development Auth Users](https://supabase.com/dashboard/project/cpjsbijgijeyrwjpuciv/auth/users) and verify the appropriate email/UUID. If the target user does not exist, use the official Supabase Auth invitation workflow; the owner sets their password through the email. If an existing correct user is missing from `admin_users`, grant access only after explicit owner verification/approval, never by user metadata. No hosted modifications were made here.

The admin UI now combines an at-a-glance overview, existing lead review, existing professional moderation, and links to existing marketplace financial/pricing screens. It does not activate payments/SMS or expose customer PII in the summary counts. No new database tables; API authorizes with `requireAdmin` before fixed-count reads.

Run `node --test tests/us-admin-overview.test.js`, review the GitHub draft PR and test the login in a safe Development deployment after explicitly approving the hosted test. This branch is blocked from automatic Vercel deployments.
