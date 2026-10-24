"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),Stripe=require("stripe"),{Readable}=require("node:stream");
const {livePaymentsApproved,liveWebhookApproved}=require("../api/_lib/stripe-live-policy");
const {checkoutParameters,processWebhook}=require("../api/_lib/stripe-live");

const id="30000000-0000-4000-8000-000000000001";
const key=["sk","live","SyntheticOnly"].join("_");
const secret="wh"+"sec_SyntheticOnly";
const settings={key,secret,expectedAccountId:"acct_SyntheticLiveOnly",origin:"https://www.getestimatefast.com"};
const sdk=new Stripe(key);
const order={
 id,status:"reserved",currency:"USD",amount_cents:3990,
 reserved_until:new Date(Date.now()+2400000).toISOString(),
 session_id:"cs_live_synthetic"
};
const session={
 id:order.session_id,livemode:true,status:"complete",payment_status:"paid",
 payment_intent:"pi_synthetic",mode:"payment",currency:"usd",amount_total:3990,
 client_reference_id:id,
 metadata:{gef_order_id:id,gef_purpose:"contact",gef_mode:"live"}
};
function event(type="checkout.session.completed"){
 return {id:"evt_synthetic_live",livemode:true,type,data:{object:{id:session.id}}};
}
function signed(value){
 const payload=JSON.stringify(value);
 return {raw:Buffer.from(payload),signature:sdk.webhooks.generateTestHeaderString({payload,secret})};
}
function client(changes={}){
 return {
  accounts:{retrieve:async()=>({object:"account",id:settings.expectedAccountId})},
  webhooks:sdk.webhooks,
  checkout:{sessions:{retrieve:async()=>({...session,...changes})}},
  paymentIntents:{retrieve:async paymentId=>({
    id:paymentId,livemode:true,currency:"usd",status:"succeeded",amount_received:3990,
    metadata:{gef_order_id:id,gef_mode:"live",gef_purpose:"contact"}
  })},
  refunds:{
    create:async()=>({id:"re_synthetic",payment_intent:"pi_synthetic",currency:"usd",amount:3990,status:"succeeded"}),
    retrieve:async()=>({id:"re_synthetic",payment_intent:"pi_synthetic",currency:"usd",amount:3990,status:"succeeded"})
  }
 };
}

test("live payment policy is fail-closed and requires every Production gate",()=>{
 const base={
  VERCEL_ENV:"production",
  VERCEL_PROJECT_ID:"prj_kA6x5rt1MChiNSQpa6pShHoUSuOF",
  GETESTIMATEFAST_ISOLATED_BACKEND:"false",
  GETESTIMATEFAST_STRIPE_MODE:"live",
  GETESTIMATEFAST_STRIPE_LIVE_ENABLED:"true",
  GETESTIMATEFAST_STRIPE_LIVE_CHECKOUT_APPROVED:"true",
  GETESTIMATEFAST_STRIPE_LIVE_WEBHOOK_ENABLED:"true",
  GETESTIMATEFAST_STRIPE_LIVE_SCHEMA_APPROVED:"true",
  GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"true",
  GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"true",
  GETESTIMATEFAST_SMS_MODE:"disabled",
  GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false",
  GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"false",
  GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"false",
  GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"false",
  GETESTIMATEFAST_SUPABASE_URL:"https://wedsjubkttygxtpkopfj.supabase.co",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://www.getestimatefast.com"
 };
 assert.equal(livePaymentsApproved({}),false);
 assert.equal(livePaymentsApproved(base),true);
 for(const key of [
  "GETESTIMATEFAST_STRIPE_LIVE_ENABLED",
  "GETESTIMATEFAST_STRIPE_LIVE_CHECKOUT_APPROVED",
  "GETESTIMATEFAST_STRIPE_LIVE_WEBHOOK_ENABLED",
  "GETESTIMATEFAST_STRIPE_LIVE_SCHEMA_APPROVED",
  "GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED",
  "GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED"
 ]) assert.equal(livePaymentsApproved({...base,[key]:"false"}),false);
 assert.equal(livePaymentsApproved({...base,VERCEL_ENV:"preview"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_ISOLATED_BACKEND:"true"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_SMS_MODE:"live"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"true"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"true"}),false);
 assert.equal(livePaymentsApproved({...base,GETESTIMATEFAST_SUPABASE_URL:"https://cpjsbijgijeyrwjpuciv.supabase.co"}),false);
 assert.equal(liveWebhookApproved({...base,GETESTIMATEFAST_STRIPE_LIVE_CHECKOUT_APPROVED:"false",GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"false"}),true);
 assert.equal(liveWebhookApproved({...base,GETESTIMATEFAST_STRIPE_LIVE_WEBHOOK_ENABLED:"false"}),false);
});

test("live Checkout freezes exact contact price and never treats redirect as payment",()=>{
 const params=checkoutParameters(order,settings.origin);
 assert.equal(params.line_items[0].price_data.unit_amount,3990);
 assert.equal(params.metadata.gef_mode,"live");
 assert.equal(params.metadata.gef_purpose,"contact");
 assert.equal(params.success_url,"https://www.getestimatefast.com/contractor-portal.html?payment=pending");
 assert.equal(params.cancel_url,"https://www.getestimatefast.com/contractor-portal.html?payment=canceled");
 assert.throws(()=>checkoutParameters({...order,status:"paid"},settings.origin));
 assert.throws(()=>checkoutParameters({...order,currency:"BRL"},settings.origin));
});

test("signed live webhook confirms a retrieved paid session exactly once",async()=>{
 const calls=[];
 const repo={
  event:async()=>null,
  order:async()=>({...order}),
  bind:async()=>{throw Error("Already bound");},
  confirm:async value=>{calls.push(value);return {created:true,status:"paid",contact_release_enabled:true};}
 };
 const value=signed(event());
 const result=await processWebhook(value.raw,value.signature,settings,repo,client());
 assert.equal(result.status,"paid");
 assert.equal(calls.length,1);
 assert.equal(calls[0].amount,3990);
 assert.equal(calls[0].mode,"live");
});

test("pending or mismatched live sessions never release a contact",async()=>{
 const value=signed(event());
 let confirmations=0;
 const repo={
  event:async()=>null,
  order:async()=>({...order}),
  bind:async()=>{},
  confirm:async()=>{confirmations++;return {status:"paid"};}
 };
 assert.equal((await processWebhook(value.raw,value.signature,settings,repo,client({payment_status:"unpaid"}))).pending,true);
 assert.equal(confirmations,0);
 await assert.rejects(()=>processWebhook(value.raw,value.signature,settings,repo,client({amount_total:4090})));
 await assert.rejects(()=>processWebhook(value.raw,value.signature,{...settings,expectedAccountId:"acct_Other"},repo,client()));
 assert.equal(confirmations,0);
});

test("redelivered persisted live event skips Checkout retrieval and purchase confirmation",async()=>{
 const value=signed(event());
 const repo={
  event:async()=>({order_id:id,session_id:session.id}),
  order:async()=>({...order,status:"paid",purchase_id:"purchase_synthetic"}),
  confirm:async()=>{throw Error("No purchase confirmation on duplicate");}
 };
 const fake=client();
 fake.checkout.sessions.retrieve=async()=>{throw Error("No Checkout retrieval on duplicate");};
 const result=await processWebhook(value.raw,value.signature,settings,repo,fake);
 assert.equal(result.duplicate,true);
 assert.equal(result.status,"paid");
});


test("refund_required creates one full idempotent live refund and confirms refunded state",async()=>{
 const value=signed(event());
 const calls=[];
 const repo={
  event:async()=>null,
  order:async()=>({...order}),
  bind:async()=>{throw Error("Already bound");},
  confirm:async()=>({created:true,status:"refund_required",contact_release_enabled:false}),
  refund:async()=>({order_id:id,status:"refund_required",refund_id:null,payment_id:"pi_synthetic",amount_cents:3990,currency:"USD"}),
  confirmRefund:async data=>{calls.push(data);return {created:true,status:"refunded",refund_id:data.refundId,contact_release_enabled:false,processor_refund_confirmed:true};}
 };
 const fake=client();
 const created=[];
 fake.refunds.create=async(params,options)=>{
  created.push({params,options});
  return {id:"re_synthetic",payment_intent:"pi_synthetic",currency:"usd",amount:3990,status:"succeeded"};
 };
 const result=await processWebhook(value.raw,value.signature,settings,repo,fake);
 assert.equal(result.status,"refunded");
 assert.equal(result.contact_release_enabled,false);
 assert.equal(result.processor_refund_confirmed,true);
 assert.equal(created.length,1);
 assert.equal(created[0].params.amount,3990);
 assert.equal(created[0].params.payment_intent,"pi_synthetic");
 assert.equal(created[0].options.idempotencyKey,"gef-live-refund:"+id);
 assert.equal(calls.length,1);
});

test("pending live refund keeps contact blocked and does not mark refunded",async()=>{
 const value=signed(event());
 let confirmed=0;
 const repo={
  event:async()=>null,
  order:async()=>({...order}),
  bind:async()=>{},
  confirm:async()=>({created:true,status:"refund_required",contact_release_enabled:false}),
  refund:async()=>null,
  confirmRefund:async()=>{confirmed++;throw Error("Pending refund must not be confirmed");}
 };
 const fake=client();
 fake.refunds.create=async()=>({id:"re_pending",payment_intent:"pi_synthetic",currency:"usd",amount:3990,status:"pending"});
 const result=await processWebhook(value.raw,value.signature,settings,repo,fake);
 assert.equal(result.status,"refund_required");
 assert.equal(result.processor_refund_confirmed,false);
 assert.equal(result.contact_release_enabled,false);
 assert.equal(confirmed,0);
});

test("duplicate paid webhook recovers refund_required without duplicating payment confirmation",async()=>{
 const value=signed(event());
 let purchaseConfirmations=0,refundConfirmations=0,refundCreates=0;
 const repo={
  event:async()=>({order_id:id,session_id:session.id}),
  order:async()=>({...order,status:"refund_required",payment_id:"pi_synthetic",purchase_id:null}),
  confirm:async()=>{purchaseConfirmations++;throw Error("No purchase confirmation on duplicate");},
  refund:async()=>({order_id:id,status:"refund_required",refund_id:null,payment_id:"pi_synthetic",amount_cents:3990,currency:"USD"}),
  confirmRefund:async data=>{refundConfirmations++;return {created:true,status:"refunded",refund_id:data.refundId,contact_release_enabled:false,processor_refund_confirmed:true};}
 };
 const fake=client();
 fake.checkout.sessions.retrieve=async()=>{throw Error("No Checkout retrieval on duplicate");};
 fake.refunds.create=async(params,options)=>{
  refundCreates++;
  assert.equal(options.idempotencyKey,"gef-live-refund:"+id);
  return {id:"re_retry",payment_intent:params.payment_intent,currency:"usd",amount:params.amount,status:"succeeded"};
 };
 const result=await processWebhook(value.raw,value.signature,settings,repo,fake);
 assert.equal(result.status,"refunded");
 assert.equal(purchaseConfirmations,0);
 assert.equal(refundCreates,1);
 assert.equal(refundConfirmations,1);
});

test("contact access endpoint fails closed before authentication while marketplace is disabled",async()=>{
 const savedFetch=global.fetch;
 global.fetch=()=>{throw Error("Unexpected network call");};
 const previous={...process.env};
 try{
  delete process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW;
  process.env.GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED="false";
  const handler=require("../api/contractor/contact-access");
  const req=Readable.from([]);req.method="GET";req.query={opportunity_id:id};req.headers={};
  let data;const res={setHeader(){},end(s){data=JSON.parse(s);}};
  await handler(req,res);
  assert.equal(res.statusCode,503);
  assert.match(data.error,/not enabled/);
 }finally{
  global.fetch=savedFetch;
  for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];
  Object.assign(process.env,previous);
 }
});
