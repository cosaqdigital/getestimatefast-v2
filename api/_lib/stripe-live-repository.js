"use strict";
const {queryDb}=require("../admin/_auth");
function createLiveRepository(query=queryDb){
  const rpc=(name,body)=>query("rpc/"+name,{method:"POST",body:JSON.stringify(body)});
  return {
    order:id=>rpc("gef_live_order_read",{p_order:id}),
    event:id=>rpc("gef_live_event_read",{p_event:id}),
    refund:id=>rpc("gef_live_refund_read",{p_order:id}),
    bind:(id,session)=>rpc("gef_bind_live_session",{p_order:id,p_session:session}),
    confirm:c=>rpc("gef_confirm_live_order",{
      p_order:c.orderId,
      p_event:c.eventId,
      p_session:c.sessionId,
      p_payment:c.paymentId,
      p_outcome:c.outcome,
      p_amount:c.amount,
      p_currency:c.currency,
      p_mode:c.mode
    }),
    confirmRefund:r=>rpc("gef_confirm_live_refund",{
      p_order:r.orderId,
      p_refund:r.refundId,
      p_payment:r.paymentId,
      p_amount:r.amount,
      p_currency:r.currency,
      p_mode:r.mode,
      p_status:r.status
    })
  };
}
module.exports={createLiveRepository};
