"use strict";
const review=require("../_lib/review-auth");
const contractor=require("../_lib/contractor-google-auth");

function hasContractorCookie(req){
 const raw=String(req.headers?.cookie||"");
 return raw.split(/;\s*/).some(part=>part.startsWith(contractor.COOKIE+"."));
}

module.exports=async function handler(req,res){
 if(hasContractorCookie(req))return contractor.handlers().callback(req,res);
 return review.createHandlers().callback(req,res);
};
