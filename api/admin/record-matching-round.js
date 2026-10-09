const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
const {calculateMatch}=require("../_lib/florida-matching");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const origin=String(req.headers.origin||"");
  if(origin){let u;try{u=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}
   if(u.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,4096);
  if(!/^[a-f0-9-]{36}$/i.test(String(body.leadId||""))||!Array.isArray(body.contractorIds)
   ||body.contractorIds.length<1||body.contractorIds.length>5
   ||body.contractorIds.some(id=>!/^[a-f0-9-]{36}$/i.test(String(id)))
   ||new Set(body.contractorIds).size!==body.contractorIds.length)return json(res,400,{error:"Select 1-5 distinct candidates."});
  const leads=await queryDb("leads?id=eq."+encodeURIComponent(body.leadId)+"&select=id,status,service_type,zip_code&limit=1");
  const lead=leads?.[0];if(!lead||lead.status!=="published")return json(res,409,{error:"Publish the approved opportunity first."});
  const profiles=await queryDb("contractor_profiles?select=user_id,account_status,email_verified_at,state_code,base_zip,service_radius_miles,service_categories&user_id=in.("+body.contractorIds.map(encodeURIComponent).join(",")+")");
  if(profiles.length!==body.contractorIds.length)return json(res,409,{error:"Some candidates are unavailable."});
  const results=body.contractorIds.map(id=>{
   const p=profiles.find(p=>p.user_id===id);
   return calculateMatch(p,{service_category:lead.service_type,zip_code:lead.zip_code});
  });
  if(results.some(r=>!r.eligible))return json(res,409,{error:"Candidate service or ZIP radius changed. Refresh matching list."});
  const result=await queryDb("rpc/admin_record_matching_round",{method:"POST",body:JSON.stringify({
    p_lead_id:lead.id,p_contractor_ids:body.contractorIds,p_distances:results.map(r=>r.distance_miles),p_actor:admin.id
  })});
  return json(res,200,{recorded:true,result,note:"No SMS, payments or customer contact releases performed."});
 }catch(e){fail(res,e);}
};
