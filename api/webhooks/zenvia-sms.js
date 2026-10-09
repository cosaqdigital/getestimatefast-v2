"use strict";
const {json,method,readJson,queryDb,fail}=require("../admin/_auth");
const {
  WEBHOOK_SECRET_HEADER,
  safeEqualSecret,
  webhookReadiness,
  parseZenviaInboundSms,
  helpResponsePreview
}=require("../_lib/zenvia-us-webhook");

async function recordEvent(event){
  await queryDb("sms_consent_events?on_conflict=provider_event_id",{
    method:"POST",
    headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(event)
  });
}

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  try{
    const ready=webhookReadiness();
    if(!ready.secret_configured||!ready.documented_schema_locked){
      return json(res,503,{accepted:false,live_sms_enabled:false});
    }
    const provided=String(req.headers[WEBHOOK_SECRET_HEADER]||"");
    if(!safeEqualSecret(provided,process.env.GETESTIMATEFAST_ZENVIA_WEBHOOK_SECRET)){
      return json(res,401,{error:"Unauthorized"});
    }

    const body=await readJson(req,8192);
    const inbound=parseZenviaInboundSms(body);

    const duplicate=await queryDb(
      "sms_consent_events?provider_event_id=eq."+encodeURIComponent(inbound.provider_event_id)+"&select=id&limit=1"
    );
    if(duplicate.length){
      return json(res,200,{accepted:true,duplicate:true,messages_sent:0});
    }

    const profiles=await queryDb(
      "contractor_profiles?sms_phone_e164=eq."+encodeURIComponent(inbound.from)+
      "&select=user_id,sms_opt_in&limit=2"
    );
    if(profiles.length>1)throw Error("Ambiguous contractor phone");

    const profile=profiles[0]||null;
    const baseEvent={
      provider:"zenvia",
      provider_event_id:inbound.provider_event_id,
      contractor_user_id:profile?profile.user_id:null,
      event_type:inbound.keyword,
      provider_timestamp:inbound.provider_timestamp,
      response_sent:false
    };

    if(!profile){
      await recordEvent({...baseEvent,action:"UNKNOWN_CONTRACTOR"});
      return json(res,200,{accepted:true,matched:false,messages_sent:0});
    }

    if(inbound.keyword==="STOP"){
      const now=new Date().toISOString();
      await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(profile.user_id),{
        method:"PATCH",
        headers:{Prefer:"return=minimal"},
        body:JSON.stringify({sms_opt_in:false,sms_opt_in_at:null,sms_opt_out_at:now})
      });
      await recordEvent({...baseEvent,action:"OPTED_OUT"});
      return json(res,200,{accepted:true,matched:true,opted_out:true,messages_sent:0});
    }

    if(inbound.keyword==="HELP"){
      await recordEvent({...baseEvent,action:"HELP_RECORDED"});
      return json(res,200,{
        accepted:true,matched:true,help_recorded:true,
        reply_prepared:true,reply_preview:helpResponsePreview(),
        messages_sent:0
      });
    }

    await recordEvent({...baseEvent,action:"IGNORED"});
    return json(res,200,{accepted:true,matched:true,ignored:true,messages_sent:0});
  }catch(e){
    fail(res,e);
  }
};
