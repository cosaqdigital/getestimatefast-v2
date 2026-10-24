"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,queryDb,userFor}=require("./_shared");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");
const {livePaymentsApproved}=require("../_lib/stripe-live-policy");
const {liveConfiguration,createCheckout,clientFor}=require("../_lib/stripe-live");
const {quotePrice}=require("../_lib/marketplace-pricing");
const {calculateMatch}=require("../_lib/florida-matching");

const rpc=(name,body)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(body)});

module.exports=async function handler(req,res){
  if(!method(req,res,["GET","POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  try{
    if(!marketplaceReady(req,res))return;
    const user=await userFor(req,res);if(!user)return;
    if(!livePaymentsApproved())return json(res,503,{error:"Live contact purchases are not enabled.",payments_enabled:false});

    if(req.method==="GET"){
      const order=await rpc("gef_live_order_read",{p_order:uuid(req.query?.order_id)});
      if(!order||order.contractor_id!==user.id)return json(res,404,{error:"Order unavailable"});
      return json(res,200,{
        order_id:order.id,
        status:order.status,
        amount_cents:Number(order.amount_cents),
        currency:"USD",
        contact_release_enabled:order.status==="paid"&&Boolean(order.purchase_id)
      });
    }

    const body=await readJson(req,8000);
    const opportunity=uuid(body.opportunity_id);

    const profiles=await queryDb(
      "contractor_profiles?user_id=eq."+encodeURIComponent(user.id)+
      "&select=account_status,email_verified_at,state_code,base_zip,service_radius_miles,service_categories&limit=1"
    );
    const profile=profiles[0];
    const context=await rpc("gef_live_quote_context",{p_opportunity:opportunity});
    if(!profile||profile.account_status!=="active"||!profile.email_verified_at||!context||
       !calculateMatch(profile,context.opportunity).eligible){
      return json(res,403,{error:"Opportunity is outside your authorized service area."});
    }

    const rule={
      ...context.rule,
      base_cents:Number(context.rule.base_cents),
      floor_cents:Number(context.rule.floor_cents)
    };
    const price=quotePrice(rule,{
      category:context.opportunity.service_category,
      published_at:context.opportunity.published_at,
      buyer_count:Number(context.buyer_count),
      scope:context.scope,
      urgency:context.urgency
    });
    if(!price.available)return json(res,409,{error:"Opportunity is unavailable.",reason:price.reason});

    if(body.action==="quote"){
      const quote=await rpc("gef_create_live_quote",{
        p_contractor:user.id,
        p_terms:context.terms_id,
        p_amount:price.amount_cents,
        p_valid_until:price.quote_valid_until
      });
      return json(res,201,{...quote,...price,payments_enabled:true});
    }

    if(body.action!=="checkout")return json(res,400,{error:"Unknown action"});
    const quoteId=uuid(body.quote_id);
    const quote=await queryDb(
      "rpc/gef_prepare_live_order",
      {
        method:"POST",
        body:JSON.stringify({
          p_contractor:user.id,
          p_quote:quoteId,
          p_key:String(body.operation_key||("buy_"+crypto.randomUUID()))
        })
      }
    );

    const settings=liveConfiguration();
    const session=await createCheckout(quote,settings,clientFor(settings.key));
    await rpc("gef_bind_live_session",{p_order:quote.id,p_session:session.id});

    return json(res,201,{
      order_id:quote.id,
      checkout_url:session.url,
      amount_cents:Number(quote.amount_cents),
      currency:"USD",
      contact_release_enabled:false
    });
  }catch{
    return json(res,409,{error:"The contact purchase could not be prepared. Reload the opportunity and try again."});
  }
};
