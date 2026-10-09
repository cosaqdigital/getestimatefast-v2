"use strict";
const {config,json}=require("../admin/_auth");
function marketplaceReady(req,res){
 if(process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW!=="true"||process.env.GETESTIMATEFAST_ISOLATED_BACKEND!=="true"||process.env.VERCEL_ENV==="production"){
  json(res,503,{error:"This feature is available in the isolated development preview only."});return false;
 }
 config();return true;
}
function blockPayments(res){return json(res,503,{error:"Payments and financial movements are disabled.",payments_enabled:false,contact_release_enabled:false});}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value){if(typeof value!=="string"||!UUID.test(value))throw Error("Invalid identifier");return value;}
function operationKey(value){if(typeof value!=="string"||!/^[A-Za-z0-9:_-]{8,120}$/.test(value))throw Error("Invalid operation key");return value;}
module.exports={marketplaceReady,blockPayments,uuid,operationKey};
