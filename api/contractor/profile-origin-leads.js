"use strict";
const {json,method,queryDb,fail,userFor}=require("./_shared");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  if(!marketplaceReady(req,res))return;
  const contractor=await userFor(req,res);
  if(!contractor)return;
  const action=String(req.query?.action||"list");
  if(action==="list"){
   // The DB function returns no name, phone or email until qualification.
   const rows=await queryDb("rpc/gef_profile_origin_leads",{
    method:"POST",body:JSON.stringify({p_contractor:contractor.id})
   });
   if(!Array.isArray(rows))throw Error("Invalid origin request listing");
   return json(res,200,{requests:rows});
  }
  if(action==="contact"){
   let id;try{id=uuid(req.query?.id);}catch{return json(res,400,{error:"Invalid request identifier"});}
   // Always use the validated auth user ID; never accept a contractor ID from the client.
   const contact=await queryDb("rpc/gef_profile_origin_contact",{
    method:"POST",body:JSON.stringify({p_contractor:contractor.id,p_lead:id})
   });
   if(!contact||contact.amount_cents!==0)throw Error("No free profile contact available");
   return json(res,200,{contact});
  }
  return json(res,400,{error:"Unknown action"});
 }catch(error){return fail(res,error);}
};
