"use strict";
const {config,json,method,readJson,queryDb,fail}=require("../contractor/_shared");
const {normalizeUsPhone}=require("../_lib/telnyx-us-provider");
const {protectedPreview}=require("../_lib/preview-target");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 if(protectedPreview()||process.env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")
  return json(res,503,{error:"Registration and confirmation email delivery are disabled in this test environment."});
 if(process.env.WORK_SIGNUP_ENABLED!=="true")
  return json(res,503,{error:"Find Work registration is not open yet."});
 try{
  const data=await readJson(req,4000);
  const email=String(data.email||"").trim().toLowerCase();
  const password=String(data.password||"");
  const phone=String(data.phone||"").trim();
  const smsPhone=normalizeUsPhone(phone);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128||
     phone.length>35||!smsPhone||typeof data.smsOptIn!=="boolean"||data.privacyConsent!==true||data.termsConsent!==true)
    return json(res,400,{error:"Check email, US mobile number, password (12+ characters), and required legal consent."});
  const production=process.env.VERCEL_ENV==="production";
  const privacyVersion=production?String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim():"preview-v1";
  const termsVersion=production?String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim():"preview-v1";
  if(production&&(!/^[A-Za-z0-9._-]{3,80}$/.test(privacyVersion)||!/^[A-Za-z0-9._-]{3,80}$/.test(termsVersion)))
    return json(res,503,{error:"Terms and privacy versions are not configured for Production."});
  const {url,publishable}=config();
  const response=await fetch(url+"/auth/v1/signup",{
   method:"POST",redirect:"error",
   headers:{"Content-Type":"application/json",apikey:publishable},
   body:JSON.stringify({email,password}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return json(res,429,{error:"We could not complete signup. Please wait and try again."});
  let authPayload={};try{authPayload=await response.json();}catch{}
  if(authPayload?.user?.id){
   const now=new Date().toISOString();
   await queryDb("work_signup_consents?on_conflict=user_id",{
    method:"POST",
    headers:{Prefer:"return=representation,resolution=merge-duplicates"},
    body:JSON.stringify({
     user_id:authPayload.user.id,
     contact_email:email,
     contact_phone:phone,
     sms_phone_e164:smsPhone,
     sms_opt_in:data.smsOptIn,
     sms_opt_in_at:data.smsOptIn?now:null,
     privacy_accepted_at:now,
     privacy_version:privacyVersion,
     terms_accepted_at:now,
     terms_version:termsVersion
    })
   });
  }
  return json(res,202,{message:"If this address can register, a confirmation email will be sent. Check your inbox."});
 }catch(e){fail(res,e);}
};