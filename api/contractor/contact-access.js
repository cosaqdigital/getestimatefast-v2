"use strict";
const {json,method,queryDb,userFor,fail,config}=require("./_shared");
const {parsePhotoPaths,signPhotoUrls}=require("../_lib/lead-photo-storage");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");

module.exports=async function handler(req,res){
  if(!method(req,res,["GET"]))return;
  try{
    if(!marketplaceReady(req,res))return;
    const user=await userFor(req,res);if(!user)return;
    const opportunity=uuid(req.query?.opportunity_id);
    const contact=await queryDb("rpc/gef_contact_access",{
      method:"POST",
      body:JSON.stringify({p_contractor:user.id,p_opportunity:opportunity})
    });
    if(!contact)return json(res,404,{error:"Contact access is not available."});
    const details=contact.project_details||{};
    const paths=parsePhotoPaths(details["Project Photo Paths"],details["Submission Token"]);
    if(paths.length){
      const {url,secret}=config();
      const signed=await signPhotoUrls(url,secret,paths,900);
      contact.project_photos=signed.map(photo=>({url:photo.url}));
    }else contact.project_photos=[];
    return json(res,200,{contact});
  }catch(e){fail(res,e);}
};
