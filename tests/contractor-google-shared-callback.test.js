"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("contractor OAuth reuses the existing review callback URL",()=>{
 const src=read("api/_lib/contractor-google-auth.js");
 assert.match(src,/redirectTo:c\.origin\+"\/api\/reviews\/auth-callback"/);
 assert.doesNotMatch(src,/redirectTo:c\.origin\+"\/api\/contractor\/google-callback"/);
});

test("shared callback routes contractor cookie to contractor handler",()=>{
 const src=read("api/reviews/auth-callback.js");
 assert.match(src,/contractor\.COOKIE/);
 assert.match(src,/contractor\.handlers\(\)\.callback/);
 assert.match(src,/review\.createHandlers\(\)\.callback/);
});

test("review callback remains default when contractor cookie is absent",()=>{
 const src=read("api/reviews/auth-callback.js");
 assert.match(src,/if\(hasContractorCookie\(req\)\)return contractor/);
 assert.match(src,/return review\.createHandlers\(\)\.callback\(req,res\)/);
});
