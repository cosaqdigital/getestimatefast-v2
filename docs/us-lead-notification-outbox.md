# Issue #63 — durable US lead notifications (draft; not installed)

Base: feat/us-persisted-leads-20261014 at 579d75df46635da3d06e839ba4989e70ddbda951 (draft #62, stacked on #61). This branch is feat/us-lead-notification-outbox-issue63-20261014. Its Vercel deploymentEnabled is false; no Cron is configured. No environment, hosted database, platform setting, payment/SMS path or external email was changed. No Brazilian platform, repository, credentials, data or API was accessed or reused.

## Persistence contract

`POST /api/lead` now calls `gef_persist_lead_and_notify` instead of inserting over REST and sending inline. The RPC inserts the lead with status new; an AFTER INSERT trigger inserts exactly one outbox intention in the same PostgreSQL transaction. Both trigger and RPC use SECURITY INVOKER, qualified object names and search_path=pg_catalog. There is no public SECURITY DEFINER function.

The RPC returns a success receipt only if a lead and its outbox item are verified. The unique submission_token index from the marketplace foundation prevents concurrent duplicate lead inserts; the unique lead_id in the outbox prevents duplicate intentions. Duplicate tokens return the original receipt, without updating lead fields or regenerating notifications. Trigger/RPC errors roll back the insertion. Missing migration returns failure with **no fallback** to an insert or provider send. Existing legacy leads without an outbox do not acquire jobs silently: their duplicate submissions fail verification until an operator separately approves a reconciliation policy. There is no automatic backfill.

Customer success depends on the committed lead and intent, never on provider availability. A request timeout may conceal a successful commit; retry uses the same submission token. Invalid attachments still fail before insertion. Attachments are validated only: **not persisted and not delivered by this queue**; persistent uploads remain a separate issue. Do not describe existing uploads as durable. Existing spam/Preview guards remain in place.

## Prepared SQL and privileges

`supabase/prepared-migrations/us-lead-notification-outbox.sql` is preparation SQL, not migration history. Supabase CLI was absent (`where.exe supabase`); it was not downloaded or invoked through npx. No timestamped migration was invented. Before any authorized installation, an operator must inspect `supabase --help`, create the versioned file using `supabase migration new`, copy/review the prepared SQL, and confirm the dedicated GetEstimateFast target and dependencies. Nothing in this PR applies it.

Dependencies: public.leads columns from getestimatefast_leads.sql plus submission_token and its unique index from getestimatefast_marketplace_foundation.sql; existing Supabase service_role/anon/authenticated. Installation must review the actual schema and default privileges separately. No hosted schema was read during implementation. The prepared SQL itself uses one transaction with lock/statement limits, so a missing dependency fails atomically. Existing rows are untouched.

Objects:

- Private schema gef_notifications; RLS-enabled lead_outbox (one lead FK, state, attempts, scheduling/lease timestamps and token, payload hash, sanitized error code, provider receipt ID). No customer names, addresses, email, phone, descriptions or attachment content copied into outbox.
- Private invoker trigger function enqueue_lead and AFTER INSERT trigger gef_lead_notification_intent on public.leads.
- Five public invoker RPCs: gef_persist_lead_and_notify, gef_claim_lead_notification, gef_prepare_lead_notification, gef_finish_lead_notification, gef_lead_notification_stats. All revoked from PUBLIC/anon/authenticated; EXECUTE granted only to service_role.

service_role needs schema USAGE, outbox SELECT/INSERT/UPDATE, existing lead INSERT/SELECT, and those RPC grants. Outbox grants are reset to this minimum (no DELETE/TRUNCATE). Supabase service_role's existing BYPASSRLS is relied upon, not newly granted. RLS has no client policy. Operators must verify schema exposure/default privileges in the authorized future preflight; gef_notifications must stay outside Data API exposed schemas. Exposed RPCs remain server-only even though their names are in public. No client receives the server key. Other privileged/owner identities inherently remain trusted; this does not isolate a compromised service_role.

## Worker, leases and retry

`POST /api/internal/lead-notifications` processes at most one job. There is no scheduler or public retry endpoint. It fails before any outbound call unless all of these hold:

- GETESTIMATEFAST_LEAD_NOTIFICATIONS_ENABLED=true and GETESTIMATEFAST_LEAD_NOTIFICATION_DELIVERY_APPROVED=true (both unset/false by default).
- VERCEL_ENV is exactly development. Every Preview and Production invocation is denied, regardless of flags. Protected branch list includes this new branch.
- A separate GETESTIMATEFAST_LEAD_NOTIFICATION_WORKER_SECRET, 32–128 base64url characters generated by a CSPRNG, matches the Bearer header through constant-time digest comparison. No credentials are supplied or generated in this change.
- Fixed Development project ref cpjsbijgijeyrwjpuciv and its HTTPS API; a configured server database key, RESEND_API_KEY, LEAD_TO_EMAIL and LEAD_FROM_EMAIL.

This is a Development-only implementation draft. The flags do not authorize sending; no actual values were configured. Future local/Development delivery and any production enablement require separate review and authorization. A future Production worker requires an explicit reviewed code/config change, not simply flipping a flag.

Claim is a single RPC transaction using FOR UPDATE SKIP LOCKED, one row, a fresh UUID lease token, five-minute lease, and attempt increment. A second independent session skips the locked row; once committed, an unexpired processing row is ineligible. Expired jobs may be reclaimed. Prepare/finish require the current token and an unexpired lease, so stale workers cannot acknowledge another owner's job. Prepare also requires at least 30 seconds remaining; outbound timeout is eight seconds, with another local lease check before sending. No heartbeats or unlimited extension.

States: pending → processing → sent/retry/exhausted; expired processing → processing with a different token, or exhausted. Maximum six claims, counting crashed attempts. Retry delay is 60, 120, 240, 480, 960 seconds (capped at one hour). No immediate retry in the same invocation. Claim performs bounded housekeeping of up to 100 exhausted/too-old items. Retry window closes 20 hours after first claim, leaving a margin below the provider's documented window. Retry-After is not currently interpreted; 429 follows the fixed backoff and consumes an attempt. This needs provider-rate/cadence review before enabling delivery.

Resend receives only a fixed message and internal persisted lead ID, enough for the team to find the authenticated administration record; no arbitrary form HTML, PII, secrets or files. The exact serialized provider payload is SHA-256 bound in the database before first send. A changed recipient/from/body under the same job is blocked rather than submitting a different payload with the same key. Failed prepare may also mean a shortening/stale lease: it never triggers a terminal acknowledgement, leaving bounded lease recovery available. Persistent payload drift eventually exhausts attempts/window without sending. No automatic manual replay of exhausted jobs is supplied. Provider account/key changes with ambiguous pending deliveries require a separate reconciliation review; a body hash alone cannot prove preservation of the provider's idempotency scope across accounts.

Resend uses stable Idempotency-Key `gef-lead-v1/<outbox-id>`. Its [official documentation](https://resend.com/docs/dashboard/emails/idempotency-keys) states a 24-hour retention window. This reduces duplicates; it does **not** establish exactly-once delivery. External effects remain at least once under ambiguous outcomes. A stalled process may resume around a lease/deadline boundary; fencing protects database acknowledgement, while provider idempotency protects identical sends within its window. Scheduler starvation, extreme process suspension beyond the provider window or future manual replay require an explicit operational decision. Never promise unlimited deduplication.

2xx with a valid provider ID is recorded as sent (provider accepted, not proof of mailbox delivery). 429/5xx/transport ambiguity produce bounded retries; other non-2xx responses, including idempotency conflicts, are terminal. Provider response bodies and exception text are never logged. A lost finish/COMMIT acknowledgement returns failure/uncertainty; it does not cause another provider request in that invocation. Database state/lease governs later recovery. Timeouts use AbortSignal and redirects are rejected. Each RPC is bounded at 10 seconds; provision a future runner budget above the worst-case approximately 38 seconds plus overhead, without increasing the lease arbitrarily.

## Administration

`GET /api/admin/lead-notifications` uses the existing requireAdmin flow: authenticated user + approved admin_users membership. Returns only aggregate state/error counts via the server RPC. No anonymous reads or resend operation; no worker secret in the response. Empty state/error maps mean zero observed jobs in the corresponding group. Failed/exhausted counts remain visible even though customer success was already acknowledged. Admin tooling/UI can consume this endpoint; no new public dashboard is introduced.

## Rollout and rollback gates (not performed)

1. Review #61/#62 dependencies and actual schema, unique index, grants, RLS, search_path and Data API exposure on the dedicated target under new authorization. Production remains untouched.
2. Generate/review a versioned migration using the CLI; approve DB changes separately. Keep delivery disabled, deploy/DB ordering planned, and do not enable intake until the RPC/trigger are present. There is no automatic deployment in this branch.
3. Validate a synthetic cohort and the API receipt/queue/admin counts; review retention of internal identifiers, provider payload/idempotency, rate limits, delivery budget and server-only credentials. No real customer data or sends in this PR.
4. Authorize a worker/scheduler and sender/recipient separately. No Cron activation is included. Review the provider's finite idempotency window and the at-least-once risk before any release.
5. Rollback: disable worker/intake first and wait for active leases/in-flight sends to settle. Preserve outbox and leads for audit; reconcile ambiguous provider outcomes. Prefer reverting application delivery while retaining schema. Reverting to the old inline-email application would reintroduce untracked sends and must not be automatic.
6. Removing new SQL objects is a separate approved migration after preserving pending/sent/exhausted metadata: drop the enqueue trigger first, then the five public RPCs, private trigger function, table/indexes and schema. Do not use DROP CASCADE against existing business objects; do not drop/change leads or their submission-token index. Dropping the queue loses pending work and is not an operational retry strategy.

## Tests and evidence

All API/provider calls use synthetic mocks. Additional local disposable PostgreSQL tests exercise the exact prepared SQL on synthetic roles/tables, including real independent sessions and held row locks; no hosted database/credentials are used. Full-suite results are recorded below and in the PR. No SQL is executed against Development or Production.

Focused scenarios: first insert, duplicate token, atomic rollback, missing migration/trigger, concurrent claims, fencing, expired lease, immutable payload, 429/5xx, retry delay, exhaustion/window expiry, failed acknowledgement, missing configuration, strong worker authentication, protected Preview/Production, public privilege denial, and administrative anonymous denial. No secrets/provider bodies in responses/logging. Tests do not validate hosted RLS/PostgREST caches or actual Resend behavior; those remain separately authorized rollout gates.

### Windows harness correction and initial failure

The first `npm test` on the unmodified native harness reported a failure in the existing development-installation test and remained incomplete with three native-test Node workers. Inspection found that embedded-postgres.stop uses taskkill /T on Windows; PostgreSQL auxiliary processes could outlive the original postmaster. The earlier four legacy PostgreSQL processes were never targeted. A guarded attempt to interrupt only the three Node test workers stopped at identity validation: CIM timestamps had microsecond precision versus the handle's 100ns timestamp. **No Kill was executed by that attempt.** No guard was loosened or retried to force termination. Inconclusive resources from that first run and their directories remain preserved for separately authorized diagnosis/recovery. Do not report that initial run as passing or fully cleaned up.

The necessary local test-harness correction is included in this PR:

- Fresh `gef-us-notification-tests-*` TEMP roots outside OneDrive, unique data directories and loopback-only ports; explicitly exclude legacy ports 56215, 59178, 50001, 49176 and 56961. Never accept a remote URL or adopt a preexisting cluster.
- Register run/controller/server identity, executable, data directory, port and lifecycle timestamps in a nonsecret test-resource journal, also copied to ignored test-output. No password/environment is journaled.
- Start only the retained own ChildProcess; use pg_ctl stop -m fast -w with a 10s server deadline/15s command deadline after original live-process, data directory, postmaster.pid and port checks. Confirm process exit and port release. No dependency .stop, taskkill, tree fallback or recursive deletion. Retain synthetic directories after shutdown.
- Close local clients before server shutdown, bound client release and startup probes, consume idle connection error events without printing server details. A first verification exposed idle-client 57P01 on administrative shutdown; corrected order was tested again.
- Keep per-operation startup/query/pg_ctl deadlines; use a 120s aggregate test budget for two initializations plus their verified shutdowns. The former 60s aggregate timed out under Windows load even with stopped journals. Limit npm test to two test files concurrently instead of the unbounded default that saturated the Windows/OneDrive run. This is concurrent execution, not a sequential-only workaround. A test-only preload denies default external fetch; mocks and local HTTP fixtures remain available.

Final focused harness/outbox SQL run: **14 passed, zero failed/cancelled**, approximately 51.97s; all three newly journaled clusters stopped with ports released. Earlier intermediate attempts included two teardown failures and one timing cancellation; they are not counted as final passes. API/routing/provider-mock batch: 40 passed before the final full-suite run. No tests were skipped or removed. CI retains the focused tests on Linux and adds the full synthetic suite on Windows without hosted credentials. The first full Linux CI attempt exposed two preexisting tests whose native controller intentionally rejects non-Windows platforms. The full job was therefore corrected to windows-latest, without weakening the platform guard, mocking it away or skipping tests.

An initial completed bounded full-suite run had 341 passes/1 failure: an existing pricing test used wall-clock time with an October 9 synthetic opportunity, which expired after the date rollover. Fixed only that test's explicit synthetic clock, not pricing behavior. A repeat exposed the aggregate two-cluster test budget described above; no claim of a pass for those preliminary runs.

Full-suite final result (Windows, Node 24, two concurrent test files): **npm test — 342 passed, 0 failed, 0 cancelled, 0 skipped; 335.08 seconds**. The exact prepared SQL, both concurrent-claim tests and all existing regressions were included. No pricing/application financial behavior was modified to obtain the pass. Sanitized local logs are ignored in test-output/issue63-acceptance.log; no logs, data directories or journal files are committed. This is local validation, not authorization for migration, deployment or delivery.
