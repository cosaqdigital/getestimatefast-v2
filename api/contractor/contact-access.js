"use strict";
const {json,method,queryDb,userFor,fail}=require("./_shared");
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
    return json(res,200,{contact});
  }catch(e){fail(res,e);}
};
