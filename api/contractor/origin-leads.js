"use strict";
const {json,method,queryDb,fail,userFor}=require("./_shared");
const {productionMarketplaceEnabled}=require("../_lib/marketplace-access");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  if(process.env.VERCEL_ENV==="production"&&!productionMarketplaceEnabled())
    return json(res,503,{error:"Customer contact access is not enabled.",contact_release_enabled:false});
  const user=await userFor(req,res);if(!user)return;
  const profile=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+
   "&select=account_status,email_verified_at&limit=1");
  if(profile[0]?.account_status!=="active"||!profile[0]?.email_verified_at)
    return json(res,403,{error:"An active verified professional account is required."});
  // Privileged server-side query; every row is bound to the verified Auth UID.
  const leads=await queryDb("leads?origin_contractor_id=eq."+encodeURIComponent(user.id)+
    "&source=eq.professional_profile&select=id,service_type,city,zip_code,status,created_at,full_name,email,phone,details"+
    "&order=created_at.desc&limit=100");
  if(!Array.isArray(leads))throw Error("Invalid referral response");
  const ids=leads.filter(x=>x.status==="published").map(x=>x.id);
  const previews=ids.length?await queryDb("opportunity_previews?lead_id=in.("+ids.join(",")+")&select=id,lead_id&limit=100"):[];
  const published=new Set(previews.map(x=>x.lead_id));
  const visible=leads.map(l=>{
    const released=l.status==="published"&&published.has(l.id)&&l.details?._profile_referral?.customer_share_accepted===true;
    return {
     id:l.id,service_type:l.service_type,city:l.city,zip_code:l.zip_code,status:l.status,created_at:l.created_at,
     contact_available:released,contact_price_cents:0,contact_source:"your_public_profile",
     customer:released?{name:l.full_name,email:l.email,phone:l.phone}:null
    };
  });
  return json(res,200,{leads:visible,total:visible.length,note:"Contacts from your profile are free only after administrative approval and publication. No wallet debits."});
 }catch(e){return fail(res,e);}
};
