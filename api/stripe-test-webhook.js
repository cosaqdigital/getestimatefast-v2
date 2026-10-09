"use strict";
const { json, method, queryDb } = require("./admin/_auth");
const { testConfiguration, readRaw, processWebhook, clientFor } = require("./_lib/stripe-test");
const rpc = (name, body) => queryDb("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
function createHandler(dependencies = {}) { return async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  let settings;
  try { settings = (dependencies.configuration || testConfiguration)(); } catch { return json(res, 503, { error: "Stripe test webhook is disabled" }); }
  let raw;
  try { raw = await readRaw(req); } catch { return json(res, 400, { error: "Raw webhook body required" }); }
  try {
    const repository = {
      order: id => rpc("gef_test_order_read", { p_order: id }),
      confirm: c => rpc("gef_confirm_test_order", { p_order: c.orderId, p_event: c.eventId, p_session: c.sessionId, p_payment: c.paymentId, p_outcome: c.outcome, p_amount: c.amount, p_currency: c.currency, p_mode: c.mode })
    };
    return json(res, 200, await processWebhook(raw, req.headers["stripe-signature"], settings, repository, (dependencies.client || clientFor)(settings.key)));
  } catch (error) {
    // Do not log keys, signed payloads, payment information or provider error bodies.
    const invalid = error.type === "StripeSignatureVerificationError";
    return json(res, invalid ? 400 : 503, { error: invalid ? "Invalid webhook signature" : "Test event could not be confirmed; retry required" });
  }
}; }
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.config = { api: { bodyParser: false } };
