"use strict";
const {queryDb}=require("../admin/_auth");
const {coordinates,haversineMiles}=require("./florida-matching");
const {normalizeUsPhone,readiness:telnyxReadiness}=require("./telnyx-us-provider");

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

function cityFor(zip){try{return require("zipcodes").lookup(zip)?.city||zip;}catch{return zip;}}
function money(cents){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);}
function overlap(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.some(v=>b.includes(v));}
function safeOrigin(env=process.env){
 const raw=env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com";
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)return "https://www.getestimatefast.com";
 return u.origin;
}
function workUrl(opportunityId,env=process.env){
 if(!UUID.test(opportunityId))throw Error("Invalid opportunity");
 return safeOrigin(env)+"/work-portal.html?opportunity="+encodeURIComponent(opportunityId);
}
function matchesWorkOpportunity(profile,opportunity){
 if(!profile||profile.status!=="active"||!opportunity||opportunity.status!=="open")return false;
 if(profile.user_id===opportunity.posted_by)return false;
 if(!Array.isArray(profile.service_categories)||!profile.service_categories.includes(opportunity.service_category))return false;
 if(!Array.isArray(profile.opportunity_types)||!profile.opportunity_types.includes(opportunity.opportunity_type))return false;
 if(!overlap(profile.languages,opportunity.languages))return false;
 const from=coordinates(profile.base_zip),to=coordinates(opportunity.zip_code);
 if(!from||!to)return false;
 return haversineMiles(from,to)<=Number(profile.service_radius_miles)+1e-7;
}
function workEmailMode(env=process.env){
 if(env.VERCEL_ENV==="preview"||env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")return "dry_run";
 if(env.VERCEL_ENV==="production"&&env.GETESTIMATEFAST_WORK_EMAIL_MODE==="enabled"&&env.RESEND_API_KEY&&env.WORK_NOTIFICATION_FROM_EMAIL)return "live";
 return "disabled";
}
function workSmsMode(env=process.env){
 if(env.VERCEL_ENV==="preview"||env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")return "dry_run";
 const state=telnyxReadiness(env);
 return state.live_sms_enabled===true?"live":"disabled";
}
function emailText({opportunity,distanceMiles}){
 const city=cityFor(opportunity.zip_code);
 const when=opportunity.work_date+(opportunity.start_time?" at "+String(opportunity.start_time).slice(0,5):"");
 const basis=opportunity.pay_basis==="hour"?"/hour":opportunity.pay_basis==="fixed"?" fixed":"/day";
 return {
  subject:"New work opportunity near you: "+opportunity.service_category+" in "+city,
  text:[
   "New work opportunity on GetEstimateFast",
   "",
   (opportunity.opportunity_type==="helper"?"Helper":"Professional")+" · "+opportunity.service_category,
   city+", FL "+opportunity.zip_code+(Number.isFinite(distanceMiles)?" · "+distanceMiles.toFixed(1)+" miles from your work ZIP":""),
   when,
   money(opportunity.pay_cents)+basis,
   opportunity.workers_needed+" "+(opportunity.workers_needed===1?"person":"people")+" needed",
   "",
   opportunity.description,
   "",
   "View the opportunity and apply:",
   workUrl(opportunity.id),
   "",
   "You received this because your Find Work profile matches this opportunity. You can change email/SMS preferences in My Profile.",
   "",
   "GetEstimateFast"
  ].join("\n")
 };
}
function smsText(opportunity){
 const city=cityFor(opportunity.zip_code);
 const basis=opportunity.pay_basis==="hour"?"/hr":opportunity.pay_basis==="fixed"?" fixed":"/day";
 let text="GetEstimateFast: New "+(opportunity.opportunity_type==="helper"?"helper":"professional")+" work in "+city+", FL · "+money(opportunity.pay_cents)+basis+". "+workUrl(opportunity.id)+" Reply STOP to opt out.";
 if(text.length>320)text="GetEstimateFast: New work near "+city+", FL. "+workUrl(opportunity.id)+" Reply STOP to opt out.";
 return text;
}
async function sendEmail({delivery,recipient,opportunity,profile,env=process.env}){
 const mode=workEmailMode(env);
 if(mode==="dry_run")return {status:"dry_run",provider:"resend"};
 if(mode!=="live")return {status:"cancelled",provider:"resend",error_code:"email_disabled"};
 const to=String(recipient?.contact_email||"").trim().toLowerCase();
 if(!EMAIL.test(to)||profile?.email_notifications!==true)return {status:"cancelled",provider:"resend",error_code:"email_unavailable"};
 const from=String(env.WORK_NOTIFICATION_FROM_EMAIL||"").trim();
 if(!from)return {status:"failed",provider:"resend",error_code:"email_sender_missing"};
 const fromCoord=coordinates(profile.base_zip),toCoord=coordinates(opportunity.zip_code);
 const distanceMiles=fromCoord&&toCoord?haversineMiles(fromCoord,toCoord):NaN;
 const copy=emailText({opportunity,distanceMiles});
 try{
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{
    Authorization:"Bearer "+env.RESEND_API_KEY,
    "Content-Type":"application/json",
    "Idempotency-Key":delivery.event_key
   },
   body:JSON.stringify({from,to:[to],subject:copy.subject,text:copy.text}),
   redirect:"error",
   signal:AbortSignal.timeout(10000)
  });
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok)return {status:"failed",provider:"resend",error_code:"resend_http_"+response.status};
  return {status:"sent",provider:"resend",provider_message_id:String(payload.id||"").slice(0,200)||null};
 }catch{return {status:"failed",provider:"resend",error_code:"resend_network"};}
}
async function sendSms({recipient,opportunity,profile,env=process.env}){
 const mode=workSmsMode(env);
 if(mode==="dry_run")return {status:"dry_run",provider:"telnyx"};
 if(mode!=="live")return {status:"cancelled",provider:"telnyx",error_code:"sms_disabled"};
 const phone=normalizeUsPhone(recipient?.sms_phone_e164||"");
 if(!phone||profile?.sms_opt_in!==true||!profile?.sms_opt_in_at)return {status:"cancelled",provider:"telnyx",error_code:"sms_unavailable"};
 return {status:"failed",provider:"telnyx",error_code:"live_sms_not_implemented"};
}
async function mapLimit(items,limit,fn){
 const results=new Array(items.length);let next=0;
 async function worker(){for(;;){const index=next++;if(index>=items.length)return;results[index]=await fn(items[index],index);}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
 return results;
}
async function completeDelivery(delivery,result){
 await rpc("gef_complete_work_delivery",{
  p_delivery:delivery.id,
  p_status:result.status,
  p_provider:result.provider||null,
  p_provider_message_id:result.provider_message_id||null,
  p_error_code:result.error_code||null
 });
}
async function deliverWorkNotifications(opportunity){
 const claimed=await rpc("gef_claim_work_deliveries",{p_opportunity:opportunity.id});
 const deliveries=Array.isArray(claimed)?claimed:[];
 if(!deliveries.length)return {claimed:0,dry_run:0,sent:0,cancelled:0,failed:0};
 const ids=[...new Set(deliveries.map(x=>x.recipient_id))];
 const profiles=ids.length?await queryDb(
  "work_profiles?user_id=in.("+ids.map(encodeURIComponent).join(",")+")"+
  "&select=user_id,base_zip,email_notifications,sms_opt_in,sms_opt_in_at,status&limit=500"
 ):[];
 const consents=ids.length?await queryDb(
  "work_signup_consents?user_id=in.("+ids.map(encodeURIComponent).join(",")+")"+
  "&select=user_id,contact_email,sms_phone_e164,sms_opt_in,sms_opt_in_at&limit=500"
 ):[];
 const pMap=new Map(profiles.map(x=>[x.user_id,x])),cMap=new Map(consents.map(x=>[x.user_id,x]));
 const summary={claimed:deliveries.length,dry_run:0,sent:0,cancelled:0,failed:0};
 await mapLimit(deliveries,8,async delivery=>{
  const state=await queryDb(
   "work_opportunities?id=eq."+encodeURIComponent(opportunity.id)+
   "&select=status,contacts_used,max_contacts,positions_filled,workers_needed&limit=1"
  );
  const open=state[0]?.status==="open"&&state[0].contacts_used<state[0].max_contacts&&state[0].positions_filled<state[0].workers_needed;
  let result;
  if(!open)result={status:"cancelled",provider:delivery.channel==="email"?"resend":"telnyx",error_code:"opportunity_closed"};
  else if(delivery.channel==="email")result=await sendEmail({delivery,recipient:cMap.get(delivery.recipient_id),opportunity,profile:pMap.get(delivery.recipient_id)});
  else result=await sendSms({delivery,recipient:cMap.get(delivery.recipient_id),opportunity,profile:pMap.get(delivery.recipient_id)});
  await completeDelivery(delivery,result);
  if(summary[result.status]!==undefined)summary[result.status]++;
 });
 return summary;
}
async function processWorkMatchJob(opportunityId){
 if(!UUID.test(String(opportunityId||"")))throw Error("Invalid opportunity");
 const claim=await rpc("gef_claim_work_match_job",{p_opportunity:opportunityId});
 if(claim?.claimed!==true)return {status:"skipped",code:claim?.code||"not_claimed"};
 let matched=0,emailQueued=0,smsQueued=0;
 try{
  const rows=await queryDb(
   "work_opportunities?id=eq."+encodeURIComponent(opportunityId)+
   "&select=id,posted_by,opportunity_type,service_category,zip_code,description,pay_cents,pay_basis,work_date,start_time,workers_needed,max_contacts,contacts_used,positions_filled,languages,status&limit=1"
  );
  const opportunity=rows[0];
  if(!opportunity||opportunity.status!=="open")throw Error("opportunity_closed");

  const profiles=await queryDb(
   "work_profiles?status=eq.active&select=user_id,base_zip,service_radius_miles,service_categories,languages,opportunity_types,status&limit=2000"
  );
  if(profiles.length>=2000)throw Error("candidate_scan_limit");

  const blocks=await queryDb(
   "work_user_blocks?or=(blocker_id.eq."+encodeURIComponent(opportunity.posted_by)+",blocked_id.eq."+encodeURIComponent(opportunity.posted_by)+")"+
   "&select=blocker_id,blocked_id&limit=5000"
  );
  const blocked=new Set();
  for(const row of blocks){
   if(row.blocker_id===opportunity.posted_by)blocked.add(row.blocked_id);
   if(row.blocked_id===opportunity.posted_by)blocked.add(row.blocker_id);
  }

  const eligible=profiles.filter(profile=>!blocked.has(profile.user_id)&&matchesWorkOpportunity(profile,opportunity));
  const recorded=await mapLimit(eligible,10,async profile=>rpc("gef_record_work_match",{
   p_opportunity:opportunity.id,
   p_recipient:profile.user_id
  }));
  for(const result of recorded){
   if(result?.ok===true){
    matched++;
    if(result.email_queued===true)emailQueued++;
    if(result.sms_queued===true)smsQueued++;
   }
  }

  await rpc("gef_finish_work_match_job",{
   p_opportunity:opportunity.id,
   p_matched:matched,
   p_email_queued:emailQueued,
   p_sms_queued:smsQueued,
   p_success:true,
   p_error_code:null
  });

  const delivery=await deliverWorkNotifications(opportunity);
  return {status:"processed",matched,email_queued:emailQueued,sms_queued:smsQueued,delivery};
 }catch(error){
  await rpc("gef_finish_work_match_job",{
   p_opportunity:opportunityId,
   p_matched:matched,
   p_email_queued:emailQueued,
   p_sms_queued:smsQueued,
   p_success:false,
   p_error_code:String(error?.message||"processing_failed").replace(/[^A-Za-z0-9_.:-]/g,"_").slice(0,120)
  }).catch(()=>{});
  throw error;
 }
}

module.exports={
 workUrl,matchesWorkOpportunity,workEmailMode,workSmsMode,emailText,smsText,processWorkMatchJob,deliverWorkNotifications
};
