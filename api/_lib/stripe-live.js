"use strict";
const Stripe=require("stripe");
const {cents}=require("./marketplace-pricing");

const SECRET_PREFIX=["sk","live"].join("_")+"_";
const WEBHOOK_PREFIX="wh"+"sec_";

function liveConfiguration(env=process.env){
  const key=String(env.GETESTIMATEFAST_STRIPE_LIVE_SECRET_KEY||"");
  const secret=String(env.GETESTIMATEFAST_STRIPE_LIVE_WEBHOOK_SECRET||"");
  const expectedAccountId=String(env.GETESTIMATEFAST_STRIPE_LIVE_ACCOUNT_ID||"");
  if(!key.startsWith(SECRET_PREFIX)||key.length<24)throw Error("Stripe live key unavailable");
  if(!secret.startsWith(WEBHOOK_PREFIX)||secret.length<16)throw Error("Stripe live webhook secret unavailable");
  if(!expectedAccountId.startsWith("acct_")||expectedAccountId.length<12)throw Error("Stripe live account unavailable");
  return {key,secret,expectedAccountId,origin:"https://www.getestimatefast.com"};
}

function clientFor(key){
  return new Stripe(key,{apiVersion:"2026-09-30.endive",maxNetworkRetries:2,timeout:15000});
}

async function verifyLiveAccount(settings,client=clientFor(settings.key)){
  try{
    const account=await client.accounts.retrieve(null);
    if(account?.object!=="account"||account.id!==settings.expectedAccountId||account.deleted===true)throw Error("Mismatch");
  }catch{
    throw Error("Stripe live identity verification failed");
  }
  return {verified:true};
}

function checkoutParameters(order,origin){
  cents(Number(order.amount_cents));
  if(order.currency!=="USD"||order.status!=="reserved")throw Error("Invalid reserved live order");
  const expires=Math.floor(Date.parse(order.reserved_until)/1000);
  if(!Number.isSafeInteger(expires))throw Error("Persisted Checkout expiry required");
  const metadata={gef_order_id:order.id,gef_purpose:"contact",gef_mode:"live"};
  return {
    mode:"payment",
    payment_method_types:["card"],
    client_reference_id:order.id,
    metadata,
    payment_intent_data:{metadata},
    expires_at:expires,
    line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:Number(order.amount_cents),product_data:{name:"GetEstimateFast contact"}}}],
    success_url:origin+"/contractor-portal.html?payment=pending",
    cancel_url:origin+"/contractor-portal.html?payment=canceled"
  };
}

function assertSession(order,session,requireBound=true){
  if(!order||session.livemode!==true||
     (requireBound&&session.id!==order.session_id)||
     !String(session.id||"").startsWith("cs_live_")||
     (order.session_id&&order.session_id!==session.id)||
     session.client_reference_id!==order.id||
     session.metadata?.gef_order_id!==order.id||
     session.metadata?.gef_mode!=="live"||
     session.metadata?.gef_purpose!=="contact"||
     session.mode!=="payment"||
     session.currency!=="usd"||
     session.amount_total!==Number(order.amount_cents)){
    throw Error("Checkout does not match the live order");
  }
}

async function createCheckout(order,settings,client=clientFor(settings.key)){
  const params=checkoutParameters(order,settings.origin);
  await verifyLiveAccount(settings,client);
  const seconds=params.expires_at-Math.floor(Date.now()/1000);
  if(!order.session_id&&(seconds<1860||seconds>86400))throw Error("Checkout creation window closed");
  const session=order.session_id
    ? await client.checkout.sessions.retrieve(order.session_id)
    : await client.checkout.sessions.create(params,{idempotencyKey:"gef-live-order:"+order.id});
  if(session.livemode!==true||!String(session.id||"").startsWith("cs_live_"))throw Error("Unexpected Stripe mode");
  assertSession(order,session,false);
  if(session.status!=="open")throw Error("Checkout unavailable");
  const link=new URL(session.url);
  if(link.origin!=="https://checkout.stripe.com")throw Error("Unexpected Checkout destination");
  return {id:session.id,url:session.url};
}

async function readRaw(req,limit=262144){
  const descriptor=Object.getOwnPropertyDescriptor(req,"body");
  if(!req[Symbol.asyncIterator]){
    const body=descriptor?.value;
    if(!Buffer.isBuffer(body)&&typeof body!=="string")throw Error("Raw webhook body required");
    const bytes=Buffer.from(body);
    if(bytes.length>limit)throw Error("Webhook too large");
    return bytes;
  }
  const chunks=[];let size=0;
  for await(const chunk of req){
    const bytes=Buffer.from(chunk);size+=bytes.length;
    if(size>limit)throw Error("Webhook too large");
    chunks.push(bytes);
  }
  if(req.aborted)throw Error("Incomplete webhook body");
  return Buffer.concat(chunks);
}

const idOf=value=>typeof value==="string"?value:value?.id;

async function reconcileLiveRefund(order,repository,client){
  if(!order||!["refund_required","refunded"].includes(order.status))return null;
  if(order.status==="refunded")return {status:"refunded",contact_release_enabled:false,processor_refund_confirmed:true};
  const paymentId=String(order.payment_id||"");
  if(!paymentId.startsWith("pi_"))throw Error("Known live payment required for refund");

  const payment=await client.paymentIntents.retrieve(paymentId);
  if(payment?.id!==paymentId||payment.livemode!==true||payment.currency!=="usd"||
     payment.status!=="succeeded"||Number(payment.amount_received)!==Number(order.amount_cents)||
     payment.metadata?.gef_order_id!==order.id||payment.metadata?.gef_mode!=="live"||
     payment.metadata?.gef_purpose!=="contact"){
    throw Error("Refund payment does not match live order");
  }

  const known=await repository.refund(order.id);
  const refund=known?.refund_id
    ? await client.refunds.retrieve(known.refund_id)
    : await client.refunds.create({
        payment_intent:paymentId,
        amount:Number(order.amount_cents),
        metadata:{gef_order_id:order.id,gef_purpose:"contact",gef_mode:"live"}
      },{idempotencyKey:"gef-live-refund:"+order.id});

  if(!String(refund?.id||"").startsWith("re_")||
     idOf(refund.payment_intent)!==paymentId||
     refund.currency!=="usd"||Number(refund.amount)!==Number(order.amount_cents)){
    throw Error("Refund does not match verified live payment");
  }

  if(refund.status!=="succeeded"){
    return {
      status:"refund_required",
      refund_id:refund.id,
      processor_refund_confirmed:false,
      contact_release_enabled:false
    };
  }

  return repository.confirmRefund({
    orderId:order.id,
    refundId:refund.id,
    paymentId,
    amount:Number(refund.amount),
    currency:"USD",
    mode:"live",
    status:refund.status
  });
}

async function processWebhook(raw,signature,settings,repository,client=clientFor(settings.key)){
  const event=client.webhooks.constructEvent(raw,signature,settings.secret,300);
  if(event.livemode!==true||!String(event.id||"").startsWith("evt_"))throw Error("Live event required");
  await verifyLiveAccount(settings,client);

  const supported=new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired"
  ]);
  if(!supported.has(event.type))return {received:true,ignored:true};

  const eventSession=event.data?.object?.id;
  if(!String(eventSession||"").startsWith("cs_live_"))throw Error("Live Checkout session required");

  const previous=await repository.event(event.id);
  if(previous){
    if(previous.session_id!==eventSession)throw Error("Event identity conflict");
    const priorOrder=await repository.order(previous.order_id);
    if(priorOrder?.status==="refund_required"){
      return reconcileLiveRefund(priorOrder,repository,client);
    }
    return {received:true,duplicate:true,status:priorOrder?.status};
  }

  const session=await client.checkout.sessions.retrieve(eventSession);
  const order=await repository.order(session.metadata?.gef_order_id);
  assertSession(order,session,false);

  if(!order.session_id){
    await repository.bind(order.id,session.id);
    order.session_id=session.id;
  }

  let outcome;
  if(session.payment_status==="paid"&&session.status==="complete")outcome="paid";
  else if(session.status==="expired")outcome="expired";
  else if(event.type==="checkout.session.async_payment_failed"&&session.payment_status==="unpaid")outcome="failed";
  else return {received:true,pending:true};

  const payment=idOf(session.payment_intent);
  if(outcome==="paid"&&!String(payment||"").startsWith("pi_"))throw Error("Confirmed payment required");

  const result=await repository.confirm({
    orderId:order.id,
    eventId:event.id,
    sessionId:session.id,
    paymentId:payment||null,
    outcome,
    amount:session.amount_total,
    currency:"USD",
    mode:"live"
  });

  if(result?.status==="refund_required"){
    return reconcileLiveRefund({...order,status:"refund_required",payment_id:payment},repository,client);
  }
  return result;
}

module.exports={
  liveConfiguration,
  clientFor,
  verifyLiveAccount,
  checkoutParameters,
  assertSession,
  createCheckout,
  readRaw,
  reconcileLiveRefund,
  processWebhook
};
