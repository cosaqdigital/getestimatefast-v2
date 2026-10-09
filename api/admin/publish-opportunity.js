const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const user=await requireAdmin(req,res);if(!user)return;
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,4096);
  if(!/^[a-f0-9-]{36}$/i.test(String(body.id||""))||typeof body.summary!=="string"||body.summary.trim().length<20||body.summary.trim().length>1400||body.confirmReviewed!==true)return json(res,400,{error:"Review the public summary and confirm it contains no contact information."});
  const result=await queryDb("rpc/admin_publish_opportunity",{method:"POST",body:JSON.stringify({p_lead_id:body.id,p_public_summary:body.summary.trim(),p_actor:user.id})});
  json(res,200,{published:true,result});
 }catch(error){fail(res,error);}
};