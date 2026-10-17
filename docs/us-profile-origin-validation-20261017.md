# PR 70 — profile-origin Development validation, 2026-10-17

**Current status: hosted acceptance NOT complete. Vercel login is resolved.** An authenticated browser opened the professional profile and submitted the synthetic form, which failed with `Request origin not allowed.` The page's referrer policy conflicts with its native same-origin POST. The runtime correction and regression tests in this revision still require an explicit Preview deployment and a new browser walkthrough.

## Follow-up: authenticated browser reproduction and policy correction

### Observed in the hosted browser

- Signed in interactively to Vercel using the existing account. Deployment Protection remains enabled. No shareable bypass link was created; the attempted share-link operation was rejected by automatic approval review, and interactive authentication was used instead.
- Opened the exact branch alias `/professionals/cosaquevitecorp` on the existing `972cf1b` runtime. Selected **Painting**, retained the synthetic customer details, accepted the displayed sharing consent, and submitted through **Send My Free Estimate Request**.
- Synthetic description marker: `PR70-20261017-BROWSER-01`.
- The browser navigated to `/api/profile-request` and displayed **We could not submit your request** and **Request origin not allowed.** This is an actual hosted form failure after login, not an authentication redirect.
- A fresh DOM read of the hosted profile confirmed a relative form action `/api/profile-request`, method `post`, and `<meta name="referrer" content="no-referrer">`.
- The browser tooling did not expose a network request capture. The precise outgoing `Origin` header was not directly observed.

### Root cause and minimal correction

`api/public-profile.js` sets `Referrer-Policy: no-referrer`, and `api/_lib/public-profile-html.js` repeats that policy in a meta element. For a native non-CORS POST, the [Fetch Standard, section 3.2](https://fetch.spec.whatwg.org/#origin-header), specifies an opaque serialized `Origin` value of `null` under `no-referrer`. The intake handler correctly rejects the literal string `"null"`. This source-level conflict explains the observed error; the corrected hosted POST remains the required acceptance check.

This revision changes only those two policy values to `same-origin`. The native form can then preserve its origin when submitting to its own site. Referrer information remains withheld for cross-origin destinations. The exact configured host allowlist, rejection of external/opaque origins, signed profile attribution, synthetic-only mode, and CSP `form-action 'self'` are retained.

### Regression evidence

Added two cases to `tests/us-profile-origin-referrals.test.js`:

1. Invoke the real public-profile handler with mocked Development backend responses and verify the actual HTTP policy, exactly one matching meta policy, native relative POST action, and self-only form CSP. The real preview preflight remains enabled.
2. Invoke the real intake handler with literal `Origin: null`; require HTTP 403, the origin error message, and zero database calls.

On Node v24.19.0, the new targeted suite against the old runtime produced **18 tests: 17 passed, 1 failed**, specifically `no-referrer` versus expected `same-origin`. After the two runtime replacements, **18 passed, 0 failed/cancelled/skipped** with both commands:

```sh
node tests/us-profile-origin-referrals.test.js
node --test --test-isolation=none tests/us-profile-origin-referrals.test.js
```

The earlier 53-test GitHub Actions result below belongs to revision `683d388`, before this correction. A new full-suite result must be checked on this revision. These automated checks do not replace hosted acceptance.

### Development read-only checks around this browser attempt

Baseline at `2026-10-17T06:52:43.830939Z` and a post-attempt check at approximately `06:53:19Z` both showed zero profile-origin leads and zero originator leads. The originator wallet remained USD 0 across paid, refund, promotional, and available balances; global ledger rows 7, contact purchases 1, originator purchases 0, payment intents 0, test checkout orders 0. All these counts were unchanged. No acceptance-request UUID was created. These checks used read-only transactions against `cpjsbijgijeyrwjpuciv` only.

### Exact continuation from this revision

1. Check this revision's GitHub Actions result, then explicitly deploy this PR source branch to **Preview** in the existing **getestimatefast-v2** Vercel project. `vercel.json` has automatic Git deployments disabled for `feat/us-admin-overview-20261015`; a push alone does not update the hosted runtime. Verify the deployment commit, branch, environment, and isolated Development backend before testing.
2. Keep Deployment Protection enabled. The current Vercel connector lists only `orcamento-brasil` and fails to access the GetEstimateFast deployment. Do not deploy into that other project. Use authorized access to the correct project; if the tool policy requires approval for a browser fallback, obtain that specific approval after the patch is ready.
3. Open a fresh profile page on the corrected preview, confirm the new policy, select Painting and submit the prefilled fictional example with consent. Require the actual receipt page and exactly one persisted lead; record its UUID.
4. Use the existing Development administrator to approve and publish that lead through the UI, then the existing originator account to verify contact access under **My free requests**, USD 0 access, persistence after refresh, and unchanged wallet/financial records. Verify privacy and the eligible peer's priced listing without making any purchase.

Application credentials have not yet been verified. Do not reset passwords or create duplicate accounts. The hosted submission, administrative approval/publication, and free professional access are still unfinished. Production and Orçamentos Brasil remain outside this work.

## Earlier audit — retained as historical evidence

The sections below record the earlier `683d388` audit, before interactive Vercel authentication and the browser reproduction described above. Its login blocker and no-runtime-fix conclusion are superseded by this follow-up; its rollback and 53-test results are historical evidence.

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

## Earlier login blocker and next action (superseded)

Navigating to the exact alias `/professionals/cosaquevitecorp` redirected to `https://vercel.com/login?...`; the observed heading was **Log in to Vercel**. No authenticated Vercel browser session exists in this chat. The CLI could refresh its existing credential and inspect deployment/configuration metadata, but that does not authenticate the browser. Protections were not disabled and no browser cookies or bypass tokens were injected.

The original submission failure cannot be diagnosed or attributed to origin validation without reaching the form. Supabase log-source aggregation was available, but no new hosted form attempt exists to correlate; aggregate logs are not evidence of submission success.

The immediate action at that earlier stage was to sign into Vercel in the browser tab kept with that chat. This login step is now complete; follow the current continuation above. After access is restored, perform the form submission, capture its request/response and lead ID, and then validate admin/professional sessions. Application credentials are not yet verified; do not create duplicate administrators or reset passwords. Use the existing administrator and Development originator accounts.

Development destinations derived from repository routes:

- [Cosaquevite profile](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/professionals/cosaquevitecorp)
- [Administrative review](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/admin.html)
- [Professional portal](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/contractor-portal.html)
- [Marketplace administration](https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app/marketplace-admin.html)

Only the profile URL was attempted in the browser; the other destinations are code-derived and await hosted verification. The current follow-up above supersedes this login-only continuation. Do not mark this PR browser-validated based on the SQL diagnostic or test count.
