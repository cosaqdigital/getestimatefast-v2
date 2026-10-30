"use strict";
const {json,method,queryDb,requireAdmin,fail}=require("./_auth");

module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await requireAdmin(req,res);
  if(!user)return;
  const result=await queryDb("rpc/gef_admin_executive_overview",{
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify({p_actor:user.id})
  });
  const metrics=Array.isArray(result)?result[0]:result;
  if(!metrics||typeof metrics!=="object")throw Error("Executive overview unavailable");
  return json(res,200,{metrics,payments_enabled:true,time_zone:"America/New_York"});
 }catch(error){return fail(res,error);}
};
