const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}
   if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,4096);
  if(!/^[a-f0-9-]{36}$/i.test(String(body.id||""))
   ||typeof body.category!=="string"||body.category.trim().length<2||body.category.trim().length>120
   ||body.contactReviewed!==true||body.serviceReviewed!==true
   ||typeof body.note!=="string"||body.note.length>1000)
   return json(res,400,{error:"Review the contact and service, select a category, then confirm."});
  const result=await queryDb("rpc/admin_reconfirm_legacy_lead",{method:"POST",
   body:JSON.stringify({p_lead_id:body.id,p_service_type:body.category.trim(),p_contact_reviewed:true,p_scope_reviewed:true,p_note:body.note.trim()||null,p_actor:admin.id})});
  return json(res,200,{reconfirmed:true,result});
 }catch(e){fail(res,e);}
};
