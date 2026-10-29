"use strict";
const {json,method,queryDb}=require("./admin/_auth");
const {readRaw}=require("./_lib/stripe-test");
const {
 configuration,clientFor,processWebhook
}=require("./_lib/work-post-credit-stripe-test");

const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 if(process.env.VERCEL_ENV==="production")return json(res,404,{error:"Not found"});

 let settings;
 try{settings=configuration("webhook");}
 catch{return json(res,503,{error:"Work post Stripe test webhook is disabled"});}

 let raw;
 try{raw=await readRaw(req);}
 catch{return json(res,400,{error:"Raw webhook body required"});}

 try{
  const repository={
   readOrder:orderId=>rpc("gef_work_post_credit_order_read",{p_order:orderId}),
   bind:(orderId,sessionId)=>rpc("gef_bind_work_post_credit_session",{p_order:orderId,p_session:sessionId}),
   confirm:payload=>rpc("gef_confirm_work_post_credit_order",{
    p_order:payload.orderId,
    p_event:payload.eventId,
    p_session:payload.sessionId,
    p_payment:payload.paymentId,
    p_outcome:payload.outcome,
    p_amount:payload.amount,
    p_currency:payload.currency,
    p_mode:payload.mode
   })
  };
  const result=await processWebhook(
   raw,
   req.headers["stripe-signature"],
   settings,
   repository,
   clientFor(settings.key)
  );
  return json(res,200,result);
 }catch(error){
  const invalid=error?.type==="StripeSignatureVerificationError";
  return json(res,invalid?400:503,{error:invalid?"Invalid webhook signature":"Test event could not be confirmed; retry required"});
 }
};
