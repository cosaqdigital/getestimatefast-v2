"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("worker selection API requires authenticated contractor and server-side RPC",()=>{
 const src=read("api/contractor/work-selection.js");
 assert.match(src,/userFor\(req,res\)/);
 assert.match(src,/gef_select_work_applicant/);
 assert.match(src,/application_id/);
 assert.doesNotMatch(src,/service_role/i);
});

test("selection RPC serializes an opportunity and creates one assignment",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/create or replace function public\.gef_select_work_applicant/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('gef-work-select:'/);
 assert.match(sql,/insert into public\.work_assignments/);
 assert.match(sql,/where application_id=p_application/);
 assert.match(sql,/idempotent',true/);
});

test("selection fills positions and closes the opportunity automatically",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/positions_filled=v_filled,status='filled',closed_at=v_now/);
 assert.match(sql,/v_filled>=v_op\.workers_needed/);
 assert.match(sql,/update public\.work_applications\s+set status='declined'/);
 assert.match(sql,/notification_type,event_key/);
 assert.match(sql,/'application_selected'/);
 assert.match(sql,/'application_closed'/);
});

test("critical selection RPC is service-role only",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/revoke all on function public\.gef_select_work_applicant\(uuid,uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.gef_select_work_applicant\(uuid,uuid\) to service_role/);
});

test("contractor UI exposes Select Worker only for interested applicants",()=>{
 const src=read("assets/work-posting.js");
 assert.match(src,/item\.status==="interested"/);
 assert.match(src,/Select Worker/);
 assert.match(src,/work-selection/);
 assert.match(src,/item\.status==="selected"/);
 assert.match(src,/Opportunity filled/);
});

test("worker application history explains selected and filled outcomes",()=>{
 const src=read("assets/work-portal.js");
 assert.match(src,/item\.status==="selected"/);
 assert.match(src,/The professional selected you for this opportunity/);
 assert.match(src,/item\.status==="declined"/);
 assert.match(src,/This opportunity has been filled/);
});

test("prepared migration contains real newlines rather than escaped newline artifacts",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.equal(sql.includes("\\n"),false);
});
