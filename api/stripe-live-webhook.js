"use strict";
const {json,method}=require("./admin/_auth");
const {liveWebhookApproved}=require("./_lib/stripe-live-policy");
const {liveConfiguration,readRaw,processWebhook,clientFor}=require("./_lib/stripe-live");
const {processTopupWebhook}=require("./_lib/stripe-live-topup");
const {processProfileServiceWebhook}=require("./_lib/stripe-live-profile-service");
const {createLiveRepository}=require("./_lib/stripe-live-repository");

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  if(!liveWebhookApproved())return json(res,503,{error:"Live payment webhook is disabled"});
  try{
    const settings=liveConfiguration();
    const raw=await readRaw(req);
    const repository=createLiveRepository();
    const client=clientFor(settings.key);
    const event=client.webhooks.constructEvent(raw,req.headers["stripe-signature"],settings.secret,300);
    const purpose=event?.data?.object?.metadata?.gef_purpose;
    const result=purpose==="wallet_topup"
      ? await processTopupWebhook(raw,req.headers["stripe-signature"],settings,repository,client)
      : purpose==="profile_service"
        ? await processProfileServiceWebhook(raw,req.headers["stripe-signature"],settings,repository,client)
        : await processWebhook(raw,req.headers["stripe-signature"],settings,repository,client);
    if(result?.pending===true)return json(res,503,{error:"Payment is not confirmed yet; retry required"});
    return json(res,200,result);
  }catch(error){
    const invalid=error?.type==="StripeSignatureVerificationError";
    return json(res,invalid?400:503,{
      error:invalid?"Invalid webhook signature":"Payment event could not be confirmed; retry required"
    });
  }
};
