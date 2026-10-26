"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,userFor,queryDb}=require("./_shared");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");
const {livePaymentsApproved}=require("../_lib/stripe-live-policy");

const rpc=(name,body)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(body)});

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  try{
    if(!marketplaceReady(req,res))return;
    const user=await userFor(req,res);if(!user)return;
    if(!livePaymentsApproved())return json(res,503,{error:"Contact purchases are not enabled."});
    const body=await readJson(req,8000);
    const quote=uuid(body.quote_id);
    const operation=String(body.operation_key||("wallet_buy_"+crypto.randomUUID()));
    const result=await rpc("gef_purchase_contact",{
      p_contractor:user.id,
      p_quote:quote,
      p_operation_key:operation
    });
    return json(res,result.created?201:200,{...result,funding_source:"wallet",contact_release_enabled:result.status==="acquired"});
  }catch(error){
    const message=String(error?.message||"");
    if(/Insufficient available credits/i.test(message))return json(res,409,{error:"You do not have enough wallet credits for this contact. Add credits or pay by card."});
    if(/Buyer limit reached|Contact already purchased|Quote expired|opportunity unavailable/i.test(message))return json(res,409,{error:"This contact is no longer available for purchase."});
    return json(res,409,{error:"The wallet purchase could not be completed. Reload the opportunity and try again."});
  }
};
