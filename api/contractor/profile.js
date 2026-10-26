const {normalizeUsPhone}=require("../_lib/telnyx-us-provider");
const {marketplaceCommercialEnabled}=require("../_lib/marketplace-access");
const {livePaymentsApproved}=require("../_lib/stripe-live-policy");
const {json,method,readJson,queryDb,fail,CATEGORIES,userFor}=require("./_shared");
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const path="contractor_profiles?user_id=eq."+encodeURIComponent(user.id);
  if(req.method==="GET"){
   const rows=await queryDb(path+"&select=user_id,display_name,business_name,contact_phone,contact_email,base_zip,city,state_code,service_radius_miles,service_categories,bio,account_status,email_verified_at,sms_opt_in,created_at,updated_at&limit=1");
   const signupRows=!rows[0]?await queryDb("contractor_signup_consents?user_id=eq."+encodeURIComponent(user.id)+"&select=contact_phone,sms_phone_e164,sms_opt_in,privacy_version,terms_version&limit=1"):[];
   const signup=signupRows[0]||null;
   const publicRows=rows[0]?await queryDb("contractor_public_profiles?contractor_id=eq."+encodeURIComponent(user.id)+"&select=published&limit=1"):[];
   return json(res,200,{profile:rows[0]||null,signup_defaults:signup?{contact_phone:signup.contact_phone,sms_opt_in:signup.sms_opt_in===true,legal_consent_recorded:true}:null,public_profile_published:publicRows[0]?.published===true,categories:CATEGORIES,capabilities:{
    marketplace_enabled:marketplaceCommercialEnabled(),
    profile_editing_enabled:process.env.CONTRACTOR_PROFILE_EDITING_ENABLED==="true",
    payments_enabled:livePaymentsApproved(),live_sms_enabled:false
   }});
  }
  if(process.env.CONTRACTOR_PROFILE_EDITING_ENABLED!=="true")return json(res,503,{error:"Profile editing is not yet open."});
  const v=await readJson(req,7000);
  const name=String(v.display_name||"").trim(),phone=String(v.contact_phone||"").trim(),zip=String(v.base_zip||"").trim(),city=String(v.city||"").trim(),state=String(v.state_code||"").trim().toUpperCase(),business=String(v.business_name||"").trim(),bio=String(v.bio||"").trim(),radius=Number(v.service_radius_miles),cats=v.service_categories;
  const smsPhone=normalizeUsPhone(phone);
  if(name.length<2||name.length>120||business.length>150||phone.length>35||!smsPhone||!/^\d{5}$/.test(zip)||city.length<2||city.length>100||!/^[A-Z]{2}$/.test(state)||!Number.isInteger(radius)||radius<1||radius>100||!Array.isArray(cats)||cats.length<1||cats.length>12||!cats.every(c=>CATEGORIES.includes(c))||new Set(cats).size!==cats.length||bio.length>1000||!EMAIL.test(user.email||"")){
   return json(res,400,{error:"Please complete all required professional profile fields."});
  }
  // The client cannot control user ID, verification, approval, or historical signup consent.
  const existing=await queryDb(path+"&select=user_id,account_status,privacy_accepted_at,privacy_version,terms_accepted_at,terms_version,sms_opt_in,sms_opt_in_at,sms_opt_out_at,sms_phone_e164&limit=1");
  if(existing[0]?.account_status==="suspended"||existing[0]?.account_status==="rejected")return json(res,403,{error:"This account cannot be edited"});
    const production=process.env.VERCEL_ENV==="production";
  const privacyVersion=production?String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim():"preview-v1";
  const termsVersion=production?String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim():"preview-v1";
  if(production&&(!/^[A-Za-z0-9._-]{3,80}$/.test(privacyVersion)||!/^[A-Za-z0-9._-]{3,80}$/.test(termsVersion)))
    return json(res,503,{error:"Terms and privacy versions are not configured for Production."});
  const signupRows=!existing.length?await queryDb("contractor_signup_consents?user_id=eq."+encodeURIComponent(user.id)+"&select=contact_phone,sms_phone_e164,sms_opt_in,sms_opt_in_at,privacy_accepted_at,privacy_version,terms_accepted_at,terms_version&limit=1"):[];
  const signup=signupRows[0]||null;
  const legacyConsent=!existing.length&&!signup;
  if(legacyConsent&&(v.privacyConsent!==true||v.termsConsent!==true))return json(res,400,{error:"Please accept the Privacy Policy and Terms of Use to complete this legacy registration."});
  const now=new Date().toISOString();
  const consent={
   privacy_accepted_at:existing[0]?.privacy_accepted_at||signup?.privacy_accepted_at||now,
   privacy_version:existing[0]?.privacy_version||signup?.privacy_version||privacyVersion,
   terms_accepted_at:existing[0]?.terms_accepted_at||signup?.terms_accepted_at||now,
   terms_version:existing[0]?.terms_version||signup?.terms_version||termsVersion
  };
  const sameSignupPhone=Boolean(signup&&signup.sms_phone_e164===smsPhone);
  const smsState=existing.length?{
   sms_opt_in:existing[0].sms_phone_e164===smsPhone&&existing[0].sms_opt_in===true,
   sms_opt_in_at:existing[0].sms_phone_e164===smsPhone?existing[0].sms_opt_in_at:null,
   sms_opt_out_at:existing[0].sms_phone_e164===smsPhone?existing[0].sms_opt_out_at:null
  }:{
   sms_opt_in:sameSignupPhone&&signup.sms_opt_in===true,
   sms_opt_in_at:sameSignupPhone&&signup.sms_opt_in===true?signup.sms_opt_in_at:null,
   sms_opt_out_at:null
  };
  const record={user_id:user.id,display_name:name,business_name:business||null,contact_phone:phone,sms_phone_e164:smsPhone,contact_email:user.email,base_zip:zip,city,state_code:state,service_radius_miles:radius,service_categories:cats,bio:bio||null,updated_at:now,...consent,...smsState,email_verified_at:user.email_confirmed_at};
  let response;
  // Never include account_status in a client-supplied update.
  if(existing.length)response=await queryDb(path,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(record)});
  else response=await queryDb("contractor_profiles?on_conflict=user_id",{method:"POST",headers:{Prefer:"return=representation,resolution=ignore-duplicates"},body:JSON.stringify(record)});
  if(!Array.isArray(response))throw new Error("Invalid profile save response");
  if(!response.length)return json(res,409,{error:"Profile already exists; reload before editing"});
  return json(res,200,{saved:true,account_status:response[0].account_status});
 }catch(e){fail(res,e);}
};
