const {json,method,queryDb,fail,userFor}=require("./_shared");
const {calculateMatch,cityMatches}=require("../_lib/florida-matching");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  const page=Number(req.query?.page??"0"),city=String(req.query?.city??"").trim();
  if(!Number.isInteger(page)||page<0||page>100||city.length>80||!/^[A-Za-z .-]*$/.test(city))return json(res,400,{error:"Invalid filter"});
  const profiles=await queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+"&select=account_status,email_verified_at,state_code,base_zip,service_radius_miles,service_categories&limit=1");
  const profile=profiles?.[0];if(!profile||profile.account_status!=="active"||!profile.email_verified_at||profile.state_code!=="FL")return json(res,403,{error:"Complete an active Florida contractor profile to browse opportunities."});
  // RPC restricts scope and never returns private contacts. Filter by exact centroid distance on the server.
  const filtered=[];const fetchedIds=new Set();
  for(let rpcPage=0;rpcPage<=100;rpcPage++){
   const data=await queryDb("rpc/list_contractor_opportunities",{method:"POST",body:JSON.stringify({p_contractor:user.id,p_page:rpcPage,p_city:null})});
   if(!Array.isArray(data))throw Error("Invalid opportunities response");
   for(const candidate of data){
    if(fetchedIds.has(candidate.opportunity_id))continue;
    fetchedIds.add(candidate.opportunity_id);
    if(cityMatches(candidate.city,city)&&calculateMatch(profile,{service_category:candidate.service_category,zip_code:candidate.zip_code}).eligible)filtered.push(candidate);
   }
   if(data.length<25)break;
   if(rpcPage===100)return json(res,503,{error:"Opportunity search reached a safety limit. Please try again later."});
  }
  return json(res,200,{opportunities:filtered.slice(page*25,(page+1)*25),page,matching_total:filtered.length,note:"Approximate straight-line miles between ZIP centroids. Private customer contact details are not shared."});
 }catch(error){fail(res,error);}
};
