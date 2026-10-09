const {json,method,readJson,queryDb,userFor,fail}=require("./_shared");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}
   if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,1024);
  if(typeof body.smsOptIn!=="boolean")return json(res,400,{error:"SMS preference is required"});
  const path="contractor_profiles?user_id=eq."+encodeURIComponent(user.id);
  const rows=await queryDb(path+"&select=user_id,sms_opt_in,sms_opt_in_at&limit=1");
  if(!rows.length)return json(res,404,{error:"Complete your contractor profile first"});
  const previous=rows[0].sms_opt_in===true;
  if(previous===body.smsOptIn)return json(res,200,{sms_opt_in:previous,changed:false,live_sms_enabled:false});
  await queryDb(path,{method:"PATCH",headers:{Prefer:"return=minimal"},
   body:JSON.stringify({sms_opt_in:body.smsOptIn,sms_opt_in_at:body.smsOptIn?new Date().toISOString():null})});
  return json(res,200,{sms_opt_in:body.smsOptIn,changed:true,live_sms_enabled:false});
 }catch(e){fail(res,e);}
};