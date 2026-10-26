"use strict";
const crypto=require("node:crypto");
const {normalizeUsPhone}=require("./zenvia-us-provider");

const WEBHOOK_SECRET_HEADER="x-auth-token";

function safeEqualSecret(provided,expected){
  if(typeof provided!=="string"||typeof expected!=="string"||expected.length<32)return false;
  const a=Buffer.from(provided,"utf8"),b=Buffer.from(expected,"utf8");
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

function webhookReadiness(env=process.env){
  return {
    authentication:"shared_header_secret",
    secret_header:WEBHOOK_SECRET_HEADER,
    secret_configured:typeof env.GETESTIMATEFAST_ZENVIA_WEBHOOK_SECRET==="string"&&env.GETESTIMATEFAST_ZENVIA_WEBHOOK_SECRET.length>=32,
    documented_schema_locked:env.GETESTIMATEFAST_ZENVIA_INBOUND_SCHEMA_VERIFIED==="true",
    live_reply_enabled:false
  };
}

function classifyKeyword(text){
  const keyword=String(text||"").trim().toUpperCase();
  if(keyword==="STOP")return "STOP";
  if(keyword==="HELP")return "HELP";
  return "OTHER";
}

function parseZenviaInboundSms(body){
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Invalid webhook body");
  if(body.direction!=="IN")throw Error("Inbound direction required");
  if(String(body.channel||"").toLowerCase()!=="sms")throw Error("SMS channel required");
  if(typeof body.id!=="string"||body.id.length<1||body.id.length>128||!/^[A-Za-z0-9._:-]+$/.test(body.id))throw Error("Invalid message id");
  if(typeof body.timestamp!=="string"||body.timestamp.length>64||Number.isNaN(Date.parse(body.timestamp)))throw Error("Invalid timestamp");
  const from=normalizeUsPhone(body.from);
  if(!from)throw Error("Invalid US sender phone");
  if(typeof body.to!=="string"||body.to.length<1||body.to.length>64)throw Error("Invalid recipient");
  if(!Array.isArray(body.contents)||body.contents.length!==1)throw Error("Exactly one content item is required");
  const item=body.contents[0];
  if(!item||typeof item!=="object"||item.type!=="text"||typeof item.text!=="string")throw Error("Text content required");
  const text=item.text.trim();
  if(!text||text.length>500)throw Error("Invalid text content");
  return {
    provider_event_id:body.id,
    provider_timestamp:new Date(body.timestamp).toISOString(),
    from,
    to:body.to,
    text,
    keyword:classifyKeyword(text)
  };
}

function phoneFingerprint(phone,secret){
  if(!normalizeUsPhone(phone)||typeof secret!=="string"||secret.length<32)throw Error("Fingerprint prerequisites missing");
  return crypto.createHmac("sha256",secret).update(normalizeUsPhone(phone)).digest("hex");
}

function helpResponsePreview(){
  const text="GetEstimateFast: Manage SMS alerts in your profile at getestimatefast.com. Reply STOP to opt out.";
  if(text.length>160)throw Error("HELP response requires segmentation");
  return text;
}

module.exports={
  WEBHOOK_SECRET_HEADER,
  safeEqualSecret,
  webhookReadiness,
  classifyKeyword,
  parseZenviaInboundSms,
  phoneFingerprint,
  helpResponsePreview
};
