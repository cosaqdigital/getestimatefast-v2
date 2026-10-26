"use strict";
const crypto=require("node:crypto");
const {normalizeUsPhone}=require("./telnyx-us-provider");

const SIGNATURE_HEADER="telnyx-signature-ed25519";
const TIMESTAMP_HEADER="telnyx-timestamp";
const MAX_SKEW_SECONDS=300;

function headerValue(headers,name){
  const wanted=name.toLowerCase();
  for(const [k,v] of Object.entries(headers||{})){
    if(String(k).toLowerCase()===wanted)return Array.isArray(v)?v[0]:v;
  }
  return undefined;
}

function publicKeyObject(publicKeyB64){
  if(typeof publicKeyB64!=="string")throw Error("Telnyx public key missing");
  const raw=Buffer.from(publicKeyB64.trim(),"base64");
  if(raw.length!==32)throw Error("Invalid Telnyx public key");
  const spkiPrefix=Buffer.from("302a300506032b6570032100","hex");
  return crypto.createPublicKey({key:Buffer.concat([spkiPrefix,raw]),format:"der",type:"spki"});
}

function verifyTelnyxSignature(rawBody,headers,publicKeyB64,nowSeconds=Math.floor(Date.now()/1000)){
  if(!Buffer.isBuffer(rawBody))throw Error("Raw webhook body required");
  const signatureB64=String(headerValue(headers,SIGNATURE_HEADER)||"");
  const timestamp=String(headerValue(headers,TIMESTAMP_HEADER)||"");
  if(!/^\d{10,13}$/.test(timestamp))throw Error("Invalid Telnyx timestamp");
  const signedAt=Number(timestamp);
  if(!Number.isSafeInteger(signedAt)||Math.abs(nowSeconds-signedAt)>MAX_SKEW_SECONDS)throw Error("Stale Telnyx webhook");
  const signature=Buffer.from(signatureB64,"base64");
  if(signature.length!==64)throw Error("Invalid Telnyx signature");
  const signed=Buffer.concat([Buffer.from(timestamp+"|","utf8"),rawBody]);
  if(!crypto.verify(null,signed,publicKeyObject(publicKeyB64),signature))throw Error("Invalid Telnyx signature");
  return true;
}

function classifyKeyword(text){
  const keyword=String(text||"").trim().toUpperCase();
  if(["STOP","UNSUBSCRIBE","CANCEL","END","QUIT"].includes(keyword))return "STOP";
  if(["START","YES","UNSTOP"].includes(keyword))return "START";
  if(keyword==="HELP")return "HELP";
  return "OTHER";
}

function parseEnvelope(body){
  if(!body||typeof body!=="object"||Array.isArray(body)||!body.data||typeof body.data!=="object")throw Error("Invalid Telnyx webhook");
  const data=body.data;
  if(typeof data.id!=="string"||data.id.length<1||data.id.length>160)throw Error("Invalid Telnyx event id");
  if(typeof data.event_type!=="string"||data.event_type.length>80)throw Error("Invalid Telnyx event type");
  if(typeof data.occurred_at!=="string"||Number.isNaN(Date.parse(data.occurred_at)))throw Error("Invalid Telnyx event timestamp");
  if(!data.payload||typeof data.payload!=="object")throw Error("Invalid Telnyx payload");
  return {id:data.id,event_type:data.event_type,occurred_at:new Date(data.occurred_at).toISOString(),payload:data.payload};
}

function parseInbound(body){
  const e=parseEnvelope(body);
  if(e.event_type!=="message.received")throw Error("Inbound message event required");
  const from=normalizeUsPhone(e.payload.from?.phone_number||"");
  if(!from)throw Error("Invalid inbound US phone");
  if(typeof e.payload.text!=="string")throw Error("Inbound text required");
  const text=e.payload.text.trim();
  if(!text||text.length>500)throw Error("Invalid inbound text");
  return {
    provider_event_id:"telnyx:"+e.id,
    provider_timestamp:e.occurred_at,
    from,
    keyword:classifyKeyword(text)
  };
}

function parseDelivery(body){
  const e=parseEnvelope(body);
  if(!["message.sent","message.finalized"].includes(e.event_type))throw Error("Delivery event required");
  const messageId=String(e.payload.id||"");
  if(!messageId||messageId.length>160)throw Error("Invalid message id");
  const status=typeof e.payload.to?.[0]?.status==="string"?e.payload.to[0].status:
    typeof e.payload.status==="string"?e.payload.status:null;
  const errors=Array.isArray(e.payload.errors)?e.payload.errors.slice(0,10).map(x=>String(x?.code||x||"").slice(0,80)).filter(Boolean):[];
  return {
    provider_event_id:"telnyx:"+e.id,
    provider_timestamp:e.occurred_at,
    message_id:messageId,
    event_type:e.event_type,
    delivery_status:status&&status.length<=80?status:null,
    error_codes:errors
  };
}

function helpResponsePreview(){
  const text="GetEstimateFast: For help visit getestimatefast.com or email admin@getestimatefast.com. Reply STOP to opt out.";
  if(text.length>160)throw Error("HELP response requires segmentation");
  return text;
}
function startResponsePreview(){
  const text="GetEstimateFast: SMS alerts are enabled. Message frequency varies. Reply HELP for help or STOP to opt out.";
  if(text.length>160)throw Error("START response requires segmentation");
  return text;
}
function stopResponsePreview(){
  const text="GetEstimateFast: You are unsubscribed and will receive no further SMS messages.";
  if(text.length>160)throw Error("STOP response requires segmentation");
  return text;
}

module.exports={
  SIGNATURE_HEADER,TIMESTAMP_HEADER,MAX_SKEW_SECONDS,headerValue,verifyTelnyxSignature,
  classifyKeyword,parseEnvelope,parseInbound,parseDelivery,
  helpResponsePreview,startResponsePreview,stopResponsePreview
};
