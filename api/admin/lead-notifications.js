"use strict";
const {json,method,queryDb,requireAdmin}=require('./_auth');
module.exports=async function handler(req,res){
  if(!method(req,res,['GET']))return;
  try {
    if(!await requireAdmin(req,res))return;
    const stats=await queryDb('rpc/gef_lead_notification_stats',{method:'POST',body:'{}'});
    return json(res,200,{notifications:stats});
  }catch{return json(res,503,{error:'Notification status unavailable'});}
};
