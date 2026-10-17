# PR 70 — profile-origin Development validation, 2026-10-17

**Status: hosted acceptance NOT complete.** The browser reached Vercel Login before the professional profile. No hosted form submission, admin approval, or professional login was performed. A passing rollback diagnostic is not a browser acceptance result.

## Confirmed starting point

- Repository: https://github.com/cosaqdigital/getestimatefast-v2
- Open PR: https://github.com/cosaqdigital/getestimatefast-v2/pull/70
- Source: `feat/us-admin-overview-20261015`; destination: `feat/us-mvp-home-pro-funnel-20261015`. No merge.
- Application commit audited: `972cf1ba0518ab857982f7673741e34b32268392`.
- GitHub deployment `7132533377` and authenticated Vercel deployment metadata agree on this commit. Vercel deployment `dpl_A8moN3tH7uXjZhZ9DZSU4HqaEcYB` is `READY`, Preview, on the PR source branch.
- Exact deployment: https://getestimatefast-v2-p4hoevxc3-get-estimate-fast.vercel.app
- Exact branch alias: https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app
- These are the two current official origins. Historical test fixtures contain an older deployment hostname; it is not the current deployment.
- Existing checkout contains unrelated Stripe work and untracked operational files. Preserved it; used a separate worktree, `getestimatefast-pr70`, on the PR source branch.
- No `AGENTS.md` was found in this checkout or its checked ancestors.

## Isolation and side effects

Authenticated Vercel API inspection of the exact branch configuration confirmed `GETESTIMATEFAST_SUPABASE_URL=https://cpjsbijgijeyrwjpuciv.supabase.co`, the same Development project ref, isolated backend `true`, profile requests `synthetic`, marketplace preview `true`, SMS `dry_run`, test checkout approval `false`, and general lead persistence `false`. The public origin is the exact branch alias above. Secret values were not printed or saved.

Supabase identifies `cpjsbijgijeyrwjpuciv` as `getestimatefast-development`. The Cosaquevite public profile is published, its contractor is active and verified, and Painting is among its categories. An active Painting USD pricing rule exists. Origin contractor: `3c02828a-30b5-4ab4-aa79-480f7ead5ec6`. Another active, verified Painting contractor exists: `40c1fdf0-3e0f-4ced-9642-d00a154b4dcc`.

All public/private application tables inspected have RLS enabled. No Edge Functions are deployed. Installed extensions do not include pg_net or pg_cron. Application trigger definitions inspected contain no external HTTP/email/SMS calls; no application function matched outbound HTTP/notification integrations. The profile intake and approve/publish handlers write to this database and do not call an email/SMS/payment provider. The paid marketplace actions remain blocked in the HTTP handler. This evidence covers these paths; the protected hosted runtime was not exercised.

No Production or Brazil database was modified or queried during this validation. No purchases, credits, messages, infrastructure, or Production deployments were created.

## Evidence and actual results

| Acceptance stage | Result |
| --- | --- |
| A: open profile, choose Painting, consent, submit, see receipt | **Blocked** at Vercel Login. No hosted POST, HTTP form response, or success message observed. |
| A: exactly one persisted hosted request | **Not performed**. Profile-origin lead count is zero. No retained acceptance-request identifier exists. |
| B: find, approve and publish through admin UI | **Not performed**. Actual Development RPCs pass the rollback diagnostic below. |
| C: originator sees free contact, refresh persists access | **Not performed in a browser**. Handler tests validate release only after publication, preview existence, and consent. |
| C: no debit/charge | **Passed in the Development SQL diagnostic**; not a hosted acceptance claim. Origin wallet remained USD 0; global ledger count 7, purchases 1, payment intents 0, test orders 0 before/after. Those 7/1 records pre-existed. |
| D: anonymous/other-account privacy | DB denies `anon` and `authenticated` direct SELECT on leads; sensitive RPC execution denied. Handler tests cover missing auth, hidden unpublished contacts and forged owner identifiers. Real separate-account browser/API sessions remain pending. |
| D: other Painting professional | Actual `list_contractor_opportunities` returned the diagnostic opportunity for the existing eligible peer; commercial preview and price terms remained present. No peer purchase attempted. |
| E: duplicate operation vs distinct new request | DB unique submission token preserved one row; a different token with identical fictitious contact details was accepted. Handler tests also cover retry ownership/source checks. |
| E: repeated approve/publish | Actual RPCs reject already-reviewed/already-published state; exactly one commercial terms record remains, no financial change. All diagnostic writes rolled back. |
| E: official/external origins | Focused handler/unit tests accept the two exact configured deployment/branch hosts and reject external, spoofed-suffix, arbitrary Vercel, and HTTP origins. Hosted origin tests remain pending. |

## Reproducible database diagnostic

`scripts/validate-profile-origin-development.sql` was executed via Supabase `execute_sql` against **only** `cpjsbijgijeyrwjpuciv`. It runs synthetic writes as `service_role` inside a PL/pgSQL exception subtransaction. Expected errors are matched explicitly; unexpected failures abort the test. A deliberate final exception rolls back every synthetic write, then the script verifies the lead is absent.

It exercised actual installed `admin_approve_lead`, `admin_publish_profile_opportunity_priced`, `list_contractor_opportunities`, `gef_commercial_previews`, and the paid-origin purchase trigger. It checked token conflict handling, distinct requests, immutable origin, premature publication rejection, approval/publication state, repeated-action rejection, peer listing, one terms record, origin purchase rejection, and unchanged wallet/financial counts. It did not fund wallets or complete a purchase.

Returned result: `PASS: reviewed publication, paid peer visibility, origin purchase guard, retries, immutable origin, unchanged finance, all writes rolled back`.

Independent follow-up query: zero profile-origin leads, zero `pr70-rollback@example.invalid` records, ledger 7, purchases 1, payment intents 0, test orders 0, origin wallet paid/promotional/refund/available all zero. Generated diagnostic UUIDs were rolled back, not retained as acceptance evidence.

## Changes and automated validation

No application defect was established behind the authentication gate, so no runtime fix or origin-policy relaxation was made. The historical origin fix remains intact. Added four tests to `tests/us-profile-origin-referrals.test.js`: verified same-operation retries including mismatched owner/source, distinct legitimate operation tokens, external-origin rejection before DB access, and forged owner identifiers with missing preview/consent.

Executed from this worktree, initially **49 passed**, then **53 passed, 0 failed/cancelled/skipped** after these tests:

```powershell
node --test tests/us-durable-lead-intake.test.js tests/us-legacy-intake-routing.test.js tests/us-mvp-home-pro.test.js tests/us-admin-overview.test.js tests/us-professional-ux.test.js tests/us-profile-origin-referrals.test.js tests/us-referral-auto-pricing.test.js
git diff --check
```

`git diff --check` passed. The full unrelated Stripe/local-Postgres test suite was not run. This change contains tests, the diagnostic script and this record only; it does not require a different application preview to exercise the same runtime code.

## Exact blocker and next action

Navigating to the exact alias `/professionals/cosaquevitecorp` redirected to `https://vercel.com/login?...`; the observed heading was **Log in to Vercel**. No authenticated Vercel browser session exists in this chat. The CLI could refresh its existing credential and inspect deployment/configuration metadata, but that does not authenticate the browser. Protections were not disabled and no browser cookies or bypass tokens were injected.

The original submission failure cannot be diagnosed or attributed to origin validation without reaching the form. Supabase log-source aggregation was available, but no new hosted form attempt exists to correlate; aggregate logs are not evidence of submission success.

Minimum immediate action: sign into Vercel in the browser tab kept with this chat and tell the agent to continue. After access is restored, perform the form submission, capture its request/response and lead ID, and then validate admin/professional sessions. Application credentials are not yet verified; do not create duplicate administrators or reset passwords. Use the existing administrator and Development originator accounts.

Development destinations derived from repository routes:

- [Cosaquevite profile](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/professionals/cosaquevitecorp)
- [Administrative review](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/admin.html)
- [Professional portal](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/contractor-portal.html)
- [Marketplace administration](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/marketplace-admin.html)

Only the profile URL was attempted in the browser; the other destinations are code-derived and await hosted verification. Continue acceptance A–E after login. Do not mark this PR browser-validated based on the SQL diagnostic or test count.
