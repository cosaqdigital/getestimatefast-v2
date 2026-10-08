const {json,method,readJson,requireAdmin,queryDb,fail}=require("./_auth");
const VALID=["pending_review","active","suspended","rejected"];
module.exports=async function(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const origin=String(req.headers.origin||"");if(origin&&new URL(origin).host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});
  const {user_id,status,note=""}=await readJson(req,4096);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(user_id))||!VALID.includes(status)||typeof note!=="string"||note.length>1000)return json(res,400,{error:"Invalid review"});
  const result=await queryDb("rpc/admin_review_contractor",{method:"POST",body:JSON.stringify({p_contractor_id:user_id,p_next_status:status,p_note:note.trim()||null,p_actor:admin.id})});
  json(res,200,{result});
 }catch(e){fail(res,e);}
};