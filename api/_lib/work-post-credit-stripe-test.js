"use strict";
const Stripe=require("stripe");
const {config}=require("../admin/_auth");
const {DEVELOPMENT_REF}=require("./preview-target");
const {EXPECTED_TEST_ACCOUNT_ID,accountConfiguration,verifyTestAccount}=require("./stripe-account");

const BRANCH="feature/work-opportunities-mvp";
const PROJECT="prj_kA6x5rt1MChiNSQpa6pShHoUSuOF";

function allowedScope(env=process.env){
 return env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"
  && env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF===DEVELOPMENT_REF
  && env.GETESTIMATEFAST_SMS_MODE==="dry_run"
  && env.GETESTIMATEFAST_STRIPE_MODE==="test"
  && env.GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID===EXPECTED_TEST_ACCOUNT_ID
  && env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_ENABLED==="true"
  && (
   env.VERCEL_ENV==="development"
   || (
    env.VERCEL_ENV==="preview"
    && env.VERCEL_GIT_COMMIT_REF===BRANCH
    && env.VERCEL_PROJECT_ID===PROJECT
   )
  );
}
function checkoutApproved(env=process.env){
 return allowedScope(env)&&env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_CHECKOUT_APPROVED==="true"
  && env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_ENABLED==="true";
}
function webhookApproved(env=process.env){
 return allowedScope(env)&&env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_ENABLED==="true";
}
function readiness(env=process.env){
 return {
  test_only:true,
  checkout_enabled:checkoutApproved(env)
    && /^sk_test_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY||"")
    && /^whsec_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_SECRET||""),
  webhook_enabled:webhookApproved(env)
    && /^sk_test_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY||"")
    && /^whsec_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_SECRET||"")
 };
}
function configuration(operation="checkout",env=process.env){
 const approved=operation==="checkout"?checkoutApproved(env):operation==="webhook"?webhookApproved(env):false;
 if(!approved)throw Error("Work post Stripe test operation is disabled");
 config(env);
 const expectedAccountId=accountConfiguration(env);
 const key=env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY;
 const secret=env.GETESTIMATEFAST_WORK_POST_STRIPE_TEST_WEBHOOK_SECRET;
 if(!/^sk_test_[A-Za-z0-9]+$/.test(key||"")||!/^whsec_[A-Za-z0-9]+$/.test(secret||""))
  throw Error("Stripe test configuration unavailable");
 const origin=new URL(env.GETESTIMATEFAST_PUBLIC_ORIGIN||"");
 if(origin.protocol!=="https:"||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=="/")
  throw Error("Trusted HTTPS preview origin required");
 if(env.VERCEL_ENV==="preview"&&!origin.hostname.endsWith(".vercel.app"))
  throw Error("Sandbox Preview hostname required");
 return {key,secret,origin:origin.origin,expectedAccountId};
}
function clientFor(key){
 return new Stripe(key,{apiVersion:"2026-09-30.endive",maxNetworkRetries:2,timeout:15000});
}
function assertOrder(order){
 if(!order||order.mode!=="test"||order.currency!=="USD"||order.status!=="reserved")
  throw Error("Invalid work post credit order");
 if(!["extra_4","extra_15"].includes(order.package_code))throw Error("Invalid work post credit package");
 const expected=order.package_code==="extra_4"?{posts:4,amount:700}:{posts:15,amount:1500};
 if(Number(order.posts)!==expected.posts||Number(order.amount_cents)!==expected.amount)
  throw Error("Work post credit snapshot mismatch");
}
function checkoutParameters(order,origin){
 assertOrder(order);
 if(order.checkout_origin!==origin)throw Error("Checkout origin changed");
 const expires=Math.floor(Date.parse(order.checkout_expires_at)/1000);
 if(!Number.isSafeInteger(expires))throw Error("Checkout expiry required");
 const metadata={
  gef_order_id:order.id,
  gef_purpose:"work_post_credits",
  gef_mode:"test",
  gef_package:order.package_code,
  gef_posts:String(order.posts)
 };
 return {
  mode:"payment",
  payment_method_types:["card"],
  client_reference_id:order.id,
  metadata,
  payment_intent_data:{metadata},
  expires_at:expires,
  line_items:[{
   quantity:1,
   price_data:{
    currency:"usd",
    unit_amount:Number(order.amount_cents),
    product_data:{name:"GetEstimateFast +"+order.posts+" Work Opportunity posts"}
   }
  }],
  success_url:origin+"/contractor-portal.html?work_credits=pending&order="+encodeURIComponent(order.id),
  cancel_url:origin+"/contractor-portal.html?work_credits=canceled"
 };
}
function assertSession(order,session,requireBound=true){
 assertOrder(order);
 if(session.livemode!==false
   || !/^cs_test_[A-Za-z0-9_]+$/.test(session.id||"")
   || (requireBound&&session.id!==order.session_id)
   || (order.session_id&&order.session_id!==session.id)
   || session.client_reference_id!==order.id
   || session.metadata?.gef_order_id!==order.id
   || session.metadata?.gef_purpose!=="work_post_credits"
   || session.metadata?.gef_mode!=="test"
   || session.metadata?.gef_package!==order.package_code
   || Number(session.metadata?.gef_posts)!==Number(order.posts)
   || session.mode!=="payment"
   || session.currency!=="usd"
   || session.amount_total!==Number(order.amount_cents))
  throw Error("Checkout does not match work post credit order");
}
async function createCheckout(order,settings,client=clientFor(settings.key)){
 const params=checkoutParameters(order,settings.origin);
 const seconds=params.expires_at-Math.floor(Date.now()/1000);
 if(!order.session_id&&(seconds<1860||seconds>86400))throw Error("Checkout window closed");
 await verifyTestAccount(settings,client);
 const session=order.session_id
  ? await client.checkout.sessions.retrieve(order.session_id)
  : await client.checkout.sessions.create(params,{idempotencyKey:"gef-work-credit:"+order.id});
 if(session.status!=="open"||session.expires_at!==params.expires_at)throw Error("Checkout unavailable");
 assertSession(order,session,false);
 const link=new URL(session.url);
 if(link.origin!=="https://checkout.stripe.com")throw Error("Unexpected Checkout destination");
 return {id:session.id,url:session.url};
}
async function processWebhook(raw,signature,settings,{readOrder,bind,confirm},client=clientFor(settings.key)){
 const event=client.webhooks.constructEvent(raw,signature,settings.secret,300);
 if(event.livemode!==false||!/^evt_[A-Za-z0-9_]+$/.test(event.id||""))throw Error("Test event required");
 const handled=new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired"
 ]);
 if(!handled.has(event.type))return {received:true,ignored:true};
 await verifyTestAccount(settings,client);
 const source=event.data?.object;
 const sessionId=source?.id;
 if(!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId||""))throw Error("Test Checkout session required");
 const session=await client.checkout.sessions.retrieve(sessionId);
 const orderId=session.metadata?.gef_order_id;
 if(!/^[0-9a-f-]{36}$/i.test(orderId||""))throw Error("Order metadata missing");
 const order=await readOrder(orderId);
 if(!order)throw Error("Order unavailable");
 assertSession(order,session,false);
 if(!order.session_id){
  if(typeof bind!=="function")throw Error("Unbound session requires recovery");
  const bound=await bind(order.id,session.id);
  if(bound?.ok!==true)throw Error("Session recovery failed");
  order.session_id=session.id;
 }
 let outcome="pending";
 if(session.payment_status==="paid"&&session.status==="complete")outcome="paid";
 else if(session.status==="expired")outcome="expired";
 else if(event.type==="checkout.session.async_payment_failed"&&session.payment_status==="unpaid")outcome="failed";
 const payment=typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id;
 if(outcome==="paid"&&!/^pi_[A-Za-z0-9_]+$/.test(payment||""))throw Error("Confirmed payment required");
 return {
  received:true,
  ...(await confirm({
   orderId:order.id,
   eventId:event.id,
   sessionId:session.id,
   paymentId:payment||null,
   outcome,
   amount:session.amount_total,
   currency:"USD",
   mode:"test"
  }))
 };
}
module.exports={
 BRANCH,allowedScope,checkoutApproved,webhookApproved,readiness,configuration,
 clientFor,checkoutParameters,assertSession,createCheckout,processWebhook
};
