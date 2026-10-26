const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
const {marketplaceCommercialEnabled}=require("../_lib/marketplace-access");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const user=await requireAdmin(req,res);if(!user)return;
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,4096);
  if(!/^[a-f0-9-]{36}$/i.test(String(body.id||""))||typeof body.summary!=="string"||body.summary.trim().length<20||body.summary.trim().length>1400||body.confirmReviewed!==true)return json(res,400,{error:"Review the public summary and confirm it contains no contact information."});
  // Read the verified origin from the server-owned US database, never from the client.
  const leads=await queryDb("leads?id=eq."+encodeURIComponent(body.id)+
    "&select=source,origin_contractor_id,service_type&limit=1");
  if(!leads[0])return json(res,404,{error:"Request not found."});
  const isReferral=leads[0].source==="professional_profile";
  if(isReferral && !leads[0].origin_contractor_id)
    return json(res,409,{error:"This profile request has no verified originating professional."});
  if(isReferral){
    if(!marketplaceCommercialEnabled())return json(res,503,{error:"Commercial opportunity publication is not enabled.",payments_enabled:false});
    const rules=await queryDb("marketplace_price_rules?category=eq."+
      encodeURIComponent(leads[0].service_type)+"&currency=eq.USD"+
      "&effective_at=lte."+encodeURIComponent(new Date().toISOString())+
      "&select=id&order=effective_at.desc&limit=1");
    if(!rules.length)return json(res,409,{error:"Set a USD contact price for "+
      leads[0].service_type+" in Marketplace pricing before publishing this request."});
  }
  const rpc=isReferral?"rpc/admin_publish_profile_opportunity_priced":"rpc/admin_publish_opportunity";
  const result=await queryDb(rpc,{method:"POST",body:JSON.stringify({
    p_lead_id:body.id,p_public_summary:body.summary.trim(),p_actor:user.id
  })});
  json(res,200,{published:true,result,origin_professional_free:isReferral,commercial_terms_assigned:isReferral});
 }catch(error){fail(res,error);}
};
