"use strict";
const {config,headers,json,method,requireAdmin,fail}=require("./_auth");
// Fixed allowlist; no user-controlled table/filter names or personal records.
const SOURCES=Object.freeze({
 leads:["leads","id",""],
 new_leads:["leads","id","status=eq.new"],
 opportunities:["opportunity_previews","id",""],
 contractors:["contractor_profiles","user_id",""],
 active_contractors:["contractor_profiles","user_id","account_status=eq.active"],
 public_profiles:["contractor_public_profiles","contractor_id","published=eq.true"]
});
async function count(url,secret,table,column,filter){
 const uri=url+"/rest/v1/"+table+"?select="+column+(filter?"&"+filter:"");
 const response=await fetch(uri,{method:"HEAD",headers:headers(secret,{Prefer:"count=exact"}),cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("Count request failed HTTP "+response.status);
 const match=response.headers.get("content-range")?.match(/\/(\d+)$/);
 if(!match)throw Error("Missing exact count");
 return Number(match[1]);
}
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  if(!await requireAdmin(req,res))return;
  const {url,secret}=config();
  const entries=await Promise.all(Object.entries(SOURCES).map(async([key,[table,column,filter]])=>[key,await count(url,secret,table,column,filter)]));
  return json(res,200,{counts:Object.fromEntries(entries),payments_enabled:false});
 }catch(error){return fail(res,error);}
};
