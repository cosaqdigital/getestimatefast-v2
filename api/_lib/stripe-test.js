"use strict";
const Stripe = require("stripe");
const { config } = require("../admin/_auth");
const { cents } = require("./marketplace-pricing");
const { uuid } = require("./marketplace-access");

function testConfiguration() {
  if (process.env.GETESTIMATEFAST_ISOLATED_BACKEND !== "true" ||
      process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW !== "true" ||
      process.env.GETESTIMATEFAST_STRIPE_MODE !== "test" ||
      process.env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED !== "true" ||
      process.env.VERCEL_ENV === "production") throw Error("Stripe test checkout is disabled");
  config();
  const key = process.env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY;
  const secret = process.env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET;
  if (!/^sk_test_[A-Za-z0-9]+$/.test(key || "") || !/^whsec_[A-Za-z0-9]+$/.test(secret || "")) throw Error("Stripe test configuration unavailable");
  const origin = new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN || "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw Error("Trusted HTTPS preview origin required");
  return { key, secret, origin: origin.origin };
}
function clientFor(key) { return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 }); }
function checkoutParameters(order, origin) {
  uuid(order.id); cents(Number(order.amount_cents));
  if (order.currency !== "USD" || !["contact", "profile_service"].includes(order.purpose) || order.status !== "reserved") throw Error("Invalid reserved test order");
  const metadata = { gef_order_id: order.id, gef_purpose: order.purpose, gef_mode: "test" };
  return { mode: "payment", payment_method_types: ["card"], client_reference_id: order.id,
    metadata, payment_intent_data: { metadata }, expires_at: Math.floor(Date.parse(order.created_at) / 1000) + 1800,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Number(order.amount_cents), product_data: { name: order.purpose === "contact" ? "GetEstimateFast individual contact" : "GetEstimateFast profile preparation" } } }],
    success_url: origin + "/contractor-portal.html?payment=pending",
    cancel_url: origin + "/contractor-portal.html?payment=canceled" };
}
async function createCheckout(order, settings, client = clientFor(settings.key)) {
  const session = await client.checkout.sessions.create(checkoutParameters(order, settings.origin), { idempotencyKey: "gef-test-order:" + order.id });
  if (session.livemode !== false || !/^cs_test_[A-Za-z0-9_]+$/.test(session.id || "")) throw Error("Unexpected Stripe mode");
  const link = new URL(session.url);
  if (link.origin !== "https://checkout.stripe.com") throw Error("Unexpected Checkout destination");
  return { id: session.id, url: session.url };
}
async function readRaw(req, limit = 262144) {
  if (req.body && !Buffer.isBuffer(req.body) && typeof req.body !== "string") throw Error("Raw webhook body required");
  if (Buffer.isBuffer(req.body) || typeof req.body === "string") { const bytes = Buffer.from(req.body); if (bytes.length > limit) throw Error("Webhook too large"); return bytes; }
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Error("Webhook too large"); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
async function processWebhook(raw, signature, settings, repository, client = clientFor(settings.key)) {
  const event = client.webhooks.constructEvent(raw, signature, settings.secret, 300);
  if (event.livemode !== false || !/^evt_[A-Za-z0-9_]+$/.test(event.id || "")) throw Error("Test event required");
  const outcomes = { "checkout.session.completed": "completed", "checkout.session.async_payment_succeeded": "completed", "checkout.session.async_payment_failed": "failed", "checkout.session.expired": "expired" };
  if (!outcomes[event.type]) return { received: true, ignored: true };
  const id = event.data?.object?.id;
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(id || "")) throw Error("Test Checkout session required");
  // The signed event triggers retrieval; the retrieved session is authoritative.
  const session = await client.checkout.sessions.retrieve(id);
  const orderId = uuid(session.metadata?.gef_order_id);
  const order = await repository.order(orderId);
  if (!order || session.livemode !== false || session.id !== order.session_id || session.client_reference_id !== order.id ||
      session.metadata?.gef_mode !== "test" || session.metadata?.gef_purpose !== order.purpose || session.mode !== "payment" ||
      session.currency !== "usd" || session.amount_total !== Number(order.amount_cents)) throw Error("Checkout does not match the test order");
  let outcome;
  if (session.payment_status === "paid" && session.status === "complete") outcome = "paid";
  else if (session.status === "expired") outcome = "expired";
  else if (outcomes[event.type] === "failed" && session.payment_status === "unpaid") outcome = "failed";
  else return { received: true, pending: true };
  const payment = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (outcome === "paid" && !/^pi_[A-Za-z0-9_]+$/.test(payment || "")) throw Error("Confirmed payment required");
  return repository.confirm({ orderId, eventId: event.id, sessionId: session.id, paymentId: payment || null, outcome, amount: session.amount_total, currency: "USD", mode: "test" });
}
module.exports = { testConfiguration, clientFor, checkoutParameters, createCheckout, readRaw, processWebhook };
