"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("signup collects mobile phone and optional SMS consent before profile completion",()=>{
 const html=read("contractor-portal.html");
 const market=read("assets/marketplace-portal.js");
 assert.match(html,/name="phone"/);
 assert.match(html,/name="smsOptIn"/);
 assert.match(html,/SMS consent is optional/);
 assert.match(market,/phone:f\.get\("phone"\)/);
 assert.match(market,/smsOptIn:f\.get\("smsOptIn"\)==="on"/);
});

test("new registrations do not repeat legal consent in profile flow",()=>{
 const html=read("contractor-portal.html");
 const portal=read("assets/contractor-portal.js");
 assert.match(html,/id="legacyProfileConsent" hidden/);
 assert.match(portal,/signup_defaults/);
 assert.match(portal,/legacy\.hidden=Boolean\(p\|\|signup\?\.legal_consent_recorded\)/);
});

test("backend persists signup consent server-side and reuses it for first profile",()=>{
 const signup=read("api/contractor/signup.js");
 const profile=read("api/contractor/profile.js");
 assert.match(signup,/contractor_signup_consents/);
 assert.match(signup,/sms_phone_e164/);
 assert.match(profile,/contractor_signup_consents/);
 assert.match(profile,/sameSignupPhone/);
 assert.match(profile,/signup\.privacy_accepted_at/);
 assert.match(profile,/signup\.terms_accepted_at/);
});

test("changing phone does not transfer prior SMS opt-in",()=>{
 const profile=read("api/contractor/profile.js");
 assert.match(profile,/existing\[0\]\.sms_phone_e164===smsPhone&&existing\[0\]\.sms_opt_in===true/);
 assert.match(profile,/sameSignupPhone&&signup\.sms_opt_in===true/);
});
