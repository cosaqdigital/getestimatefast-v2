const {json,method,readJson,requireAdmin,fail}=require("./_auth");
const {sendControlledTest,readiness,validUuid}=require("../_lib/telnyx-us-provider");

module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const originHeader=String(req.headers.origin||"");
  if(originHeader){let url;try{url=new URL(originHeader);}catch{return json(res,403,{error:"Invalid origin"});}
   if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const state=readiness();
  if(!state.live_sms_enabled)return json(res,503,{error:"Controlled SMS test is not enabled",readiness:state});
  const body=await readJson(req,2048);
  const phone=String(body.phone||""),city=String(body.city||"Riverview"),opportunityId=String(body.opportunityId||"");
  if(!validUuid(opportunityId))return json(res,400,{error:"Invalid opportunity id"});
  const sent=await sendControlledTest({
    phone,city,opportunityId,
    origin:process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://getestimatefast.com"
  });
  return json(res,200,{mode:"CONTROLLED_TEST",message_id:sent.id,to:sent.to,from:sent.from,text:sent.text});
 }catch(e){fail(res,e);}
};
