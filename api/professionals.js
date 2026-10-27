"use strict";
const {json,method,queryDb,fail}=require("./admin/_auth");
const {marketplaceReady}=require("./_lib/marketplace-access");
const catalog=require("../assets/launch-categories");
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  if(!marketplaceReady(req,res))return;
  const category=String(req.query?.category||"").trim();
  const city=String(req.query?.city||"").trim();
  const zip=String(req.query?.zip||"").trim();
  const limit=Math.min(50,Math.max(1,Number(req.query?.limit)||20));
  if(!catalog.names.includes(category))return json(res,400,{error:"Choose a supported service category."});
  if(city.length>80)return json(res,400,{error:"Invalid city."});
  if(zip&& !/^[0-9]{5}$/.test(zip))return json(res,400,{error:"Invalid ZIP Code."});
  const rows=await rpc("gef_ranked_professionals",{p_category:category,p_city:city||null,p_zip:zip||null,p_limit:limit});
  const safe=(rows||[]).map(r=>({
    rank:Number(r.rank_position),
    slug:r.slug,
    display_name:r.display_name,
    headline:r.headline,
    city:r.city,
    state_code:r.state_code,
    zip_code:r.zip_code,
    radius_miles:Number(r.radius_miles),
    average_rating:r.average_rating==null?null:Number(r.average_rating),
    review_count:Number(r.review_count||0),
    profile_completeness_percent:Number(r.profile_completeness_percent||0),
    portfolio_count:Number(r.portfolio_count||0),
    badges:r.badges||{},
    algorithm_version:r.algorithm_version
  }));
  res.setHeader("Cache-Control","public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  return json(res,200,{category,city:city||null,zip:zip||null,professionals:safe});
 }catch(e){fail(res,e);}
};