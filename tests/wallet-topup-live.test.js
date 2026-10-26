"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Stripe=require("stripe");
const {topupCheckoutParameters,assertTopupSession,processTopupWebhook}=require("../api/_lib/stripe-live-topup");

const intent={
  id:"40000000-0000-4000-8000-000000000001",
  contractor_id:"40000000-0000-4000-8000-000000000002",
  purpose:"wallet_topup",
  provider:"stripe_live",
  status:"pending",
  amount_cents:10000,
  bonus_cents:1500,
  currency:"USD",
  checkout_session_id:null
};
const secret="wh"+"sec_SyntheticOnly";
const key=["rk","live","SyntheticOnlyKeyForTests"].join("_");
const settings={key,secret,expectedAccountId:"acct_SyntheticLiveOnly",origin:"https://www.getestimatefast.com"};
const sdk=new Stripe(key);

function session(changes={}){
  return {
    id:"cs_live_topup_synthetic",
    livemode:true,
    status:"complete",
    payment_status:"paid",
    payment_intent:"pi_topup_synthetic",
    mode:"payment",
    currency:"usd",
    amount_total:intent.amount_cents,
    client_reference_id:intent.id,
    metadata:{gef_topup_intent_id:intent.id,gef_purpose:"wallet_topup",gef_mode:"live"},
    ...changes
  };
}
function signed(event){
  const payload=JSON.stringify(event);
  return {raw:Buffer.from(payload),signature:sdk.webhooks.generateTestHeaderString({payload,secret})};
}
function client(changes={}){
  return {
    accounts:{retrieve:async()=>({object:"account",id:settings.expectedAccountId})},
    webhooks:sdk.webhooks,
    checkout:{sessions:{retrieve:async()=>session(changes)}}
  };
}

test("wallet top-up Checkout charges only paid amount and snapshots purpose",()=>{
  const params=topupCheckoutParameters(intent,settings.origin);
  assert.equal(params.line_items[0].price_data.unit_amount,10000);
  assert.equal(params.metadata.gef_purpose,"wallet_topup");
  assert.equal(params.metadata.gef_topup_intent_id,intent.id);
  assert.equal(params.success_url,"https://www.getestimatefast.com/contractor-portal.html?wallet=pending");
  assert.equal(params.cancel_url,"https://www.getestimatefast.com/contractor-portal.html?wallet=canceled");
});

test("wallet top-up session rejects amount and purpose mismatches",()=>{
  assert.doesNotThrow(()=>assertTopupSession(intent,session(),false));
  assert.throws(()=>assertTopupSession(intent,session({amount_total:11500}),false),/does not match/);
  assert.throws(()=>assertTopupSession(intent,session({metadata:{gef_topup_intent_id:intent.id,gef_purpose:"contact",gef_mode:"live"}}),false),/does not match/);
});

test("signed paid top-up webhook confirms wallet credit exactly once",async()=>{
  const calls=[];
  const repo={
    topupEvent:async()=>null,
    topup:async()=>({...intent}),
    bindTopup:async()=>({}),
    confirmTopup:async value=>{calls.push(value);return {created:true,status:"confirmed",available:{available_cents:11500}};}
  };
  const evt={id:"evt_topup_synthetic",livemode:true,type:"checkout.session.completed",data:{object:{id:"cs_live_topup_synthetic"}}};
  const value=signed(evt);
  const result=await processTopupWebhook(value.raw,value.signature,settings,repo,client());
  assert.equal(result.status,"confirmed");
  assert.equal(calls.length,1);
  assert.equal(calls[0].amount,10000);
  assert.equal(calls[0].paymentId,"pi_topup_synthetic");
});

test("duplicate top-up webhook does not credit again",async()=>{
  let confirmations=0;
  const repo={
    topupEvent:async()=>({payment_intent_id:intent.id,checkout_session_id:"cs_live_topup_synthetic"}),
    topup:async()=>({...intent,status:"confirmed",checkout_session_id:"cs_live_topup_synthetic"}),
    bindTopup:async()=>{throw Error("must not bind");},
    confirmTopup:async()=>{confirmations++;throw Error("must not confirm");}
  };
  const evt={id:"evt_topup_duplicate",livemode:true,type:"checkout.session.completed",data:{object:{id:"cs_live_topup_synthetic"}}};
  const value=signed(evt);
  const result=await processTopupWebhook(value.raw,value.signature,settings,repo,client());
  assert.equal(result.duplicate,true);
  assert.equal(result.status,"confirmed");
  assert.equal(confirmations,0);
});
