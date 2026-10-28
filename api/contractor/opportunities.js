const {json,method,queryDb,fail,userFor,config}=require("./_shared");
const {parsePhotoPaths,signPhotoUrls}=require("../_lib/lead-photo-storage");
const {parseFilters,matchesFilters}=require("../_lib/opportunity-filters");
const {quotePrice}=require("../_lib/marketplace-pricing");
const {marketplaceCommercialEnabled}=require("../_lib/marketplace-access");
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
   if(marketplaceCommercialEnabled()&&data.length){
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
  // Mark the originating professional's own requests as FREE; other buyers
  // continue to use ordinary, paid USD pricing. This query never returns PII.
  if(filtered.length){
   const ownLeads=await queryDb("leads?origin_contractor_id=eq."+encodeURIComponent(user.id)+
     "&source=eq.professional_profile&status=eq.published&select=id&limit=1000");
   let ownPreviewIds=new Set();
   if(ownLeads.length){
    const ownPreviews=await queryDb("opportunity_previews?lead_id=in.("+
      ownLeads.map(x=>x.id).join(",")+")&select=id&limit=1000");
    ownPreviewIds=new Set(ownPreviews.map(x=>x.id));
   }
   for(const item of filtered){
    item.origin_free=ownPreviewIds.has(item.opportunity_id);
    if(item.origin_free)item.commercial=null;
   }
  }
  const pageSize=10;
  const pageItems=filtered.slice(page*pageSize,(page+1)*pageSize);
  await attachProjectPhotos(pageItems);
  return json(res,200,{opportunities:pageItems,page,page_size:pageSize,matching_total:filtered.length,note:"Approximate straight-line miles between ZIP centroids. Project photos may be shown to signed-in professionals before purchase; customer contact details remain private until authorized release."});
 }catch(error){fail(res,error);}
};

async function attachProjectPhotos(items){
 if(!items.length)return;
 const ids=items.map(x=>x.opportunity_id);
 const previews=await queryDb("opportunity_previews?id=in.("+ids.join(",")+")&select=id,lead_id");
 const byOpportunity=new Map(previews.map(row=>[row.id,row.lead_id]));
 const leadIds=[...new Set(previews.map(row=>row.lead_id).filter(Boolean))];
 if(!leadIds.length)return;
 const leads=await queryDb("leads?id=in.("+leadIds.join(",")+")&select=id,details");
 const detailsByLead=new Map(leads.map(row=>[row.id,row.details||{}]));
 const pathsByOpportunity=new Map();
 const allPaths=[];
 for(const item of items){
  const leadId=byOpportunity.get(item.opportunity_id);
  const details=detailsByLead.get(leadId)||{};
  const paths=parsePhotoPaths(details["Project Photo Paths"],details["Submission Token"]);
  pathsByOpportunity.set(item.opportunity_id,paths);
  allPaths.push(...paths);
 }
 if(!allPaths.length)return;
 const {url,secret}=config();
 const signed=await signPhotoUrls(url,secret,[...new Set(allPaths)],900);
 const signedByPath=new Map(signed.map(photo=>[photo.path,photo.url]));
 for(const item of items){
  const paths=pathsByOpportunity.get(item.opportunity_id)||[];
  item.photos=paths.map(path=>signedByPath.get(path)).filter(Boolean).map(url=>({url}));
  item.photo_count=item.photos.length;
 }
}


function publicProjectDetails(details){
 const source=details&&typeof details==="object"&&!Array.isArray(details)?details:{};
 const blocked=new Set([
  "Full Name","Phone Number","Email Address","Preferred contact method",
  "Submission Token","Project Photo Paths","Project Photo Count","Landing Page","Landing Page URL",
  "City","ZIP Code","Service Type","_platform_review","_profile_referral"
 ]);
 const out={};
 for(const [key,value] of Object.entries(source)){
  if(blocked.has(key)||key.startsWith("_")||value===null||value===undefined)continue;
  if(typeof value==="string"&&!value.trim())continue;
  if(typeof value==="object"&&!Array.isArray(value))continue;
  out[key]=value;
 }
 return out;
}
module.exports.publicProjectDetails=publicProjectDetails;
