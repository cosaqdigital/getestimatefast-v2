"use strict";
const {json,method,readJson,queryDb,fail,userFor}=require("./_shared");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  if(req.method==="POST"){
   const body=await readJson(req,3000);
   const id=String(body.notification_id||"").trim();
   if(!UUID.test(id))return json(res,400,{error:"Invalid notification."});
   const saved=await queryDb(
    "work_notifications?id=eq."+encodeURIComponent(id)+"&recipient_id=eq."+encodeURIComponent(user.id),
    {method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({read_at:new Date().toISOString()})}
   );
   if(!saved.length)return json(res,404,{error:"Notification not found."});
   return json(res,200,{saved:true});
  }
  const rows=await queryDb(
   "work_notifications?recipient_id=eq."+encodeURIComponent(user.id)+
   "&notification_type=eq.application_received&select=id,actor_id,opportunity_id,application_id,notification_type,read_at,created_at&order=created_at.desc&limit=20"
  );
  const actors=[...new Set(rows.map(x=>x.actor_id).filter(Boolean))];
  const profiles=actors.length?await queryDb(
   "work_profiles?user_id=in.("+actors.map(encodeURIComponent).join(",")+")&select=user_id,display_name&limit=100"
  ):[];
  const names=new Map(profiles.map(x=>[x.user_id,x.display_name]));
  return json(res,200,{
   unread_count:rows.filter(x=>!x.read_at).length,
   notifications:rows.map(row=>({...row,actor_name:names.get(row.actor_id)||"A worker"}))
  });
 }catch(e){fail(res,e);}
};