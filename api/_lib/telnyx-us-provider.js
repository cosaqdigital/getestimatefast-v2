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

const CONTROLLED_HELP_REPLY="GetEstimateFast: For help visit getestimatefast.com or email admin@getestimatefast.com. Reply STOP to opt out.";

async function sendControlledHelpReply({phone,env=process.env,fetchImpl=global.fetch}){
  const state=readiness(env);
  const to=normalizeUsPhone(phone);
  if(!to){const error=Error("Invalid US recipient number");error.diagnostic_stage="recipient";throw error;}
  if(state.controlled_test_enabled){
    const allowed=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_TEST_TO||"");
    if(!allowed||to!==allowed){const error=Error("Recipient is not the configured controlled test number");error.diagnostic_stage="recipient";throw error;}
  }else if(!state.live_sms_enabled){
    const error=Error("Telnyx SMS reply is not enabled");error.diagnostic_stage="readiness";throw error;
  }
  if(typeof fetchImpl!=="function"){const error=Error("Fetch unavailable");error.diagnostic_stage="fetch_available";throw error;}
  const from=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_FROM_NUMBER||"");
  if(!from){const error=Error("Invalid Telnyx sender number");error.diagnostic_stage="sender";throw error;}
  let response;
  try{
    response=await fetchImpl(TELNYX_SMS_ENDPOINT,{
      method:"POST",
      headers:{Authorization:"Bearer "+env.GETESTIMATEFAST_TELNYX_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({from,to,text:CONTROLLED_HELP_REPLY}),
      signal:AbortSignal.timeout(10000)
    });
  }catch(cause){
    const error=Error("Telnyx HELP reply transport failed");
    error.diagnostic_stage="fetch";
    error.telnyx_transport={code:typeof cause?.cause?.code==="string"?cause.cause.code.slice(0,80):null};
    throw error;
  }
  if(!response||typeof response.ok!=="boolean"){const error=Error("Invalid Telnyx HELP reply response");error.diagnostic_stage="response";throw error;}
  let data={};try{data=await response.json();}catch{}
  if(!response.ok){
    const first=Array.isArray(data?.errors)?data.errors[0]:null;
    const error=Error("Telnyx HELP reply failed with HTTP "+response.status);
    error.diagnostic_stage="http";
    error.telnyx={http_status:response.status,code:first?.code==null?null:String(first.code).slice(0,80)};
    throw error;
  }
  return {id:data?.data?.id||null,to,from,text:CONTROLLED_HELP_REPLY};
}

function readiness(env=process.env){
  const configured=env.GETESTIMATEFAST_SMS_PROVIDER==="telnyx";
  const requestedMode=env.GETESTIMATEFAST_SMS_MODE;
  const mode=requestedMode==="controlled_test"?"controlled_test":requestedMode==="dry_run"?"dry_run":requestedMode==="live"?"live":"disabled";
  const api_key_configured=Boolean(env.GETESTIMATEFAST_TELNYX_API_KEY);
  const from=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_FROM_NUMBER||"");
  const brand_approved=env.GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED==="true";
  const campaign_approved=env.GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED==="true";
  const test_recipient_configured=Boolean(normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_TEST_TO||""));
  const live_approval_configured=env.GETESTIMATEFAST_SMS_LIVE_APPROVED==="true";
  const automation_approval_configured=env.GETESTIMATEFAST_SMS_AUTOMATION_APPROVED==="true";
  const canary_automation_approved=env.GETESTIMATEFAST_SMS_CANARY_AUTOMATION_APPROVED==="true";
  const live_batch_limit=Number(env.GETESTIMATEFAST_SMS_LIVE_BATCH_LIMIT);
  const live_daily_limit=Number(env.GETESTIMATEFAST_SMS_LIVE_DAILY_LIMIT);
  const live_batch_limit_configured=Number.isInteger(live_batch_limit)&&live_batch_limit>=1&&live_batch_limit<=5;
  const live_daily_limit_configured=Number.isInteger(live_daily_limit)&&live_daily_limit>=1&&live_daily_limit<=2000;
  const cron_secret_configured=typeof env.CRON_SECRET==="string"&&env.CRON_SECRET.length>=16;
  const provider_ready=configured&&api_key_configured&&Boolean(from)&&brand_approved&&campaign_approved;
  const controlled_test_enabled=provider_ready&&mode==="controlled_test"&&test_recipient_configured;
  const live_sms_enabled=provider_ready&&mode==="live"&&live_approval_configured;
  const live_worker_enabled=live_sms_enabled&&automation_approval_configured&&live_batch_limit_configured&&live_daily_limit_configured&&cron_secret_configured;
  const canary_worker_enabled=controlled_test_enabled&&canary_automation_approved&&cron_secret_configured;
  return {
    provider:configured?"telnyx":"unconfigured",
    mode,
    endpoint:TELNYX_SMS_ENDPOINT,
    api_key_configured,
    sender_configured:Boolean(from),
    brand_approved,
    campaign_approved,
    test_recipient_configured,
    live_approval_configured,
    automation_approval_configured,
    canary_automation_approved,
    live_batch_limit:live_batch_limit_configured?live_batch_limit:null,
    live_daily_limit:live_daily_limit_configured?live_daily_limit:null,
    cron_secret_configured,
    controlled_test_enabled,
    live_sms_enabled,
    live_worker_enabled,
    canary_worker_enabled,
    compliance_reply_enabled:controlled_test_enabled||live_sms_enabled,
    sms_sent:0,
    next_steps:[
      "Approve the Telnyx 10DLC Brand",
      "Create and approve the Telnyx 10DLC Campaign",
      "Create a server-only Telnyx API v2 key",
      "Configure signed Telnyx inbound/status webhooks",
      "Run a controlled Preview test before any Production send",
      "Set GETESTIMATEFAST_SMS_LIVE_APPROVED=true only after the production queue and consent gates are verified",
      "Set GETESTIMATEFAST_SMS_AUTOMATION_APPROVED=true only after the live worker dry-run and controlled tests pass"
    ]
  };
}

async function sendControlledHealthTest({env=process.env,fetchImpl=global.fetch}={}){
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
  if(!response||typeof response.ok!=="boolean"){const error=Error("Invalid Telnyx HTTP response");error.diagnostic_stage="response";throw error;}
  let data={};try{data=await response.json();}catch{}
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

async function sendLiveOpportunitySms({phone,city,opportunityId,origin=DEFAULT_ORIGIN,env=process.env,fetchImpl=global.fetch}){
  const state=readiness(env);
  if(!state.live_sms_enabled){const error=Error("Live Telnyx SMS is not enabled");error.diagnostic_stage="readiness";throw error;}
  const to=normalizeUsPhone(phone);
  if(!to){const error=Error("Invalid US recipient number");error.diagnostic_stage="recipient";throw error;}
  if(typeof fetchImpl!=="function"){const error=Error("Fetch unavailable");error.diagnostic_stage="fetch_available";throw error;}
  const payload=prepareTelnyxPayload({
    from:env.GETESTIMATEFAST_TELNYX_FROM_NUMBER,
    phone:to,city,opportunityId,origin
  });
  let response;
  try{
    response=await fetchImpl(TELNYX_SMS_ENDPOINT,{
      method:"POST",
      headers:{
        Authorization:"Bearer "+env.GETESTIMATEFAST_TELNYX_API_KEY,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(10000)
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
  if(!response||typeof response.ok!=="boolean"){const error=Error("Invalid Telnyx HTTP response");error.diagnostic_stage="response";throw error;}
  let data={};try{data=await response.json();}catch{}
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
  if(!state.controlled_test_enabled)throw Error("Controlled Telnyx SMS test is not enabled");
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

module.exports={TELNYX_SMS_ENDPOINT,normalizeUsPhone,validUuid,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,formatTelnyxControlledTestNotice,prepareTelnyxControlledTestPayload,CONTROLLED_HELP_REPLY,readiness,sendControlledHealthTest,sendControlledTest,sendLiveOpportunitySms,sendControlledHelpReply};
