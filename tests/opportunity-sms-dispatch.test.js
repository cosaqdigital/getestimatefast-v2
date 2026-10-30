"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {dispatchControlledOpportunitySms}=require("../api/_lib/opportunity-sms-dispatch");

const queueId="11111111-1111-4111-8111-111111111111";
const opportunityId="22222222-2222-4222-8222-222222222222";
const contractorId="33333333-3333-4333-8333-333333333333";
const testPhone="+18135550134";
const env={
  GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
  GETESTIMATEFAST_SMS_MODE:"controlled_test",
  GETESTIMATEFAST_TELNYX_API_KEY:"fake",
  GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
  GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
  GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
  GETESTIMATEFAST_TELNYX_TEST_TO:testPhone
};
const profile={
  user_id:contractorId,
  account_status:"active",
  email_verified_at:"2026-10-29T00:00:00Z",
  sms_opt_in:true,
  sms_opt_in_at:"2026-10-29T00:00:00Z",
  sms_opt_out_at:null,
  sms_phone_e164:testPhone
};
const row={id:queueId,opportunity_id:opportunityId,contractor_user_id:contractorId,recipient_phone_e164:testPhone,attempt_count:0,status:"QUEUED"};

function database({profileRow=profile,claim=true}={}){
  const calls=[];
  async function queryDb(path,options={}){
    calls.push({path,options});
    if(path.startsWith("opportunity_sms_queue?status=in.(QUEUED,FAILED)"))return [row];
    if(path.startsWith("contractor_profiles?"))return profileRow?[profileRow]:[];
    if(path.startsWith("opportunity_previews?"))return [{id:opportunityId,city:"Riverview"}];
    if(path.includes("&status=in.(QUEUED,FAILED)&attempt_count=eq.0")){
      if(!claim)return [];
      return [{...row,status:"SENDING",attempt_count:1}];
    }
    if(path.startsWith("opportunity_sms_queue?id=eq."))return [{...row}];
    throw Error("Unexpected DB path: "+path);
  }
  return {queryDb,calls};
}

test("controlled dispatcher sends at most one queued notice only to configured test recipient",async()=>{
  const db=database(),sent=[];
  const fetchImpl=async(_url,options)=>{
    sent.push(JSON.parse(options.body));
    return {ok:true,status:200,json:async()=>({data:{id:"msg_controlled_1"}})};
  };
  const result=await dispatchControlledOpportunitySms({queryDb:db.queryDb,env,fetchImpl,clock:()=>new Date("2026-10-29T22:00:00Z")});
  assert.equal(result.sent,1);
  assert.equal(result.messages_sent,1);
  assert.equal(result.message_id,"msg_controlled_1");
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,testPhone);
  assert.equal(sent[0].from,"+18133039893");
  assert.match(sent[0].text,/New job near Riverview, FL/);
  assert(db.calls[0].path.includes("recipient_phone_e164=eq.%2B18135550134"));
  assert(db.calls.some(c=>c.path.includes("&status=in.(QUEUED,FAILED)&attempt_count=eq.0")));
  const finalPatch=db.calls.find(c=>c.options?.method==="PATCH"&&JSON.parse(c.options.body).status==="SENT");
  assert(finalPatch);
  assert.equal(JSON.parse(finalPatch.options.body).provider_message_id,"msg_controlled_1");
});

test("dispatcher rechecks STOP before sending and blocks the queued row",async()=>{
  const db=database({profileRow:{...profile,sms_opt_in:false,sms_opt_in_at:null,sms_opt_out_at:"2026-10-29T21:59:00Z"}});
  let sends=0;
  const result=await dispatchControlledOpportunitySms({queryDb:db.queryDb,env,fetchImpl:async()=>{sends++;}});
  assert.equal(result.sent,0);
  assert.equal(result.blocked,1);
  assert.equal(result.blocked_status,"BLOCKED_NO_CONSENT");
  assert.equal(sends,0);
  const patch=db.calls.find(c=>c.options?.method==="PATCH");
  assert.equal(JSON.parse(patch.options.body).status,"BLOCKED_NO_CONSENT");
});

test("atomic claim prevents duplicate sends from concurrent dispatch requests",async()=>{
  const db=database({claim:false});
  let sends=0;
  const result=await dispatchControlledOpportunitySms({queryDb:db.queryDb,env,fetchImpl:async()=>{sends++;}});
  assert.equal(result.duplicate_prevented,true);
  assert.equal(result.sent,0);
  assert.equal(sends,0);
});

test("controlled dispatcher cannot run in live or disabled mode",async()=>{
  for(const mode of ["live","disabled"]){
    let dbCalls=0;
    await assert.rejects(
      ()=>dispatchControlledOpportunitySms({queryDb:async()=>{dbCalls++;},env:{...env,GETESTIMATEFAST_SMS_MODE:mode,GETESTIMATEFAST_SMS_LIVE_APPROVED:"true"}}),
      /Controlled Telnyx SMS dispatch is not enabled/
    );
    assert.equal(dbCalls,0);
  }
});

test("matching round SQL queues selected recipients atomically but sends zero messages",()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../sql/controlled_matching_rounds.sql"),"utf8");
  for(const part of [
    "insert into public.opportunity_sms_queue",
    "on conflict (matching_recipient_id) do nothing",
    "'BLOCKED_NO_CONSENT'",
    "'BLOCKED_INVALID_PHONE'",
    "'QUEUED'",
    "'sms_queued'",
    "'sms_blocked'",
    "'notifications_sent',0"
  ])assert(sql.includes(part),part);
});

test("delivery webhook reconciles finalized Telnyx messages back to the queue",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../api/webhooks/telnyx-sms.js"),"utf8");
  assert(source.includes("opportunity_sms_queue?provider_message_id=eq."));
  assert(source.includes('status:"DELIVERED"'));
  assert(source.includes('status:"FAILED"'));
});
