"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Stripe = require("stripe");
const { EXPECTED_TEST_ACCOUNT_ID, accountConfiguration, verifyTestAccount } = require("../api/_lib/stripe-account");
const { createCheckout, processWebhook } = require("../api/_lib/stripe-test");
const { reconcileTestOrder } = require("../api/_lib/stripe-reconciliation");
const { checkoutApproved, webhookApproved } = require("../api/_lib/stripe-policy");
const settings = { expectedAccountId: EXPECTED_TEST_ACCOUNT_ID, key: "sk_test_SyntheticAccountOnly", secret: "whsec_SyntheticAccountOnly", origin: "https://synthetic.example.invalid" };
const sdk = new Stripe(settings.key);
test("account configuration cannot be absent or replaced by an arbitrary account", () => {
  assert.throws(() => accountConfiguration({}));
  assert.throws(() => accountConfiguration({ GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: "acct_other" }));
  assert.equal(accountConfiguration({ GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: EXPECTED_TEST_ACCOUNT_ID }), EXPECTED_TEST_ACCOUNT_ID);
  const env = { VERCEL_ENV: "development", GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_STRIPE_MODE: "test", GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "cpjsbijgijeyrwjpuciv", GETESTIMATEFAST_SMS_MODE: "dry_run", GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: EXPECTED_TEST_ACCOUNT_ID, GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED: "true", GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED: "true", GETESTIMATEFAST_MARKETPLACE_PREVIEW: "true", GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "true" };
  assert.equal(checkoutApproved(env), true); assert.equal(webhookApproved(env), true);
  for (const value of [undefined, "acct_other"]) { assert.equal(checkoutApproved({ ...env, GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: value }), false); assert.equal(webhookApproved({ ...env, GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID: value }), false); }
});
test("key ownership check uses the current account GET and returns only a sanitized boolean", async () => {
  const args = [];
  const client = { accounts: { retrieve: async id => { args.push(id); return { object: "account", id: EXPECTED_TEST_ACCOUNT_ID, email: "synthetic.private@example.invalid", external_accounts: { data: ["synthetic-sensitive-data"] } }; } } };
  assert.deepEqual(await verifyTestAccount(settings, client), { verified: true }); assert.deepEqual(args, [null]);
  assert(!JSON.stringify(await verifyTestAccount(settings, client)).includes("email"));
  await assert.rejects(verifyTestAccount({ ...settings, key: "sk_live_SyntheticOnly" }, client)); assert.equal(args.length, 2);
  await assert.rejects(verifyTestAccount({ ...settings, expectedAccountId: "acct_other" }, client)); assert.equal(args.length, 2);
});
test("wrong, deleted, malformed or unavailable account is denied without leaking provider data", async () => {
  for (const account of [{ object: "account", id: "acct_other" }, { object: "account", id: EXPECTED_TEST_ACCOUNT_ID, deleted: true }, { id: EXPECTED_TEST_ACCOUNT_ID }, null]) {
    await assert.rejects(verifyTestAccount(settings, { accounts: { retrieve: async () => account } }), /Stripe Sandbox identity verification failed/);
  }
  const secretMessage = "synthetic-private-provider-detail";
  await assert.rejects(verifyTestAccount(settings, { accounts: { retrieve: async () => { throw Error(secretMessage); } } }), e => e.message === "Stripe Sandbox identity verification failed" && !e.cause && !e.stack.includes(secretMessage));
});
test("wrong account blocks Checkout, webhook and reconciliation before provider business calls or DB writes", async () => {
  let businessCalls = 0, databaseCalls = 0, identityReads = 0;
  const client = { accounts: { retrieve: async () => { identityReads++; return { object: "account", id: "acct_wrong_synthetic" }; } }, webhooks: sdk.webhooks,
    checkout: { sessions: { create: async () => { businessCalls++; }, retrieve: async () => { businessCalls++; } } }, refunds: { retrieve: async () => { businessCalls++; }, create: async () => { businessCalls++; } } };
  const order = { id: "20000000-0000-4000-8000-000000000010", purpose: "contact", status: "reserved", currency: "USD", amount_cents: 1000, checkout_origin: settings.origin, checkout_expires_at: new Date(Date.now() + 2400000).toISOString() };
  await assert.rejects(createCheckout(order, settings, client));
  const raw = JSON.stringify({ id: "evt_account_test", livemode: false, type: "checkout.session.completed", data: { object: { id: "cs_test_account_test" } } });
  const signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: settings.secret });
  const repo = new Proxy({}, { get() { return async () => { databaseCalls++; }; } });
  await assert.rejects(processWebhook(Buffer.from(raw), signature, settings, repo, client));
  await assert.rejects(reconcileTestOrder({ orderId: order.id, observationId: order.id }, repo, client, () => settings));
  assert.equal(identityReads, 3); assert.equal(businessCalls, 0); assert.equal(databaseCalls, 0);
  // Invalid signatures are rejected before even the account-identity GET.
  await assert.rejects(processWebhook(Buffer.from(raw + " "), signature, settings, repo, client)); assert.equal(identityReads, 3);
});
test("verification is repeated for every operation: key/account changes cannot reuse cached authorization", async () => {
  let calls = 0;
  const client = { accounts: { retrieve: async () => ({ object: "account", id: calls++ === 0 ? EXPECTED_TEST_ACCOUNT_ID : "acct_wrong_after_change" }) } };
  assert.equal((await verifyTestAccount(settings, client)).verified, true);
  await assert.rejects(verifyTestAccount(settings, client)); assert.equal(calls, 2);
});
