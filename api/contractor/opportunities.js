const {json,method,queryDb,fail,userFor}=require("./_shared");
const {parseFilters,matchesFilters}=require("../_lib/opportunity-filters");
const {quotePrice}=require("../_lib/marketplace-pricing");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  let filters;try{filters=parseFilters(req.query);}catch(e){return json(res,400,{error:e.message});}
  const {page}=filters;
  const profiles=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=account_status,email_verified_at,state_code,base_zip,service_radius_miles,service_categories&limit=1");
  const profile=profiles?.[0];if(!profile||profile.account_status!=="active"||!profile.email_verified_at||profile.state_code!=="FL")return json(res,403,{error:"Complete an active Florida contractor profile to browse opportunities."});
  // RPC restricts scope and never returns private contacts. Filter by exact centroid distance on the server.
  const filtered=[];const fetchedIds=new Set();
  for(let rpcPage=0;rpcPage<=100;rpcPage++){
   const data=await queryDb("rpc/list_contractor_opportunities",{method:"POST",body:JSON.stringify({p_contractor:user.id,p_page:rpcPage,p_city:null})});
   if(!Array.isArray(data))throw Error("Invalid opportunities response");
   let commercial=[];
   if(process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW==="true"&&process.env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"&&process.env.VERCEL_ENV!=="production"&&data.length){
    commercial=await queryDb("rpc/gef_commercial_previews",{method:"POST",body:JSON.stringify({p_ids:data.map(o=>o.opportunity_id)})});
   }
   const terms=new Map(commercial.map(c=>[c.opportunity_id,c]));
   for(const candidate of data){
    if(fetchedIds.has(candidate.opportunity_id))continue;
    fetchedIds.add(candidate.opportunity_id);
    const t=terms.get(candidate.opportunity_id);
    const pricing=t?quotePrice({...t.rule,base_cents:Number(t.rule.base_cents),floor_cents:Number(t.rule.floor_cents)},{category:candidate.service_category,published_at:candidate.published_at,buyer_count:Number(t.buyer_count),scope:t.scope,urgency:t.urgency}):null;
    // Preserve an explicit public projection even if the upstream RPC adds columns later.
    const safe={opportunity_id:candidate.opportunity_id,service_category:candidate.service_category,public_summary:candidate.public_summary,city:candidate.city,zip_code:candidate.zip_code,published_at:candidate.published_at,commercial:pricing};
    if(matchesFilters(safe,profile,filters))filtered.push(safe);
   }
   if(data.length<25)break;
   if(rpcPage===100)return json(res,503,{error:"Opportunity search reached a safety limit. Please try again later."});
  }
  return json(res,200,{opportunities:filtered.slice(page*25,(page+1)*25),page,matching_total:filtered.length,note:"Approximate straight-line miles between ZIP centroids. Private customer contact details are not shared."});
 }catch(error){fail(res,error);}
};
