const {json,method,queryDb,requireAdmin,fail}=require("./_auth");
const {calculateMatch,coordinates}=require("../_lib/florida-matching");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try {
  const admin=await requireAdmin(req,res);if(!admin)return;
  const id=String(req.query?.id||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)||id.length!==36)return json(res,400,{error:"Invalid request id"});
  const leads=await queryDb("leads?id=eq."+encodeURIComponent(id)+"&select=id,service_type,zip_code,city,status&limit=1");
  const lead=leads?.[0];if(!lead)return json(res,404,{error:"Request not found"});
  const profiles=await queryDb("contractor_profiles?select=user_id,display_name,city,base_zip,state_code,service_radius_miles,service_categories,account_status,email_verified_at&limit=1001");
  if(!Array.isArray(profiles)||profiles.length>1000)return json(res,503,{error:"Candidate list reached a safety limit"});
  const matches=profiles.map(profile=>({profile,result:calculateMatch(profile,{service_category:lead.service_type,zip_code:lead.zip_code})}))
   .filter(item=>item.result.eligible)
   .sort((a,b)=>a.result.distance_miles-b.result.distance_miles)
   .map(({profile,result})=>({user_id:profile.user_id,display_name:profile.display_name,city:profile.city,base_zip:profile.base_zip,service_radius_miles:profile.service_radius_miles,distance_miles:result.distance_miles}));
  let selectedIds=[],roundCount=0;
  if(lead.status==="published"){
   const opportunities=await queryDb("opportunity_previews?lead_id=eq."+encodeURIComponent(id)+"&select=id&limit=1");
   if(opportunities?.length){
    const opportunityId=opportunities[0].id;
    const [rounds,recipients]=await Promise.all([
      queryDb("opportunity_matching_rounds?opportunity_id=eq."+encodeURIComponent(opportunityId)+"&select=id&limit=10"),
      queryDb("opportunity_matching_recipients?opportunity_id=eq."+encodeURIComponent(opportunityId)+"&select=contractor_user_id&limit=25")
    ]);
    roundCount=rounds.length;selectedIds=recipients.map(r=>r.contractor_user_id);
   }
  }
  return json(res,200,{candidates:matches.map(c=>({...c,already_selected:selectedIds.includes(c.user_id)})),round_count:roundCount,
    remaining_rounds:Math.max(0,5-roundCount),unresolved_zip:!coordinates(lead.zip_code),
    distance_method:"ZIP centroid (straight-line miles)",status:lead.status});
 }catch(e){fail(res,e);}
};
