"use strict";
// Operator-only library: no HTTP route, scheduler, charges or refund creation.
// Pass the already-approved processing configuration and a server-side repository.
const { assertSession, testConfiguration } = require("./stripe-test");
const { uuid } = require("./marketplace-access");
const idOf = value => typeof value === "string" ? value : value?.id;
async function reconcileTestOrder(input, repository, client, authorize = () => testConfiguration("webhook")) {
  authorize();
  const orderId = uuid(input.orderId), observation = uuid(input.observationId);
  const order = await repository.order(orderId);
  const sessionId = order?.session_id || input.sessionId;
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId || "")) throw Error("Known test session required for recovery");
  const session = await client.checkout.sessions.retrieve(sessionId);
  assertSession(order, session, false);
  if (!order.session_id) { await repository.bind(orderId, sessionId); order.session_id = sessionId; }
  const paymentId = idOf(session.payment_intent);
  if (input.refundId) {
    if (!/^re_[A-Za-z0-9_]+$/.test(input.refundId) || !/^pi_[A-Za-z0-9_]+$/.test(paymentId || "")) throw Error("Known refund and payment required");
    const payment = await client.paymentIntents.retrieve(paymentId);
    const refund = await client.refunds.retrieve(input.refundId);
    if (payment.id !== paymentId || payment.livemode !== false || payment.currency !== "usd" ||
        payment.status !== "succeeded" || payment.amount_received !== Number(order.amount_cents) ||
        payment.metadata?.gef_order_id !== orderId || payment.metadata?.gef_mode !== "test" ||
        payment.metadata?.gef_purpose !== order.purpose ||
        refund.id !== input.refundId || idOf(refund.payment_intent) !== paymentId ||
        refund.currency !== "usd" || refund.amount !== Number(order.amount_cents)) throw Error("Refund does not match verified test payment");
    if (refund.status !== "succeeded") return { status: "refund_required", processor_refund_confirmed: false };
    return repository.confirmRefund({ orderId, refundId: refund.id, paymentId, amount: refund.amount, currency: "USD", mode: "test", status: refund.status });
  }
  const outcome = session.payment_status === "paid" && session.status === "complete" ? "paid" : session.status === "expired" ? "expired" : null;
  if (!outcome) return { pending: true, action: "retry_read_only_reconciliation" };
  if (outcome === "paid" && !/^pi_[A-Za-z0-9_]+$/.test(paymentId || "")) throw Error("Confirmed payment required");
  return repository.reconcile({ orderId, observationId: observation, sessionId, paymentId: paymentId || null, outcome, amount: session.amount_total });
}
module.exports = { reconcileTestOrder };
