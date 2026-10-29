"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");

const {
 allowedScope,checkoutApproved,webhookApproved,readiness,
 checkoutParameters,assertSession,processWebhook
}=require("../api/_lib/work-post-credit-stripe-test");
const {EXPECTED_TEST_ACCOUNT_ID}=require("../api/_lib/stripe-account");

const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function env(extra={}){
 return {
  GETESTIMATEFAST_ISOLATED_BACKEND:"true",
  GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:"cpjsbijgijeyrwjpuciv",
  GETESTIMATEFAST_SMS_MODE:"dry_run",
  GETESTIMATEFAST_STRIPE_MODE:"test",
  GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID:EXPECTED_TEST_ACCOUNT_ID,
  GETESTIMATEFAST_WORK_POST_STRIPE_TEST_ENABLED:"true",
  GETESTIMATEFAST_WORK_POST_STRIPE_TEST_CHECKOUT_APPROVED:"true",
  GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_ENABLED:"true",
  GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY:"sk_test_synthetic",
  GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_SECRET:"whsec_synthetic",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://preview-example.vercel.app",
  VERCEL_ENV:"preview",
  VERCEL_GIT_COMMIT_REF:"feature/work-opportunities-mvp",
  VERCEL_PROJECT_ID:"prj_kA6x5rt1MChiNSQpa6pShHoUSuOF",
  ...extra
 };
}
function order(packageCode="extra_4"){
 const posts=packageCode==="extra_4"?4:15;
 const amount=packageCode==="extra_4"?700:1500;
 return {
  id:"40000000-0000-4000-8000-000000000001",
  contractor_id:"40000000-0000-4000-8000-000000000002",
  package_code:packageCode,
  posts,
  amount_cents:amount,
  currency:"USD",
  mode:"test",
  status:"reserved",
  operation_key:"work-credit-synthetic",
  checkout_origin:"https://preview-example.vercel.app",
  checkout_expires_at:new Date(Date.now()+40*60*1000).toISOString(),
  session_id:null
 };
}

test("work post Stripe test gate is locked to isolated feature Preview",()=>{
 const good=env();
 assert.equal(allowedScope(good),true);
 assert.equal(checkoutApproved(good),true);
 assert.equal(webhookApproved(good),true);
 assert.equal(readiness(good).checkout_enabled,true);
 assert.equal(allowedScope(env({VERCEL_ENV:"production"})),false);
 assert.equal(allowedScope(env({VERCEL_GIT_COMMIT_REF:"main"})),false);
 assert.equal(allowedScope(env({GETESTIMATEFAST_ISOLATED_BACKEND:"false"})),false);
 assert.equal(checkoutApproved(env({GETESTIMATEFAST_WORK_POST_STRIPE_TEST_CHECKOUT_APPROVED:"false"})),false);
});

test("checkout package snapshots are fixed at 4/$7 and 15/$15",()=>{
 const four=checkoutParameters(order("extra_4"),"https://preview-example.vercel.app");
 assert.equal(four.line_items[0].price_data.unit_amount,700);
 assert.equal(four.metadata.gef_posts,"4");
 assert.match(four.line_items[0].price_data.product_data.name,/\+4/);
 const fifteen=checkoutParameters(order("extra_15"),"https://preview-example.vercel.app");
 assert.equal(fifteen.line_items[0].price_data.unit_amount,1500);
 assert.equal(fifteen.metadata.gef_posts,"15");
 assert.match(fifteen.line_items[0].price_data.product_data.name,/\+15/);
});

test("checkout rejects altered package snapshots",()=>{
 assert.throws(()=>checkoutParameters({...order("extra_4"),amount_cents:701},"https://preview-example.vercel.app"));
 assert.throws(()=>checkoutParameters({...order("extra_15"),posts:14},"https://preview-example.vercel.app"));
});

test("Stripe session identity binds package amount and metadata",()=>{
 const o=order("extra_4");
 const params=checkoutParameters(o,o.checkout_origin);
 const session={
  id:"cs_test_synthetic",
  livemode:false,
  client_reference_id:o.id,
  metadata:params.metadata,
  mode:"payment",
  currency:"usd",
  amount_total:700,
  status:"open",
  expires_at:params.expires_at
 };
 assert.doesNotThrow(()=>assertSession(o,session,false));
 assert.throws(()=>assertSession(o,{...session,amount_total:1500},false));
 assert.throws(()=>assertSession(o,{...session,metadata:{...session.metadata,gef_package:"extra_15"}},false));
});

test("webhook can recover an early unbound session and confirms once",async()=>{
 const o=order("extra_4");
 const params=checkoutParameters(o,o.checkout_origin);
 const session={
  id:"cs_test_synthetic",
  livemode:false,
  client_reference_id:o.id,
  metadata:params.metadata,
  mode:"payment",
  currency:"usd",
  amount_total:700,
  status:"complete",
  payment_status:"paid",
  payment_intent:"pi_synthetic",
  expires_at:params.expires_at
 };
 const event={
  id:"evt_synthetic",
  livemode:false,
  type:"checkout.session.completed",
  data:{object:{id:session.id}}
 };
 const calls={bind:0,confirm:0};
 const client={
  webhooks:{constructEvent:()=>event},
  accounts:{retrieve:async()=>({object:"account",id:EXPECTED_TEST_ACCOUNT_ID})},
  checkout:{sessions:{retrieve:async()=>session}}
 };
 const result=await processWebhook(
  Buffer.from("{}"),"sig",
  {key:"sk_test_synthetic",secret:"whsec_synthetic",origin:o.checkout_origin,expectedAccountId:EXPECTED_TEST_ACCOUNT_ID},
  {
   readOrder:async()=>({...o}),
   bind:async()=>{calls.bind++;return{ok:true}},
   confirm:async payload=>{calls.confirm++;assert.equal(payload.outcome,"paid");assert.equal(payload.amount,700);return{ok:true,status:"paid"}}
  },
  client
 );
 assert.equal(result.status,"paid");
 assert.equal(calls.bind,1);
 assert.equal(calls.confirm,1);
});

test("checkout backend stays isolated while launch UI hides monetization",()=>{
 const api=read("api/contractor/work-post-credit-checkout.js");
 const ui=read("assets/work-posting.js");
 assert.match(api,/VERCEL_ENV==="production"/);
 assert.match(api,/gef_prepare_work_post_credit_order/);
 assert.match(api,/gef_bind_work_post_credit_session/);
 assert.doesNotMatch(ui,/Stripe test checkout not enabled/);
 assert.doesNotMatch(ui,/Payment confirmed/);
 assert.doesNotMatch(ui,/work-post-credit-checkout/);
 const html=read("contractor-portal.html");
 assert.doesNotMatch(html,/Extra post packages|Buy \+4|Buy \+15|\$7|\$15/);
 assert.match(html,/Free during launch/);
 assert.doesNotMatch(ui,/localStorage/);
});

test("database credits only through confirmed immutable purchase ledger entries",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/create table gef_private\.work_post_credit_orders/);
 assert.match(sql,/create table gef_private\.work_post_credit_events/);
 assert.match(sql,/gef_confirm_work_post_credit_order/);
 assert.match(sql,/'stripe-test-work-credit:'\|\|v_order\.id::text/);
 assert.match(sql,/entry_type,package_code,opportunity_id,operation_key/);
 assert.match(sql,/on conflict\(operation_key\) do nothing/);
 assert.match(sql,/unique\(contractor_id,operation_key\)/);
 assert.match(sql,/revoke all on gef_private\.work_post_credit_orders from public,anon,authenticated/);
});


test("paid work-credit orders remain valid for duplicate Stripe webhook verification",()=>{
 const o={...order("extra_4"),status:"paid",session_id:"cs_test_synthetic"};
 const params=checkoutParameters({...o,status:"reserved",session_id:null},o.checkout_origin);
 const session={
  id:"cs_test_synthetic",
  livemode:false,
  client_reference_id:o.id,
  metadata:params.metadata,
  mode:"payment",
  currency:"usd",
  amount_total:700,
  status:"complete",
  payment_status:"paid",
  payment_intent:"pi_synthetic",
  expires_at:params.expires_at
 };
 assert.doesNotThrow(()=>assertSession(o,session,true,true));
});
