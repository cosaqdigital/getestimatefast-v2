"use strict";
const { json, method } = require("./admin/_auth");
const { testConfiguration, readRaw, processWebhook, clientFor } = require("./_lib/stripe-test");
const { createRepository } = require("./_lib/stripe-repository");
function createHandler(dependencies = {}) { return async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  let settings;
  try { settings = (dependencies.configuration || (() => testConfiguration("webhook")))(); } catch { return json(res, 503, { error: "Stripe test webhook is disabled" }); }
  let raw;
  try { raw = await readRaw(req); } catch { return json(res, 400, { error: "Raw webhook body required" }); }
  try {
    const repository = createRepository();
    return json(res, 200, await processWebhook(raw, req.headers["stripe-signature"], settings, repository, (dependencies.client || clientFor)(settings.key)));
  } catch (error) {
    // Do not log keys, signed payloads, payment information or provider error bodies.
    const invalid = error.type === "StripeSignatureVerificationError";
    return json(res, invalid ? 400 : 503, { error: invalid ? "Invalid webhook signature" : "Test event could not be confirmed; retry required" });
  }
}; }
module.exports = createHandler();
module.exports.createHandler = createHandler;
