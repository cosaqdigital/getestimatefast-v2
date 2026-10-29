const {json,method,requireAdmin,fail}=require("./_auth");
const {sendControlledHealthTest,readiness}=require("../_lib/telnyx-us-provider");

module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 let stage="require_admin";
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  stage="origin";
  const originHeader=String(req.headers.origin||"");
  if(originHeader){let url;try{url=new URL(originHeader);}catch{return json(res,403,{error:"Invalid origin"});}
   if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  stage="readiness";
  const state=readiness();
  if(!state.controlled_test_enabled)return json(res,503,{error:"Controlled SMS test is not enabled",readiness:state});
  stage="send";
  const sent=await sendControlledHealthTest();
  return json(res,200,{mode:"CONTROLLED_TEST",message_id:sent.id,to:sent.to,from:sent.from,text:sent.text});
 }catch(e){
  if(e?.telnyx){
   console.error("GetEstimateFast Telnyx controlled test failed.",{http_status:e.telnyx.http_status,code:e.telnyx.code});
   return json(res,502,{error:"Telnyx rejected the controlled SMS test",telnyx:e.telnyx});
  }
  if(e?.telnyx_transport){
   console.error("GetEstimateFast Telnyx transport failed.",{type:e.telnyx_transport.type,code:e.telnyx_transport.code});
   return json(res,502,{error:"Telnyx request failed before an HTTP response",transport:e.telnyx_transport});
  }
  if(e?.diagnostic_stage){
   console.error("GetEstimateFast controlled SMS diagnostic failed.",{stage:e.diagnostic_stage,type:e?.name||"Error"});
   return json(res,502,{error:"Controlled SMS diagnostic failed",diagnostic:{stage:e.diagnostic_stage,type:e?.name||"Error"}});
  }
  console.error("GetEstimateFast controlled SMS endpoint failed.",{stage,type:e?.name||"Error"});
  return json(res,502,{error:"Controlled SMS endpoint failed",diagnostic:{stage,type:e?.name||"Error"}});
 }
};
