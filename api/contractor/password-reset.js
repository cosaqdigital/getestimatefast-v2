"use strict";
const {config,json,readJson,queryDb}=require("./_shared");

const ORIGIN="https://www.getestimatefast.com";
const HOST="www.getestimatefast.com";
const MIN_PASSWORD_LENGTH=8;
const MAX_PASSWORD_LENGTH=256;

function reject(res,status,code,error){return json(res,status,{error,code});}
function enabled(env=process.env){
 if(env.VERCEL_ENV!=="production")return false;
 if(env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")return false;
 if(env.GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED!=="true")return false;
 if(String(env.GETESTIMATEFAST_SUPABASE_URL||"").replace(/\/$/,"")!=="https://wedsjubkttygxtpkopfj.supabase.co")return false;
 if(env.GETESTIMATEFAST_PUBLIC_ORIGIN!==ORIGIN)return false;
 try{config(env);return true;}catch{return false;}
}
function requestOrigin(req){
 const site=req.headers["sec-fetch-site"];
 if(site!==undefined&&site!=="same-origin")return "";
 const host=String(req.headers.host||"");
 const origin=req.headers.origin;
 if(host===HOST&&(origin===ORIGIN||(req.method==="GET"&&origin===undefined)))return ORIGIN;
 return "";
}
function bearer(req){
 const m=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(String(req.headers.authorization||""));
 return m?m[1]:"";
}
async function contractorForToken(token){
 const {url,publishable}=config();
 const response=await fetch(url+"/auth/v1/user",{
  headers:{apikey:publishable,Authorization:"Bearer "+token},
  redirect:"error",
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)return null;
 const user=await response.json();
 if(!user?.id||!user?.email_confirmed_at||user?.is_anonymous)return null;
 const profiles=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id&limit=1");
 return profiles.length?user:null;
}

module.exports=async function handler(req,res){
 res.setHeader("Referrer-Policy","no-referrer");
 if(!enabled())return reject(res,404,"recovery_disabled","Password reset is not enabled.");
 if(!["GET","POST"].includes(req.method)){res.setHeader("Allow","GET, POST");return reject(res,405,"method_not_allowed","Method not allowed.");}
 const acceptedOrigin=requestOrigin(req);
 if(!acceptedOrigin)return reject(res,403,"origin_not_allowed","Request origin not allowed.");
 if(Object.keys(req.query||{}).length||String(req.url||"").includes("?"))return reject(res,400,"invalid_request","Invalid password reset request.");
 try{
  if(req.method==="GET"){
   const token=bearer(req);
   if(!token)return json(res,200,{enabled:true,minPasswordLength:MIN_PASSWORD_LENGTH,maxPasswordLength:MAX_PASSWORD_LENGTH,sessionValidated:false});
   const user=await contractorForToken(token);
   if(!user)return reject(res,403,"access_denied","Access denied.");
   return json(res,200,{enabled:true,minPasswordLength:MIN_PASSWORD_LENGTH,maxPasswordLength:MAX_PASSWORD_LENGTH,sessionValidated:true});
  }
  if(String(req.headers["content-type"]||"").split(";")[0].trim().toLowerCase()!=="application/json")return reject(res,400,"invalid_request","A JSON request is required.");
  let body;try{body=await readJson(req,4096);}catch{return reject(res,400,"invalid_request","Invalid password reset request.");}
  if(!body||typeof body!=="object"||Array.isArray(body)||!["request","complete"].includes(body.action))return reject(res,400,"invalid_request","Invalid password reset request.");

  if(body.action==="request"){
   if(Object.keys(body).length!==2||typeof body.email!=="string")return reject(res,400,"invalid_request","Invalid password reset request.");
   const email=body.email.trim().toLowerCase();
   if(!email||email.length>254||!email.includes("@"))return reject(res,400,"invalid_email","Enter a valid email address.");
   const {url,publishable}=config();
   const redirectTo=acceptedOrigin+"/contractor-reset-password.html";
   const recovery=await fetch(url+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirectTo),{
    method:"POST",redirect:"error",
    headers:{apikey:publishable,"Content-Type":"application/json","X-Supabase-Api-Version":"2024-01-01"},
    body:JSON.stringify({email}),signal:AbortSignal.timeout(10000)
   });
   if(!recovery.ok){
    let code="";try{const d=await recovery.json();code=d?.code||d?.error_code||"";}catch{}
    if(recovery.status===429||["over_email_send_rate_limit","over_request_rate_limit"].includes(code))return reject(res,429,"rate_limited","Too many password reset requests.");
    return reject(res,503,"email_delivery_unavailable","Password reset email could not be sent.");
   }
   return json(res,200,{ok:true,requested:true});
  }

  if(Object.keys(body).length!==2||typeof body.password!=="string")return reject(res,400,"invalid_request","Invalid password reset request.");
  if(body.password.length<MIN_PASSWORD_LENGTH||body.password.length>MAX_PASSWORD_LENGTH)return reject(res,400,"invalid_password","Use a password between 8 and 256 characters.");
  const token=bearer(req);
  if(!token)return reject(res,401,"session_invalid","The recovery session is missing or expired.");
  const user=await contractorForToken(token);
  if(!user)return reject(res,403,"access_denied","Access denied.");
  const {url,publishable}=config();
  const update=await fetch(url+"/auth/v1/user",{
   method:"PUT",redirect:"error",
   headers:{apikey:publishable,Authorization:"Bearer "+token,"Content-Type":"application/json","X-Supabase-Api-Version":"2024-01-01"},
   body:JSON.stringify({password:body.password}),signal:AbortSignal.timeout(10000)
  });
  if(!update.ok){
   let code="";try{const d=await update.json();code=d?.code||d?.error_code||"";}catch{}
   if(["same_password","weak_password"].includes(code)||[400,422].includes(update.status))return reject(res,400,"invalid_password","The password was not accepted.");
   if([401,403].includes(update.status))return reject(res,401,"session_invalid","The recovery session is invalid or expired.");
   return reject(res,503,"service_unavailable","Password reset is temporarily unavailable.");
  }
  return json(res,200,{ok:true,redirectPath:"/contractor-portal.html"});
 }catch{return reject(res,503,"service_unavailable","Password reset is temporarily unavailable.");}
};
