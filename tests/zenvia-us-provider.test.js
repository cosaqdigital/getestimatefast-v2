"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUsPhone,formatUsNotice,prepareZenviaUsPayload,readiness}=require("../api/_lib/zenvia-us-provider");
test("US phone formatting",()=>{assert.equal(normalizeUsPhone("+1 (813) 555-0134"),"18135550134");assert.equal(normalizeUsPhone("8135550134"),"18135550134");assert.equal(normalizeUsPhone("+55 21 99999-9999"),null);});
test("no customer contact in SMS",()=>{const m=formatUsNotice("Riverview");assert.match(m,/GetEstimateFast/);assert(!m.includes("@"));assert(m.length<=160);});
test("no delivery capability even when flags set",()=>{const s=readiness({GETESTIMATEFAST_SMS_MODE:"enabled",GETESTIMATEFAST_SMS_PROVIDER:"zenvia",GETESTIMATEFAST_ZENVIA_API_TOKEN:"fake",GETESTIMATEFAST_ZENVIA_US_ROUTE_APPROVED:"true"});assert.equal(s.live_sms_enabled,false);assert.equal(s.mode,"disabled");});
test("payload shape",()=>{const p=prepareZenviaUsPayload({senderId:"SENDER",phone:"8135550134",city:"Riverview"});assert.equal(p.to,"18135550134");assert.equal(p.contents[0].type,"text");});
