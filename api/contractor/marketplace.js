"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,queryDb,fail,userFor,config,headers}=require("./_shared");
const {marketplaceReady,blockPayments,uuid}=require("../_lib/marketplace-access");
const {parsePublicProfile,tokenHash}=require("../_lib/public-profile-policy");
const {formatUsd}=require("../_lib/marketplace-pricing");
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  if(!marketplaceReady(req,res))return;
  const user=await userFor(req,res);if(!user)return;
  const action=String(req.query?.action||"dashboard");
  if(req.method==="GET"){
   if(action==="dashboard")return json(res,200,{...await rpc("gef_dashboard",{p_contractor:user.id}),payments_enabled:false,contact_release_enabled:false});
   if(action==="public-profile"){
    const rows=await queryDb("contractor_public_profiles?contractor_id=eq."+encodeURIComponent(user.id)+"&select=slug,display_name,headline,about,city,state_code,zip_code,radius_miles,categories,languages,social_links,portfolio,published,publish_email,publish_phone,public_email,public_phone&limit=1");
    return json(res,200,{profile:rows[0]||null});
   }
   return json(res,400,{error:"Unknown action"});
  }
  if(["purchase","topup","refund","adjustment","profile-service-checkout"].includes(action))return blockPayments(res);
  const body=await readJson(req,action==="portfolio-upload"?4200000:18000);
  if(action==="public-profile"){
   let profile;try{profile=parsePublicProfile(body);}catch(e){return json(res,400,{error:e.message});}
   const result=await rpc("gef_save_public_profile",{p_contractor:user.id,p_profile:profile});
   return json(res,200,{...result,profile_path:"/professionals/"+profile.slug});
  }
  if(action==="review-invitation"){
   const token=crypto.randomBytes(32).toString("base64url");
   const purchase=body.purchase_id?uuid(body.purchase_id):null;
   const result=await rpc("gef_create_review_invitation",{p_contractor:user.id,p_hash:tokenHash(token),p_purchase:purchase});
   return json(res,201,{...result,review_path:"/review.html#"+token,manual_sharing_only:true});
  }
  if(action==="portfolio-upload"){
   const p=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=account_status&limit=1");
   if(p[0]?.account_status!=="active")return json(res,403,{error:"Active profile required"});
   if(body.rightsConsent!==true||typeof body.data!=="string"||body.data.length>4000000)return json(res,400,{error:"Choose a photo you may publish (maximum 3 MB) and confirm permission."});
   const data=Buffer.from(body.data,"base64");if(data.length<12||data.length>3000000||data.toString("base64")!==body.data)return json(res,400,{error:"Invalid photo data"});
   let ext,mime;
   if(data.subarray(0,3).equals(Buffer.from([255,216,255]))){ext="jpg";mime="image/jpeg";}
   else if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){ext="png";mime="image/png";}
   else if(data.toString("ascii",0,4)==="RIFF"&&data.toString("ascii",8,12)==="WEBP"){ext="webp";mime="image/webp";}
   else return json(res,400,{error:"Use a JPG, PNG or WebP photo"});
   const {url,secret}=config(),imagePath=user.id+"/"+crypto.randomUUID()+"."+ext;
   const response=await fetch(url+"/storage/v1/object/gef-portfolio/"+imagePath,{method:"POST",headers:headers(secret,{"Content-Type":mime,"x-upsert":"false"}),body:data,signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error("Portfolio upload failed");
   return json(res,201,{image_path:imagePath});
  }
  if(action==="profile-service-preview"){
   const d=await rpc("gef_dashboard",{p_contractor:user.id});
   return json(res,200,{...d.profile_service,price_label:d.profile_service.amount_cents==null?"Price not configured":formatUsd(d.profile_service.amount_cents),note:"Preparing your own public profile is free. Assisted preparation is optional and billed separately from opportunity credits. Checkout is disabled."});
  }
  return json(res,400,{error:"Unknown action"});
 }catch(e){fail(res,e);}
};
