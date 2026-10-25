"use strict";
const crypto=require("node:crypto");
const net=require("node:net");

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value){return String(value||"").trim().toLowerCase();}
function validEmail(value){const email=normalizeEmail(value);return email.length>=5&&email.length<=254&&EMAIL.test(email);}
function matchesOwnedEmail(value,candidates){const email=normalizeEmail(value);return Array.isArray(candidates)&&candidates.some(candidate=>normalizeEmail(candidate)===email&&email.length>0);}
function identityHash(email,secret){
  if(typeof secret!=="string"||secret.length<32)throw Error("Review identity secret is not configured");
  return crypto.createHmac("sha256",secret).update(normalizeEmail(email)).digest("hex");
}
function createVerificationToken(){
  const token=crypto.randomBytes(32).toString("hex");
  return {token,tokenHash:crypto.createHash("sha256").update(token).digest("hex")};
}
function hashVerificationToken(token){
  if(!/^[a-f0-9]{64}$/.test(String(token||"")))return null;
  return crypto.createHash("sha256").update(token).digest("hex");
}
function trustedIp(req){
  const raw=process.env.VERCEL==="1"?String(req.headers["x-vercel-forwarded-for"]||"").split(",")[0].trim():req.socket?.remoteAddress;
  return net.isIP(raw||"")?raw:null;
}
function requestHash(value,secret,prefix){
  if(!value)return null;
  return crypto.createHmac("sha256",secret).update(prefix+":"+value).digest("hex");
}
async function sendVerificationEmail({to,professionalName,verificationUrl,reviewId,key}){
  if(!process.env.RESEND_API_KEY)return false;
  const from=process.env.REVIEW_FROM_EMAIL||process.env.LEAD_FROM_EMAIL||"GetEstimateFast <onboarding@resend.dev>";
  const subject="Confirm your review of "+professionalName;
  const text=[
    "Hello,",
    "",
    "We received your review of "+professionalName+" on GetEstimateFast.",
    "Please confirm that you submitted this review by opening the link below:",
    "",
    verificationUrl,
    "",
    "This link expires in 24 hours. After confirmation, your review will be sent for moderation before it can appear publicly.",
    "",
    "If you did not submit this review, you can ignore this email.",
    "",
    "GetEstimateFast"
  ].join("\n");
  try{
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        Authorization:"Bearer "+process.env.RESEND_API_KEY,
        "Content-Type":"application/json",
        "Idempotency-Key":"review-verification:"+reviewId+":"+key
      },
      body:JSON.stringify({from,to:[to],subject,text})
    });
    return response.ok;
  }catch{return false;}
}
module.exports={normalizeEmail,validEmail,matchesOwnedEmail,identityHash,createVerificationToken,hashVerificationToken,trustedIp,requestHash,sendVerificationEmail};
