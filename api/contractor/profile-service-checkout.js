"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,queryDb,userFor}=require("./_shared");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");
const {livePaymentsApproved}=require("../_lib/stripe-live-policy");
const {liveConfiguration,clientFor}=require("../_lib/stripe-live");
const {createProfileServiceCheckout}=require("../_lib/stripe-live-profile-service");
const rpc=(name,body)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(body)});

module.exports=async function handler(req,res){
  if(!method(req,res,["GET","POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  try{
    if(!marketplaceReady(req,res))return;
    const user=await userFor(req,res);if(!user)return;
    if(!livePaymentsApproved())return json(res,503,{error:"Profile service checkout is not enabled.",payments_enabled:false});

    if(req.method==="GET"){
      if(req.query?.intent_id){
        const intent=await rpc("gef_live_profile_service_read",{p_intent:uuid(req.query.intent_id)});
        if(!intent||intent.contractor_id!==user.id)return json(res,404,{error:"Profile service order unavailable"});
        return json(res,200,{
          intent_id:intent.id,order_id:intent.order_id,status:intent.status,
          order_status:intent.order_status,amount_cents:Number(intent.amount_cents),
          currency:"USD",service_ready:intent.status==="confirmed"
        });
      }
      const rows=await queryDb("profile_service_prices?effective_at=lte."+encodeURIComponent(new Date().toISOString())+"&select=id,version,amount_cents,currency,effective_at&order=effective_at.desc&limit=1");
      const active=rows[0];
      const existing=await rpc("gef_profile_service_status",{p_contractor:user.id});
      return json(res,200,{
        available:Boolean(active),
        payments_enabled:true,
        price:active?{amount_cents:Number(active.amount_cents),currency:active.currency,version:active.version}:null,
        standard_price_cents:18000,
        offer_label:"Launch offer",
        existing_order:existing||null
      });
    }

    const body=await readJson(req,18000);
    if(body.action==="intake"){
      const orderId=uuid(body.order_id);
      const intake={
        business_name:String(body.business_name||"").trim(),
        logo_plan:String(body.logo_plan||""),
        services:Array.isArray(body.services)?body.services.map(x=>String(x).trim()).filter(Boolean).slice(0,20):[],
        years_experience:String(body.years_experience||"").trim().slice(0,60),
        city:String(body.city||"").trim().slice(0,80),
        zip_code:String(body.zip_code||"").trim(),
        radius_miles:Number(body.radius_miles),
        languages:Array.isArray(body.languages)?body.languages.map(x=>String(x).trim()).filter(Boolean).slice(0,10):[],
        company_story:String(body.company_story||"").trim().slice(0,3000),
        portfolio_notes:String(body.portfolio_notes||"").trim().slice(0,3000),
        notes:String(body.notes||"").trim().slice(0,3000)
      };
      const result=await rpc("gef_submit_profile_service_intake",{p_contractor:user.id,p_order:orderId,p_intake:intake});
      return json(res,200,result);
    }
    if(body.action!=="checkout")return json(res,400,{error:"Unknown action"});
    const operation=String(body.operation_key||("profile_"+crypto.randomUUID()));
    const created=await rpc("gef_create_live_profile_service",{p_contractor:user.id,p_operation_key:operation});
    const intent=await rpc("gef_live_profile_service_read",{p_intent:created.intent_id});
    if(!intent||intent.contractor_id!==user.id)return json(res,409,{error:"Profile service could not be prepared."});
    if(intent.status==="confirmed")return json(res,200,{
      intent_id:intent.id,order_id:intent.order_id,status:intent.status,service_ready:true,
      amount_cents:Number(intent.amount_cents),currency:"USD"
    });
    if(intent.status!=="pending")return json(res,409,{error:"This profile service order is no longer payable."});

    const settings=liveConfiguration();
    const session=await createProfileServiceCheckout(intent,settings,clientFor(settings.key));
    await rpc("gef_bind_live_profile_service_session",{p_intent:intent.id,p_session:session.id});
    return json(res,201,{
      intent_id:intent.id,order_id:intent.order_id,checkout_url:session.url,
      amount_cents:Number(intent.amount_cents),currency:"USD",service_ready:false
    });
  }catch{
    return json(res,409,{error:"The professional profile service could not be prepared. Please reload and try again."});
  }
};