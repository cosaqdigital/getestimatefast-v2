"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("Find Work email signup allows 6-character passwords at the app layer",()=>{
 const html=read("work-portal.html");
 const api=read("api/work/signup.js");
 assert.match(html,/Password \(minimum 6 characters\)/);
 assert.match(html,/minlength="6"/);
 assert.match(api,/password\.length<6/);
 assert.doesNotMatch(api,/password\.length<12/);
});

test("Find Work exposes Google sign-in for both login and account creation",()=>{
 const html=read("work-portal.html");
 const client=read("assets/work-portal.js");
 assert.match(html,/id="googleLogin"/);
 assert.match(html,/id="googleSignup"/);
 assert.match(html,/Continue with Google/);
 assert.match(client,/google-start/);
 assert.match(client,/google-session/);
 assert.match(client,/google-logout/);
 assert.doesNotMatch(client,/localStorage/);
 assert.doesNotMatch(client,/sessionStorage/);
});

test("Find Work Google OAuth uses its own encrypted cookie and domain-separated key",()=>{
 const src=read("api/_lib/work-google-auth.js");
 assert.match(src,/COOKIE="gef-work-google"/);
 assert.match(src,/work-google-v1:/);
 assert.match(src,/HttpOnly; SameSite=Lax; Secure/);
 assert.match(src,/flowType:"pkce"/);
 assert.match(src,/provider:"google"/);
});

test("Find Work Google OAuth reuses the existing authorized shared callback URL",()=>{
 const src=read("api/_lib/work-google-auth.js");
 assert.match(src,/redirectTo:c\.origin\+"\/api\/reviews\/auth-callback"/);
 assert.match(src,/work-portal\.html\?google=/);
 assert.doesNotMatch(src,/\/api\/work\/google-callback/);
});

test("shared callback routes Find Work cookie before contractor and review cookies",()=>{
 const src=read("api/reviews/auth-callback.js");
 assert.match(src,/work\.COOKIE/);
 assert.match(src,/if\(hasWorkCookie\(req\)\)return work\.handlers\(\)\.callback/);
 assert.match(src,/if\(hasContractorCookie\(req\)\)return contractor\.handlers\(\)\.callback/);
 assert.match(src,/return review\.createHandlers\(\)\.callback\(req,res\)/);
});
