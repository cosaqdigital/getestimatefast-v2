"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { Readable } = require("node:stream");
const Stripe = require("stripe");
const { SANDBOX_BRANCH, checkoutApproved, webhookApproved } = require("../api/_lib/stripe-policy");
const { inspect } = require("../scripts/preview-readiness");
const { createCheckout, readRaw, processWebhook, checkoutParameters } = require("../api/_lib/stripe-test");
const { reconcileTestOrder } = require("../api/_lib/stripe-reconciliation");
const { startRelay, createRelay } = require("../scripts/stripe-preview-relay");
const id = "20000000-0000-4000-8000-000000000010";
const origin = "https://synthetic-stripe-preview.vercel.app";
const settings = { expectedAccountId: "acct_1UOl9qH5rFe1usWF", key: "sk_test_SyntheticOnly", secret: "whsec_SyntheticOnly", origin };
const sdk = new Stripe(settings.key);
const order = () => ({ id, purpose: "contact", status: "reserved", currency: "USD", amount_cents: 1000,
  checkout_origin: origin, checkout_expires_at: new Date(Date.now() + 2400000).toISOString(), session_id: null });
const session = (o, changes = {}) => ({ id: "cs_test_safety", livemode: false, status: "open", payment_status: "unpaid",
  mode: "payment", currency: "usd", amount_total: o.amount_cents, expires_at: Math.floor(Date.parse(o.checkout_expires_at) / 1000),
  url: "https://checkout.stripe.com/c/pay/cs_test_safety", client_reference_id: o.id,
  metadata: { gef_order_id: o.id, gef_mode: "test", gef_purpose: o.purpose }, ...changes });
function env() { return { VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF", VERCEL_GIT_COMMIT_REF: SANDBOX_BRANCH,
  GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "cpjsbijgijeyrwjpuciv", GETESTIMATEFAST_SUPABASE_URL: "https://cpjsbijgijeyrwjpuciv.supabase.co",
  GETESTIMATEFAST_SUPABASE_SECRET_KEY: "synthetic-private", GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: "synthetic-public",
  GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_MARKETPLACE_PREVIEW: "true", GETESTIMATEFAST_SMS_MODE: "dry_run",
  GETESTIMATEFAST_STRIPE_MODE: "test", GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: "acct_1UOl9qH5rFe1usWF", GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "false", GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED: "false",
  GETESTIMATEFAST_PUBLIC_ORIGIN: origin, GETESTIMATEFAST_REVIEW_IDENTITY_SECRET: "synthetic-review-identity-minimum-32" }; }
test("infrastructure preflight survives Checkout approval; payment authorization remains separate and scoped", () => {
  const e = env(); assert.equal(inspect(e).ready, true); assert.equal(checkoutApproved(e), false);
  e.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED = "true";
  assert.equal(inspect(e).ready, true); assert.equal(checkoutApproved(e), false);
  e.GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED = "true"; assert.equal(checkoutApproved(e), false);
  e.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED = "true"; assert.equal(checkoutApproved(e), true);
  assert.equal(inspect(e).stripe_checkout_enabled, false);
  assert.equal(checkoutApproved({ ...e, VERCEL_PROJECT_ID: "other" }), false);
  assert.equal(checkoutApproved({ ...e, VERCEL_ENV: "production" }), false);
  assert.equal(checkoutApproved({ ...e, VERCEL_GIT_COMMIT_REF: "feat/review-already-submitted-20261012" }), false);
  assert.equal(checkoutApproved({ ...e, GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "wedsjubkttygxtpkopfj" }), false);
});
test("closing marketplace and new Checkout does not stop separately authorized pending webhooks", () => {
  const e = { ...env(), GETESTIMATEFAST_MARKETPLACE_PREVIEW: "false", GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED: "true", GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED: "true" };
  assert.equal(checkoutApproved(e), false); assert.equal(webhookApproved(e), true);
  assert.equal(webhookApproved({ ...e, GETESTIMATEFAST_SMS_MODE: "live" }), false);
  assert.equal(webhookApproved({ ...e, GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED: "false" }), false);
});
test("expiration remains frozen across an ambiguous network failure and bound retries use retrieval", async () => {
  const o = order(), calls = [], s = session(o); let failed = false;
  const client = { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, checkout: { sessions: { async create(params, options) {
    calls.push({ params, options }); if (!failed) { failed = true; throw Error("Synthetic response lost after provider commit"); } return s;
  }, async retrieve(value) { assert.equal(value, s.id); return s; } } } };
  await assert.rejects(createCheckout(o, settings, client));
  await createCheckout(o, settings, client); assert.deepEqual(calls[0], calls[1]);
  assert(calls[0].params.expires_at - Math.floor(Date.now() / 1000) >= 1860);
  await createCheckout({ ...o, session_id: s.id }, settings, client); assert.equal(calls.length, 2);
  await assert.rejects(createCheckout({ ...o, checkout_expires_at: new Date(Date.now() + 1800000).toISOString() }, settings, client));
  assert.equal(calls.length, 2);
  assert.throws(() => checkoutParameters({ ...o, amount_cents: 49 }, origin));
  assert.throws(() => checkoutParameters({ ...o, amount_cents: 100000000 }, origin));
  assert.throws(() => checkoutParameters(o, "https://changed.vercel.app"));
});
test("native Vercel JSON getter is never accessed and raw bytes retain valid Stripe signatures", async () => {
  const payload = JSON.stringify({ id: "evt_native", livemode: false, type: "customer.created" });
  const req = Readable.from([Buffer.from(payload.slice(0, 15)), Buffer.from(payload.slice(15))]);
  Object.defineProperty(req, "body", { get() { throw Error("Lazy JSON getter must not be accessed"); } });
  const bytes = await readRaw(req);
  const signature = sdk.webhooks.generateTestHeaderString({ payload, secret: settings.secret });
  assert.equal((await processWebhook(bytes, signature, settings, {}, { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, webhooks: sdk.webhooks })).ignored, true);
  await assert.rejects(readRaw(Readable.from(["é".repeat(5)]), 9));
  const aborted = Readable.from(["{}"]); aborted.aborted = true; await assert.rejects(readRaw(aborted));
});
test("event redelivery skips provider retrieval after persistence, including changed provider state", async () => {
  const raw = Buffer.from(JSON.stringify({ id: "evt_repeat", livemode: false, type: "checkout.session.expired", data: { object: { id: "cs_test_safety" } } }));
  const signature = sdk.webhooks.generateTestHeaderString({ payload: raw.toString(), secret: settings.secret });
  const repo = { event: async () => ({ session_id: "cs_test_safety" }) };
  const client = { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, webhooks: sdk.webhooks, checkout: { sessions: { retrieve() { throw Error("No network on completed event redelivery"); } } } };
  assert.equal((await processWebhook(raw, signature, settings, repo, client)).duplicate, true);
});
test("database bind and confirmation failures are retriable without another Checkout or duplicated payment", async () => {
  const o = order(), s = session(o, { status: "complete", payment_status: "paid", payment_intent: "pi_recovery" });
  let bindFailures = 1, confirmationFailures = 1, commits = 0;
  const repo = { order: async () => ({ ...o }), bind: async (_, value) => { if (bindFailures--) throw Error("Synthetic bind failure"); o.session_id = value; },
    confirm: async () => { if (confirmationFailures--) throw Error("Synthetic confirmation failure"); commits++; return { created: true, status: "paid" }; } };
  const client = { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, webhooks: sdk.webhooks, checkout: { sessions: { retrieve: async () => s, create() { throw Error("No new sessions during recovery"); } } } };
  const raw = Buffer.from(JSON.stringify({ id: "evt_database_recovery", livemode: false, type: "checkout.session.completed", data: { object: { id: s.id } } }));
  const signature = sdk.webhooks.generateTestHeaderString({ payload: raw.toString(), secret: settings.secret });
  await assert.rejects(processWebhook(raw, signature, settings, repo, client)); assert.equal(commits, 0);
  await assert.rejects(processWebhook(raw, signature, settings, repo, client)); assert.equal(commits, 0);
  assert.equal((await processWebhook(raw, signature, settings, repo, client)).status, "paid"); assert.equal(commits, 1);
});
test("orphan session recovery validates provider facts before binding or confirming", async () => {
  const o = order(), s = session(o, { status: "complete", payment_status: "paid", payment_intent: "pi_safety" }), calls = [];
  const client = { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, checkout: { sessions: { retrieve: async () => s } } };
  const repo = { order: async () => ({ ...o }), bind: async (...args) => calls.push(["bind", ...args]), reconcile: async data => { calls.push(["confirm", data]); return { status: "paid" }; } };
  const input = { orderId: id, observationId: "20000000-0000-4000-8000-000000000099", sessionId: s.id };
  assert.equal((await reconcileTestOrder(input, repo, client, () => settings)).status, "paid"); assert.equal(calls[0][0], "bind");
  s.amount_total++; await assert.rejects(reconcileTestOrder(input, repo, client, () => settings)); assert.equal(calls.length, 2);
});
test("refund request is never completion; only a matching succeeded processor refund reaches SQL", async () => {
  const o = { ...order(), session_id: "cs_test_safety" }, s = session(o, { status: "complete", payment_status: "paid", payment_intent: "pi_safety" });
  const refund = { id: "re_safety", payment_intent: "pi_safety", currency: "usd", amount: 1000, status: "pending" };
  const payment = { id: "pi_safety", livemode: false, status: "succeeded", amount_received: 1000, currency: "usd", metadata: s.metadata };
  let confirmations = 0;
  const client = { accounts: { retrieve: async () => ({ object: "account", id: settings.expectedAccountId }) }, checkout: { sessions: { retrieve: async () => s } }, refunds: { retrieve: async () => refund, create() { throw Error("Refund creation forbidden"); } }, paymentIntents: { retrieve: async () => payment } };
  const repo = { order: async () => o, confirmRefund: async () => { confirmations++; return { status: "refunded" }; } };
  const input = { orderId: id, observationId: "20000000-0000-4000-8000-000000000099", refundId: refund.id };
  for (const status of ["pending", "failed", "canceled", "requires_action"]) { refund.status = status; assert.equal((await reconcileTestOrder(input, repo, client, () => settings)).processor_refund_confirmed, false); }
  assert.equal(confirmations, 0); refund.status = "succeeded";
  assert.equal((await reconcileTestOrder(input, repo, client, () => settings)).status, "refunded");
  payment.livemode = true; await assert.rejects(reconcileTestOrder(input, repo, client, () => settings)); assert.equal(confirmations, 1);
});
test("loopback relay forwards signed bytes only to one verified Preview webhook, without opening other routes", async () => {
  const calls = [], token = "synthetic-temporary-oidc";
  const deployment = require("../scripts/stripe-authorized-deployments").selectDeployment("pr60-stage7");
  const origin = deployment.origin;
  assert.throws(() => createRelay({ origin, deployment: { ...deployment, environment: "production" } }));
  const server = await startRelay({ origin, deployment, verifyDestination: async () => deployment, verifyToken: async value => value === token, verifySignature: async () => true,
    tokenProvider: async () => token, transport: async (url, options) => { calls.push({ url, options: { ...options, body: Buffer.from(options.body) } }); return new Response(null, { status: 200 }); } });
  const local = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal((await fetch(local + "/api/admin/marketplace", { method: "POST" })).status, 404);
    assert.equal((await fetch(local + "/api/stripe-test-webhook?other=true", { method: "POST" })).status, 404);
    const raw = '{ "synthetic": true }';
    const response = await fetch(local + "/api/stripe-test-webhook", { method: "POST", headers: { "stripe-signature": "synthetic-signature", Authorization: "must-not-forward", Cookie: "must-not-forward" }, body: raw });
    assert.equal(response.status, 204); assert.equal(calls.length, 1);
    assert.equal(calls[0].url, origin + "/api/stripe-test-webhook"); assert.equal(calls[0].options.body.toString(), raw);
    assert.equal(calls[0].options.redirect, "error"); assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.headers.Cookie, undefined); assert.equal(await response.text(), "");
  } finally { await new Promise(resolve => server.close(resolve)); }
});
