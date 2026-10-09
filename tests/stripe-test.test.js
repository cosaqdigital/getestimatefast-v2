"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Stripe = require("stripe"), { Readable } = require("node:stream");
const { checkoutParameters, createCheckout, processWebhook, readRaw, testConfiguration } = require("../api/_lib/stripe-test");
const id = "20000000-0000-4000-8000-000000000001";
const order = { id, purpose: "contact", status: "reserved", currency: "USD", amount_cents: 1234, created_at: new Date().toISOString(), session_id: "cs_test_fixture" };
const settings = { key: "sk_test_SyntheticOnly", secret: "whsec_SyntheticOnly", origin: "https://synthetic.example.invalid" };
const sdk = new Stripe(settings.key);
const session = { id: order.session_id, livemode: false, metadata: { gef_order_id: id, gef_purpose: "contact", gef_mode: "test" }, client_reference_id: id, mode: "payment", currency: "usd", amount_total: 1234, status: "complete", payment_status: "paid", payment_intent: "pi_fixture" };
function event(type = "checkout.session.completed", changes = {}) { return { id: "evt_fixture", livemode: false, type, data: { object: { id: order.session_id } }, ...changes }; }
function signed(value, timestamp) { const payload = JSON.stringify(value); return { raw: Buffer.from(payload), signature: sdk.webhooks.generateTestHeaderString({ payload, secret: settings.secret, ...(timestamp ? { timestamp } : {}) }) }; }
function fixture(changes = {}) {
  const calls = [];
  return { calls, client: { webhooks: sdk.webhooks, checkout: { sessions: { retrieve: async () => ({ ...session, ...changes }) } } }, repository: { order: async () => order, confirm: async value => { calls.push(value); return { created: true, status: value.outcome }; } } };
}
test("Stripe Checkout uses exact contact cents and an independent profile-service purpose", async () => {
  const params = checkoutParameters(order, settings.origin);
  assert.equal(params.line_items[0].price_data.unit_amount, 1234); assert.equal(params.payment_intent_data.metadata.gef_purpose, "contact"); assert.equal(params.payment_method_types[0], "card");
  const profile = checkoutParameters({ ...order, purpose: "profile_service" }, settings.origin);
  assert.equal(profile.metadata.gef_purpose, "profile_service"); assert(profile.line_items[0].price_data.product_data.name.includes("profile"));
  const calls = [];
  const client = { checkout: { sessions: { create: async (p, options) => { calls.push(options.idempotencyKey); return { id: "cs_test_fixture", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_fixture" }; } } } };
  await createCheckout(order, settings, client); await createCheckout(order, settings, client); assert.deepEqual(calls, ["gef-test-order:" + id, "gef-test-order:" + id]);
  await assert.rejects(() => createCheckout(order, settings, { checkout: { sessions: { create: async () => ({ id: "cs_live_bad", livemode: true }) } } }));
  assert.throws(() => checkoutParameters({ ...order, purpose: "wallet_topup" }, settings.origin));
});
test("raw Stripe signatures reject mutation, stale timestamps and wrong signing secrets", async () => {
  const f = fixture(), value = signed(event());
  await processWebhook(value.raw, value.signature, settings, f.repository, f.client); assert.equal(f.calls.length, 1);
  await assert.rejects(() => processWebhook(Buffer.concat([value.raw, Buffer.from(" ")]), value.signature, settings, f.repository, f.client));
  const stale = signed(event(), Math.floor(Date.now() / 1000) - 360);
  await assert.rejects(() => processWebhook(stale.raw, stale.signature, settings, f.repository, f.client));
  await assert.rejects(() => processWebhook(value.raw, value.signature, { ...settings, secret: "whsec_WrongSynthetic" }, f.repository, f.client));
  assert.equal(f.calls.length, 1);
  assert.equal((await readRaw(Readable.from([value.raw]))).toString(), value.raw.toString());
  await assert.rejects(() => readRaw({ body: event() })); await assert.rejects(() => readRaw(Readable.from([Buffer.alloc(30)]), 20));
});
test("server retrieves session and rejects live mode, price, currency, ownership and purpose mismatches", async () => {
  const value = signed(event());
  for (const changes of [{ livemode: true }, { amount_total: 1235 }, { currency: "brl" }, { client_reference_id: "wrong" }, { id: "cs_test_other" }, { metadata: { ...session.metadata, gef_purpose: "profile_service" } }]) {
    const f = fixture(changes); await assert.rejects(() => processWebhook(value.raw, value.signature, settings, f.repository, f.client)); assert.equal(f.calls.length, 0);
  }
  const live = signed(event(undefined, { livemode: true })), f = fixture();
  await assert.rejects(() => processWebhook(live.raw, live.signature, settings, f.repository, f.client));
});
test("pending completion cannot fulfill; failures and expiration persist without payment credits", async () => {
  const pending = fixture({ payment_status: "unpaid" }), value = signed(event());
  assert.equal((await processWebhook(value.raw, value.signature, settings, pending.repository, pending.client)).pending, true); assert.equal(pending.calls.length, 0);
  for (const [type, changes, outcome] of [["checkout.session.async_payment_failed", { payment_status: "unpaid", payment_intent: null }, "failed"], ["checkout.session.expired", { status: "expired", payment_status: "unpaid", payment_intent: null }, "expired"]]) {
    const f = fixture(changes), e = signed(event(type)); await processWebhook(e.raw, e.signature, settings, f.repository, f.client); assert.equal(f.calls[0].outcome, outcome);
  }
  const f = fixture(), e = signed(event("customer.created")); assert.equal((await processWebhook(e.raw, e.signature, settings, f.repository, f.client)).ignored, true);
});
test("test Checkout gates reject default, production and live keys before SDK network calls", () => {
  const old = { ...process.env };
  try {
    assert.throws(testConfiguration);
    Object.assign(process.env, { GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_MARKETPLACE_PREVIEW: "true", GETESTIMATEFAST_STRIPE_MODE: "test", GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "true", GETESTIMATEFAST_SUPABASE_URL: "http://127.0.0.1:1", GETESTIMATEFAST_SUPABASE_SECRET_KEY: "synthetic", GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: "synthetic", GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY: settings.key, GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET: settings.secret, GETESTIMATEFAST_PUBLIC_ORIGIN: settings.origin, VERCEL_ENV: "development" });
    assert.equal(testConfiguration().origin, settings.origin);
    process.env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY = "sk_live_SyntheticOnly"; assert.throws(testConfiguration);
    process.env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY = settings.key; process.env.VERCEL_ENV = "production"; assert.throws(testConfiguration);
    process.env.VERCEL_ENV = "preview"; assert.throws(testConfiguration);
    process.env.VERCEL_GIT_COMMIT_REF = "feat/isolated-preview-stripe-test-20261009"; process.env.GETESTIMATEFAST_ISOLATED_BACKEND = "false";
    assert.throws(() => require("../api/admin/_auth").config(), /requires its isolated/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old); }
});
