"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {opportunitySmsEligibility}=require("../api/_lib/opportunity-sms-policy");

test("opportunity SMS eligibility requires active verified explicit current consent",()=>{
  const base={
    account_status:"active",
    email_verified_at:"2026-10-29T00:00:00Z",
    sms_opt_in:true,
    sms_opt_in_at:"2026-10-29T00:00:00Z",
    sms_opt_out_at:null,
    sms_phone_e164:"+18135550134"
  };
  assert.deepEqual(opportunitySmsEligibility(base),{eligible:true,status:"QUEUED",phone:"+18135550134"});
  assert.equal(opportunitySmsEligibility({...base,sms_opt_out_at:"2026-10-29T01:00:00Z"}).status,"BLOCKED_NO_CONSENT");
  assert.equal(opportunitySmsEligibility({...base,sms_opt_in:false}).status,"BLOCKED_NO_CONSENT");
  assert.equal(opportunitySmsEligibility({...base,email_verified_at:null}).status,"BLOCKED_INACTIVE");
  assert.equal(opportunitySmsEligibility({...base,account_status:"pending"}).status,"BLOCKED_INACTIVE");
  assert.equal(opportunitySmsEligibility({...base,sms_phone_e164:"+5511999999999"}).status,"BLOCKED_INVALID_PHONE");
});

test("prepared opportunity SMS queue is idempotent and server-only",()=>{
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/prepared-migrations/20261029_opportunity_sms_queue.sql"),"utf8");
  for(const required of [
    "matching_recipient_id uuid not null unique",
    "enable row level security",
    "revoke all on public.opportunity_sms_queue from public,anon,authenticated",
    "grant select,insert,update on public.opportunity_sms_queue to service_role",
    "'BLOCKED_NO_CONSENT'",
    "'BLOCKED_INVALID_PHONE'",
    "'DELIVERED'",
    "attempt_count between 0 and 5",
    "opportunity_sms_queue_opportunity_idx",
    "opportunity_sms_queue_contractor_idx"
  ])assert(sql.includes(required),required);
  const phoneCheckLine=sql.split("\n").find(line=>line.includes("recipient_phone_e164 ~"));
  assert.equal(phoneCheckLine.trim(),"or recipient_phone_e164 ~ '^\\+1[2-9][0-9]{2}[2-9][0-9]{6}$'");
  assert.doesNotMatch(sql,/grant\s+.*\b(delete|truncate)\b.*service_role/i);
});
