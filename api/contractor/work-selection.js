"use strict";
const {json,method,readJson,queryDb,fail,userFor}=require("./_shared");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

function errorFor(code){
 if(code==="application_not_found")return [404,"Application not found."];
 if(code==="not_owner")return [403,"You can only select candidates for your own opportunity."];
 if(code==="opportunity_closed")return [409,"This opportunity is already closed."];
 if(code==="positions_already_filled")return [409,"All positions for this opportunity are already filled."];
 if(code==="application_not_selectable")return [409,"This candidate is no longer available for selection."];
 if(code==="worker_unavailable")return [409,"This worker profile is no longer active."];
 return [400,"Could not select this worker."];
}

module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const body=await readJson(req,3000);
  const applicationId=String(body.application_id||"").trim();
  if(!UUID.test(applicationId))return json(res,400,{error:"Invalid application."});

  const result=await rpc("gef_select_work_applicant",{
   p_contractor:user.id,
   p_application:applicationId
  });

  if(result?.ok!==true){
   const [status,error]=errorFor(result?.code);
   return json(res,status,{error,code:result?.code||"invalid_request"});
  }

  return json(res,200,result);
 }catch(e){fail(res,e);}
};