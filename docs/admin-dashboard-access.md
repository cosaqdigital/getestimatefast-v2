# GetEstimateFast admin dashboard (Preview-only until authorized)

This panel uses the isolated GetEstimateFast Supabase project. Nothing connects to Orçamentos Brasil.

- Route: `/admin.html` (indexing disabled; server API is protected independently).
- Login is mediated through `/api/admin/login`. No database secrets enter the browser.
- The access token is kept in JS memory, not localStorage/cookies; closing or refreshing the page requires signing in again.
- Every private API call verifies the user's token with Supabase Auth and checks membership in `public.admin_users` on the server.
- No admin has been assigned. Granting one requires a verified Supabase Auth user UUID and explicit owner approval. Never accept an email address or client claims as authorization.
- `/api/admin/leads` returns up to 25 entries per page and optional status filtering; no public listing.
- `/api/admin/status` calls a transaction-safe database RPC to change status and write an event.
- Failures must not expose raw database errors or secrets.

## Acceptance gates
1. No admin configured => valid ordinary Supabase Auth users cannot see leads (403).
2. Missing/invalid Bearer => 401, even if they know the URL.
3. Explicitly approved admin => list works and updates create an audit record.
4. Multiple simultaneous status changes => concurrent mismatch rejected; no orphan history.
5. Network failure and expiry => no data leaks or silent success.
6. Test only in Preview, including mobile. Keep Production unchanged until all gates pass.
