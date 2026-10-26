const {config,json,method,readJson,fail}=require("./_shared");
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
  const data=await readJson(req,3000);
  const email=String(data.email||"").trim().toLowerCase(),password=String(data.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128||!data.privacyConsent||!data.termsConsent)return json(res,400,{error:"Check email, password (12+ characters) and consent."});
  const {url,publishable}=config();
  const response=await fetch(url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){console.warn("Contractor signup unsuccessful:",response.status);return json(res,429,{error:"We could not complete signup. Please wait and try again."});}
  try{await notifyContractorSignup(email);}catch{console.error("GetEstimateFast contractor signup notification failed.");}
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
