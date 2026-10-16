"use strict";
// Profile-sourced requests stay disabled until an explicit Development rollout.
// No production availability, SMS, payments, Resend or customer-contact release.
const crypto=require("node:crypto"),net=require("node:net");
const {json,method,readJson,queryDb,fail}=require("./admin/_auth");
const {protectedPreview}=require("./_lib/preview-target");
const {marketplaceReady}=require("./_lib/marketplace-access");
const {prepareProfileRequest}=require("./_lib/profile-origin-policy");
function enabled(env=process.env){
 return env.VERCEL_ENV==="preview"&&protectedPreview(env)&&
  env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"&&
  env.GETESTIMATEFAST_PROFILE_REQUESTS_ENABLED==="true";
}
function trustedIp(req){
 const candidate=process.env.VERCEL==="1"
   ? String(req.headers["x-vercel-forwarded-for"]||"").split(",")[0].trim()
   : req.socket?.remoteAddress;
 return net.isIP(candidate||"")?candidate:null;
}
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 if(!enabled())return json(res,503,{error:"Requests from professional profiles are not yet available in this preview."});
 try{
  const origin=String(req.headers.origin||"");
  const host=String(req.headers.host||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Origin not allowed"});}if(url.host!==host)return json(res,403,{error:"Origin not allowed"});}
  if(!String(req.headers["content-type"]||"").toLowerCase().startsWith("application/json"))
    return json(res,415,{error:"Send a JSON request."});
  if(!marketplaceReady(req,res))return;
  const body=await readJson(req,8192);
  let input;try{input=prepareProfileRequest(body);}catch(error){return json(res,400,{error:error.message});}
  const secret=process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET;
  const ip=trustedIp(req);
  if(!ip||typeof secret!=="string"||secret.length<32)throw Error("Public request limit configuration missing");
  const fingerprint=crypto.createHmac("sha256",secret).update("profile-request:"+ip).digest("hex");
  const permitted=await queryDb("rpc/gef_public_request_allowed",{method:"POST",body:JSON.stringify({p_hash:fingerprint,p_limit:5})});
  if(permitted!==true)return json(res,429,{error:"Too many requests. Please try again later."});
  // RPC is an atomic transaction: lead + immutable profile owner attribution.
  const saved=await queryDb("rpc/gef_create_profile_lead",{method:"POST",body:JSON.stringify(input)});
  if(!saved?.lead_id)throw Error("Profile request was not persisted");
  return json(res,saved.duplicate?200:201,{received:true,duplicate:Boolean(saved.duplicate),request_id:saved.lead_id});
 }catch(error){return fail(res,error);}
};
module.exports.enabled=enabled;
