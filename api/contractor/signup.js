const {config,json,method,readJson,fail}=require("./_shared");
const {protectedPreview}=require("../_lib/preview-target");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 if(protectedPreview()||process.env.GETESTIMATEFAST_ISOLATED_BACKEND==="true")return json(res,503,{error:"Registration and confirmation email delivery are disabled in this test environment."});
 if(process.env.CONTRACTOR_SIGNUP_ENABLED!=="true")return json(res,503,{error:"Registration is not open yet."});
 try{
  const data=await readJson(req,3000);
  const email=String(data.email||"").trim().toLowerCase(),password=String(data.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128||!data.privacyConsent||!data.termsConsent)return json(res,400,{error:"Check email, password (12+ characters) and consent."});
  const {url,publishable}=config();
  const response=await fetch(url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){console.warn("Contractor signup unsuccessful:",response.status);return json(res,429,{error:"We could not complete signup. Please wait and try again."});}
  return json(res,202,{message:"If this address can register, a confirmation email will be sent. Check your inbox."});
 }catch(e){fail(res,e);}
};
