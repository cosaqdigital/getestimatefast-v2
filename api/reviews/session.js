"use strict";
const {json,method,queryDb}=require("../admin/_auth");
const {marketplaceReady}=require("../_lib/marketplace-access");
const {tokenHash}=require("../_lib/public-profile-policy");

const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

module.exports=async function handler(req,res){
  if(!method(req,res,["GET"]))return;
  try{
    if(!marketplaceReady(req,res))return;
    const token=String(req.query?.token||"");
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))return json(res,400,{error:"Open the exclusive review invitation shared by your professional."});
    const ctx=await rpc("gef_review_invitation_context",{p_hash:tokenHash(token)});
    if(!ctx)return json(res,409,{error:"This invitation is unavailable or has already been used."});
    return json(res,200,{profile:{display_name:ctx.display_name,slug:ctx.slug},expires_in_days:30});
  }catch{
    return json(res,503,{error:"Review service temporarily unavailable. Please try again later."});
  }
};
