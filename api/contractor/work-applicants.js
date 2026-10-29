"use strict";
const {json,method,queryDb,fail,userFor,config}=require("./_shared");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const id=String(req.query?.opportunity_id||"").trim();
  if(!UUID.test(id))return json(res,400,{error:"Invalid opportunity."});
  const own=await queryDb("work_opportunities?id=eq."+encodeURIComponent(id)+"&posted_by=eq."+encodeURIComponent(user.id)+"&select=id,service_category,task_label,status,workers_needed,max_contacts,contacts_used,positions_filled&limit=1");
  if(!own[0])return json(res,404,{error:"Opportunity not found."});
  const apps=await queryDb(
   "work_applications?opportunity_id=eq."+encodeURIComponent(id)+
   "&select=id,applicant_id,status,contact_released_at,selected_at,created_at&order=created_at.asc&limit=100"
  );
  const ids=[...new Set(apps.map(x=>x.applicant_id))];
  const profiles=ids.length?await queryDb(
   "work_profiles?user_id=in.("+ids.map(encodeURIComponent).join(",")+")"+
   "&select=user_id,slug,display_name,contact_phone,base_zip,state_code,service_radius_miles,service_categories,languages,opportunity_types,bio,profile_image_path,status&limit=100"
  ):[];
  const profileMap=new Map(profiles.map(x=>[x.user_id,x]));
  const {url}=config();
  return json(res,200,{
   opportunity:own[0],
   applicants:apps.map(app=>{
    const p=profileMap.get(app.applicant_id)||null;
    return {...app,profile:p?{
     slug:p.slug,
     display_name:p.display_name,
     contact_phone:p.contact_phone,
     base_zip:p.base_zip,
     state_code:p.state_code,
     service_radius_miles:p.service_radius_miles,
     service_categories:p.service_categories,
     languages:p.languages,
     opportunity_types:p.opportunity_types,
     bio:p.bio,
     status:p.status,
     profile_image_url:p.profile_image_path?url+"/storage/v1/object/public/gef-portfolio/"+p.profile_image_path:null
    }:null};
   }).filter(x=>x.profile)
  });
 }catch(e){fail(res,e);}
};