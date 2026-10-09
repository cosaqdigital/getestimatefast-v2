const {json,method,queryDb,fail,userFor}=require("./_shared");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const rawPage=String(req.query?.page??"0");
  const city=String(req.query?.city??"").trim();
  if(!/^(0|[1-9][0-9]{0,2})$/.test(rawPage)||Number(rawPage)>100||city.length>80||!/^([A-Za-z .-]*)$/.test(city))return json(res,400,{error:"Invalid filter"});
  const profile=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=account_status,email_verified_at,state_code&limit=1");
  if(!profile.length||profile[0].account_status!=="active"||!profile[0].email_verified_at||profile[0].state_code!=="FL")return json(res,403,{error:"Complete an active Florida contractor profile to browse opportunities."});
  const data=await queryDb("rpc/list_contractor_opportunities",{method:"POST",body:JSON.stringify({p_contractor:user.id,p_page:Number(rawPage),p_city:city||null})});
  return json(res,200,{opportunities:Array.isArray(data)?data:[],page:Number(rawPage),note:"These are summaries only. Customer contact access and payment are not enabled."});
 }catch(error){fail(res,error);}
};