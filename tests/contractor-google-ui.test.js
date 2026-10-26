"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("professional portal loads isolated Google auth UI",()=>{
 const html=read("contractor-portal.html");
 assert.match(html,/contractor-google\.js/);
});

test("Google UI supports existing login and first-time professional signup",()=>{
 const src=read("assets/contractor-google.js");
 assert.match(src,/Continue with Google/);
 assert.match(src,/Create account with Google/);
 assert.match(src,/start\("login"\)/);
 assert.match(src,/start\("signup"/);
 assert.match(src,/privacyConsent:true/);
 assert.match(src,/termsConsent:true/);
 assert.match(src,/smsOptIn:sms\.checked/);
});

test("Google callback resumes the existing contractor workspace without exposing tokens",()=>{
 const src=read("assets/contractor-google.js");
 assert.match(src,/portal\(\)\.api\("profile"\)/);
 assert.match(src,/gef-signed-in/);
 assert.match(src,/gef-profile/);
 assert.match(src,/portal\(\)\.loadOpportunities\(\)/);
 assert.doesNotMatch(src,/access_token/);
 assert.doesNotMatch(src,/localStorage/);
});

test("Google logout clears server-side contractor OAuth cookie",()=>{
 const src=read("assets/contractor-google.js");
 assert.match(src,/\/api\/contractor\/google-logout/);
 assert.match(src,/credentials:"same-origin"/);
});
