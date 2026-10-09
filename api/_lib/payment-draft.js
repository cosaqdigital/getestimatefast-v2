"use strict";
const {cents}=require("./marketplace-pricing"),{uuid,operationKey}=require("./marketplace-access");
// Pure preparation only. No SDK, credentials, network request or checkout route.
function stripeCheckoutDraft(intent,origin){
 uuid(intent.id);operationKey(intent.operation_key);cents(intent.amount_cents);cents(intent.bonus_cents||0,true);
 if(intent.currency!=="USD"||intent.status!=="pending"||!["wallet_topup","profile_service"].includes(intent.purpose))throw Error("Invalid pending USD payment intent");
 if(intent.purpose==="profile_service"&&(intent.bonus_cents||intent.promotion_id))throw Error("Profile preparation is independent of wallet credits");
 const base=new URL(origin);if(base.protocol!=="https:"||base.username||base.password||base.search||base.hash||base.pathname!=="/")throw Error("Trusted HTTPS origin required");
 const metadata={gef_intent_id:intent.id,gef_purpose:intent.purpose};
 return {enabled:false,test_mode_required:true,idempotency_key:"gef-checkout:"+intent.id,params:{mode:"payment",client_reference_id:intent.id,metadata,payment_intent_data:{metadata},line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:intent.amount_cents,product_data:{name:intent.purpose==="wallet_topup"?"GetEstimateFast opportunity credits":"GetEstimateFast profile preparation"}}}],success_url:base.origin+"/contractor-portal.html?payment=pending",cancel_url:base.origin+"/contractor-portal.html?payment=canceled"}};
}
module.exports={stripeCheckoutDraft};
