"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {
  WEBHOOK_SECRET_HEADER,safeEqualSecret,webhookReadiness,classifyKeyword,
  parseZenviaInboundSms,helpResponsePreview
}=require("../api/_lib/zenvia-us-webhook");

const secret="12345678-1234-1234-1234-123456789012";
function body(text="STOP"){
  return {
    from:"+1 (813) 555-0134",to:"SENDER",direction:"IN",channel:"sms",
    id:"msg-001",timestamp:"2026-10-09T20:00:00Z",
    contents:[{type:"text",text}]
  };
}

test("uses documented auth header and timing safe secret",()=>{
  assert.equal(WEBHOOK_SECRET_HEADER,"x-auth-token");
  assert.equal(safeEqualSecret(secret,secret),true);
  assert.equal(safeEqualSecret("bad",secret),false);
});
test("webhook stays locked without explicit schema verification",()=>{
  const a=webhookReadiness({GETESTIMATEFAST_ZENVIA_WEBHOOK_SECRET:secret});
  assert.equal(a.secret_configured,true);
  assert.equal(a.documented_schema_locked,false);
  assert.equal(a.live_reply_enabled,false);
});
test("strictly parses documented inbound SMS structure",()=>{
  const m=parseZenviaInboundSms(body(" stop "));
  assert.equal(m.from,"18135550134");
  assert.equal(m.keyword,"STOP");
  assert.equal(m.provider_event_id,"msg-001");
});
test("rejects outbound or non-SMS payloads",()=>{
  assert.throws(()=>parseZenviaInboundSms({...body(),direction:"OUT"}));
  assert.throws(()=>parseZenviaInboundSms({...body(),channel:"whatsapp"}));
});
test("only STOP and HELP are actionable keywords",()=>{
  assert.equal(classifyKeyword("STOP"),"STOP");
  assert.equal(classifyKeyword(" help "),"HELP");
  assert.equal(classifyKeyword("STOP NOW"),"OTHER");
});
test("HELP is prepared but not sent",()=>{
  const text=helpResponsePreview();
  assert.match(text,/GetEstimateFast/);
  assert.match(text,/STOP/);
  assert(text.length<=160);
});
