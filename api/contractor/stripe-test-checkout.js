"use strict";
const { json, method, readJson, queryDb, userFor } = require("./_shared");
const { marketplaceReady, uuid, operationKey } = require("../_lib/marketplace-access");
const { testConfiguration, createCheckout, clientFor } = require("../_lib/stripe-test");
const { quotePrice } = require("../_lib/marketplace-pricing");
const { calculateMatch } = require("../_lib/florida-matching");
const rpc = (name, body) => queryDb("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
function createHandler(dependencies = {}) { return async function handler(req, res) {
  if (!method(req, res, ["GET", "POST"])) return;
  try {
    if (!marketplaceReady(req, res)) return;
    const user = await userFor(req, res); if (!user) return;
    if (req.method === "GET") {
      const order = await rpc("gef_test_order_read", { p_order: uuid(req.query?.order_id) });
      if (!order || order.contractor_id !== user.id) return json(res, 404, { error: "Test order unavailable" });
      return json(res, 200, { order_id: order.id, purpose: order.purpose, status: order.status, amount_cents: order.amount_cents, currency: "USD", contact_release_enabled: false });
    }
    const body = await readJson(req);
    const eligible = async id => {
      const rows = await queryDb("contractor_profiles?user_id=eq." + encodeURIComponent(user.id) + "&select=account_status,email_verified_at,state_code,base_zip,service_radius_miles,service_categories&limit=1");
      const profile = rows[0];
      const context = await rpc("gef_test_quote_context", { p_opportunity: id });
      if (!profile || profile.account_status !== "active" || !profile.email_verified_at || !context || !calculateMatch(profile, context.opportunity).eligible) throw Error("Opportunity is outside the authorized service area");
      return context;
    };
    if (body.action === "quote") {
      const context = await eligible(uuid(body.opportunity_id));
      const rule = { ...context.rule, base_cents: Number(context.rule.base_cents), floor_cents: Number(context.rule.floor_cents) };
      const price = quotePrice(rule, { category: context.opportunity.service_category, published_at: context.opportunity.published_at, buyer_count: Number(context.buyer_count), scope: context.scope, urgency: context.urgency });
      if (!price.available) return json(res, 409, { error: "Opportunity is unavailable", reason: price.reason });
      const quote = await rpc("gef_create_test_quote", { p_contractor: user.id, p_terms: context.terms_id, p_amount: price.amount_cents, p_valid_until: price.quote_valid_until });
      return json(res, 201, { ...quote, ...price, test_only: true, checkout_enabled: false });
    }
    let settings;
    try { settings = (dependencies.configuration || testConfiguration)(); } catch { return json(res, 503, { error: "Stripe test checkout requires separate approval and secure configuration", payments_enabled: false }); }
    const purpose = body.purpose;
    if (!["contact", "profile_service"].includes(purpose)) return json(res, 400, { error: "Only individual contacts and independent profile preparation are supported" });
    const quote = purpose === "contact" ? uuid(body.quote_id) : null;
    if (quote) {
      const context = await rpc("gef_test_quote_read", { p_contractor: user.id, p_quote: quote });
      if (!context) return json(res, 404, { error: "Quote unavailable" });
      await eligible(context.opportunity_id);
    }
    const order = await rpc("gef_create_test_order", { p_contractor: user.id, p_purpose: purpose, p_quote: quote, p_key: operationKey(body.operation_key) });
    if (order.status === "paid" || order.status === "refunded" || order.status === "refund_required") return json(res, 200, { order_id: order.id, status: order.status, test_only: true, contact_release_enabled: false });
    const session = await createCheckout(order, settings, (dependencies.client || clientFor)(settings.key));
    await rpc("gef_bind_test_session", { p_order: order.id, p_session: session.id });
    return json(res, 201, { order_id: order.id, checkout_url: session.url, test_only: true, contact_release_enabled: false });
  } catch { return json(res, 409, { error: "Test order could not be prepared. Check eligibility, pricing and operation key." }); }
}; }
module.exports = createHandler();
module.exports.createHandler = createHandler;
