"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("contractor Google OAuth uses isolated cookie and domain-separated key",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/COOKIE="gef-contractor-google"/);
 assert.match(src,/contractor-google-v1:/);
 assert.doesNotMatch(src,/COOKIE="gef-review-auth"/);
});

test("Google login refuses marketplace access for an account without professional records",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/hasProfessionalRecord/);
 assert.match(src,/state\.mode==="login"&&!await hasProfessionalRecord\(user\.id\)/);
 assert.match(src,/result="needs_signup"/);
});

test("Google signup requires phone and legal consent before OAuth redirect",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/normalizeUsPhone/);
 assert.match(src,/body\.privacyConsent!==true/);
 assert.match(src,/body\.termsConsent!==true/);
 assert.match(src,/typeof body\.smsOptIn!=="boolean"/);
 assert.match(src,/state\.signup=\{phone,smsOptIn:body\.smsOptIn\}/);
});

test("Google signup persists consent only after a verified Google user returns",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/data\.user\.email_confirmed_at/);
 assert.match(src,/client\.auth\.getUser\(\)/);
 assert.match(src,/await persistSignup\(user,state\)/);
 assert.match(src,/contractor_signup_consents/);
});

test("contractor Google OAuth uses PKCE and server-held session storage",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/flowType:"pkce"/);
 assert.match(src,/skipBrowserRedirect:true/);
 assert.match(src,/safeSession/);
 assert.match(src,/HttpOnly; SameSite=Lax; Secure/);
});
