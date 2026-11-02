"use strict";
const {json,method,readJson,queryDb,userFor}=require("./_shared");
const {
 readiness,configuration,createCheckout,clientFor
}=require("../_lib/work-post-credit-stripe-test");

const PACKAGE=/^(extra_4|extra_15)$/;
const OP=/^[A-Za-z0-9:_-]{8,160}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

module.exports=async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 if(process.env.VERCEL_ENV==="production")return json(res,404,{error:"Not found"});
 try{
  const user=await userFor(req,res);if(!user)return;

  if(req.method==="GET"){
   const orderId=String(req.query?.order_id||"").trim();
   if(!UUID.test(orderId))return json(res,400,{error:"Invalid order."});
   const order=await rpc("gef_work_post_credit_order_read",{p_order:orderId});
   if(!order||order.contractor_id!==user.id)return json(res,404,{error:"Order unavailable."});
   const summary=await rpc("gef_work_post_summary",{p_contractor:user.id});
   return json(res,200,{
    order_id:order.id,
    package_code:order.package_code,
    posts:order.posts,
    amount_cents:order.amount_cents,
    currency:order.currency,
    status:order.status,
    purchased_remaining:summary?.purchased_remaining??0,
    test_only:true
   });
  }

  const state=readiness();
  if(state.checkout_enabled!==true)
   return json(res,503,{error:"Stripe test checkout for extra posts is not enabled in this Preview.",test_only:true,payments_enabled:false});

  const body=await readJson(req,4000);
  const packageCode=String(body.package_code||"").trim();
  const operationKey=String(body.operation_key||"").trim();
  if(!PACKAGE.test(packageCode)||!OP.test(operationKey))
   return json(res,400,{error:"Choose a valid extra post package."});

  let settings;
  try{settings=configuration("checkout");}
  catch{return json(res,503,{error:"Stripe test checkout is not configured for this Preview.",test_only:true,payments_enabled:false});}

  const prepared=await rpc("gef_prepare_work_post_credit_order",{
   p_contractor:user.id,
   p_package:packageCode,
   p_key:operationKey,
   p_origin:settings.origin
  });
  if(prepared?.ok!==true){
   const code=prepared?.code;
   const status=code==="package_unavailable"?409:code==="operation_key_conflict"?409:403;
   return json(res,status,{error:code==="package_unavailable"?"This package is unavailable.":"This purchase could not be prepared.",code});
  }

  const order=await rpc("gef_work_post_credit_order_read",{p_order:prepared.order_id});
  if(!order||order.contractor_id!==user.id)return json(res,404,{error:"Order unavailable."});
  if(order.status==="paid")
    return json(res,200,{order_id:order.id,status:"paid",test_only:true,purchased:true});

  const client=clientFor(settings.key);
  const session=await createCheckout(order,settings,client);
  const bound=await rpc("gef_bind_work_post_credit_session",{p_order:order.id,p_session:session.id});
  if(bound?.ok!==true)return json(res,409,{error:"Checkout session could not be bound."});

  return json(res,201,{
   order_id:order.id,
   package_code:order.package_code,
   posts:order.posts,
   amount_cents:order.amount_cents,
   currency:order.currency,
   checkout_url:session.url,
   test_only:true
  });
 }catch{
  return json(res,409,{error:"Extra post checkout could not be prepared.",test_only:true});
 }
};
