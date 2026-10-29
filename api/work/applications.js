"use strict";
const {json,method,readJson,queryDb,fail,userFor,config}=require("../contractor/_shared");
const {coordinates,haversineMiles}=require("../_lib/florida-matching");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OP=/^[A-Za-z0-9:_-]{12,160}$/;
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
function cityFor(zip){try{return require("zipcodes").lookup(zip)?.city||zip;}catch{return zip;}}
function overlap(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.some(v=>b.includes(v));}
function applicationError(code){
 if(code==="work_profile_required")return [403,"Complete your Find Work profile before applying."];
 if(code==="applications_closed")return [409,"Applications for this opportunity are closed."];
 if(code==="self_application")return [409,"You cannot apply to your own opportunity."];
 if(code==="expired")return [409,"This opportunity has expired."];
 if(code==="not_eligible")return [403,"This opportunity no longer matches your work profile."];
 if(code==="blocked")return [403,"This opportunity is unavailable."];
 if(code==="not_found")return [404,"Opportunity not found."];
 return [400,"Could not submit your application."];
}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  if(req.method==="GET"){
   const apps=await queryDb(
    "work_applications?applicant_id=eq."+encodeURIComponent(user.id)+
    "&select=id,opportunity_id,status,contact_released_at,selected_at,created_at&order=created_at.desc&limit=100"
   );
   const ids=apps.map(x=>x.opportunity_id);
   const opportunities=ids.length?await queryDb(
    "work_opportunities?id=in.("+ids.join(",")+")"+
    "&select=id,posted_by,opportunity_type,service_category,task_label,zip_code,description,pay_cents,pay_basis,work_date,start_time,workers_needed,max_contacts,contacts_used,positions_filled,languages,status&limit=100"
   ):[];
   const posterIds=[...new Set(opportunities.map(x=>x.posted_by))];
   const posters=posterIds.length?await queryDb(
    "contractor_public_profiles?contractor_id=in.("+posterIds.map(encodeURIComponent).join(",")+")"+
    "&select=contractor_id,slug,display_name,headline,city,state_code,published&limit=100"
   ):[];
   const opMap=new Map(opportunities.map(x=>[x.id,x])),posterMap=new Map(posters.map(x=>[x.contractor_id,x]));
   return json(res,200,{applications:apps.map(app=>{
    const opportunity=opMap.get(app.opportunity_id)||null,poster=opportunity?posterMap.get(opportunity.posted_by)||null:null;
    return {...app,opportunity:opportunity?{...opportunity,city:cityFor(opportunity.zip_code),poster:poster?{slug:poster.slug,display_name:poster.display_name,headline:poster.headline||"",city:poster.city,state_code:poster.state_code,profile_path:"/professionals/"+poster.slug}:null}:null};
   })});
  }

  const body=await readJson(req,5000);
  const opportunityId=String(body.opportunity_id||"").trim(),operationKey=String(body.operation_key||"").trim();
  if(!UUID.test(opportunityId)||!OP.test(operationKey))return json(res,400,{error:"Invalid application request."});

  const profiles=await queryDb("work_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id,base_zip,service_radius_miles,service_categories,languages,opportunity_types,status&limit=1");
  const profile=profiles[0]||null;
  if(!profile||profile.status!=="active")return json(res,403,{error:"Complete your Find Work profile before applying."});

  const rows=await queryDb(
   "work_opportunities?id=eq."+encodeURIComponent(opportunityId)+
   "&select=id,posted_by,opportunity_type,service_category,zip_code,languages,status,contacts_used,max_contacts,positions_filled,workers_needed&limit=1"
  );
  const opportunity=rows[0]||null;
  if(!opportunity)return json(res,404,{error:"Opportunity not found."});
  if(opportunity.posted_by===user.id)return json(res,409,{error:"You cannot apply to your own opportunity."});
  if(opportunity.status!=="open"||opportunity.contacts_used>=opportunity.max_contacts||opportunity.positions_filled>=opportunity.workers_needed)
    return json(res,409,{error:"Applications for this opportunity are closed."});
  if(!profile.service_categories.includes(opportunity.service_category)||!profile.opportunity_types.includes(opportunity.opportunity_type)||!overlap(profile.languages,opportunity.languages))
    return json(res,403,{error:"This opportunity no longer matches your work profile."});

  const from=coordinates(profile.base_zip),to=coordinates(opportunity.zip_code);
  if(!from||!to||haversineMiles(from,to)>Number(profile.service_radius_miles)+1e-7)
    return json(res,403,{error:"This opportunity is outside your work radius."});

  const result=await rpc("gef_apply_work_opportunity",{p_applicant:user.id,p_opportunity:opportunityId,p_operation_key:operationKey});
  if(result?.ok!==true){
   const [status,error]=applicationError(result?.code);
   return json(res,status,{error,code:result?.code||"invalid_request"});
  }
  return json(res,result.idempotent===true?200:201,result);
 }catch(e){fail(res,e);}
};