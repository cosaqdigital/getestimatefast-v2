"use strict";
const {json,method,queryDb,fail}=require("../admin/_auth");
const {normalizeUsPhone}=require("../_lib/telnyx-us-provider");
const {
  verifyTelnyxSignature,parseEnvelope,parseInbound,parseDelivery,
  helpResponsePreview,startResponsePreview,stopResponsePreview
}=require("../_lib/telnyx-us-webhook");

async function readRaw(req,maxBytes=65536){
  const parts=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>maxBytes)throw Error("Request too large");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
async function consentEvent(event){
  await queryDb("sms_consent_events?on_conflict=provider_event_id",{
    method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(event)
  });
}
async function deliveryEvent(event){
  await queryDb("sms_delivery_events?on_conflict=provider_event_id",{
    method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({
      provider:"telnyx",...event
    })
  });
}
module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  try{
    const publicKey=String(process.env.GETESTIMATEFAST_TELNYX_PUBLIC_KEY||"").trim();
    if(!publicKey)return json(res,503,{accepted:false,live_sms_enabled:false});
    const raw=await readRaw(req);
    try{verifyTelnyxSignature(raw,req.headers,publicKey);}
    catch{return json(res,401,{error:"Invalid webhook signature"});}
    let body;try{body=JSON.parse(raw.toString("utf8"));}catch{return json(res,400,{error:"Invalid JSON"});}
    const envelope=parseEnvelope(body);

    if(["message.sent","message.finalized"].includes(envelope.event_type)){
      const delivery=parseDelivery(body);
      const duplicate=await queryDb("sms_delivery_events?provider_event_id=eq."+encodeURIComponent(delivery.provider_event_id)+"&select=id&limit=1");
      if(duplicate.length)return json(res,200,{accepted:true,duplicate:true,messages_sent:0});
      await deliveryEvent(delivery);
      return json(res,200,{accepted:true,delivery_recorded:true,messages_sent:0});
    }
    if(envelope.event_type!=="message.received"){
      return json(res,200,{accepted:true,ignored:true,messages_sent:0});
    }

    const inbound=parseInbound(body);
    const duplicate=await queryDb("sms_consent_events?provider_event_id=eq."+encodeURIComponent(inbound.provider_event_id)+"&select=id&limit=1");
    if(duplicate.length)return json(res,200,{accepted:true,duplicate:true,messages_sent:0});

    const profiles=await queryDb("contractor_profiles?sms_phone_e164=eq."+encodeURIComponent(inbound.from)+"&select=user_id,sms_opt_in&limit=2");
    if(profiles.length>1)throw Error("Ambiguous contractor phone");
    const profile=profiles[0]||null;
    const base={provider:"telnyx",provider_event_id:inbound.provider_event_id,contractor_user_id:profile?.user_id||null,
      event_type:inbound.keyword,provider_timestamp:inbound.provider_timestamp,response_sent:false};

    if(!profile){
      await consentEvent({...base,action:"UNKNOWN_CONTRACTOR"});
      return json(res,200,{accepted:true,matched:false,messages_sent:0});
    }

    if(inbound.keyword==="STOP"){
      const now=new Date().toISOString();
      await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(profile.user_id),{
        method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({sms_opt_in:false,sms_opt_in_at:null,sms_opt_out_at:now})
      });
      await consentEvent({...base,action:"OPTED_OUT"});
      return json(res,200,{accepted:true,matched:true,opted_out:true,reply_prepared:true,reply_preview:stopResponsePreview(),messages_sent:0});
    }

    if(inbound.keyword==="START"){
      const now=new Date().toISOString();
      await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(profile.user_id),{
        method:"PATCH",headers:{Prefer:"return=minimal"},
        body:JSON.stringify({sms_opt_in:true,sms_opt_in_at:now,sms_opt_out_at:null})
      });
      await consentEvent({...base,action:"OPTED_IN"});
      return json(res,200,{accepted:true,matched:true,opted_in:true,reply_prepared:true,reply_preview:startResponsePreview(),messages_sent:0});
    }

    if(inbound.keyword==="HELP"){
      await consentEvent({...base,action:"HELP_RECORDED"});
      return json(res,200,{accepted:true,matched:true,help_recorded:true,reply_prepared:true,reply_preview:helpResponsePreview(),messages_sent:0});
    }

    await consentEvent({...base,action:"IGNORED"});
    return json(res,200,{accepted:true,matched:true,ignored:true,messages_sent:0});
  }catch(e){fail(res,e);}
};
