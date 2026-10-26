"use strict";
// Zenvia API v2 adapter: prepares US-only SMS payloads; intentionally NO network/send function.
// Live sending MUST NOT be enabled by this module or this Preview.
const ZENVIA_SMS_ENDPOINT="https://api.zenvia.com/v2/channels/sms/messages";
function normalizeUsPhone(value){
  if(typeof value!=="string"||!/^[+0-9(). -]{10,25}$/.test(value))return null;
  let digits=value.replace(/\D/g,"");
  if(digits.length===11&&digits.startsWith("1"))digits=digits.slice(1);
  if(!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits))return null;
  return "1"+digits; // Zenvia recipient format: country code + ten digits, digits only.
}
function formatUsNotice(city){
  if(typeof city!=="string"||!/^[A-Za-z][A-Za-z .-]{1,79}$/.test(city.trim()))throw Error("Invalid city");
  const txt="GetEstimateFast: New service request near "+city.trim()+", FL. Sign in to view it. Manage SMS alerts in your profile.";
  if(txt.length>160)throw Error("Message requires segmentation");
  return txt; // No customer contact; STOP wording held until two-way/opt-out capability is verified.
}
function prepareZenviaUsPayload({senderId,phone,city}){
  const to=normalizeUsPhone(phone);
  if(!to)throw Error("Invalid US phone number");
  if(typeof senderId!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(senderId))throw Error("Invalid Zenvia sender identifier");
  return {from:senderId,to,contents:[{type:"text",text:formatUsNotice(city)}]};
}
function readiness(env=process.env){
  const mode=env.GETESTIMATEFAST_SMS_MODE==="dry_run"?"dry_run":"disabled";
  const provider=env.GETESTIMATEFAST_SMS_PROVIDER==="zenvia"?"zenvia":"unconfigured";
  const token_configured=Boolean(env.GETESTIMATEFAST_ZENVIA_API_TOKEN);
  const sender_configured=Boolean(env.GETESTIMATEFAST_ZENVIA_SENDER_ID);
  const us_route_approved=env.GETESTIMATEFAST_ZENVIA_US_ROUTE_APPROVED==="true";
  const reply_stop_verified=env.GETESTIMATEFAST_ZENVIA_REPLY_STOP_VERIFIED==="true";
  const price_confirmed=env.GETESTIMATEFAST_ZENVIA_US_PRICE_CONFIRMED==="true";
  return {provider,mode,token_configured,sender_configured,us_route_approved,reply_stop_verified,price_confirmed,
    live_sms_enabled:false,sms_sent:0,
    next_steps:["Confirm actual U.S. account pricing and available sender","Confirm approved U.S. A2P route and carrier requirements","Confirm two-way inbound STOP/HELP handling","Save dedicated Zenvia API credentials as server-only Vercel secrets"]};
}
module.exports={ZENVIA_SMS_ENDPOINT,normalizeUsPhone,formatUsNotice,prepareZenviaUsPayload,readiness};