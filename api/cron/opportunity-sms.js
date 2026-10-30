"use strict";
const {json,method,queryDb,fail}=require("../admin/_auth");
const {dispatchLiveOpportunitySmsBatch}=require("../_lib/opportunity-sms-dispatch");

module.exports=async function handler(req,res){
  if(!method(req,res,["GET"]))return;
  const secret=String(process.env.CRON_SECRET||"");
  const authorization=String(req.headers.authorization||"");
  if(secret.length<16||authorization!=="Bearer "+secret){
    return json(res,401,{error:"Unauthorized",messages_sent:0});
  }
  try{
    const result=await dispatchLiveOpportunitySmsBatch({queryDb});
    return json(res,200,result);
  }catch(error){
    console.error("GetEstimateFast opportunity SMS cron failed.");
    fail(res,error);
  }
};
