"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {dispatchLiveOpportunitySmsBatch,retryAtFor}=require("../api/_lib/opportunity-sms-dispatch");

const queueId="11111111-1111-4111-8111-111111111111";
const opportunityId="22222222-2222-4222-8222-222222222222";
const leadId="44444444-4444-4444-8444-444444444444";
const contractorId="33333333-3333-4333-8333-333333333333";
const phone="+18135550134";
const liveEnv={
  GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
  GETESTIMATEFAST_SMS_MODE:"live",
  GETESTIMATEFAST_SMS_LIVE_APPROVED:"true",
  GETESTIMATEFAST_SMS_AUTOMATION_APPROVED:"true",
  GETESTIMATEFAST_SMS_LIVE_BATCH_LIMIT:"1",
  GETESTIMATEFAST_SMS_LIVE_DAILY_LIMIT:"200",
  GETESTIMATEFAST_TELNYX_API_KEY:"fake",
  GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
  GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
  GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://www.getestimatefast.com",
  CRON_SECRET:"0123456789abcdef0123456789abcdef"
};
const profile={
  user_id:contractorId,
  account_status:"active",
  email_verified_at:"2026-10-30T00:00:00Z",
  sms_opt_in:true,
  sms_opt_in_at:"2026-10-30T00:00:00Z",
  sms_opt_out_at:null,
  sms_phone_e164:phone
};
const claimed={id:queueId,opportunity_id:opportunityId,contractor_user_id:contractorId,recipient_phone_e164:phone,attempt_count:1};

function db({profileRow=profile,claimedRows=[claimed],leadStatus="published"}={}){
  const calls=[];
  async function queryDb(route,options={}){
    calls.push({route,options});
    if(route==="rpc/gef_claim_opportunity_sms_batch")return claimedRows;
    if(route.startsWith("contractor_profiles?"))return profileRow?[profileRow]:[];
    if(route.startsWith("opportunity_previews?"))return [{id:opportunityId,lead_id:leadId,city:"Riverview"}];
    if(route.startsWith("leads?"))return [{id:leadId,status:leadStatus}];
    if(route.startsWith("opportunity_sms_queue?status=eq.SENDING&updated_at=lt."))return [];
    if(route.startsWith("opportunity_sms_queue?id=eq."))return [{id:queueId}];
    throw Error("Unexpected DB route: "+route);
  }
  return {queryDb,calls};
}

test("live worker stays inactive outside fully approved live mode",async()=>{
  let dbCalls=0,fetchCalls=0;
  const result=await dispatchLiveOpportunitySmsBatch({
    queryDb:async()=>{dbCalls++;return [];},
    env:{...liveEnv,GETESTIMATEFAST_SMS_MODE:"controlled_test"},
    fetchImpl:async()=>{fetchCalls++;}
  });
  assert.equal(result.active,false);
  assert.equal(result.messages_sent,0);
  assert.equal(dbCalls,0);
  assert.equal(fetchCalls,0);
});

test("live worker claims one row, revalidates consent and records SENT",async()=>{
  const mock=db();let payload=null;
  const result=await dispatchLiveOpportunitySmsBatch({
    queryDb:mock.queryDb,env:liveEnv,
    fetchImpl:async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_live_worker_1"}})};},
    clock:()=>new Date("2026-10-30T03:00:00Z")
  });
  assert.equal(result.active,true);
  assert.equal(result.claimed,1);
  assert.equal(result.sent,1);
  assert.equal(result.messages_sent,1);
  assert.equal(payload.to,phone);
  assert.match(payload.text,/https:\/\/www\.getestimatefast\.com\/o\//);
  const claim=mock.calls.find(c=>c.route==="rpc/gef_claim_opportunity_sms_batch");
  assert.deepEqual(JSON.parse(claim.options.body),{p_limit:1,p_daily_limit:200,p_now:"2026-10-30T03:00:00.000Z"});
  const sentPatch=mock.calls.find(c=>c.options?.method==="PATCH"&&JSON.parse(c.options.body).status==="SENT");
  assert(sentPatch);
  assert.equal(JSON.parse(sentPatch.options.body).provider_message_id,"msg_live_worker_1");
});

test("live worker rechecks STOP after claim and sends nothing",async()=>{
  const mock=db({profileRow:{...profile,sms_opt_in:false,sms_opt_in_at:null,sms_opt_out_at:"2026-10-30T02:59:00Z"}});
  let fetchCalls=0;
  const result=await dispatchLiveOpportunitySmsBatch({
    queryDb:mock.queryDb,env:liveEnv,fetchImpl:async()=>{fetchCalls++;},
    clock:()=>new Date("2026-10-30T03:00:00Z")
  });
  assert.equal(result.blocked,1);
  assert.equal(result.sent,0);
  assert.equal(fetchCalls,0);
  const blocked=mock.calls.find(c=>c.options?.method==="PATCH"&&JSON.parse(c.options.body).status==="BLOCKED_NO_CONSENT");
  assert(blocked);
});

test("only explicit Telnyx 429 schedules automatic retry",async()=>{
  const mock429=db();
  const result429=await dispatchLiveOpportunitySmsBatch({
    queryDb:mock429.queryDb,env:liveEnv,
    fetchImpl:async()=>({ok:false,status:429,json:async()=>({errors:[{code:"RATE_LIMITED"}]})}),
    clock:()=>new Date("2026-10-30T03:00:00Z")
  });
  assert.equal(result429.retry_scheduled,1);
  const failed429=mock429.calls.find(c=>c.options?.method==="PATCH"&&JSON.parse(c.options.body).status==="FAILED");
  assert.equal(JSON.parse(failed429.options.body).next_attempt_at,"2026-10-30T03:02:00.000Z");

  const mock500=db();
  const result500=await dispatchLiveOpportunitySmsBatch({
    queryDb:mock500.queryDb,env:liveEnv,
    fetchImpl:async()=>({ok:false,status:500,json:async()=>({errors:[{code:"SERVER_ERROR"}]})}),
    clock:()=>new Date("2026-10-30T03:00:00Z")
  });
  assert.equal(result500.retry_scheduled,0);
  const failed500=mock500.calls.find(c=>c.options?.method==="PATCH"&&JSON.parse(c.options.body).status==="FAILED");
  assert.equal(JSON.parse(failed500.options.body).next_attempt_at,null);
});

test("retry helper stops at five attempts",()=>{
  const error={telnyx:{http_status:429}};
  const now=new Date("2026-10-30T03:00:00Z");
  assert.equal(retryAtFor(error,1,now),"2026-10-30T03:02:00.000Z");
  assert.equal(retryAtFor(error,2,now),"2026-10-30T03:05:00.000Z");
  assert.equal(retryAtFor(error,3,now),"2026-10-30T03:15:00.000Z");
  assert.equal(retryAtFor(error,4,now),"2026-10-30T04:00:00.000Z");
  assert.equal(retryAtFor(error,5,now),null);
});

test("database claim is atomic, bounded and service-role only",()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../sql/opportunity_sms_live_worker.sql"),"utf8");
  for(const required of [
    "for update skip locked",
    "p_limit < 1 or p_limit > 5",
    "p_daily_limit < 1 or p_daily_limit > 2000",
    "q.sent_at >= p_now - interval '24 hours'",
    "q.status='SENDING'",
    "q.next_attempt_at <= p_now",
    "grant execute on function public.gef_claim_opportunity_sms_batch",
    "to service_role"
  ])assert(sql.toLowerCase().includes(required.toLowerCase()),required);
  assert(!/security\s+definer/i.test(sql));
});

test("Vercel cron is authenticated and scheduled once per minute",()=>{
  const route=fs.readFileSync(path.join(__dirname,"../api/cron/opportunity-sms.js"),"utf8");
  const vercel=JSON.parse(fs.readFileSync(path.join(__dirname,"../vercel.json"),"utf8"));
  assert(route.includes('authorization!=="Bearer "+secret'));
  assert(route.includes("secret.length<16"));
  assert(route.includes("dispatchLiveOpportunitySmsBatch"));
  assert.deepEqual(vercel.crons,[{path:"/api/cron/opportunity-sms",schedule:"* * * * *"}]);
});
