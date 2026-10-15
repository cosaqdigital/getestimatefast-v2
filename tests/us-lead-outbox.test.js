"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWorker}=require('../api/_lib/lead-notifications');
const {DEVELOPMENT_REF}=require('../api/_lib/preview-target');
const env={VERCEL_ENV:'development',GETESTIMATEFAST_LEAD_NOTIFICATIONS_ENABLED:'true',GETESTIMATEFAST_LEAD_NOTIFICATION_DELIVERY_APPROVED:'true',GETESTIMATEFAST_LEAD_NOTIFICATION_WORKER_SECRET:'synthetic_worker_secret_not_real_123456',GETESTIMATEFAST_SUPABASE_URL:`https://${DEVELOPMENT_REF}.supabase.co`,GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:DEVELOPMENT_REF,GETESTIMATEFAST_SUPABASE_SECRET_KEY:'SYNTHETIC_DATABASE_KEY',RESEND_API_KEY:'SYNTHETIC_PROVIDER_KEY',LEAD_TO_EMAIL:'team@example.invalid',LEAD_FROM_EMAIL:'synthetic@example.invalid'};
const auth='Bearer '+env.GETESTIMATEFAST_LEAD_NOTIFICATION_WORKER_SECRET;
const job={id:'6a0ed316-bdbd-4132-a98e-f0088aca25f7',lead_id:'2a23d263-080f-4c5d-85c4-396b11b4dd8a',lease_token:'3ba1e24d-ec8d-4cf4-95ad-20b5493fb04d',lease_until:'2026-10-14T12:05:00Z'};job.idempotency_key='gef-lead-v1/'+job.id;
const now=()=>Date.parse('2026-10-14T12:00:00Z');
function fixture({vars={},status=200,throws=false,claim=job,prepared=true,finish=true}={}){
 const calls=[];
 const worker=createWorker({env:{...env,...vars},now,fetchImpl:async(url,opts)=>{
  calls.push({url,opts,body:JSON.parse(opts.body)});
  const reply=data=>new Response(JSON.stringify(data),{status:200});
  if(url.endsWith('gef_claim_lead_notification'))return reply(claim);
  if(url.endsWith('gef_prepare_lead_notification'))return reply(prepared);
  if(url.endsWith('gef_finish_lead_notification'))return reply(finish);
  assert.equal(url,'https://api.resend.com/emails');if(throws)throw Error('synthetic private provider details');
  return new Response(JSON.stringify(status===200?{id:'synthetic-accepted'}:{message:'synthetic private response'}),{status});
 }});return {worker,calls};
}
test('One persisted leased job, stable idempotency key, no PII in provider payload',async()=>{const f=fixture();assert.deepEqual(await f.worker(auth),{state:'sent'});assert.equal(f.calls.length,4);const call=f.calls[2];assert.equal(call.opts.headers['Idempotency-Key'],job.idempotency_key);assert.match(call.body.text,new RegExp(job.lead_id));assert.equal(call.body.attachments,undefined);assert.equal(f.calls[3].body.p_error,null);});
for(const [status,code] of [[429,'RATE_LIMIT'],[500,'PROVIDER_UNAVAILABLE'],[503,'PROVIDER_UNAVAILABLE'],[400,'PROVIDER_REJECTED']])test(`Provider ${status} records sanitized ${code}`,async()=>{const f=fixture({status});assert.equal((await f.worker(auth)).state,'failure_recorded');assert.equal(f.calls.at(-1).body.p_error,code);});
test('Transport ambiguity recorded without immediate retry or leaking exception',async()=>{const f=fixture({throws:true});assert.deepEqual(await f.worker(auth),{state:'failure_recorded'});assert.equal(f.calls.at(-1).body.p_error,'TRANSPORT_UNKNOWN');assert.equal(f.calls.filter(c=>c.url.includes('resend')).length,1);});
for(const vars of [{GETESTIMATEFAST_LEAD_NOTIFICATIONS_ENABLED:undefined},{GETESTIMATEFAST_LEAD_NOTIFICATION_DELIVERY_APPROVED:'false'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},{GETESTIMATEFAST_SUPABASE_URL:'https://wrong-project.supabase.co'},{GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:'wrong'},{RESEND_API_KEY:undefined},{LEAD_FROM_EMAIL:undefined},{GETESTIMATEFAST_SUPABASE_SECRET_KEY:undefined},{GETESTIMATEFAST_LEAD_NOTIFICATION_WORKER_SECRET:'weak'}])test('Fail closed before any side effect: '+Object.keys(vars)[0]+' '+(vars.VERCEL_ENV||''),async()=>{const f=fixture({vars});await assert.rejects(f.worker(auth));assert.equal(f.calls.length,0);});
test('Wrong/missing worker authentication makes no outbound call',async()=>{for(const a of [undefined,'Bearer wrong']){const f=fixture();await assert.rejects(f.worker(a));assert.equal(f.calls.length,0);}});
test('Empty queue does not send',async()=>{const f=fixture({claim:null});assert.equal((await f.worker(auth)).state,'idle');assert.equal(f.calls.length,1);});
test('Unverified or stale job never sends',async()=>{for(const claim of [{...job,id:'wrong'},{...job,lease_until:'invalid'},{...job,lease_until:'2026-10-14T11:59:00Z'}]){const f=fixture({claim});await assert.rejects(f.worker(auth));assert.equal(f.calls.length,1);}});
test('Payload mismatch or shortening lease cannot send or incorrectly exhaust a recoverable job',async()=>{const f=fixture({prepared:false});assert.equal((await f.worker(auth)).state,'not_sent');assert.equal(f.calls.length,2);assert.equal(f.calls.at(-1).url.endsWith('gef_prepare_lead_notification'),true);});
test('Lost finish acknowledgement never reports sent or repeats provider call',async()=>{const f=fixture({finish:false});await assert.rejects(f.worker(auth),/OUTBOX_ACK_UNCONFIRMED/);assert.equal(f.calls.length,4);});
test('Internal endpoint disabled by default and no secret in output',async()=>{const handler=require('../api/internal/lead-notifications');let output;const res={setHeader(){},end(v){output=String(v);}};await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,503);assert.equal(output,'{"error":"Notification worker unavailable"}');});
test('Admin counts deny anonymous access using existing authentication',async()=>{const handler=require('../api/admin/lead-notifications');let output;const res={setHeader(){},end(v){output=v;}};await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);assert.doesNotMatch(output,/states|errors/);});
test('SQL and deployment gates are preserved',()=>{const fs=require('fs');const config=JSON.parse(fs.readFileSync(require.resolve('../vercel.json')));assert.equal(config.git.deploymentEnabled['feat/us-lead-notification-outbox-issue63-20261014'],false);assert.equal(config.crons,undefined);const sql=fs.readFileSync(require.resolve('../supabase/prepared-migrations/us-lead-notification-outbox.sql'),'utf8');assert.doesNotMatch(sql,/security\s+definer/i);assert.match(sql,/for update of o skip locked/i);assert.match(sql,/enable row level security/i);});
