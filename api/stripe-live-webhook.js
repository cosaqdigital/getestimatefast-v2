"use strict";
const {json,method}=require("./admin/_auth");
const {livePaymentsApproved}=require("./_lib/stripe-live-policy");
const {liveConfiguration,readRaw,processWebhook,clientFor}=require("./_lib/stripe-live");
const {createLiveRepository}=require("./_lib/stripe-live-repository");

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  if(!livePaymentsApproved())return json(res,503,{error:"Live payment webhook is disabled"});
  try{
    const settings=liveConfiguration();
    const raw=await readRaw(req);
    const repository=createLiveRepository();
    const result=await processWebhook(
      raw,
      req.headers["stripe-signature"],
      settings,
      repository,
      clientFor(settings.key)
    );
    return json(res,200,result);
  }catch(error){
    const invalid=error?.type==="StripeSignatureVerificationError";
    return json(res,invalid?400:503,{
      error:invalid?"Invalid webhook signature":"Payment event could not be confirmed; retry required"
    });
  }
};
