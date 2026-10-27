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
    topup:id=>rpc("gef_live_topup_read",{p_intent:id}),
    topupEvent:id=>rpc("gef_live_topup_event_read",{p_event:id}),
    bindTopup:(id,session)=>rpc("gef_bind_live_topup_session",{p_intent:id,p_session:session}),
    confirmTopup:t=>rpc("gef_confirm_live_topup",{
      p_intent:t.intentId,
      p_event:t.eventId,
      p_session:t.sessionId,
      p_payment:t.paymentId,
      p_outcome:t.outcome,
      p_amount:t.amount,
      p_currency:t.currency,
      p_mode:t.mode
    }),
    profileService:id=>rpc("gef_live_profile_service_read",{p_intent:id}),
    profileServiceEvent:id=>rpc("gef_live_profile_service_event_read",{p_event:id}),
    bindProfileService:(id,session)=>rpc("gef_bind_live_profile_service_session",{p_intent:id,p_session:session}),
    confirmProfileService:t=>rpc("gef_confirm_live_profile_service",{
      p_intent:t.intentId,
      p_event:t.eventId,
      p_session:t.sessionId,
      p_payment:t.paymentId,
      p_outcome:t.outcome,
      p_amount:t.amount,
      p_currency:t.currency,
      p_mode:t.mode
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
