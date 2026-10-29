"use strict";
const {json,method,queryDb,fail,userFor,config}=require("../contractor/_shared");
const {coordinates,haversineMiles}=require("../_lib/florida-matching");

function floridaToday(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
function cityFor(zip){
 try{return require("zipcodes").lookup(zip)?.city||zip;}catch{return zip;}
}
function overlap(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.some(v=>b.includes(v));}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const profiles=await queryDb("work_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id,base_zip,service_radius_miles,service_categories,languages,opportunity_types,status&limit=1");
  const profile=profiles[0]||null;
  if(!profile||profile.status!=="active")return json(res,403,{error:"Complete your Find Work profile to see matching opportunities.",profile_required:true});

  const today=floridaToday();
  const opportunities=await queryDb(
   "work_opportunities?status=eq.open&work_date=gte."+encodeURIComponent(today)+
   "&select=id,posted_by,opportunity_type,service_category,task_label,zip_code,description,pay_cents,pay_basis,work_date,start_time,workers_needed,max_contacts,contacts_used,positions_filled,languages,status,created_at"+
   "&order=work_date.asc,created_at.desc&limit=150"
  );
  const blocks=await queryDb(
   "work_user_blocks?or=(blocker_id.eq."+encodeURIComponent(user.id)+",blocked_id.eq."+encodeURIComponent(user.id)+")"+
   "&select=blocker_id,blocked_id&limit=500"
  );
  const blocked=new Set();
  for(const row of blocks){
   if(row.blocker_id===user.id)blocked.add(row.blocked_id);
   if(row.blocked_id===user.id)blocked.add(row.blocker_id);
  }

  const from=coordinates(profile.base_zip);
  const candidates=[];
  for(const item of opportunities){
   if(item.posted_by===user.id||blocked.has(item.posted_by))continue;
   if(!profile.service_categories.includes(item.service_category))continue;
   if(!profile.opportunity_types.includes(item.opportunity_type))continue;
   if(!overlap(profile.languages,item.languages))continue;
   if(item.contacts_used>=item.max_contacts||item.positions_filled>=item.workers_needed)continue;
   const to=coordinates(item.zip_code);
   if(!from||!to)continue;
   const distance=Math.round(haversineMiles(from,to)*10)/10;
   if(distance>Number(profile.service_radius_miles)+1e-7)continue;
   candidates.push({...item,distance_miles:distance,city:cityFor(item.zip_code)});
  }

  const posterIds=[...new Set(candidates.map(x=>x.posted_by))];
  const posters=posterIds.length?await queryDb(
   "contractor_public_profiles?contractor_id=in.("+posterIds.map(encodeURIComponent).join(",")+")"+
   "&published=eq.true&select=contractor_id,slug,display_name,headline,city,state_code,zip_code,portfolio&limit=200"
  ):[];
  const posterMap=new Map(posters.map(x=>[x.contractor_id,x]));
  const visible=candidates.filter(x=>posterMap.has(x.posted_by));

  const applicationRows=visible.length?await queryDb(
   "work_applications?applicant_id=eq."+encodeURIComponent(user.id)+
   "&opportunity_id=in.("+visible.map(x=>x.id).join(",")+")&select=id,opportunity_id,status,created_at&limit=200"
  ):[];
  const applied=new Map(applicationRows.map(x=>[x.opportunity_id,x]));
  const {url}=config();

  return json(res,200,{
   profile:{zip_code:profile.base_zip,radius_miles:profile.service_radius_miles},
   opportunities:visible.map(item=>{
    const poster=posterMap.get(item.posted_by),application=applied.get(item.id)||null;
    return {
     ...item,
     contacts_remaining:Math.max(0,item.max_contacts-item.contacts_used),
     application,
     poster:{
      slug:poster.slug,
      display_name:poster.display_name,
      headline:poster.headline||"",
      city:poster.city,
      state_code:poster.state_code,
      profile_path:"/professionals/"+poster.slug,
      logo_url:Array.isArray(poster.portfolio)&&poster.portfolio[0]?.image_path?url+"/storage/v1/object/public/gef-portfolio/"+poster.portfolio[0].image_path:null
     }
    };
   })
  });
 }catch(e){fail(res,e);}
};