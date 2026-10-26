"use strict";
const {cents}=require("./marketplace-pricing");
const {verifyLiveAccount,clientFor}=require("./stripe-live");

function topupCheckoutParameters(intent,origin){
  cents(Number(intent.amount_cents));
  if(intent.currency!=="USD"||intent.status!=="pending"||intent.provider!=="stripe_live"||intent.purpose!=="wallet_topup")throw Error("Invalid live wallet top-up");
  const metadata={gef_topup_intent_id:intent.id,gef_purpose:"wallet_topup",gef_mode:"live"};
  return {
    mode:"payment",
    client_reference_id:intent.id,
    metadata,
    payment_intent_data:{metadata},
    line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:Number(intent.amount_cents),product_data:{name:"GetEstimateFast wallet credits"}}}],
    success_url:origin+"/contractor-portal.html?wallet=pending",
    cancel_url:origin+"/contractor-portal.html?wallet=canceled"
  };
}

function assertTopupSession(intent,session,requireBound=true){
  if(!intent||session.livemode!==true||
     (requireBound&&session.id!==intent.checkout_session_id)||
     !String(session.id||"").startsWith("cs_live_")||
     (intent.checkout_session_id&&intent.checkout_session_id!==session.id)||
     session.client_reference_id!==intent.id||
     session.metadata?.gef_topup_intent_id!==intent.id||
     session.metadata?.gef_mode!=="live"||
     session.metadata?.gef_purpose!=="wallet_topup"||
     session.mode!=="payment"||
     session.currency!=="usd"||
     session.amount_total!==Number(intent.amount_cents)){
    throw Error("Checkout does not match the live wallet top-up");
  }
}

async function createTopupCheckout(intent,settings,client=clientFor(settings.key)){
  const params=topupCheckoutParameters(intent,settings.origin);
  await verifyLiveAccount(settings,client);
  const session=intent.checkout_session_id
    ? await client.checkout.sessions.retrieve(intent.checkout_session_id)
    : await client.checkout.sessions.create(params,{idempotencyKey:"gef-live-topup:"+intent.id});
  if(session.livemode!==true||!String(session.id||"").startsWith("cs_live_"))throw Error("Unexpected Stripe mode");
  assertTopupSession(intent,session,false);
  if(session.status!=="open")throw Error("Checkout unavailable");
  const link=new URL(session.url);
  if(link.origin!=="https://checkout.stripe.com")throw Error("Unexpected Checkout destination");
  return {id:session.id,url:session.url};
}

const idOf=value=>typeof value==="string"?value:value?.id;

async function processTopupWebhook(raw,signature,settings,repository,client=clientFor(settings.key)){
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

  const previous=await repository.topupEvent(event.id);
  if(previous){
    if(previous.checkout_session_id!==eventSession)throw Error("Event identity conflict");
    const prior=await repository.topup(previous.payment_intent_id);
    return {received:true,duplicate:true,status:prior?.status};
  }

  const session=await client.checkout.sessions.retrieve(eventSession);
  if(session.metadata?.gef_purpose!=="wallet_topup")return {received:true,ignored:true};

  const intent=await repository.topup(session.metadata?.gef_topup_intent_id);
  assertTopupSession(intent,session,false);

  if(!intent.checkout_session_id){
    await repository.bindTopup(intent.id,session.id);
    intent.checkout_session_id=session.id;
  }

  let outcome;
  if(session.payment_status==="paid"&&session.status==="complete")outcome="paid";
  else if(session.status==="expired")outcome="expired";
  else if(event.type==="checkout.session.async_payment_failed"&&session.payment_status==="unpaid")outcome="failed";
  else return {received:true,pending:true};

  const payment=idOf(session.payment_intent);
  if(outcome==="paid"&&!String(payment||"").startsWith("pi_"))throw Error("Confirmed payment required");

  return repository.confirmTopup({
    intentId:intent.id,
    eventId:event.id,
    sessionId:session.id,
    paymentId:payment||null,
    outcome,
    amount:session.amount_total,
    currency:"USD",
    mode:"live"
  });
}

module.exports={topupCheckoutParameters,assertTopupSession,createTopupCheckout,processTopupWebhook};
