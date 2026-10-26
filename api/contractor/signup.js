const {config,json,method,readJson,queryDb,fail}=require("./_shared");
const {normalizeUsPhone}=require("../_lib/telnyx-us-provider");
const {protectedPreview}=require("../_lib/preview-target");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 if(protectedPreview()||process.env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")return json(res,503,{error:"Registration and confirmation email delivery are disabled in this test environment."});
 if(process.env.CONTRACTOR_SIGNUP_ENABLED!=="true")return json(res,503,{error:"Registration is not open yet."});
 if(process.env.VERCEL_ENV==="production"){
  const privacy=String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim();
  const terms=String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim();
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(privacy)||!/^[A-Za-z0-9._-]{3,80}$/.test(terms))
   return json(res,503,{error:"Registration is not open until Production terms and privacy versions are configured."});
 }
 try{
  const data=await readJson(req,4000);
  const email=String(data.email||"").trim().toLowerCase(),password=String(data.password||""),phone=String(data.phone||"").trim();
  const smsPhone=normalizeUsPhone(phone);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128||phone.length>35||!smsPhone||typeof data.smsOptIn!=="boolean"||!data.privacyConsent||!data.termsConsent)return json(res,400,{error:"Check email, US mobile number, password (12+ characters), and required legal consent."});
  const production=process.env.VERCEL_ENV==="production";
  const privacyVersion=production?String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim():"preview-v1";
  const termsVersion=production?String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim():"preview-v1";
  const {url,publishable}=config();
  const response=await fetch(url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){console.warn("Contractor signup unsuccessful:",response.status);return json(res,429,{error:"We could not complete signup. Please wait and try again."});}
  let authPayload={};try{authPayload=await response.json();}catch{}
  let persisted=false;
  if(authPayload?.user?.id){
   const now=new Date().toISOString();
   try{
    const saved=await queryDb("contractor_signup_consents?on_conflict=user_id",{method:"POST",headers:{Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify({
     user_id:authPayload.user.id,contact_email:email,contact_phone:phone,sms_phone_e164:smsPhone,sms_opt_in:data.smsOptIn,
     sms_opt_in_at:data.smsOptIn?now:null,privacy_accepted_at:now,privacy_version:privacyVersion,terms_accepted_at:now,terms_version:termsVersion
    })});
    persisted=Array.isArray(saved)&&saved.length===1;
   }catch{console.error("GetEstimateFast signup consent persistence failed.");}
  }
  if(persisted){try{await notifyContractorSignup(email);}catch{console.error("GetEstimateFast contractor signup notification failed.");}}
  return json(res,202,{message:"If this address can register, a confirmation email will be sent. Check your inbox."});
 }catch(e){fail(res,e);}
};


async function notifyContractorSignup(email){
 const apiKey=process.env.RESEND_API_KEY;
 const to=String(process.env.CONTRACTOR_NOTIFICATION_TO_EMAIL||"").trim();
 if(!apiKey||!to){console.error("GetEstimateFast contractor signup notification not configured.");return false;}
 const from=String(process.env.CONTRACTOR_NOTIFICATION_FROM_EMAIL||"GetEstimateFast Contractors <contractors@getestimatefast.com>").trim();
 const subject="New professional registration - "+email;
 const text=[
  "A new professional registration was submitted on GetEstimateFast.",
  "",
  "Email: "+email,
  "Status: Email confirmation pending",
  "Source: Professional Portal",
  "Time: "+new Date().toISOString()
 ].join("\n");
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},
  body:JSON.stringify({from,to:[to],subject,text})
 });
 if(!response.ok){console.error("GetEstimateFast contractor signup notification provider failed:",response.status);return false;}
 return true;
}
module.exports.notifyContractorSignup=notifyContractorSignup;
