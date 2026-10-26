"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("professional login exposes password recovery",()=>{
 const html=read("contractor-portal.html");
 assert.match(html,/href="\/contractor-reset-password\.html">Forgot password\?/);
});

test("professional reset page never stores refresh tokens",()=>{
 const html=read("contractor-reset-password.html");
 const js=read("assets/contractor-reset-password.js");
 assert.match(html,/Professional password reset/);
 assert.match(js,/type!==?"recovery"|types\[0\]!=="recovery"/);
 assert.doesNotMatch(js,/refresh_token/);
 assert.match(js,/history\.replaceState/);
});

test("professional reset API is production and same-origin guarded",()=>{
 const src=read("api/contractor/password-reset.js");
 assert.match(src,/VERCEL_ENV!=="production"/);
 assert.match(src,/sec-fetch-site/);
 assert.match(src,/www\.getestimatefast\.com/);
 assert.match(src,/contractor_profiles/);
 assert.match(src,/auth\/v1\/recover/);
 assert.match(src,/auth\/v1\/user/);
 assert.doesNotMatch(src,/service_role/i);
});
