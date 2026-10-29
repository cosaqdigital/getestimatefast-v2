"use strict";
const {json,method,queryDb,fail}=require("../admin/_auth");
const {processWorkMatchJob}=require("../_lib/work-notification-dispatch");

const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

function authorized(req,env=process.env){
 const secret=String(env.CRON_SECRET||"");
 if(secret.length<16)return false;
 return String(req.headers.authorization||"")==="Bearer "+secret;
}
function enabled(env=process.env){
 if(env.VERCEL_ENV==="production")return env.GETESTIMATEFAST_WORK_NOTIFICATION_RETRY_ENABLED==="true";
 return env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"&&env.GETESTIMATEFAST_WORK_NOTIFICATION_RETRY_ENABLED==="true";
}

module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 if(!authorized(req))return json(res,401,{error:"Unauthorized"});
 if(!enabled())return json(res,503,{error:"Work notification retry is disabled."});
 try{
  const ids=await rpc("gef_list_retryable_work_notification_jobs",{p_limit:10});
  const jobs=Array.isArray(ids)?ids:[];
  const summary={selected:jobs.length,processed:0,delivery_retry:0,skipped:0,failed:0};
  for(const id of jobs){
   try{
    const result=await processWorkMatchJob(id);
    if(result?.status==="processed")summary.processed++;
    else if(result?.status==="delivery_retry")summary.delivery_retry++;
    else summary.skipped++;
   }catch{summary.failed++;}
  }
  return json(res,200,summary);
 }catch(e){fail(res,e);}
};

module.exports._test={authorized,enabled};
