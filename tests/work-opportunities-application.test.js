"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("worker feed matches by category type language and distance without exposing worker contact data",()=>{
 const src=read("api/work/opportunities.js");
 assert.match(src,/service_categories\.includes\(item\.service_category\)/);
 assert.match(src,/opportunity_types\.includes\(item\.opportunity_type\)/);
 assert.match(src,/overlap\(profile\.languages,item\.languages\)/);
 assert.match(src,/haversineMiles/);
 assert.match(src,/item\.posted_by===user\.id/);
 assert.match(src,/work_user_blocks/);
 assert.doesNotMatch(src,/contact_phone/);
});

test("worker application API rechecks matching before atomic database application",()=>{
 const src=read("api/work/applications.js");
 assert.match(src,/service_categories\.includes\(opportunity\.service_category\)/);
 assert.match(src,/opportunity_types\.includes\(opportunity\.opportunity_type\)/);
 assert.match(src,/overlap\(profile\.languages,opportunity\.languages\)/);
 assert.match(src,/haversineMiles/);
 assert.match(src,/gef_apply_work_opportunity/);
 assert.match(src,/work-apply-/);
});

test("application RPC serializes candidate slots and closes at max contacts",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/create or replace function public\.gef_apply_work_opportunity/);
 assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('gef-work-apply:'/);
 assert.match(sql,/contacts_used=v_contacts,status=v_status/);
 assert.match(sql,/v_status := case when v_contacts>=v_op\.max_contacts then 'applications_closed'/);
 assert.match(sql,/unique\(opportunity_id,applicant_id\)/);
 assert.match(sql,/operation_key text not null unique/);
});

test("application creates an in-platform notification for the opportunity owner",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 const api=read("api/contractor/work-notifications.js");
 assert.match(sql,/create table public\.work_notifications/);
 assert.match(sql,/notification_type,'application_received'/);
 assert.match(sql,/recipient_id,actor_id,opportunity_id,application_id/);
 assert.match(api,/recipient_id=eq\./);
 assert.match(api,/actor_name/);
});

test("only the opportunity owner can retrieve applicant contact profiles",()=>{
 const src=read("api/contractor/work-applicants.js");
 assert.match(src,/posted_by=eq\./);
 assert.match(src,/contact_phone/);
 assert.match(src,/p\?\.status==="active"/);
 assert.match(src,/profile_image_url/);
});

test("Find Work UI supports apply and application history",()=>{
 const html=read("work-portal.html");
 const src=read("assets/work-portal.js");
 assert.match(html,/id="workFeed"/);
 assert.match(html,/id="applicationList"/);
 assert.match(src,/I'm Interested/);
 assert.match(src,/api\("applications","POST"/);
 assert.match(src,/My Applications|applicationList/);
 assert.doesNotMatch(src,/localStorage/);
});

test("Hire Help UI shows candidate notifications and contact profiles",()=>{
 const html=read("contractor-portal.html");
 const src=read("assets/work-posting.js");
 assert.match(html,/Candidate Notifications/);
 assert.match(html,/id="workNotifications"/);
 assert.match(src,/is interested in your opportunity/);
 assert.match(src,/work-applicants\?opportunity_id=/);
 assert.match(src,/tel:/);
});
