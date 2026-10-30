"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUsPhone,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,formatTelnyxControlledTestNotice,prepareTelnyxControlledTestPayload,CONTROLLED_HELP_REPLY,readiness,sendControlledHealthTest,sendControlledTest,sendLiveOpportunitySms,sendControlledHelpReply}=require("../api/_lib/telnyx-us-provider");
const id="123e4567-e89b-42d3-a456-426614174000";
test("Telnyx uses E.164 US numbers",()=>{
  assert.equal(normalizeUsPhone("+1 (813) 303-9893"),"+18133039893");
  assert.equal(normalizeUsPhone("8135550134"),"+18135550134");
  assert.equal(normalizeUsPhone("+55 21 99999-9999"),null);
});
test("opportunity link is first-party and direct",()=>{
  assert.equal(opportunityUrl(id),"https://getestimatefast.com/o/"+id);
});
test("notification stays within one GSM-style segment and includes opt-out",()=>{
  const text=formatTelnyxOpportunityNotice({city:"Riverview",opportunityId:id});
  assert.match(text,/GetEstimateFast/);
  assert.match(text,/\/o\//);
  assert.match(text,/STOP/);
  assert(text.length<=160);
});
test("payload matches Telnyx API v2 send shape without sending",()=>{
  const p=prepareTelnyxPayload({from:"+1 813 303 9893",phone:"8135550134",city:"Riverview",opportunityId:id});
  assert.deepEqual(Object.keys(p).sort(),["from","text","to"]);
  assert.equal(p.from,"+18133039893");
  assert.equal(p.to,"+18135550134");
});
test("controlled and live SMS modes are strictly separated",()=>{
  const base={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  };
  const disabled=readiness({...base,GETESTIMATEFAST_SMS_MODE:"enabled"});
  assert.equal(disabled.live_sms_enabled,false);
  assert.equal(disabled.controlled_test_enabled,false);
  assert.equal(disabled.mode,"disabled");
  const controlled=readiness({...base,GETESTIMATEFAST_SMS_MODE:"controlled_test",GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"});
  assert.equal(controlled.controlled_test_enabled,true);
  assert.equal(controlled.live_sms_enabled,false);
  assert.equal(controlled.mode,"controlled_test");
  const liveWithoutApproval=readiness({...base,GETESTIMATEFAST_SMS_MODE:"live"});
  assert.equal(liveWithoutApproval.mode,"live");
  assert.equal(liveWithoutApproval.live_sms_enabled,false);
  const live=readiness({...base,GETESTIMATEFAST_SMS_MODE:"live",GETESTIMATEFAST_SMS_LIVE_APPROVED:"true"});
  assert.equal(live.controlled_test_enabled,false);
  assert.equal(live.live_sms_enabled,true);
  assert.equal(live.live_worker_enabled,false);
  assert.equal(live.compliance_reply_enabled,true);
  const worker=readiness({
    ...base,
    GETESTIMATEFAST_SMS_MODE:"live",
    GETESTIMATEFAST_SMS_LIVE_APPROVED:"true",
    GETESTIMATEFAST_SMS_AUTOMATION_APPROVED:"true",
    GETESTIMATEFAST_SMS_LIVE_BATCH_LIMIT:"1",
    GETESTIMATEFAST_SMS_LIVE_DAILY_LIMIT:"200",
    CRON_SECRET:"0123456789abcdef0123456789abcdef"
  });
  assert.equal(worker.live_worker_enabled,true);
  assert.equal(worker.live_batch_limit,1);
  assert.equal(worker.live_daily_limit,200);
});
test("live opportunity sender requires live approval and accepts a current consented US recipient",async()=>{
  const base={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  };
  let body=null;
  const fakeFetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_live_1"}})};};
  await assert.rejects(
    ()=>sendLiveOpportunitySms({phone:"+18135550134",city:"Riverview",opportunityId:id,env:{...base,GETESTIMATEFAST_SMS_MODE:"controlled_test"},fetchImpl:fakeFetch}),
    /Live Telnyx SMS is not enabled/
  );
  const sent=await sendLiveOpportunitySms({
    phone:"+18135550134",city:"Riverview",opportunityId:id,
    env:{...base,GETESTIMATEFAST_SMS_MODE:"live",GETESTIMATEFAST_SMS_LIVE_APPROVED:"true"},
    fetchImpl:fakeFetch
  });
  assert.equal(sent.id,"msg_live_1");
  assert.equal(body.to,"+18135550134");
  assert.match(body.text,/STOP/);
});

test("controlled sender only permits the configured test recipient",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  let body=null;
  const fakeFetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_test"}})};};
  const sent=await sendControlledTest({phone:"8135550134",city:"Riverview",opportunityId:id,env,fetchImpl:fakeFetch});
  assert.equal(sent.id,"msg_test");
  assert.equal(body.from,"+18133039893");
  assert.equal(body.to,"+18135550134");
  await assert.rejects(()=>sendControlledTest({phone:"8135550199",city:"Riverview",opportunityId:id,env,fetchImpl:fakeFetch}),/configured controlled test number/);
});


test("controlled sender never becomes a live sender",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"live",
    GETESTIMATEFAST_SMS_LIVE_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  };
  let calls=0;
  await assert.rejects(
    ()=>sendControlledTest({phone:"8135550134",city:"Riverview",opportunityId:id,env,fetchImpl:async()=>{calls++;}}),
    /Controlled Telnyx SMS test is not enabled/
  );
  assert.equal(calls,0);
});

test("controlled health test uses only configured recipient and fixed opt-out text",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  let body=null;
  const fakeFetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_health"}})};};
  const sent=await sendControlledHealthTest({env,fetchImpl:fakeFetch});
  assert.equal(sent.id,"msg_health");
  assert.equal(body.from,"+18133039893");
  assert.equal(body.to,"+18135550134");
  assert.equal(body.text,formatTelnyxControlledTestNotice());
  assert.match(body.text,/STOP/);
  assert.deepEqual(body,prepareTelnyxControlledTestPayload({from:env.GETESTIMATEFAST_TELNYX_FROM_NUMBER,phone:env.GETESTIMATEFAST_TELNYX_TEST_TO}));
});

test("controlled health test exposes only safe Telnyx error metadata",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"super-secret-key",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  const fakeFetch=async()=>({
    ok:false,status:401,
    json:async()=>({errors:[{code:"10009",title:"Unauthorized",detail:"Authentication failed"}]})
  });
  await assert.rejects(
    ()=>sendControlledHealthTest({env,fetchImpl:fakeFetch}),
    error=>{
      assert.equal(error.message,"Telnyx send failed with HTTP 401");
      assert.deepEqual(error.telnyx,{http_status:401,code:"10009",title:"Unauthorized",detail:"Authentication failed"});
      assert.doesNotMatch(JSON.stringify(error.telnyx),/super-secret-key/);
      return true;
    }
  );
});

test("controlled health test exposes safe transport diagnostics",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"super-secret-key",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  const transport=new TypeError("fetch failed");
  transport.cause={code:"ECONNRESET"};
  const fakeFetch=async()=>{throw transport;};
  await assert.rejects(
    ()=>sendControlledHealthTest({env,fetchImpl:fakeFetch}),
    error=>{
      assert.equal(error.message,"Telnyx transport request failed");
      assert.deepEqual(error.telnyx_transport,{type:"TypeError",code:"ECONNRESET",message:"fetch failed"});
      assert.doesNotMatch(JSON.stringify(error.telnyx_transport),/super-secret-key/);
      return true;
    }
  );
});

test("controlled health test tags payload-stage failures safely",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  const fakeFetch=async()=>({ok:true,status:200,json:async()=>({data:{id:"ok"}})});
  const sent=await sendControlledHealthTest({env,fetchImpl:fakeFetch});
  assert.equal(sent.id,"ok");
});

test("controlled health test tags invalid HTTP response stage",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135550134"
  };
  await assert.rejects(
    ()=>sendControlledHealthTest({env,fetchImpl:async()=>undefined}),
    error=>{assert.equal(error.diagnostic_stage,"response");return true;}
  );
});

test("controlled health test accepts the production no-argument call shape",async()=>{
  const original={
    provider:process.env.GETESTIMATEFAST_SMS_PROVIDER,
    mode:process.env.GETESTIMATEFAST_SMS_MODE,
    api:process.env.GETESTIMATEFAST_TELNYX_API_KEY,
    from:process.env.GETESTIMATEFAST_TELNYX_FROM_NUMBER,
    brand:process.env.GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED,
    campaign:process.env.GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED,
    to:process.env.GETESTIMATEFAST_TELNYX_TEST_TO
  };
  process.env.GETESTIMATEFAST_SMS_PROVIDER="telnyx";
  process.env.GETESTIMATEFAST_SMS_MODE="controlled_test";
  process.env.GETESTIMATEFAST_TELNYX_API_KEY="fake";
  process.env.GETESTIMATEFAST_TELNYX_FROM_NUMBER="+18133039893";
  process.env.GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED="true";
  process.env.GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED="true";
  process.env.GETESTIMATEFAST_TELNYX_TEST_TO="+18135550134";
  const previousFetch=global.fetch;
  let body=null;
  global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_no_args"}})};};
  try{
    const sent=await sendControlledHealthTest();
    assert.equal(sent.id,"msg_no_args");
    assert.equal(body.from,"+18133039893");
    assert.equal(body.to,"+18135550134");
  } finally {
    global.fetch=previousFetch;
    const restore=(key,value)=>value===undefined?delete process.env[key]:process.env[key]=value;
    restore("GETESTIMATEFAST_SMS_PROVIDER",original.provider);
    restore("GETESTIMATEFAST_SMS_MODE",original.mode);
    restore("GETESTIMATEFAST_TELNYX_API_KEY",original.api);
    restore("GETESTIMATEFAST_TELNYX_FROM_NUMBER",original.from);
    restore("GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED",original.brand);
    restore("GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED",original.campaign);
    restore("GETESTIMATEFAST_TELNYX_TEST_TO",original.to);
  }
});

test("controlled HELP reply is fixed and restricted to configured test recipient",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135917560"
  };
  let body=null;
  const fakeFetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_help"}})};};
  const sent=await sendControlledHelpReply({phone:"+18135917560",env,fetchImpl:fakeFetch});
  assert.equal(sent.id,"msg_help");
  assert.deepEqual(body,{from:"+18133039893",to:"+18135917560",text:CONTROLLED_HELP_REPLY});
  assert.match(body.text,/HELP|help/);
  assert.match(body.text,/STOP/);
  assert(body.text.length<=160);
  await assert.rejects(()=>sendControlledHelpReply({phone:"+17274124478",env,fetchImpl:fakeFetch}),/configured controlled test number/);
});

test("HELP reply remains available in explicitly approved live mode",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"live",
    GETESTIMATEFAST_SMS_LIVE_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  };
  let body=null;
  const fakeFetch=async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,status:200,json:async()=>({data:{id:"msg_live_help"}})};};
  const sent=await sendControlledHelpReply({phone:"+18135550134",env,fetchImpl:fakeFetch});
  assert.equal(sent.id,"msg_live_help");
  assert.equal(body.to,"+18135550134");
  assert.match(body.text,/STOP/);
});

test("controlled HELP reply exposes safe HTTP diagnostics",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"super-secret-key",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135917560"
  };
  const fakeFetch=async()=>({ok:false,status:422,json:async()=>({errors:[{code:"40000"}]})});
  await assert.rejects(
    ()=>sendControlledHelpReply({phone:"+18135917560",env,fetchImpl:fakeFetch}),
    error=>{
      assert.equal(error.diagnostic_stage,"http");
      assert.deepEqual(error.telnyx,{http_status:422,code:"40000"});
      assert.doesNotMatch(JSON.stringify(error),/super-secret-key/);
      return true;
    }
  );
});

test("controlled HELP reply exposes safe transport stage",async()=>{
  const env={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"controlled_test",
    GETESTIMATEFAST_TELNYX_API_KEY:"super-secret-key",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_TEST_TO:"+18135917560"
  };
  const transport=new TypeError("fetch failed"); transport.cause={code:"ECONNRESET"};
  await assert.rejects(
    ()=>sendControlledHelpReply({phone:"+18135917560",env,fetchImpl:async()=>{throw transport;}}),
    error=>{
      assert.equal(error.diagnostic_stage,"fetch");
      assert.deepEqual(error.telnyx_transport,{code:"ECONNRESET"});
      assert.doesNotMatch(JSON.stringify(error),/super-secret-key/);
      return true;
    }
  );
});
