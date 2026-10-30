"use strict";
const {json,method,queryDb,fail}=require("../admin/_auth");
const {dispatchControlledOpportunitySmsCanary,dispatchLiveOpportunitySmsBatch}=require("../_lib/opportunity-sms-dispatch");
const {readiness}=require("../_lib/telnyx-us-provider");

module.exports=async function handler(req,res){
  if(!method(req,res,["GET"]))return;
  const secret=String(process.env.CRON_SECRET||"");
  const authorization=String(req.headers.authorization||"");
  if(secret.length<16||authorization!=="Bearer "+secret){
    return json(res,401,{error:"Unauthorized",messages_sent:0});
  }
  try{
    const state=readiness();
    const result=state.canary_worker_enabled
      ?await dispatchControlledOpportunitySmsCanary({queryDb})
      :await dispatchLiveOpportunitySmsBatch({queryDb});
    return json(res,200,result);
  }catch(error){
    console.error("GetEstimateFast opportunity SMS cron failed.");
    fail(res,error);
  }
};
