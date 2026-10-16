"use strict";
const net=require("node:net");
const {queryDb,config}=require("./admin/_auth");
const {mode,verify,validate,readFields,limitHash}=require("./_lib/profile-origin");
const ESC=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function page(res,code,message){
 res.statusCode=code;
 res.setHeader("Content-Type","text/html; charset=utf-8");
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Referrer-Policy","no-referrer");
 res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
 res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estimate request | GetEstimateFast</title><style>body{font:16px system-ui,sans-serif;background:#f2f6fa;color:#143450;margin:5vh auto;padding:20px;max-width:650px}.box{background:white;border:1px solid #dbe5ed;border-radius:16px;padding:26px}a{color:#b75017;font-weight:700}</style><div class="box"><h1>We could not submit your request</h1><p>'+ESC(message)+'</p><p><a href="/">Return to GetEstimateFast</a></p></div></html>');
}
function redirect(res){
 res.statusCode=303;
 res.setHeader("Location","/profile-request-received.html");
 res.setHeader("Cache-Control","no-store");
 res.end();
}
async function readForm(req){
 const type=String(req.headers["content-type"]||"").toLowerCase();
 if(!type.startsWith("application/x-www-form-urlencoded"))throw Error("Use the request form");
 let raw;
 if(typeof req.body==="string")raw=req.body;
 else if(req.body && typeof req.body==="object" && !Buffer.isBuffer(req.body)){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(req.body)){
   if(Array.isArray(value)){for(const item of value)params.append(key,String(item));}
   else if(typeof value==="string")params.append(key,value);
   else throw Error("Invalid form field");
  }
  raw=params.toString();
 }else{
  const chunks=[];let size=0;
  for await(const chunk of req){
   size+=chunk.length;
   if(size>8000)throw Error("Request too long");
   chunks.push(chunk);
  }
  raw=Buffer.concat(chunks).toString("utf8");
 }
 if(Buffer.byteLength(raw)>8000)throw Error("Request too long");
 return new URLSearchParams(raw);
}
async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return page(res,405,"This page only accepts estimate requests.");}
 const activeMode=mode();
 if(!activeMode)return page(res,503,"Profile estimate requests are not enabled here.");
 try{
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin)}catch{return page(res,403,"Request origin not allowed.");}
   if(url.protocol!=="https:"||url.host!==req.headers.host)return page(res,403,"Request origin not allowed.");
  }
  const fields=readFields(await readForm(req));
  if(!fields.profile_slug||!fields.profile_token)return page(res,400,"Please open the professional's public page again.");
  const referral=verify(fields.profile_token,fields.profile_slug);
  if(!referral)return page(res,400,"This estimate link has expired. Reload the professional's page.");
  // Validate the server-derived owner is STILL the published, active profile.
  config();
  const results=await queryDb("contractor_public_profiles?slug=eq."+encodeURIComponent(referral.slug)+
   "&contractor_id=eq."+encodeURIComponent(referral.contractorId)+
   "&published=eq.true&select=contractor_id,slug,categories&limit=1");
  const profile=results[0];
  if(!profile)return page(res,404,"This professional page is no longer available.");
  const active=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(referral.contractorId)+
   "&account_status=eq.active&email_verified_at=not.is.null&select=user_id&limit=1");
  if(!active.length)return page(res,404,"This professional is not currently available.");
  const error=validate(fields,profile,activeMode);
  if(error)return page(res,400,error);
  const trustedIp=String(req.headers["x-vercel-forwarded-for"]||req.socket?.remoteAddress||"").split(",")[0].trim();
  if(!net.isIP(trustedIp))return page(res,403,"Request could not be verified.");
  const allowed=await queryDb("rpc/gef_public_request_allowed",{method:"POST",
   body:JSON.stringify({p_hash:limitHash(trustedIp),p_limit:5})});
  if(allowed!==true)return page(res,429,"Too many requests from this connection. Please try later.");
  const detail={
    "Service Type":fields.service,
    "Project Description":fields.description,
    "Contact Source":"Professional public profile",
    "_profile_referral":{source:"public_profile",origin_slug:referral.slug,customer_share_accepted:true,
      accepted_at:new Date().toISOString(),consent_version:"profile-request-v1"},
    "_platform_review":{required:true,reason:"profile_origin_request",original_service:fields.service}
  };
  const body={
   submission_token:fields.submission_token,source:"professional_profile",origin_contractor_id:referral.contractorId,
   service_type:fields.service,full_name:fields.full_name,email:fields.email.toLowerCase(),phone:fields.phone,
   city:fields.city,zip_code:fields.zip,contact_method:"email",status:"new",details:detail
  };
  const records=await queryDb("leads?on_conflict=submission_token&select=id,origin_contractor_id",{method:"POST",
   headers:{"Prefer":"resolution=ignore-duplicates,return=representation"},
   body:JSON.stringify(body)});
  if(!Array.isArray(records))throw Error("Lead database response invalid");
  if(records.length===0){
   const existing=await queryDb("leads?submission_token=eq."+encodeURIComponent(fields.submission_token)+
     "&select=id,origin_contractor_id,source&limit=1");
   if(!existing[0]?.id||existing[0].origin_contractor_id!==referral.contractorId||existing[0].source!=="professional_profile")
     return page(res,409,"This request identifier is already in use. Reload the page.");
  }else if(!records[0]?.id){throw Error("Lead insert had no identifier");}
  return redirect(res);
 }catch(err){
  console.error("GetEstimateFast US profile estimate intake:",err?.name||"unknown");
  return page(res,503,"We could not save this request right now. Please try again later.");
 }
}
module.exports=handler;
