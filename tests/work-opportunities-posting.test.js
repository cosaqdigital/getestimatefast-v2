"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("contractor portal exposes a distinct Hire Help posting screen",()=>{
 const html=read("contractor-portal.html");
 const ux=read("assets/contractor-ux.js");
 assert.match(html,/id="workPostingPanel"/);
 assert.match(html,/Post a Work Opportunity/);
 assert.match(html,/No job-site street address is stored/);
 assert.match(html,/id="workMaxContacts"/);
 assert.match(html,/name="work_languages"/);
 assert.match(ux,/\["workPostingPanel","Hire Help"\]/);
});

test("work posting client reuses the authenticated contractor portal session",()=>{
 const src=read("assets/work-posting.js");
 assert.match(src,/portal\(\)\.api\("work-opportunities"/);
 assert.match(src,/crypto\.randomUUID\(\)/);
 assert.doesNotMatch(src,/localStorage/);
 assert.doesNotMatch(src,/access_token/);
 assert.doesNotMatch(src,/street|address/i);
 assert.doesNotThrow(()=>new Function(src));
});

test("work posting API validates existing categories ZIP pay and applicant limits",()=>{
 const src=read("api/contractor/work-opportunities.js");
 assert.match(src,/CATEGORIES\.includes\(category\)/);
 assert.match(src,/recognizedFloridaZip\(zip\)/);
 assert.match(src,/parseUsd/);
 assert.match(src,/maxContacts<workers/);
 assert.match(src,/languages\.every\(v=>LANGUAGES\.has\(v\)\)/);
 assert.match(src,/gef_create_work_opportunity/);
});

test("database makes publication quota atomic and idempotent",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/operation_key text not null unique/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/v_free_used < 4/);
 assert.match(sql,/posting_source='monthly_free'/);
 assert.match(sql,/v_source:='purchased_credit'/);
 assert.match(sql,/p_contractor,-1,'consume'/);
 assert.match(sql,/entry_type,opportunity_id,operation_key/);
 assert.match(sql,/work_post_credit_balances/);
 assert.match(sql,/\('extra_4',4,700\)/);
 assert.match(sql,/\('extra_15',15,1500\)/);
});

test("only complete active professionals with a published public profile can post",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/v_profile\.account_status='active'/);
 assert.match(sql,/cardinality\(v_profile\.service_categories\)>=1/);
 assert.match(sql,/v_public\.published=true/);
 assert.match(sql,/public_profile_required/);
 assert.match(sql,/professional_profile_incomplete/);
});

test("extra post packages stay private behind a service-role-only summary function",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 const api=read("api/contractor/work-opportunities.js");
 assert.match(sql,/from gef_private\.work_post_credit_packages/);
 assert.match(sql,/revoke all on function public\.gef_work_post_summary\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.gef_work_post_summary\(uuid\) to service_role/);
 assert.doesNotMatch(api,/queryDb\(\s*"work_post_credit_packages/);
});
