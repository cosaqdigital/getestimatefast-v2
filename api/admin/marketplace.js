"use strict";
const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
const {marketplaceReady,blockPayments,uuid,operationKey}=require("../_lib/marketplace-access");
const {validateRule,cents}=require("../_lib/marketplace-pricing");
const {text}=require("../_lib/public-profile-policy");
const catalog=require("../../assets/launch-categories");
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});
const date=v=>{if(typeof v!=="string"||v.length>40||!Number.isFinite(Date.parse(v)))throw Error("Invalid date");return new Date(v).toISOString();};
module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 try{
  if(!marketplaceReady(req,res))return;
  const admin=await requireAdmin(req,res);if(!admin)return;
  if(req.method==="GET")return json(res,200,{...await rpc("gef_admin_marketplace",{p_actor:admin.id}),payments_enabled:false,financial_movements_enabled:false});
  const body=await readJson(req,14000),action=body.action;
  if(["credit","adjustment","refund","confirm-payment"].includes(action))return blockPayments(res);
  let args;
  try{
   const reason=text(body.reason,5,500),key=operationKey(body.operation_key);
   if(action==="moderate-review")args={name:"gef_moderate_review",payload:{p_actor:admin.id,p_review:uuid(body.review_id),p_status:body.status,p_reason:reason,p_key:key}};
   else if(action==="resolve-report")args={name:"gef_resolve_review_report",payload:{p_actor:admin.id,p_report:uuid(body.report_id),p_status:body.status,p_reason:reason,p_key:key}};
   else{
    const p=body.payload;let payload;
    if(!p||typeof p!=="object")throw Error("Configuration required");
    const version=action==="opportunity_terms"?null:text(p.version,3,80);if(version&&!/^[A-Za-z0-9._-]+$/.test(version))throw Error("Invalid configuration version");
    if(action==="pricing_rule"){
     validateRule(p);if(!catalog.names.includes(p.category))throw Error("Choose an existing category");
     payload={version,category:p.category,currency:"USD",base_cents:p.base_cents,floor_cents:p.floor_cents,max_buyers:p.max_buyers,lifetime_hours:p.lifetime_hours,scope_bps:p.scope_bps||{},urgency_bps:p.urgency_bps||{},discounts:p.discounts,effective_at:date(p.effective_at)};
    }else if(action==="promotion"){
     cents(p.amount_cents);cents(p.bonus_cents,true);cents(p.amount_cents+p.bonus_cents);
     if(typeof p.enabled!=="boolean"||Date.parse(p.ends_at)<=Date.parse(p.starts_at))throw Error("Invalid promotion dates");
     payload={version,amount_cents:p.amount_cents,bonus_cents:p.bonus_cents,starts_at:date(p.starts_at),ends_at:date(p.ends_at),enabled:p.enabled};
    }else if(action==="opportunity_terms"){
     payload={opportunity_id:uuid(p.opportunity_id),rule_id:uuid(p.rule_id),scope_key:p.scope_key?text(p.scope_key,1,40):null,urgency_key:p.urgency_key?text(p.urgency_key,1,40):null};
    }else if(action==="profile_service_price"){
     cents(p.amount_cents);payload={version,amount_cents:p.amount_cents,effective_at:date(p.effective_at)};
    }else throw Error("Unknown action");
    args={name:"gef_admin_configuration",payload:{p_actor:admin.id,p_action:action,p_payload:payload,p_reason:reason,p_key:key}};
   }
  }catch(e){return json(res,400,{error:e.message});}
  return json(res,200,await rpc(args.name,args.payload));
 }catch(e){fail(res,e);}
};
