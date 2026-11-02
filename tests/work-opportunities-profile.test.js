"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("Find Work portal keeps email session tokens in memory only",()=>{
 const src=read("assets/work-portal.js");
 assert.match(src,/let token=""/);
 assert.doesNotMatch(src,/localStorage/);
 assert.doesNotMatch(src,/sessionStorage/);
 assert.match(src,/Authorization:"Bearer "\+token/);
});

test("Find Work profile uses the existing launch service catalog",()=>{
 const profile=read("api/work/profile.js");
 assert.match(profile,/CATEGORIES/);
 assert.match(profile,/categories\.every\(c=>CATEGORIES\.includes\(c\)\)/);
 assert.match(profile,/recognizedFloridaZip/);
});

test("Find Work registration has its own legal consent record",()=>{
 const signup=read("api/work/signup.js");
 const profile=read("api/work/profile.js");
 const migration=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(signup,/work_signup_consents/);
 assert.match(profile,/work_signup_consents/);
 assert.match(migration,/create table public\.work_signup_consents/);
 assert.match(migration,/revoke all on public\.work_signup_consents from public,anon,authenticated/);
});

test("work marketplace remains separate from homeowner leads",()=>{
 const migration=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(migration,/create table public\.work_opportunities/);
 assert.match(migration,/create table public\.work_applications/);
 assert.match(migration,/create table public\.work_assignments/);
 assert.doesNotMatch(migration,/alter table public\.leads/);
});

test("paid posting packs match the approved product rules",()=>{
 const migration=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(migration,/\('extra_4',4,700\)/);
 assert.match(migration,/\('extra_15',15,1500\)/);
});

test("worker profile activation requires a published profile photo and matching fields",()=>{
 const migration=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 const api=read("api/work/profile.js");
 assert.match(migration,/profile_image_path is not null/);
 assert.match(migration,/cardinality\(service_categories\) >= 1/);
 assert.match(migration,/cardinality\(languages\) >= 1/);
 assert.match(migration,/cardinality\(opportunity_types\) >= 1/);
 assert.match(api,/status:"active"/);
});

test("Find Work is exposed from professional registration",()=>{
 const html=read("contractor-portal.html");
 assert.match(html,/work-portal\.html\?signup=1/);
 assert.match(html,/Create a free Find Work profile/);
});
