"use strict";
const crypto=require("node:crypto");
const {DEVELOPMENT_REF,protectedPreview}=require("./preview-target");
const {productionMarketplaceEnabled}=require("./marketplace-access");
const {recognizedFloridaZip}=require("./florida-matching");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_AGE_SECONDS=7*86400;
function mode(env=process.env){
 const flag=env.GETESTIMATEFAST_PROFILE_REQUESTS_MODE;
 if(flag==="synthetic" && protectedPreview(env) && env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"
    && env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF===DEVELOPMENT_REF
    && String(env.GETESTIMATEFAST_SUPABASE_URL||"").replace(/\/$/,"")==="https://"+DEVELOPMENT_REF+".supabase.co")return "synthetic";
 if(flag==="live" && env.VERCEL_ENV==="production" && env.GETESTIMATEFAST_PROFILE_REQUESTS_LIVE_APPROVED==="true"
    && env.LEAD_PERSISTENCE_ENABLED==="true" && productionMarketplaceEnabled(env))return "live";
 return null;
}
function secret(env=process.env){
 const key=env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET;
 if(typeof key!=="string"||key.length<32)throw Error("Referral signing secret not configured");
 return key;
}
function signature(payload,key){
 return crypto.createHmac("sha256",key).update("GetEstimateFast-US:profile-origin:v1:"+payload).digest("base64url");
}
function sign(slug,contractorId,now=Date.now(),env=process.env){
 if(!SLUG.test(slug)||slug.length>80||!UUID.test(contractorId))throw Error("Invalid public profile");
 const payload=Buffer.from(JSON.stringify({v:1,s:slug,c:contractorId,iat:Math.floor(now/1000)})).toString("base64url");
 return payload+"."+signature(payload,secret(env));
}
function verify(token,slug,now=Date.now(),env=process.env){
 if(typeof token!=="string"||token.length<30||token.length>600||!SLUG.test(slug))return null;
 const parts=token.split(".");
 if(parts.length!==2||!parts.every(s=>/^[A-Za-z0-9_-]+$/.test(s)))return null;
 const expected=signature(parts[0],secret(env));
 const a=Buffer.from(parts[1]),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 let data;
 try{data=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));}catch{return null;}
 const seconds=Math.floor(now/1000);
 if(data.v!==1||data.s!==slug||!UUID.test(data.c)||!Number.isSafeInteger(data.iat)||data.iat>seconds+60||seconds-data.iat>MAX_AGE_SECONDS)return null;
 return {slug:data.s,contractorId:data.c};
}
function readFields(form){
 const allowed=["profile_slug","profile_token","submission_token","full_name","email","phone","city","zip","service","description","contact_consent","website"];
 const fields={};
 for(const key of allowed){
  const list=form.getAll(key);
  if(list.length>1)throw Error("Duplicate form field");
  fields[key]=String(list[0]||"").trim();
 }
 return fields;
}
function validate(fields,profile,activeMode){
 if(fields.website)return "Invalid request";
 if(!UUID.test(fields.submission_token))return "Please reload the page and try again.";
 if(!fields.contact_consent||fields.contact_consent!=="yes")return "Please confirm that you understand how your request may be shared.";
 if(fields.full_name.length<2||fields.full_name.length>120)return "Enter your full name.";
 if(fields.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))return "Enter a valid email address.";
 const phone=fields.phone.replace(/\D/g,"");
 if(!/^(1)?[2-9]\d{9}$/.test(phone))return "Enter a valid US telephone number.";
 if(!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(fields.city))return "Enter a valid city.";
 if(!recognizedFloridaZip(fields.zip))return "Enter a recognized Florida ZIP Code.";
 if(fields.description.length<20||fields.description.length>2400)return "Describe your project in 20 to 2400 characters.";
 if(!Array.isArray(profile.categories)||!profile.categories.includes(fields.service))return "Select a service offered by this professional.";
 if(activeMode==="synthetic"){
  if(!/^TEST ONLY\b/i.test(fields.full_name)||!fields.email.toLowerCase().endsWith("@example.invalid")
     ||phone!=="8135550100"||!/^TEST ONLY[:\s]/i.test(fields.description)){
   return "Development accepts synthetic test details only: TEST ONLY name, example.invalid email, 8135550100 phone and TEST ONLY description.";
  }
 }
 return "";
}
// Vercel serves one protected Preview through both a deployment URL and a
// branch alias. Both are first-party, but Origin and Host may differ between
// those exact runtime-configured domains. Never trust arbitrary vercel.app hosts
// or client-supplied X-Forwarded-Host headers.
function trustedHost(value){
 if(typeof value!=="string"||!value||value.length>300)return null;
 try{
  const candidate=new URL(value.includes("://")?value:"https://"+value);
  if(candidate.protocol!=="https:"||candidate.username||candidate.password||
     candidate.pathname!=="/"||candidate.search||candidate.hash||candidate.port)return null;
  return candidate.hostname.toLowerCase();
 }catch{return null;}
}
function allowedHosts(env=process.env){
 const allowed=new Set();
 const activeMode=mode(env);
 if(activeMode==="synthetic"){
  for(const value of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.GETESTIMATEFAST_PUBLIC_ORIGIN]){
   const hostname=trustedHost(value);
   // A project/team-specific suffix limits accepted domains to this US Preview.
   if(hostname&&/^getestimatefast-v2-[a-z0-9-]+-get-estimate-fast\.vercel\.app$/.test(hostname))
    allowed.add(hostname);
  }
 }else if(activeMode==="live"){
  allowed.add("www.getestimatefast.com");
  allowed.add("getestimatefast.com");
 }
 return allowed;
}
function requestOriginAllowed(origin,requestHost,env=process.env){
 if(origin===undefined||origin===null||origin==="")return true; // Existing form compatibility
 if(typeof origin!=="string")return false;
 let parsed;
 try{parsed=new URL(origin);}catch{return false;}
 if(parsed.protocol!=="https:"||parsed.origin!==origin||parsed.username||parsed.password||
    parsed.pathname!=="/"||parsed.search||parsed.hash||parsed.port)return false;
 const hosts=allowedHosts(env);
 const requested=trustedHost(requestHost);
 return Boolean(requested&&hosts.has(requested)&&hosts.has(parsed.hostname.toLowerCase()));
}

function limitHash(ip,env=process.env){
 return crypto.createHmac("sha256",secret(env)).update("GetEstimateFast-US:profile-request:rate:"+ip).digest("hex");
}
module.exports={mode,sign,verify,validate,readFields,limitHash,requestOriginAllowed};
