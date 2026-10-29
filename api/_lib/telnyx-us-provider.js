"use strict";
const TELNYX_SMS_ENDPOINT="https://api.telnyx.com/v2/messages";
const DEFAULT_ORIGIN="https://getestimatefast.com";

function normalizeUsPhone(value){
  if(typeof value!=="string"||!/^[+0-9(). -]{10,25}$/.test(value))return null;
  let digits=value.replace(/\D/g,"");
  if(digits.length===11&&digits.startsWith("1"))digits=digits.slice(1);
  if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits))return null;
  return "+1"+digits;
}

function validUuid(value){
  return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function opportunityUrl(opportunityId,origin=DEFAULT_ORIGIN){
  if(!validUuid(opportunityId))throw Error("Invalid opportunity id");
  const base=new URL(origin);
  if(base.protocol!=="https:")throw Error("HTTPS origin required");
  return base.origin+"/o/"+opportunityId;
}

function formatTelnyxOpportunityNotice({city,opportunityId,origin=DEFAULT_ORIGIN}){
  if(typeof city!=="string"||!/^[A-Za-z][A-Za-z .-]{1,79}$/.test(city.trim()))throw Error("Invalid city");
  const text="GetEstimateFast: New job near "+city.trim()+", FL. View: "+opportunityUrl(opportunityId,origin)+" Reply STOP to opt out.";
  if(text.length>160)throw Error("Message requires segmentation");
  return text;
}

function prepareTelnyxPayload({from,phone,city,opportunityId,origin=DEFAULT_ORIGIN}){
  const sender=normalizeUsPhone(from),to=normalizeUsPhone(phone);
  if(!sender)throw Error("Invalid Telnyx sender number");
  if(!to)throw Error("Invalid US recipient number");
  return {from:sender,to,text:formatTelnyxOpportunityNotice({city,opportunityId,origin})};
}

function formatTelnyxControlledTestNotice(){
  return "GetEstimateFast: Telnyx controlled SMS test successful. Reply STOP to opt out.";
}

function prepareTelnyxControlledTestPayload({from,phone}){
  const sender=normalizeUsPhone(from),to=normalizeUsPhone(phone);
  if(!sender)throw Error("Invalid Telnyx sender number");
  if(!to)throw Error("Invalid US recipient number");
  return {from:sender,to,text:formatTelnyxControlledTestNotice()};
}

function readiness(env=process.env){
  const configured=env.GETESTIMATEFAST_SMS_PROVIDER==="telnyx";
  const requestedMode=env.GETESTIMATEFAST_SMS_MODE;
  const mode=requestedMode==="controlled_test"?"controlled_test":requestedMode==="dry_run"?"dry_run":"disabled";
  const api_key_configured=Boolean(env.GETESTIMATEFAST_TELNYX_API_KEY);
  const from=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_FROM_NUMBER||"");
  const brand_approved=env.GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED==="true";
  const campaign_approved=env.GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED==="true";
  const test_recipient_configured=Boolean(normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_TEST_TO||""));
  const controlled_test_enabled=configured&&mode==="controlled_test"&&api_key_configured&&Boolean(from)&&brand_approved&&campaign_approved&&test_recipient_configured;
  return {
    provider:configured?"telnyx":"unconfigured",
    mode,
    endpoint:TELNYX_SMS_ENDPOINT,
    api_key_configured,
    sender_configured:Boolean(from),
    brand_approved,
    campaign_approved,
    test_recipient_configured,
    controlled_test_enabled,
    live_sms_enabled:controlled_test_enabled,
    sms_sent:0,
    next_steps:[
      "Approve the Telnyx 10DLC Brand",
      "Create and approve the Telnyx 10DLC Campaign",
      "Create a server-only Telnyx API v2 key",
      "Configure signed Telnyx inbound/status webhooks",
      "Run a controlled Preview test before any Production send"
    ]
  };
}

async function sendControlledHealthTest({env=process.env,fetchImpl=global.fetch}){
  const state=readiness(env);
  if(!state.controlled_test_enabled){const error=Error("Controlled Telnyx SMS test is not enabled");error.diagnostic_stage="readiness";throw error;}
  if(typeof fetchImpl!=="function"){const error=Error("Fetch unavailable");error.diagnostic_stage="fetch_available";throw error;}
  let payload;
  try{payload=prepareTelnyxControlledTestPayload({
    from:env.GETESTIMATEFAST_TELNYX_FROM_NUMBER,
    phone:env.GETESTIMATEFAST_TELNYX_TEST_TO
  });}catch(cause){const error=Error("Controlled test payload preparation failed");error.diagnostic_stage="payload";throw error;}
  let response;
  try{
    response=await fetchImpl(TELNYX_SMS_ENDPOINT,{
      method:"POST",
      headers:{Authorization:"Bearer "+env.GETESTIMATEFAST_TELNYX_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
  }catch(cause){
    const error=Error("Telnyx transport request failed");
    error.diagnostic_stage="fetch";
    error.telnyx_transport={
      type:typeof cause?.name==="string"?cause.name.slice(0,80):"Error",
      code:typeof cause?.cause?.code==="string"?cause.cause.code.slice(0,80):null,
      message:typeof cause?.message==="string"?cause.message.slice(0,200):"Request failed before HTTP response"
    };
    throw error;
  }
  let data={};try{data=await response.json();}catch{}
  if(!response||typeof response.ok!=="boolean"){const error=Error("Invalid Telnyx HTTP response");error.diagnostic_stage="response";throw error;}
  if(!response.ok){
    const first=Array.isArray(data?.errors)?data.errors[0]:null;
    const error=Error("Telnyx send failed with HTTP "+response.status);
    error.diagnostic_stage="http";
    error.telnyx={
      http_status:response.status,
      code:first?.code==null?null:String(first.code).slice(0,80),
      title:first?.title==null?null:String(first.title).slice(0,160),
      detail:first?.detail==null?null:String(first.detail).slice(0,300)
    };
    throw error;
  }
  return {id:data?.data?.id||null,to:payload.to,from:payload.from,text:payload.text};
}

async function sendControlledTest({phone,city,opportunityId,origin=DEFAULT_ORIGIN,env=process.env,fetchImpl=global.fetch}){
  const state=readiness(env);
  if(!state.live_sms_enabled)throw Error("Controlled Telnyx SMS test is not enabled");
  const allowed=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_TEST_TO||"");
  const to=normalizeUsPhone(phone);
  if(!allowed||!to||to!==allowed)throw Error("Recipient is not the configured controlled test number");
  if(typeof fetchImpl!=="function")throw Error("Fetch unavailable");
  const payload=prepareTelnyxPayload({
    from:env.GETESTIMATEFAST_TELNYX_FROM_NUMBER,
    phone:to,city,opportunityId,origin
  });
  const response=await fetchImpl(TELNYX_SMS_ENDPOINT,{
    method:"POST",
    headers:{
      Authorization:"Bearer "+env.GETESTIMATEFAST_TELNYX_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  });
  let data={};try{data=await response.json();}catch{}
  if(!response.ok){
    const first=Array.isArray(data?.errors)?data.errors[0]:null;
    const error=Error("Telnyx send failed with HTTP "+response.status);
    error.telnyx={
      http_status:response.status,
      code:first?.code==null?null:String(first.code).slice(0,80),
      title:first?.title==null?null:String(first.title).slice(0,160),
      detail:first?.detail==null?null:String(first.detail).slice(0,300)
    };
    throw error;
  }
  return {id:data?.data?.id||null,to:payload.to,from:payload.from,text:payload.text};
}

module.exports={TELNYX_SMS_ENDPOINT,normalizeUsPhone,validUuid,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,formatTelnyxControlledTestNotice,prepareTelnyxControlledTestPayload,readiness,sendControlledHealthTest,sendControlledTest};
