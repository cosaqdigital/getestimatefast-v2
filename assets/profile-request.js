(()=>{
"use strict";
const form=document.getElementById("profileRequest"),status=document.getElementById("requestStatus");
const owner=document.getElementById("featuredProfile"),service=document.getElementById("service");
const slug=new URLSearchParams(location.search).get("profile")||"";
const say=message=>{status.textContent=message;};
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80){
 owner.textContent="This professional profile link is invalid.";return;
}
let token=crypto.randomUUID();
async function initialize(){
 try{
  const response=await fetch("/api/public-profile?slug="+encodeURIComponent(slug),{cache:"no-store"});
  if(!response.ok)throw Error("This professional profile is not available.");
  const profile=(await response.json())?.profile;
  if(!profile||!Array.isArray(profile.categories)||!profile.categories.length)throw Error("This professional has no available services.");
  owner.textContent="Request started from: "+profile.display_name+" — "+profile.city+", "+profile.state_code;
  for(const name of profile.categories){
   const option=document.createElement("option");option.value=name;option.textContent=name;service.append(option);
  }
  form.hidden=false;
 }catch(error){owner.textContent=error.message;}
}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 const values=Object.fromEntries(new FormData(form).entries());
 const payload={
  profileSlug:slug,submissionToken:token,service:values.service,description:values.description,
  fullName:values.fullName,email:values.email,phone:values.phone,
  city:values.city,zipCode:values.zipCode,contactMethod:values.contactMethod,
  marketplaceConsent:values.marketplaceConsent==="on",
  contactConsent:values.contactConsent==="on",
  privacyConsent:values.privacyConsent==="on",
  website:values.website||""
 };
 const button=document.getElementById("submitRequest");
 button.disabled=true;say("Submitting your request...");
 try{
  const response=await fetch("/api/profile-request",{
   method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",
   cache:"no-store",body:JSON.stringify(payload)
  });
  let data={};try{data=await response.json();}catch{}
  if(!response.ok||data.received!==true)throw Error(data.error||"We could not accept your request. Please try again.");
  form.hidden=true;
  say("Request received! The GetEstimateFast team will review your project before sharing contact information.");
 }catch(error){say(error.message);button.disabled=false;}
});
initialize();
})();
