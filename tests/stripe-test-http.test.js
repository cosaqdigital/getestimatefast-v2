"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Stripe = require("stripe"), crypto = require("node:crypto");
const { createSandbox } = require("../scripts/local-marketplace-sandbox");
test("HTTP Checkout + signed webhook + SQL use synthetic SDK transport, with no external calls", async () => {
  const key = "sk_test_SyntheticHttpOnly", secret = "whsec_SyntheticHttpOnly", sessions = new Map(), requests = [];
  const sdk = new Stripe(key), sessionForOrder = new Map();
  const client = { webhooks: sdk.webhooks, checkout: { sessions: {
    async create(params, options) {
      requests.push({ params, options });
      const existing = sessionForOrder.get(options.idempotencyKey); if (existing) return existing;
      const id = "cs_test_" + crypto.randomUUID().replaceAll("-", "");
      const session = { id, url: "https://checkout.stripe.com/c/pay/" + id, livemode: false, client_reference_id: params.client_reference_id, metadata: params.metadata, currency: "usd", amount_total: params.line_items[0].price_data.unit_amount, mode: "payment", payment_status: "unpaid", status: "open", payment_intent: null };
      sessions.set(id, session); sessionForOrder.set(options.idempotencyKey, session); return session;
    }, async retrieve(id) { return sessions.get(id); }
  } } };
  const s = await createSandbox(0, { stripe: { configuration: () => ({ key, secret, origin: "https://synthetic.example.invalid" }), client: () => client } });
  const post = (path, body, token = "synthetic-contractor") => s.fetch(s.origin + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
  const rpc = async (name, values) => (await s.db.query(`select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) result`, values)).rows[0].result;
  async function webhook(session, type = "checkout.session.completed", id = "evt_" + crypto.randomUUID().replaceAll("-", ""), wrongSignature = false) {
    const raw = JSON.stringify({ id, livemode: false, type, data: { object: { id: session.id } } });
    const signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: wrongSignature ? "whsec_WrongSynthetic" : secret });
    return s.fetch(s.origin + "/api/stripe-test-webhook", { method: "POST", headers: { "stripe-signature": signature }, body: raw });
  }
  try {
    const admin = s.ids.admin, op = s.ids.opportunity;
    const rule = (await rpc("gef_admin_configuration", [admin, "pricing_rule", { category: "Painting", version: "http-test", currency: "USD", base_cents: 1200, floor_cents: 100, max_buyers: 2, lifetime_hours: 24, scope_bps: {}, urgency_bps: {}, discounts: [], effective_at: new Date().toISOString() }, "Synthetic Checkout rules", "http:stripe:price"])).id;
    await rpc("gef_admin_configuration", [admin, "opportunity_terms", { opportunity_id: op, rule_id: rule }, "Synthetic Checkout terms", "http:stripe:terms"]);
    assert.equal((await post("/api/contractor/stripe-test-checkout", { action: "quote", opportunity_id: op }, "no-session")).status, 401);
    const response = await post("/api/contractor/stripe-test-checkout", { action: "quote", opportunity_id: op, amount_cents: 1 }); assert.equal(response.status, 201);
    const quote = await response.json(); assert.equal(quote.amount_cents, 1200);
    const body = { purpose: "contact", quote_id: quote.quote_id, operation_key: "http:stripe:contact" };
    const checkout = await post("/api/contractor/stripe-test-checkout", body); assert.equal(checkout.status, 201); const order = await checkout.json();
    const retry = await post("/api/contractor/stripe-test-checkout", body); assert.equal((await retry.json()).order_id, order.order_id); assert.equal(sessions.size, 1);
    const session = [...sessions.values()][0];
    assert.equal((await webhook(session, undefined, "evt_bad_signature", true)).status, 400);
    assert.equal((await webhook(session, undefined, "evt_pending")).status, 200);
    assert.equal((await s.db.query("select count(*)::int n from gef_private.contact_purchases")).rows[0].n, 0);
    session.payment_status = "paid"; session.status = "complete"; session.payment_intent = "pi_synthetic_contact";
    const paid = await webhook(session, undefined, "evt_paid001"); assert.equal(paid.status, 200); assert.equal((await paid.json()).status, "paid");
    assert.equal((await webhook(session, undefined, "evt_paid001")).status, 200); assert.equal((await webhook(session, undefined, "evt_paid002")).status, 200);
    const completedRetry=await post("/api/contractor/stripe-test-checkout",body);assert.equal(completedRetry.status,200);assert.equal((await completedRetry.json()).status,"paid");
    assert.equal((await s.db.query("select count(*)::int n from gef_private.contact_purchases")).rows[0].n, 1);
    assert.equal((await rpc("gef_wallet_summary", [s.ids.contractor])).available_cents, 0);
    assert.equal((await s.fetch(s.origin + "/api/contractor/stripe-test-checkout?order_id=" + order.order_id, { headers: { Authorization: "Bearer synthetic-other" } })).status, 404);
    assert.equal((await post("/api/contractor/stripe-test-checkout", { purpose: "wallet_topup", operation_key: "http:topup:bad" })).status, 400);
    assert.equal((await post("/api/lead", {})).status, 503);
    assert(requests.every(r => r.params.line_items[0].price_data.unit_amount === 1200));
    // Post-payment eligibility changes must never leak private contacts through a success redirect.
    const publicBody = await (await s.fetch(s.origin + "/api/contractor/stripe-test-checkout?order_id=" + order.order_id, { headers: { Authorization: "Bearer synthetic-contractor" } })).json();
    assert.equal(publicBody.contact_release_enabled, false); assert.equal(publicBody.phone, undefined);
  } finally { await s.close(); }
});
