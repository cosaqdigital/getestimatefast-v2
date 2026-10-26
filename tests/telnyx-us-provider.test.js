"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUsPhone,opportunityUrl,formatTelnyxOpportunityNotice,prepareTelnyxPayload,readiness}=require("../api/_lib/telnyx-us-provider");
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
test("live SMS remains fail-closed even when credentials and approvals are present",()=>{
  const s=readiness({
    GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
    GETESTIMATEFAST_SMS_MODE:"enabled",
    GETESTIMATEFAST_TELNYX_API_KEY:"fake",
    GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18133039893",
    GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
    GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
  });
  assert.equal(s.live_sms_enabled,false);
  assert.equal(s.mode,"disabled");
});
