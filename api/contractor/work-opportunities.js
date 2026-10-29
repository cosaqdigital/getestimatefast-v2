"use strict";
const {json,method,readJson,queryDb,fail,CATEGORIES,userFor}=require("./_shared");
const {recognizedFloridaZip}=require("../_lib/florida-matching");
const {parseUsd}=require("../_lib/marketplace-pricing");
const {processWorkMatchJob}=require("../_lib/work-notification-dispatch");

const TYPES=new Set(["helper","professional"]);
const PAY_BASIS=new Set(["day","hour","fixed"]);
const LANGUAGES=new Set(["en","pt","es"]);
const OPERATION=/^[A-Za-z0-9:_-]{12,160}$/;

const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
function floridaToday(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
function unique(values){return Array.isArray(values)&&new Set(values).size===values.length;}
function cleanPayload(body){
 const opportunityType=String(body.opportunity_type||"").trim();
 const category=String(body.service_category||"").trim();
 const taskLabel=String(body.task_label||"").trim();
 const zip=String(body.zip_code||"").trim();
 const description=String(body.description||"").trim();
 const payBasis=String(body.pay_basis||"day").trim();
 const workDate=String(body.work_date||"").trim();
 const startTime=String(body.start_time||"").trim();
 const workers=Number(body.workers_needed);
 const maxContacts=Number(body.max_contacts);
 const languages=Array.isArray(body.languages)?body.languages.map(v=>String(v).trim()):[];
 let payCents;
 try{payCents=parseUsd(String(body.pay_amount||""));}catch{return null;}
 if(!TYPES.has(opportunityType)||!CATEGORIES.includes(category)||
    (taskLabel.length>120)||!recognizedFloridaZip(zip)||
    description.length<20||description.length>1500||
    !PAY_BASIS.has(payBasis)||!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||workDate<floridaToday()||
    (startTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))||
    !Number.isInteger(workers)||workers<1||workers>20||
    !Number.isInteger(maxContacts)||maxContacts<1||maxContacts>25||maxContacts<workers||
    !unique(languages)||languages.length<1||languages.length>3||!languages.every(v=>LANGUAGES.has(v))){
   return null;
 }
 return {
  opportunity_type:opportunityType,
  service_category:category,
  task_label:taskLabel||null,
  zip_code:zip,
  description,
  pay_cents:payCents,
  pay_basis:payBasis,
  work_date:workDate,
  start_time:startTime||null,
  workers_needed:workers,
  max_contacts:maxContacts,
  languages
 };
}
function statusForCode(code){
 if(code==="quota_exceeded")return [409,"You have reached the current launch limit of 10 free work posts this month."];
 if(code==="public_profile_required")return [403,"Publish your professional public profile before posting work opportunities."];
 if(code==="professional_profile_incomplete")return [403,"Complete your professional profile before posting work opportunities."];
 if(code==="account_inactive")return [403,"An active professional account is required to post work opportunities."];
 if(code==="work_date_in_past")return [400,"Choose today or a future work date."];
 return [400,"Check the opportunity details and try again."];
}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  if(req.method==="GET"){
   const summary=await rpc("gef_work_post_summary",{p_contractor:user.id});
   const profileRows=await queryDb(
    "contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+
    "&select=base_zip,city,state_code,service_categories&limit=1"
   );
   const own=await queryDb(
    "work_opportunities?posted_by=eq."+encodeURIComponent(user.id)+
    "&select=id,opportunity_type,service_category,task_label,zip_code,description,pay_cents,pay_basis,work_date,start_time,workers_needed,max_contacts,contacts_used,positions_filled,languages,posting_source,status,created_at,closed_at"+
    "&order=created_at.desc&limit=20"
   );
   return json(res,200,{
    summary:{...summary,packages:[],purchased_remaining:0,launch_free:true},
    defaults:{zip_code:profileRows[0]?.base_zip||""},
    categories:CATEGORIES,
    languages:[
     {code:"en",label:"English"},
     {code:"pt",label:"Portuguese"},
     {code:"es",label:"Spanish"}
    ],
    packages:[],
    payments:{extra_post_test_checkout:false},
    opportunities:own
   });
  }

  const body=await readJson(req,12000);
  const operationKey=String(body.operation_key||"").trim();
  const payload=cleanPayload(body);
  if(!OPERATION.test(operationKey)||!payload)
    return json(res,400,{error:"Complete all required opportunity fields."});

  const result=await rpc("gef_create_work_opportunity",{
   p_contractor:user.id,
   p_operation_key:operationKey,
   p_payload:payload
  });
  if(result?.ok!==true){
   const [status,error]=statusForCode(result?.code);
   return json(res,status,{error,code:result?.code||"invalid_request",summary:result?.summary||null});
  }
  let matching={status:"pending"};
  try{
   matching=await processWorkMatchJob(result.opportunity_id);
  }catch{
   matching={status:"pending_retry"};
  }
  return json(res,result.idempotent===true?200:201,{...result,matching});
 }catch(e){fail(res,e);}
};