const {json,method,requireAdmin,queryDb,fail}=require("./_auth");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await requireAdmin(req,res);if(!user)return;
  const allowed=["pending_review","active","suspended","rejected"];
  const filter=String(req.query.status||"");
  if(filter&&!allowed.includes(filter))return json(res,400,{error:"Invalid status"});
  const params=new URLSearchParams({select:"user_id,display_name,business_name,contact_phone,contact_email,base_zip,city,state_code,service_radius_miles,service_categories,account_status,created_at",order:"created_at.desc",limit:"50"});
  if(filter)params.set("account_status","eq."+filter);
  return json(res,200,{contractors:await queryDb("contractor_profiles?"+params.toString())});
 }catch(e){fail(res,e);}
};
