"use strict";
const Stripe = require("stripe");
const { config } = require("../admin/_auth");
const { cents } = require("./marketplace-pricing");
const { uuid } = require("./marketplace-access");
const { checkoutApproved, webhookApproved } = require("./stripe-policy");

function testConfiguration(operation = "checkout") {
  const authorized = operation === "checkout" ? checkoutApproved() : operation === "webhook" ? webhookApproved() : false;
  if (!authorized) throw Error("Stripe test operation is disabled");
  config();
  const key = process.env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY;
  const secret = process.env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET;
  if (!/^sk_test_[A-Za-z0-9]+$/.test(key || "") || !/^whsec_[A-Za-z0-9]+$/.test(secret || "")) throw Error("Stripe test configuration unavailable");
  const origin = new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN || "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw Error("Trusted HTTPS preview origin required");
  if (process.env.VERCEL_ENV === "preview" && !origin.hostname.endsWith(".vercel.app")) throw Error("Sandbox Preview hostname required");
  return { key, secret, origin: origin.origin };
}
function clientFor(key) { return new Stripe(key, { apiVersion: "2026-09-30.endive", maxNetworkRetries: 2, timeout: 15000 }); }
function checkoutParameters(order, origin) {
  uuid(order.id); cents(Number(order.amount_cents));
  if (order.currency !== "USD" || !["contact", "profile_service"].includes(order.purpose) || order.status !== "reserved") throw Error("Invalid reserved test order");
  if (Number(order.amount_cents) < 50 || Number(order.amount_cents) > 99999999) throw Error("Amount outside Stripe USD limits");
  const expires = Math.floor(Date.parse(order.checkout_expires_at) / 1000);
  if (!Number.isSafeInteger(expires)) throw Error("Persisted Checkout expiry required");
  if (order.checkout_origin !== origin) throw Error("Checkout origin changed; reconciliation required");
  const metadata = { gef_order_id: order.id, gef_purpose: order.purpose, gef_mode: "test" };
  return { mode: "payment", payment_method_types: ["card"], client_reference_id: order.id,
    metadata, payment_intent_data: { metadata }, expires_at: expires,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Number(order.amount_cents), product_data: { name: order.purpose === "contact" ? "GetEstimateFast individual contact" : "GetEstimateFast profile preparation" } } }],
    success_url: origin + "/contractor-portal.html?payment=pending",
    cancel_url: origin + "/contractor-portal.html?payment=canceled" };
}
async function createCheckout(order, settings, client = clientFor(settings.key)) {
  const params = checkoutParameters(order, settings.origin);
  // Never change parameters under the same idempotency key. An ambiguous timeout
  // beyond the creation window must be recovered by reconciliation, not a new key.
  const secondsRemaining = params.expires_at - Math.floor(Date.now() / 1000);
  if (!order.session_id && (secondsRemaining < 1860 || secondsRemaining > 86400)) throw Error("Checkout creation window closed; reconciliation required");
  const session = order.session_id ? await client.checkout.sessions.retrieve(order.session_id) :
    await client.checkout.sessions.create(params, { idempotencyKey: "gef-test-order:" + order.id });
  if (session.livemode !== false || !/^cs_test_[A-Za-z0-9_]+$/.test(session.id || "")) throw Error("Unexpected Stripe mode");
  assertSession(order, session, false);
  if (session.status !== "open" || session.expires_at !== params.expires_at) throw Error("Checkout is not available");
  const link = new URL(session.url);
  if (link.origin !== "https://checkout.stripe.com") throw Error("Unexpected Checkout destination");
  return { id: session.id, url: session.url };
}
async function readRaw(req, limit = 262144) {
  // Vercel's native Node runtime has a lazy JSON req.body getter. Reading that
  // property destroys byte fidelity. Consume the restored raw request stream.
  const descriptor = Object.getOwnPropertyDescriptor(req, "body");
  if (!req[Symbol.asyncIterator]) {
    const body = descriptor?.value;
    if (!Buffer.isBuffer(body) && typeof body !== "string") throw Error("Raw webhook body required");
    const bytes = Buffer.from(body); if (bytes.length > limit) throw Error("Webhook too large"); return bytes;
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > limit) throw Error("Webhook too large"); chunks.push(bytes); }
  if (req.aborted) throw Error("Incomplete webhook body");
  return Buffer.concat(chunks);
}
function assertSession(order, session, requireBound = true) {
  if (!order || session.livemode !== false || (requireBound && session.id !== order.session_id) ||
      !/^cs_test_[A-Za-z0-9_]+$/.test(session.id || "") || (order.session_id && order.session_id !== session.id) ||
      session.client_reference_id !== order.id || session.metadata?.gef_order_id !== order.id ||
      session.metadata?.gef_mode !== "test" || session.metadata?.gef_purpose !== order.purpose || session.mode !== "payment" ||
      session.currency !== "usd" || session.amount_total !== Number(order.amount_cents)) throw Error("Checkout does not match the test order");
}
async function processWebhook(raw, signature, settings, repository, client = clientFor(settings.key)) {
  const event = client.webhooks.constructEvent(raw, signature, settings.secret, 300);
  if (event.livemode !== false || !/^evt_[A-Za-z0-9_]+$/.test(event.id || "")) throw Error("Test event required");
  const outcomes = { "checkout.session.completed": "completed", "checkout.session.async_payment_succeeded": "completed", "checkout.session.async_payment_failed": "failed", "checkout.session.expired": "expired" };
  if (!outcomes[event.type]) return { received: true, ignored: true };
  const id = event.data?.object?.id;
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(id || "")) throw Error("Test Checkout session required");
  if (event.id.startsWith("evt_reconcile_")) throw Error("Reserved observation namespace");
  if (repository.event) {
    const previous = await repository.event(event.id);
    if (previous) {
      if (previous.session_id !== id) throw Error("Event identity conflict");
      return { received: true, duplicate: true };
    }
  }
  // The signed event triggers retrieval; the retrieved session is authoritative.
  const session = await client.checkout.sessions.retrieve(id);
  const orderId = uuid(session.metadata?.gef_order_id);
  const order = await repository.order(orderId);
  assertSession(order, session, false);
  if (!order.session_id) {
    if (!repository.bind) throw Error("Unbound session requires recovery");
    await repository.bind(order.id, session.id);
    order.session_id = session.id;
  }
  let outcome;
  if (session.payment_status === "paid" && session.status === "complete") outcome = "paid";
  else if (session.status === "expired") outcome = "expired";
  else if (outcomes[event.type] === "failed" && session.payment_status === "unpaid") outcome = "failed";
  else outcome = "pending";
  const payment = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (outcome === "paid" && !/^pi_[A-Za-z0-9_]+$/.test(payment || "")) throw Error("Confirmed payment required");
  const result = await repository.confirm({ orderId, eventId: event.id, sessionId: session.id, paymentId: payment || null, outcome, amount: session.amount_total, currency: "USD", mode: "test" });
  return { ...result, ...(outcome === "pending" ? { pending: true } : {}) };
}
module.exports = { testConfiguration, clientFor, checkoutParameters, createCheckout, readRaw, processWebhook, assertSession };
