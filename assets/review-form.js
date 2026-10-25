(()=>{"use strict";
const profile=document.getElementById("reviewProfessional"),status=document.getElementById("reviewStatus");
const googleStart=document.getElementById("googleReviewStart"),googleButton=document.getElementById("continueGoogle");
const googleForm=document.getElementById("googleReviewForm"),googleSubmit=document.getElementById("submitGoogleReview");
const emailFallback=document.getElementById("emailFallback"),showEmail=document.getElementById("showEmailReview");
const emailForm=document.getElementById("emailReviewForm"),emailSubmit=document.getElementById("submitEmailReview");
const tokenRe=/^[A-Za-z0-9_-]{43}$/;
const hashToken=location.hash.slice(1);
if(tokenRe.test(hashToken))sessionStorage.setItem("gef-review-invite",hashToken);
let token=tokenRe.test(hashToken)?hashToken:sessionStorage.getItem("gef-review-invite")||"";
if(!tokenRe.test(token))token="";
if(location.hash)history.replaceState(null,"",location.pathname+location.search);
const authResult=new URLSearchParams(location.search).get("auth");
let csrf="";
const say=(message,focus=false)=>{status.textContent=message;if(focus)status.focus();};
async function json(url,options){const r=await fetch(url,{...options,cache:"no-store",credentials:"same-origin"});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Review service temporarily unavailable.");return d;}
function fillProfile(data){if(data?.display_name)profile.textContent="Review "+data.display_name;}
function hideAll(){googleStart.hidden=true;googleForm.hidden=true;emailFallback.hidden=true;emailForm.hidden=true;}
async function load(){
 hideAll();
 try{
  const google=await json("/api/reviews/google-session");
  csrf=google.csrf||"";
  let context=google.profile?{profile:google.profile}:null;
  if(!context&&token)context=await json("/api/reviews/session?token="+encodeURIComponent(token));
  if(!context?.profile){say("Open the exclusive review invitation shared by your professional.",true);return;}
  fillProfile(context.profile);
  if(google.already_reviewed){say("You have already submitted a review for this professional.",true);return;}
  if(google.authenticated){
    googleForm.hidden=false;
    say("Google verified your identity. You can submit your review without any additional email confirmation.");
    return;
  }
  if(google.google_available){
    googleStart.hidden=false;
    emailFallback.hidden=false;
    if(authResult==="cancelled")say("Google sign-in was cancelled. You can try again or use email verification.");
    else say("Continue with Google for instant identity verification, or use email verification instead.");
  }else{
    emailFallback.hidden=false;
    emailForm.hidden=false;
    say("Google verification is not available yet. You can verify your review by email.");
  }
 }catch(e){say(e.message,true);}
}
googleButton.onclick=async()=>{
 googleButton.disabled=true;
 try{
  const data=await json("/api/reviews/auth-start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csrf,token:token||undefined})});
  if(!data.redirect)throw Error("Google sign-in could not be started.");
  location.href=data.redirect;
 }catch(e){say(e.message,true);googleButton.disabled=false;}
};
showEmail.onclick=()=>{emailForm.hidden=false;showEmail.hidden=true;say("Enter your email. We'll send a one-time confirmation link.");};
googleForm.onsubmit=async e=>{
 e.preventDefault();googleSubmit.disabled=true;
 const f=new FormData(googleForm);
 try{
  await json("/api/reviews/google-submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   csrf,display_name:f.get("display_name"),rating:Number(f.get("rating")),comment:f.get("comment"),website:f.get("website"),consent:f.get("consent")==="on"
  })});
  sessionStorage.removeItem("gef-review-invite");token="";hideAll();
  say("Thank you. Your Google-verified review is pending GetEstimateFast moderation.",true);
 }catch(e){say(e.message,true);googleSubmit.disabled=false;}
};
emailForm.onsubmit=async e=>{
 e.preventDefault();emailSubmit.disabled=true;
 const f=new FormData(emailForm);
 try{
  const data=await json("/api/reviews/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   token,display_name:f.get("display_name"),email:f.get("email"),rating:Number(f.get("rating")),comment:f.get("comment"),website:f.get("website"),consent:f.get("consent")==="on"
  })});
  emailForm.reset();hideAll();
  say(data.message||"Check your email to confirm your review.",true);
 }catch(e){say(e.message,true);emailSubmit.disabled=false;}
};
load();
})();