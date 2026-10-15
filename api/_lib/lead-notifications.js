"use strict";
const { createHash, timingSafeEqual } = require('node:crypto');
const { DEVELOPMENT_REF, protectedPreview } = require('./preview-target');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function workerConfig(env,authorization) {
  if(env.GETESTIMATEFAST_LEAD_NOTIFICATIONS_ENABLED!=='true' || env.GETESTIMATEFAST_LEAD_NOTIFICATION_DELIVERY_APPROVED!=='true' || env.VERCEL_ENV!=='development' || protectedPreview(env))throw Error('WORKER_DISABLED');
  const secret=env.GETESTIMATEFAST_LEAD_NOTIFICATION_WORKER_SECRET;
  if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(secret)||typeof authorization!=='string'||authorization.length>160)throw Error('WORKER_UNAUTHORIZED');
  const hash=s=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(hash(authorization),hash('Bearer '+secret)))throw Error('WORKER_UNAUTHORIZED');
  const url=env.GETESTIMATEFAST_SUPABASE_URL;
  if(url!==`https://${DEVELOPMENT_REF}.supabase.co`||env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF!==DEVELOPMENT_REF||!env.GETESTIMATEFAST_SUPABASE_SECRET_KEY)throw Error('WORKER_TARGET_INVALID');
  if(!env.RESEND_API_KEY||!env.LEAD_TO_EMAIL||!env.LEAD_FROM_EMAIL)throw Error('WORKER_PROVIDER_UNCONFIGURED');
  return {url,key:env.GETESTIMATEFAST_SUPABASE_SECRET_KEY,apiKey:env.RESEND_API_KEY,to:env.LEAD_TO_EMAIL,from:env.LEAD_FROM_EMAIL};
}

function createWorker({env=process.env,fetchImpl=(...args)=>fetch(...args),now=Date.now}={}) {
  return async function deliver(authorization) {
    const c=workerConfig(env,authorization); // No DB/provider call before every gate.
    async function rpc(name,body={}) {
      const r=await fetchImpl(c.url+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',headers:{apikey:c.key,...(c.key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+c.key}),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error('OUTBOX_UNAVAILABLE');
      try{return await r.json();}catch{throw Error('OUTBOX_RESPONSE_INVALID');}
    }
    const job=await rpc('gef_claim_lead_notification');
    if(job===null)return {state:'idle'};
    if(!UUID.test(job?.id)||!UUID.test(job?.lead_id)||!UUID.test(job?.lease_token)||job.idempotency_key!==`gef-lead-v1/${job.id}`||!Number.isFinite(Date.parse(job.lease_until))||Date.parse(job.lease_until)-now()<30000)throw Error('OUTBOX_RESPONSE_INVALID');
    // Persisted lead ID is sufficient for the team to open its authenticated panel.
    // Stable payload: never copy arbitrary form details, email, phone or attachments.
    const payload={from:c.from,to:[c.to],subject:'New GetEstimateFast request',text:`A request has been saved.\nRequest ID: ${job.lead_id}\nOpen the authenticated GetEstimateFast administration panel to review it.`};
    const body=JSON.stringify(payload),digest=createHash('sha256').update(body).digest('hex');
    const prepared=await rpc('gef_prepare_lead_notification',{p_id:job.id,p_lease:job.lease_token,p_hash:digest});
    const finish=(error,provider=null)=>rpc('gef_finish_lead_notification',{p_id:job.id,p_lease:job.lease_token,p_error:error,p_provider_id:provider});
    if(prepared!==true){
      // False also means a nearly expired/stale lease, not necessarily drift.
      // Never terminally classify that ambiguity. Let the bounded lease recover;
      // a persistently different payload remains blocked until attempts exhaust.
      return {state:'not_sent'};
    }
    if(Date.parse(job.lease_until)-now()<20000)throw Error('LEASE_TOO_SHORT');
    let error=null,provider=null;
    try {
      const r=await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+c.apiKey,'Content-Type':'application/json','Idempotency-Key':job.idempotency_key},body,signal:AbortSignal.timeout(8000)});
      if(r.status===429)error='RATE_LIMIT';
      else if(r.status>=500)error='PROVIDER_UNAVAILABLE';
      else if(!r.ok)error='PROVIDER_REJECTED';
      else {const data=await r.json();if(typeof data?.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(data.id))error='INVALID_RESPONSE';else provider=data.id;}
    } catch {error='TRANSPORT_UNKNOWN';}
    // A lost acknowledgement is ambiguous. Leave lease to expire; never resend
    // in this invocation or report sent without the database acknowledgement.
    if(await finish(error,provider)!==true)throw Error('OUTBOX_ACK_UNCONFIRMED');
    return {state:error?'failure_recorded':'sent'};
  };
}
module.exports={workerConfig,createWorker};
