"use strict";
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const assert=require("node:assert/strict");
const {
 workUrl,matchesWorkOpportunity,workEmailMode,workSmsMode,emailText,smsText
}=require("../api/_lib/work-notification-dispatch");

const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const opportunity={
 id:"123e4567-e89b-42d3-a456-426614174000",
 posted_by:"40c1fdf0-3e0f-4ced-9642-d00a154b4dcc",
 opportunity_type:"helper",
 service_category:"House Cleaning",
 zip_code:"33569",
 description:"Help with a move-out cleaning project tomorrow morning.",
 pay_cents:18000,
 pay_basis:"day",
 work_date:"2026-10-30",
 start_time:"08:00",
 workers_needed:1,
 max_contacts:3,
 contacts_used:0,
 positions_filled:0,
 languages:["en","pt"],
 status:"open"
};
const profile={
 user_id:"b6150b6c-bfcb-4ec9-90f7-14edfd78a784",
 base_zip:"33569",
 service_radius_miles:25,
 service_categories:["House Cleaning"],
 languages:["pt"],
 opportunity_types:["helper"],
 status:"active"
};

test("work matching uses category type language and ZIP radius",()=>{
 assert.equal(matchesWorkOpportunity(profile,opportunity),true);
 assert.equal(matchesWorkOpportunity({...profile,service_categories:["Flooring"]},opportunity),false);
 assert.equal(matchesWorkOpportunity({...profile,opportunity_types:["professional"]},opportunity),false);
 assert.equal(matchesWorkOpportunity({...profile,languages:["es"]},opportunity),false);
 assert.equal(matchesWorkOpportunity({...profile,status:"suspended"},opportunity),false);
 assert.equal(matchesWorkOpportunity({...profile,user_id:opportunity.posted_by},opportunity),false);
});

test("Preview notification channels are always dry-run",()=>{
 const preview={VERCEL_ENV:"preview",GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_SMS_MODE:"dry_run"};
 assert.equal(workEmailMode(preview),"dry_run");
 assert.equal(workSmsMode(preview),"dry_run");
});

test("Production email is fail-closed without explicit flag sender and key",()=>{
 const base={VERCEL_ENV:"production",GETESTIMATEFAST_ISOLATED_BACKEND:"false"};
 assert.equal(workEmailMode(base),"disabled");
 assert.equal(workEmailMode({...base,GETESTIMATEFAST_WORK_EMAIL_MODE:"enabled"}),"disabled");
 assert.equal(workEmailMode({...base,GETESTIMATEFAST_WORK_EMAIL_MODE:"enabled",RESEND_API_KEY:"synthetic"}),"disabled");
 assert.equal(workEmailMode({...base,GETESTIMATEFAST_WORK_EMAIL_MODE:"enabled",RESEND_API_KEY:"synthetic",WORK_NOTIFICATION_FROM_EMAIL:"GetEstimateFast <notifications@example.com>"}),"live");
});

test("Production SMS remains fail-closed under current Telnyx policy",()=>{
 const production={
  VERCEL_ENV:"production",
  GETESTIMATEFAST_SMS_MODE:"enabled",
  GETESTIMATEFAST_SMS_PROVIDER:"telnyx",
  GETESTIMATEFAST_TELNYX_API_KEY:"synthetic",
  GETESTIMATEFAST_TELNYX_FROM_NUMBER:"+18135550123",
  GETESTIMATEFAST_TELNYX_10DLC_BRAND_APPROVED:"true",
  GETESTIMATEFAST_TELNYX_10DLC_CAMPAIGN_APPROVED:"true"
 };
 assert.equal(workSmsMode(production),"disabled");
});

test("email and SMS links deep-link to the Find Work opportunity",()=>{
 const url=workUrl(opportunity.id,{GETESTIMATEFAST_PUBLIC_ORIGIN:"https://preview.example.com"});
 assert.equal(url,"https://preview.example.com/work-portal.html?opportunity="+opportunity.id);
 const mail=emailText({opportunity,distanceMiles:0});
 const sms=smsText(opportunity);
 assert.match(mail.text,/work-portal\.html\?opportunity=/);
 assert.match(sms,/work-portal\.html\?opportunity=/);
 assert.match(sms,/Reply STOP to opt out/);
});

test("prepared migration creates durable private match and delivery queues",()=>{
 const sql=read("supabase/prepared-migrations/20261029_work_opportunities_mvp.sql");
 assert.match(sql,/create table gef_private\.work_match_jobs/);
 assert.match(sql,/create table gef_private\.work_notification_outbox/);
 assert.match(sql,/work_opportunities_enqueue_match_job/);
 assert.match(sql,/work_opportunities_cancel_pending_delivery/);
 assert.match(sql,/gef_claim_work_match_job/);
 assert.match(sql,/gef_record_work_match/);
 assert.match(sql,/gef_claim_work_deliveries/);
 assert.match(sql,/skipped_not_urgent/);
 assert.match(sql,/blocked_no_consent/);
 assert.match(sql,/revoke all on gef_private\.work_match_jobs from public,anon,authenticated/);
});

test("publication invokes matching without making publication depend on delivery success",()=>{
 const src=read("api/contractor/work-opportunities.js");
 assert.match(src,/processWorkMatchJob/);
 assert.match(src,/matching=\{status:"pending_retry"\}/);
 assert.match(src,/return json\(res,result\.idempotent===true\?200:201,\{\.\.\.result,matching\}\)/);
});

test("Find Work UI focuses the opportunity from notification links",()=>{
 const src=read("assets/work-portal.js");
 assert.match(src,/data-work-opportunity-id/);
 assert.match(src,/new URLSearchParams\(location\.search\)\.get\("opportunity"\)/);
 assert.match(src,/scrollIntoView/);
});
