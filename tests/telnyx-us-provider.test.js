"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUsPhone,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,readiness,sendControlledTest}=require("../api/_lib/telnyx-us-provider");
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
test("live SMS remains fail-closed unless controlled_test is explicitly enabled",()=>{
  const base={
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  };
  const disabled=readiness({...base,GETESTIMATEFAST_SMS_MODE:"enabled"});
  assert.equal(disabled.live_sms_enabled,false);
  assert.equal(disabled.mode,"disabled");
  const controlled=readiness({...base,GETESTIMATEFAST_SMS_MODE:"controlled_test"});
  assert.equal(controlled.live_sms_enabled,true);
  assert.equal(controlled.mode,"controlled_test");
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
