"use strict";
const {json,method,readJson,queryDb,fail,config}=require("./admin/_auth");
const {marketplaceReady,uuid}=require("./_lib/marketplace-access");
const {parseReview,identityHash,text}=require("./_lib/public-profile-policy");
const {profileHtml}=require("./_lib/public-profile-html");
const crypto=require("node:crypto"),net=require("node:net");
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
function origin(){const u=new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com");if(u.username||u.password||u.search||u.hash||u.pathname!=="/"||!(u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1"].includes(u.hostname))))throw Error("Invalid public origin");return u.origin;}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  if(!marketplaceReady(req,res))return;
  if(req.method==="GET"){
   const slug=String(req.query?.slug||"");if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)return json(res,400,{error:"Invalid profile link"});
   const data=await rpc("gef_public_profile",{p_slug:slug});
   if(!data?.profile)return json(res,404,{error:"Profile not available"});
   if(req.query?.format!=="html")return json(res,200,data);
   const {url}=config();res.statusCode=200;res.setHeader("Content-Type","text/html; charset=utf-8");res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","no-referrer");
   res.setHeader("Content-Security-Policy",`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' ${url}; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
   return res.end(profileHtml(data,origin(),url));
  }
  const action=String(req.query?.action||"review");
  const secret=process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET;
  if(typeof secret!=="string"||secret.length<32)throw Error("Review identity secret not configured");
  const ip=process.env.VERCEL==="1"?String(req.headers["x-vercel-forwarded-for"]||"").split(",")[0].trim():req.socket?.remoteAddress;
  if(!net.isIP(ip||""))throw Error("Trusted client address unavailable");
  const hash=crypto.createHmac("sha256",secret).update(action+":"+ip).digest("hex");
  if(!await rpc("gef_public_request_allowed",{p_hash:hash,p_limit:action==="report"?5:10}))return json(res,429,{error:"Too many submissions. Please try again later."});
  const body=await readJson(req,6000);
  if(action==="review"){
   let review;try{review=parseReview(body,process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET);}catch(e){return json(res,400,{error:e.message});}
   return json(res,201,await rpc("gef_submit_review",{p_review:review}));
  }
  if(action==="report"){
   let id,reason,hash;try{id=uuid(body.review_id);reason=text(body.reason,10,1000);hash=identityHash(body.email,process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))throw Error("Invalid email");}catch(e){return json(res,400,{error:e.message});}
   return json(res,200,await rpc("gef_report_review",{p_review:id,p_hash:hash,p_reason:reason}));
  }
  return json(res,400,{error:"Unknown action"});
 }catch(e){if(e.reviewConflict)return json(res,409,{error:e.reviewConflict});fail(res,e);}
};
