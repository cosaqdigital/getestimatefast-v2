"use strict";
const {json,method,queryDb,fail}=require("../admin/_auth");
const {normalizeUsPhone,sendControlledHelpReply}=require("../_lib/telnyx-us-provider");
const WEBHOOK_VERSION="telnyx-help-v4";
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
async function reconcileOpportunityQueueDelivery(delivery){
  if(delivery.event_type!=="message.finalized")return false;
  const queued=await queryDb(
    "opportunity_sms_queue?provider_message_id=eq."+encodeURIComponent(delivery.message_id)+
    "&select=id,status&limit=2"
  );
  if(queued.length>1)throw Error("Ambiguous opportunity SMS provider message");
  if(!queued.length)return false;
  const delivered=delivery.delivery_status==="delivered";
  const now=delivery.provider_timestamp||new Date().toISOString();
  const body=delivered
    ?{status:"DELIVERED",delivered_at:now,last_error_code:null,next_attempt_at:null,updated_at:now}
    :{status:"FAILED",last_error_code:String(delivery.error_codes?.[0]||delivery.delivery_status||"TELNYX_FINALIZED_NOT_DELIVERED").slice(0,80),next_attempt_at:null,updated_at:now};
  await queryDb("opportunity_sms_queue?id=eq."+encodeURIComponent(queued[0].id),{
    method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(body)
  });
  return true;
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
      if(!duplicate.length)await deliveryEvent(delivery);
      const queueUpdated=await reconcileOpportunityQueueDelivery(delivery);
      return json(res,200,{
        accepted:true,
        duplicate:Boolean(duplicate.length),
        delivery_recorded:!duplicate.length,
        queue_updated:queueUpdated,
        messages_sent:0
      });
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
      event_type:inbound.keyword,provider_timestamp:inbound.provider_timestamp,response_sent:false,webhook_version:WEBHOOK_VERSION};

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
      await consentEvent({...base,
        provider_event_id:inbound.provider_event_id+":attempt",
        action:"HELP_REPLY_ATTEMPT",
        response_sent:false,
        response_error_stage:null,
        response_error_http_status:null,
        response_error_code:null
      });
      try{
        const sent=await sendControlledHelpReply({phone:inbound.from});
        await consentEvent({...base,
          provider_event_id:inbound.provider_event_id+":reply",
          action:"HELP_REPLY_SENT",
          response_sent:true,
          response_error_stage:null,
          response_error_http_status:null,
          response_error_code:null
        });
        return json(res,200,{accepted:true,matched:true,help_recorded:true,response_sent:true,message_id:sent.id,messages_sent:1,webhook_version:WEBHOOK_VERSION});
      }catch(error){
        const stage=typeof error?.diagnostic_stage==="string"?error.diagnostic_stage.slice(0,80):"unknown";
        const httpStatus=Number.isInteger(error?.telnyx?.http_status)?error.telnyx.http_status:null;
        const code=error?.telnyx?.code==null
          ?(error?.telnyx_transport?.code==null?null:String(error.telnyx_transport.code).slice(0,80))
          :String(error.telnyx.code).slice(0,80);
        await consentEvent({...base,
          provider_event_id:inbound.provider_event_id+":reply",
          action:"HELP_REPLY_FAILED",
          response_sent:false,
          response_error_stage:stage,
          response_error_http_status:httpStatus,
          response_error_code:code
        });
        console.error("Telnyx HELP reply failed",{stage,http_status:httpStatus,code});
        return json(res,200,{accepted:true,matched:true,help_recorded:true,response_sent:false,reply_failed:true,stage,http_status:httpStatus,code,messages_sent:0,webhook_version:WEBHOOK_VERSION});
      }
    }

    await consentEvent({...base,action:"IGNORED"});
    return json(res,200,{accepted:true,matched:true,ignored:true,messages_sent:0});
  }catch(e){fail(res,e);}
};
