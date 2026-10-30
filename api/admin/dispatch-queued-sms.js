"use strict";
const {json,method,queryDb,requireAdmin,fail}=require("./_auth");
const {dispatchControlledOpportunitySms}=require("../_lib/opportunity-sms-dispatch");

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  try{
    const admin=await requireAdmin(req,res);if(!admin)return;
    const origin=String(req.headers.origin||"");
    if(origin){
      let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}
      if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});
    }
    const result=await dispatchControlledOpportunitySms({queryDb});
    return json(res,200,result);
  }catch(error){
    if(error?.code==="CONTROLLED_SMS_DISABLED"){
      return json(res,409,{error:"Controlled Telnyx SMS dispatch is not enabled.",messages_sent:0});
    }
    fail(res,error);
  }
};
