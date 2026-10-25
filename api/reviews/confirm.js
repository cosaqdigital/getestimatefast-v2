"use strict";
const {queryDb}=require("../admin/_auth");
const {marketplaceReady}=require("../_lib/marketplace-access");
const {hashVerificationToken}=require("../_lib/review-email");
const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

module.exports=async function handler(req,res){
  if(req.method!=="GET"){res.statusCode=405;res.setHeader("Allow","GET");return res.end();}
  try{
    if(!marketplaceReady(req,res))return;
    const hash=hashVerificationToken(String(req.query?.token||""));
    let result={result:"invalid",slug:null};
    if(hash)result=await rpc("gef_confirm_email_review",{p_token_hash:hash})||result;
    const target=new URL("/review-confirmed.html",process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com");
    target.searchParams.set("result",result.result==="confirmed"||result.result==="already_confirmed"?"success":result.result||"invalid");
    if(result.slug)target.searchParams.set("profile",result.slug);
    res.statusCode=303;res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Location",target.toString());res.end();
  }catch{
    const target=new URL("/review-confirmed.html?result=error",process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com");
    res.statusCode=303;res.setHeader("Location",target.toString());res.end();
  }
};
