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

function readiness(env=process.env){
  const configured=env.GETESTIMATEFAST_SMS_PROVIDER==="telnyx";
  const mode=env.GETESTIMATEFAST_SMS_MODE==="dry_run"?"dry_run":"disabled";
  const api_key_configured=Boolean(env.GETESTIMATEFAST_TELNYX_API_KEY);
  const from=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_FROM_NUMBER||"");
  const brand_approved=env.GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED==="true";
  const campaign_approved=env.GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED==="true";
  return {
    provider:configured?"telnyx":"unconfigured",
    mode,
    endpoint:TELNYX_SMS_ENDPOINT,
    api_key_configured,
    sender_configured:Boolean(from),
    brand_approved,
    campaign_approved,
    live_sms_enabled:false,
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

module.exports={TELNYX_SMS_ENDPOINT,normalizeUsPhone,validUuid,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,readiness};
