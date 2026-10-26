"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {
  SIGNATURE_HEADER,TIMESTAMP_HEADER,verifyTelnyxSignature,classifyKeyword,
  parseInbound,parseDelivery,helpResponsePreview,startResponsePreview,stopResponsePreview
}=require("../api/_lib/telnyx-us-webhook");

function keypair(){
  const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
  const der=publicKey.export({format:"der",type:"spki"});
  return {publicB64:Buffer.from(der).subarray(-32).toString("base64"),privateKey};
}
function signed(raw,privateKey,timestamp){
  return crypto.sign(null,Buffer.concat([Buffer.from(timestamp+"|"),raw]),privateKey).toString("base64");
}
function inbound(text="STOP"){
  return {data:{id:"event-1",event_type:"message.received",occurred_at:"2026-10-26T14:00:00Z",payload:{
    from:{phone_number:"+1 813 555 0134"},text
  }}};
}
test("verifies Telnyx Ed25519 signature over timestamp|raw_body",()=>{
  const kp=keypair(),raw=Buffer.from(JSON.stringify(inbound())),timestamp="1793023200";
  const headers={[SIGNATURE_HEADER]:signed(raw,kp.privateKey,timestamp),[TIMESTAMP_HEADER]:timestamp};
  assert.equal(verifyTelnyxSignature(raw,headers,kp.publicB64,1793023200),true);
  assert.throws(()=>verifyTelnyxSignature(Buffer.from("{}"),headers,kp.publicB64,1793023200));
  assert.throws(()=>verifyTelnyxSignature(raw,headers,kp.publicB64,1793024000));
});
test("classifies standard stop start and help keywords",()=>{
  for(const k of ["STOP","unsubscribe","CANCEL","END","QUIT"])assert.equal(classifyKeyword(k),"STOP");
  for(const k of ["START","yes","UNSTOP"])assert.equal(classifyKeyword(k),"START");
  assert.equal(classifyKeyword("help"),"HELP");
  assert.equal(classifyKeyword("stop now"),"OTHER");
});
test("parses inbound SMS without retaining body text",()=>{
  const x=parseInbound(inbound(" STOP "));
  assert.equal(x.from,"+18135550134");
  assert.equal(x.keyword,"STOP");
  assert.equal(x.provider_event_id,"telnyx:event-1");
  assert(!Object.hasOwn(x,"text"));
});
test("parses delivery events without phone or content",()=>{
  const b={data:{id:"evt-d1",event_type:"message.finalized",occurred_at:"2026-10-26T14:00:00Z",payload:{
    id:"msg-123",to:[{phone_number:"+18135550134",status:"delivered"}],text:"secret",errors:[]
  }}};
  const x=parseDelivery(b);
  assert.equal(x.message_id,"msg-123");
  assert.equal(x.delivery_status,"delivered");
  assert(!Object.hasOwn(x,"phone_number"));
  assert(!Object.hasOwn(x,"text"));
});
test("prepared compliance replies remain short and unsent",()=>{
  for(const fn of [helpResponsePreview,startResponsePreview,stopResponsePreview]){
    const s=fn(); assert(s.includes("GetEstimateFast")); assert(s.length<=160);
  }
});
