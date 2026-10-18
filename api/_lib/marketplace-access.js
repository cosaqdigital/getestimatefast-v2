"use strict";
const {config,json}=require("../admin/_auth");
const {protectedPreview}=require("./preview-target");
const {inspect}=require("../../scripts/preview-readiness");

function previewMarketplaceEnabled(env=process.env){
 return env.GETESTIMATEFAST_MARKETPLACE_PREVIEW==="true"&&env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"&&env.VERCEL_ENV!=="production";
}
function productionMarketplaceEnabled(env=process.env){
 const url=String(env.GETESTIMATEFAST_SUPABASE_URL||"").replace(/\/$/,"");
 return env.VERCEL_ENV==="production"&&
  env.GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED==="true"&&
  env.GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED==="true"&&
  env.GETESTIMATEFAST_ISOLATED_BACKEND!=="true"&&
  url==="https://wedsjubkttygxtpkopfj.supabase.co"&&
  env.GETESTIMATEFAST_SMS_MODE==="disabled"&&
  env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED!=="true"&&
  env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED!=="true"&&
  env.GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED!=="true"&&
  env.GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED!=="true";
}
function marketplaceCommercialEnabled(env=process.env){
 return previewMarketplaceEnabled(env)||productionMarketplaceEnabled(env);
}
function marketplaceReady(req,res){
 if(!marketplaceCommercialEnabled()){
  json(res,503,{error:"This feature is not enabled for this environment."});return false;
 }
 if(previewMarketplaceEnabled()&&protectedPreview()&&!inspect().ready){
  json(res,503,{error:"Preview configuration preflight has not passed."});return false;
 }
 config();return true;
}
function blockPayments(res){return json(res,503,{error:"Payments and financial movements are disabled.",payments_enabled:false,contact_release_enabled:false});}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value){if(typeof value!=="string"||!UUID.test(value))throw Error("Invalid identifier");return value;}
function operationKey(value){if(typeof value!=="string"||!/^[A-Za-z0-9:_-]{8,120}$/.test(value))throw Error("Invalid operation key");return value;}
module.exports={marketplaceReady,marketplaceCommercialEnabled,previewMarketplaceEnabled,productionMarketplaceEnabled,blockPayments,uuid,operationKey};
