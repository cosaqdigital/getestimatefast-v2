"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,queryDb,userFor}=require("./_shared");
const {marketplaceReady,uuid}=require("../_lib/marketplace-access");
const {livePaymentsApproved}=require("../_lib/stripe-live-policy");
const {liveConfiguration,clientFor}=require("../_lib/stripe-live");
const {createTopupCheckout}=require("../_lib/stripe-live-topup");
const {cents}=require("../_lib/marketplace-pricing");

const rpc=(name,body)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(body)});

function activePromotion(row,now=Date.now()){
  return row&&row.enabled===true&&Date.parse(row.starts_at)<=now&&Date.parse(row.ends_at)>now;
}

module.exports=async function handler(req,res){
  if(!method(req,res,["GET","POST"]))return;
  if(process.env.VERCEL_ENV!=="production")return json(res,404,{error:"Not found"});
  try{
    if(!marketplaceReady(req,res))return;
    const user=await userFor(req,res);if(!user)return;
    if(!livePaymentsApproved())return json(res,503,{error:"Wallet payments are not enabled.",payments_enabled:false});

    if(req.method==="GET"){
      if(req.query?.intent_id){
        const intent=await rpc("gef_live_topup_read",{p_intent:uuid(req.query.intent_id)});
        if(!intent||intent.contractor_id!==user.id)return json(res,404,{error:"Wallet top-up unavailable"});
        return json(res,200,{
          intent_id:intent.id,
          status:intent.status,
          amount_cents:Number(intent.amount_cents),
          bonus_cents:Number(intent.bonus_cents),
          currency:"USD",
          credited:intent.status==="confirmed"
        });
      }
      const rows=await rpc("gef_active_wallet_promotions",{});
      const promotions=(rows||[]).sort((a,b)=>Number(a.amount_cents)-Number(b.amount_cents)).map(p=>({
        id:p.id,
        version:p.version,
        amount_cents:Number(p.amount_cents),
        bonus_cents:Number(p.bonus_cents),
        total_cents:Number(p.amount_cents)+Number(p.bonus_cents),
        campaign:String(p.version||"").startsWith("black-friday-")?"black_friday":null,
        ends_at:p.ends_at
      }));
      return json(res,200,{payments_enabled:true,promotions});
    }

    const body=await readJson(req,8000);
    let amount,bonus=0,promotion=null;

    if(body.promotion_id){
      const id=uuid(body.promotion_id);
      const rows=await queryDb("marketplace_promotions?id=eq."+encodeURIComponent(id)+"&select=id,amount_cents,bonus_cents,starts_at,ends_at,enabled&limit=1");
      const p=rows[0];
      if(!activePromotion(p))return json(res,409,{error:"This credit package is no longer available."});
      amount=Number(p.amount_cents);bonus=Number(p.bonus_cents);promotion=p.id;
    }else{
      amount=Number(body.amount_cents);
      cents(amount);
      if(amount<2500)return json(res,400,{error:"Minimum custom wallet top-up is $25.00."});
    }

    const operation=String(body.operation_key||("topup_"+crypto.randomUUID()));
    const created=await rpc("gef_create_live_topup",{
      p_contractor:user.id,
      p_amount:amount,
      p_bonus:bonus,
      p_promotion:promotion,
      p_operation_key:operation
    });
    const intent=await rpc("gef_live_topup_read",{p_intent:created.intent_id});
    if(!intent||intent.contractor_id!==user.id)return json(res,409,{error:"Wallet top-up could not be prepared."});

    if(intent.status==="confirmed"){
      return json(res,200,{
        intent_id:intent.id,status:intent.status,credited:true,
        amount_cents:Number(intent.amount_cents),bonus_cents:Number(intent.bonus_cents),currency:"USD"
      });
    }
    if(intent.status!=="pending")return json(res,409,{error:"This wallet top-up is no longer payable."});

    const settings=liveConfiguration();
    const session=await createTopupCheckout(intent,settings,clientFor(settings.key));
    await rpc("gef_bind_live_topup_session",{p_intent:intent.id,p_session:session.id});

    return json(res,201,{
      intent_id:intent.id,
      checkout_url:session.url,
      amount_cents:Number(intent.amount_cents),
      bonus_cents:Number(intent.bonus_cents),
      currency:"USD",
      credited:false
    });
  }catch{
    return json(res,409,{error:"The wallet top-up could not be prepared. Reload your wallet and try again."});
  }
};
