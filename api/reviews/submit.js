"use strict";
const {json,method,readJson,queryDb}=require("../admin/_auth");
const {marketplaceReady}=require("../_lib/marketplace-access");
const {tokenHash,text}=require("../_lib/public-profile-policy");
const {normalizeEmail,validEmail,matchesOwnedEmail,identityHash,createVerificationToken,trustedIp,requestHash,sendVerificationEmail}=require("../_lib/review-email");

const rpc=(name,payload)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(payload)});

module.exports=async function handler(req,res){
  if(!method(req,res,["POST"]))return;
  try{
    if(!marketplaceReady(req,res))return;
    const origin=new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com").origin;
    if(!process.env.RESEND_API_KEY)return json(res,503,{error:"Review email verification is temporarily unavailable."});
    if(String(req.headers.origin||"")!==origin)return json(res,403,{error:"Please reopen the review invitation and try again."});
    const body=await readJson(req,7000);
    if(body.website)return json(res,202,{pending_verification:true});
    const invite=String(body.token||"");
    if(!/^[A-Za-z0-9_-]{43}$/.test(invite))return json(res,400,{error:"Invalid review invitation."});
    const email=normalizeEmail(body.email);
    const inviteContext=await rpc("gef_review_invitation_context",{p_hash:tokenHash(invite)});
    if(!inviteContext?.contractor_id)return json(res,409,{error:"This review invitation is unavailable or expired."});
    const [ownerRows,publicRows]=await Promise.all([
      queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(inviteContext.contractor_id)+"&select=contact_email&limit=1"),
      queryDb("contractor_public_profiles?contractor_id=eq."+encodeURIComponent(inviteContext.contractor_id)+"&select=public_email&limit=1")
    ]);
    if(matchesOwnedEmail(email,[ownerRows?.[0]?.contact_email,publicRows?.[0]?.public_email])){
      return json(res,409,{error:"Professionals cannot review their own public profile."});
    }
    if(!validEmail(email)||!Number.isInteger(body.rating)||body.rating<1||body.rating>5||body.consent!==true)
      return json(res,400,{error:"Enter a valid email, choose a rating and confirm that this review describes your own experience."});
    let displayName,comment;
    try{
      displayName=text(body.display_name,2,80);
      comment=text(body.comment,10,1500);
    }catch{
      return json(res,400,{error:"Enter a display name and a review between 10 and 1,500 characters."});
    }
    const secret=process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET;
    if(typeof secret!=="string"||secret.length<32)return json(res,503,{error:"Review service temporarily unavailable."});
    const ip=trustedIp(req);
    if(!ip)return json(res,503,{error:"Review service temporarily unavailable."});
    const emailIdentity=identityHash(email,secret);
    const emailRate=requestHash(emailIdentity,secret,"review-email");
    const ipRate=requestHash(ip,secret,"review-ip");
    if(!await rpc("gef_public_request_allowed",{p_hash:emailRate,p_limit:3})||!await rpc("gef_public_request_allowed",{p_hash:ipRate,p_limit:10}))
      return json(res,429,{error:"Too many review attempts. Please try again later."});

    const verification=createVerificationToken();
    const prepared=await rpc("gef_prepare_email_review",{
      p_invite_hash:tokenHash(invite),
      p_identity_hash:emailIdentity,
      p_display_name:displayName,
      p_rating:body.rating,
      p_comment:comment,
      p_verification_hash:verification.tokenHash,
      p_request_hash:requestHash(ip,secret,"review-request")
    });
    if(!prepared?.review_id||!prepared?.display_name)return json(res,503,{error:"Review service temporarily unavailable."});
    const verificationUrl=origin+"/api/reviews/confirm?token="+encodeURIComponent(verification.token);
    const sent=await sendVerificationEmail({
      to:email,
      professionalName:prepared.display_name,
      verificationUrl,
      reviewId:prepared.review_id,
      key:verification.tokenHash.slice(0,16)
    });
    if(!sent)return json(res,503,{error:"We saved your review, but could not send the confirmation email. Please try again shortly."});
    return json(res,201,{pending_verification:true,message:"Check your email to confirm your review."});
  }catch(e){
    const message=String(e?.message||"");
    if(/already submitted|claimed|unavailable|expired|used/i.test(message))return json(res,409,{error:message});
    return json(res,503,{error:"Review service temporarily unavailable. Please try again later."});
  }
};
