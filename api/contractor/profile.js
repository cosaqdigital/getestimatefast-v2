const {normalizeUsPhone}=require("../_lib/zenvia-us-provider");
const {json,method,readJson,queryDb,fail,CATEGORIES,userFor}=require("./_shared");
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const path="contractor_profiles?user_id=eq."+encodeURIComponent(user.id);
  if(req.method==="GET"){
   const rows=await queryDb(path+"&select=user_id,display_name,business_name,contact_phone,contact_email,base_zip,city,state_code,service_radius_miles,service_categories,bio,account_status,email_verified_at,sms_opt_in,created_at,updated_at&limit=1");
   return json(res,200,{profile:rows[0]||null,categories:CATEGORIES});
  }
  if(process.env.CONTRACTOR_PROFILE_EDITING_ENABLED!=="true")return json(res,503,{error:"Profile editing is not yet open."});
  const v=await readJson(req,7000);
  const name=String(v.display_name||"").trim(),phone=String(v.contact_phone||"").trim(),zip=String(v.base_zip||"").trim(),city=String(v.city||"").trim(),state=String(v.state_code||"").trim().toUpperCase(),business=String(v.business_name||"").trim(),bio=String(v.bio||"").trim(),radius=Number(v.service_radius_miles),cats=v.service_categories;
  const smsPhone=normalizeUsPhone(phone);
  if(name.length<2||name.length>120||business.length>150||phone.length>35||!smsPhone||!/^\d{5}$/.test(zip)||city.length<2||city.length>100||!/^[A-Z]{2}$/.test(state)||!Number.isInteger(radius)||radius<1||radius>100||!Array.isArray(cats)||cats.length<1||cats.length>12||!cats.every(c=>CATEGORIES.includes(c))||new Set(cats).size!==cats.length||bio.length>1000||v.privacyConsent!==true||v.termsConsent!==true||!EMAIL.test(user.email||"")){
   return json(res,400,{error:"Please complete all fields and accept the terms and privacy notice."});
  }
  // The client cannot control user ID, verification, or approval.
  const existing=await queryDb(path+"&select=user_id,account_status&limit=1");
  if(existing[0]?.account_status==="suspended"||existing[0]?.account_status==="rejected")return json(res,403,{error:"This account cannot be edited"});
  const record={user_id:user.id,display_name:name,business_name:business||null,contact_phone:phone,sms_phone_e164:smsPhone,contact_email:user.email,base_zip:zip,city,state_code:state,service_radius_miles:radius,service_categories:cats,bio:bio||null,updated_at:new Date().toISOString(),privacy_accepted_at:new Date().toISOString(),privacy_version:"preview-v1",terms_accepted_at:new Date().toISOString(),terms_version:"preview-v1",email_verified_at:user.email_confirmed_at};
  let response;
  // Never include account_status in a client-supplied update.
  if(existing.length)response=await queryDb(path,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(record)});
  else response=await queryDb("contractor_profiles?on_conflict=user_id",{method:"POST",headers:{Prefer:"return=representation,resolution=ignore-duplicates"},body:JSON.stringify(record)});
  if(!Array.isArray(response))throw new Error("Invalid profile save response");
  if(!response.length)return json(res,409,{error:"Profile already exists; reload before editing"});
  return json(res,200,{saved:true,account_status:response[0].account_status});
 }catch(e){fail(res,e);}
};
