"use strict";
const {normalizeUsPhone}=require("../_lib/telnyx-us-provider");
const {recognizedFloridaZip}=require("../_lib/florida-matching");
const {json,method,readJson,queryDb,fail,CATEGORIES,userFor,config}=require("../contractor/_shared");

const LANGUAGES=["en","pt","es"];
const TYPES=["helper","professional"];
const unique=v=>Array.isArray(v)&&new Set(v).size===v.length;
const slugify=(name,userId)=>{
 const base=String(name||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)||"worker";
 return (base+"-"+String(userId||"").replace(/-/g,"").slice(0,8)).slice(0,80);
};
const validImagePath=(userId,value)=>{
 if(!value)return null;
 const s=String(value);
 return new RegExp("^"+String(userId)+"\\/work-[0-9a-f-]{36}\\.(jpg|png|webp)$").test(s)?s:null;
};
function versions(){
 const production=process.env.VERCEL_ENV==="production";
 const privacy=production?String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim():"preview-v1";
 const terms=production?String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim():"preview-v1";
 if(production&&(!/^[A-Za-z0-9._-]{3,80}$/.test(privacy)||!/^[A-Za-z0-9._-]{3,80}$/.test(terms)))return null;
 return {privacy,terms};
}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const editable=process.env.VERCEL_ENV!=="production"||process.env.WORK_PROFILE_EDITING_ENABLED==="true";
  const path="work_profiles?user_id=eq."+encodeURIComponent(user.id);
  if(req.method==="GET"){
   const rows=await queryDb(path+"&select=user_id,slug,display_name,contact_phone,base_zip,state_code,service_radius_miles,service_categories,languages,opportunity_types,bio,profile_image_path,sms_opt_in,email_notifications,status,created_at,updated_at&limit=1");
   const consentRows=await queryDb("work_signup_consents?user_id=eq."+encodeURIComponent(user.id)+"&select=contact_phone,sms_opt_in,privacy_version,terms_version&limit=1");
   const {url}=config();
   const profile=rows[0]||null,consent=consentRows[0]||null;
   return json(res,200,{
    profile,
    categories:CATEGORIES,
    languages:[
     {code:"en",label:"English"},
     {code:"pt",label:"Portuguese"},
     {code:"es",label:"Spanish"}
    ],
    opportunity_types:[
     {code:"helper",label:"Helper opportunities"},
     {code:"professional",label:"Professional opportunities"}
    ],
    signup_defaults:profile?null:consent?{contact_phone:consent.contact_phone,sms_opt_in:consent.sms_opt_in===true}:null,
    legal_consent_recorded:Boolean(consent),
    profile_image_url:profile?.profile_image_path?url+"/storage/v1/object/public/gef-portfolio/"+profile.profile_image_path:null,
    capabilities:{profile_editing_enabled:editable}
   });
  }
  if(!editable)return json(res,503,{error:"Work profile editing is not open yet."});
  const body=await readJson(req,12000);
  const name=String(body.display_name||"").trim();
  const phone=String(body.contact_phone||"").trim();
  const smsPhone=normalizeUsPhone(phone);
  const zip=String(body.base_zip||"").trim();
  const radius=Number(body.service_radius_miles);
  const categories=Array.isArray(body.service_categories)?body.service_categories.map(v=>String(v).trim()):[];
  const languages=Array.isArray(body.languages)?body.languages.map(v=>String(v).trim()):[];
  const types=Array.isArray(body.opportunity_types)?body.opportunity_types.map(v=>String(v).trim()):[];
  const bio=String(body.bio||"").trim();
  const imagePath=validImagePath(user.id,body.profile_image_path);
  const smsOptIn=body.sms_opt_in===true;
  const emailNotifications=body.email_notifications!==false;
  if(name.length<2||name.length>120||phone.length>35||!smsPhone||!recognizedFloridaZip(zip)||
     !Number.isInteger(radius)||radius<1||radius>100||
     !unique(categories)||categories.length<1||categories.length>CATEGORIES.length||!categories.every(c=>CATEGORIES.includes(c))||
     !unique(languages)||languages.length<1||languages.length>3||!languages.every(v=>LANGUAGES.includes(v))||
     !unique(types)||types.length<1||types.length>2||!types.every(v=>TYPES.includes(v))||
     bio.length<10||bio.length>1000||!imagePath){
   return json(res,400,{error:"Complete your photo, name, US phone, Florida ZIP, work radius, services, languages, work preference and short experience description."});
  }
  const existing=await queryDb(path+"&select=user_id,slug,status,contact_phone,sms_opt_in,sms_opt_in_at&limit=1");
  if(existing[0]?.status==="suspended")return json(res,403,{error:"This work profile is suspended."});
  let consentRows=await queryDb("work_signup_consents?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id&limit=1");
  if(!consentRows.length){
   if(body.privacyConsent!==true||body.termsConsent!==true)
    return json(res,400,{error:"Accept the Privacy Policy and Terms of Use to activate your Find Work profile."});
   const v=versions();if(!v)return json(res,503,{error:"Terms and privacy versions are not configured for Production."});
   const now=new Date().toISOString();
   consentRows=await queryDb("work_signup_consents?on_conflict=user_id",{
    method:"POST",headers:{Prefer:"return=representation,resolution=ignore-duplicates"},
    body:JSON.stringify({
     user_id:user.id,
     contact_email:String(user.email||"").toLowerCase(),
     contact_phone:phone,
     sms_phone_e164:smsPhone,
     sms_opt_in:smsOptIn,
     sms_opt_in_at:smsOptIn?now:null,
     privacy_accepted_at:now,privacy_version:v.privacy,
     terms_accepted_at:now,terms_version:v.terms
    })
   });
   if(!Array.isArray(consentRows)||!consentRows.length)
    return json(res,409,{error:"Consent record already exists; reload and try again."});
  }
  const now=new Date().toISOString();
  const oldPhone=existing[0]?.contact_phone?normalizeUsPhone(existing[0].contact_phone):null;
  const smsAt=smsOptIn?(oldPhone===smsPhone&&existing[0]?.sms_opt_in===true&&existing[0]?.sms_opt_in_at?existing[0].sms_opt_in_at:now):null;
  const record={
   user_id:user.id,
   slug:existing[0]?.slug||slugify(name,user.id),
   display_name:name,
   contact_phone:phone,
   base_zip:zip,
   state_code:"FL",
   service_radius_miles:radius,
   service_categories:categories,
   languages,
   opportunity_types:types,
   bio,
   profile_image_path:imagePath,
   sms_opt_in:smsOptIn,
   sms_opt_in_at:smsAt,
   email_notifications:emailNotifications,
   status:"active",
   updated_at:now
  };
  let saved;
  if(existing.length)saved=await queryDb(path,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(record)});
  else saved=await queryDb("work_profiles?on_conflict=user_id",{method:"POST",headers:{Prefer:"return=representation,resolution=ignore-duplicates"},body:JSON.stringify(record)});
  if(!Array.isArray(saved)||!saved.length)return json(res,409,{error:"Work profile could not be saved; reload and try again."});
  return json(res,200,{saved:true,status:saved[0].status,slug:saved[0].slug});
 }catch(e){fail(res,e);}
};