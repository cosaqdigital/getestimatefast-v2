"use strict";
const { queryDb } = require("../admin/_auth");
function createRepository(query = queryDb) {
  const rpc = (name, body) => query("rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  return {
    order: id => rpc("gef_test_order_read", { p_order: id }),
    event: id => rpc("gef_test_event_read", { p_event: id }),
    bind: (id, session) => rpc("gef_recover_test_session", { p_order: id, p_session: session }),
    confirm: c => rpc("gef_confirm_test_order", { p_order: c.orderId, p_event: c.eventId, p_session: c.sessionId, p_payment: c.paymentId, p_outcome: c.outcome, p_amount: c.amount, p_currency: c.currency, p_mode: c.mode }),
    reconcile: c => rpc("gef_reconcile_test_order", { p_order: c.orderId, p_observation: c.observationId, p_session: c.sessionId, p_payment: c.paymentId, p_outcome: c.outcome, p_amount: c.amount }),
    confirmRefund: c => rpc("gef_confirm_test_refund", { p_order: c.orderId, p_refund: c.refundId, p_payment: c.paymentId, p_amount: c.amount, p_currency: c.currency, p_mode: c.mode, p_status: c.status })
  };
}
module.exports = { createRepository };
