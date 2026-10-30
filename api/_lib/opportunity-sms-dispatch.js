"use strict";
const {readiness,normalizeUsPhone,sendControlledTest,sendLiveOpportunitySms}=require("./telnyx-us-provider");
const {opportunitySmsEligibility}=require("./opportunity-sms-policy");

function safeFailureCode(error){
  const raw=error?.telnyx?.code??error?.telnyx_transport?.code??"CONTROLLED_SEND_FAILED";
  return String(raw).slice(0,80);
}

async function patchQueue(queryDb,id,body,extraFilter=""){
  return queryDb(
    "opportunity_sms_queue?id=eq."+encodeURIComponent(id)+extraFilter,
    {method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)}
  );
}

async function dispatchControlledOpportunitySms({queryDb,env=process.env,fetchImpl=global.fetch,clock=()=>new Date()}={}){
  if(typeof queryDb!=="function")throw Error("Database adapter required");
  const state=readiness(env);
  if(!state.controlled_test_enabled){
    const error=Error("Controlled Telnyx SMS dispatch is not enabled");
    error.code="CONTROLLED_SMS_DISABLED";
    throw error;
  }
  const allowed=normalizeUsPhone(env.GETESTIMATEFAST_TELNYX_TEST_TO||"");
  if(!allowed)throw Error("Controlled test recipient is not configured");

  const rows=await queryDb(
    "opportunity_sms_queue?status=in.(QUEUED,FAILED)&attempt_count=lt.5"+
    "&recipient_phone_e164=eq."+encodeURIComponent(allowed)+
    "&select=id,opportunity_id,contractor_user_id,recipient_phone_e164,attempt_count,status"+
    "&order=created_at.asc&limit=1"
  );
  const row=rows?.[0];
  if(!row)return {mode:"controlled_test",candidates:0,claimed:0,sent:0,blocked:0,messages_sent:0};

  const profiles=await queryDb(
    "contractor_profiles?user_id=eq."+encodeURIComponent(row.contractor_user_id)+
    "&select=user_id,account_status,email_verified_at,sms_opt_in,sms_opt_in_at,sms_opt_out_at,sms_phone_e164&limit=1"
  );
  const eligibility=opportunitySmsEligibility(profiles?.[0]||null);
  const now=clock().toISOString();

  if(!eligibility.eligible){
    await patchQueue(queryDb,row.id,{
      status:eligibility.status,
      recipient_phone_e164:null,
      next_attempt_at:null,
      last_error_code:null,
      updated_at:now
    });
    return {mode:"controlled_test",candidates:1,claimed:0,sent:0,blocked:1,blocked_status:eligibility.status,messages_sent:0};
  }

  if(eligibility.phone!==allowed){
    await patchQueue(queryDb,row.id,{recipient_phone_e164:eligibility.phone,updated_at:now});
    return {mode:"controlled_test",candidates:1,claimed:0,sent:0,blocked:0,recipient_changed:true,messages_sent:0};
  }

  const opportunities=await queryDb(
    "opportunity_previews?id=eq."+encodeURIComponent(row.opportunity_id)+"&select=id,city&limit=1"
  );
  const opportunity=opportunities?.[0];
  if(!opportunity||typeof opportunity.city!=="string"){
    await patchQueue(queryDb,row.id,{status:"FAILED",last_error_code:"OPPORTUNITY_UNAVAILABLE",updated_at:now});
    return {mode:"controlled_test",candidates:1,claimed:0,sent:0,failed:1,error_code:"OPPORTUNITY_UNAVAILABLE",messages_sent:0};
  }

  const attempt=Number(row.attempt_count)||0;
  const claimed=await patchQueue(queryDb,row.id,{
    status:"SENDING",
    attempt_count:attempt+1,
    next_attempt_at:null,
    last_error_code:null,
    updated_at:now
  },"&status=in.(QUEUED,FAILED)&attempt_count=eq."+attempt);

  if(!Array.isArray(claimed)||claimed.length!==1){
    return {mode:"controlled_test",candidates:1,claimed:0,sent:0,duplicate_prevented:true,messages_sent:0};
  }

  try{
    const sent=await sendControlledTest({
      phone:allowed,
      city:opportunity.city,
      opportunityId:row.opportunity_id,
      env,
      fetchImpl
    });
    const sentAt=clock().toISOString();
    await patchQueue(queryDb,row.id,{
      status:"SENT",
      provider_message_id:sent.id||null,
      sent_at:sentAt,
      updated_at:sentAt
    });
    return {
      mode:"controlled_test",
      candidates:1,
      claimed:1,
      sent:1,
      message_id:sent.id||null,
      messages_sent:1
    };
  }catch(error){
    const code=safeFailureCode(error);
    const failedAt=clock().toISOString();
    await patchQueue(queryDb,row.id,{
      status:"FAILED",
      last_error_code:code,
      next_attempt_at:null,
      updated_at:failedAt
    });
    return {mode:"controlled_test",candidates:1,claimed:1,sent:0,failed:1,error_code:code,messages_sent:0};
  }
}



function liveFailureCode(error){
  const raw=error?.telnyx?.code??error?.telnyx_transport?.code??error?.diagnostic_stage??"LIVE_SEND_FAILED";
  return String(raw).slice(0,80);
}

function retryDelayMinutes(attempt){
  return attempt<=1?2:attempt===2?5:attempt===3?15:60;
}

function retryAtFor(error,attempt,now){
  if(Number(error?.telnyx?.http_status)!==429||attempt>=5)return null;
  return new Date(now.getTime()+retryDelayMinutes(attempt)*60000).toISOString();
}

async function dispatchLiveOpportunitySmsBatch({queryDb,env=process.env,fetchImpl=global.fetch,clock=()=>new Date()}={}){
  if(typeof queryDb!=="function")throw Error("Database adapter required");
  const state=readiness(env);
  if(!state.live_worker_enabled){
    return {mode:state.mode,active:false,claimed:0,sent:0,blocked:0,failed:0,messages_sent:0};
  }
  const now=clock();
  const nowIso=now.toISOString();
  const claimed=await queryDb("rpc/gef_claim_opportunity_sms_batch",{
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify({
      p_limit:state.live_batch_limit,
      p_daily_limit:state.live_daily_limit,
      p_now:nowIso
    })
  });
  const rows=Array.isArray(claimed)?claimed:[];
  const summary={mode:"live",active:true,claimed:rows.length,sent:0,blocked:0,failed:0,retry_scheduled:0,messages_sent:0};

  for(const row of rows){
    const profiles=await queryDb(
      "contractor_profiles?user_id=eq."+encodeURIComponent(row.contractor_user_id)+
      "&select=user_id,account_status,email_verified_at,sms_opt_in,sms_opt_in_at,sms_opt_out_at,sms_phone_e164&limit=1"
    );
    const eligibility=opportunitySmsEligibility(profiles?.[0]||null);
    if(!eligibility.eligible){
      await patchQueue(queryDb,row.id,{
        status:eligibility.status,
        recipient_phone_e164:null,
        next_attempt_at:null,
        last_error_code:null,
        updated_at:clock().toISOString()
      },"&status=eq.SENDING&attempt_count=eq."+Number(row.attempt_count));
      summary.blocked++;
      continue;
    }

    const opportunityRows=await queryDb(
      "opportunity_previews?id=eq."+encodeURIComponent(row.opportunity_id)+
      "&select=id,lead_id,city&limit=1"
    );
    const opportunity=opportunityRows?.[0]||null;
    const leadRows=opportunity?.lead_id?await queryDb(
      "leads?id=eq."+encodeURIComponent(opportunity.lead_id)+"&select=id,status&limit=1"
    ):[];
    if(!opportunity||leadRows?.[0]?.status!=="published"){
      await patchQueue(queryDb,row.id,{
        status:"FAILED",
        next_attempt_at:null,
        last_error_code:"OPPORTUNITY_UNAVAILABLE",
        updated_at:clock().toISOString()
      },"&status=eq.SENDING&attempt_count=eq."+Number(row.attempt_count));
      summary.failed++;
      continue;
    }

    if(row.recipient_phone_e164!==eligibility.phone){
      await patchQueue(queryDb,row.id,{
        recipient_phone_e164:eligibility.phone,
        updated_at:clock().toISOString()
      },"&status=eq.SENDING&attempt_count=eq."+Number(row.attempt_count));
    }

    try{
      const sent=await sendLiveOpportunitySms({
        phone:eligibility.phone,
        city:opportunity.city,
        opportunityId:row.opportunity_id,
        origin:env.GETESTIMATEFAST_PUBLIC_ORIGIN||undefined,
        env,
        fetchImpl
      });
      const sentAt=clock().toISOString();
      await patchQueue(queryDb,row.id,{
        status:"SENT",
        provider_message_id:sent.id||null,
        sent_at:sentAt,
        next_attempt_at:null,
        last_error_code:null,
        updated_at:sentAt
      },"&status=eq.SENDING&attempt_count=eq."+Number(row.attempt_count));
      summary.sent++;
      summary.messages_sent++;
    }catch(error){
      const failedAt=clock();
      const nextRetry=retryAtFor(error,Number(row.attempt_count),failedAt);
      await patchQueue(queryDb,row.id,{
        status:"FAILED",
        next_attempt_at:nextRetry,
        last_error_code:liveFailureCode(error),
        updated_at:failedAt.toISOString()
      },"&status=eq.SENDING&attempt_count=eq."+Number(row.attempt_count));
      summary.failed++;
      if(nextRetry)summary.retry_scheduled++;
    }
  }

  const staleCutoff=new Date(now.getTime()-10*60000).toISOString();
  const stale=await queryDb(
    "opportunity_sms_queue?status=eq.SENDING&updated_at=lt."+encodeURIComponent(staleCutoff)+
    "&select=id&limit=10"
  );
  summary.stale_sending=Array.isArray(stale)?stale.length:0;
  return summary;
}

module.exports={safeFailureCode,liveFailureCode,retryDelayMinutes,retryAtFor,dispatchControlledOpportunitySms,dispatchLiveOpportunitySmsBatch};
