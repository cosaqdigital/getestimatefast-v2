(()=>{"use strict";
const el=id=>document.getElementById(id);
let token="",sessionGeneration=0,profileImagePath="";
const say=value=>{el("message").textContent=value||"";};
async function api(path,method="GET",body){
 const generation=sessionGeneration;
 const response=await fetch("/api/work/"+path,{
  method,cache:"no-store",credentials:"same-origin",
  headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined
 });
 let data={};try{data=await response.json();}catch{}
 if(generation!==sessionGeneration)throw Error("Session changed. Please sign in again.");
 if(!response.ok){
  if(response.status===401&&token){sessionGeneration++;token="";showSignedIn(false);}
  throw Error(data.error||"Request failed");
 }
 return data;
}
function showSignedIn(value){
 el("auth").hidden=value;
 el("register").hidden=value||new URLSearchParams(location.search).get("signup")!=="1";
 el("workspace").hidden=!value;
}
function option(container,value,label,checked=false){
 const row=document.createElement("label");row.className="option";
 const input=document.createElement("input");input.type="checkbox";input.value=value;input.checked=checked;
 const span=document.createElement("span");span.textContent=label;
 row.append(input,span);container.append(row);return input;
}
function values(container){return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(i=>i.value);}
function imagePreview(url){
 const holder=el("photoPreview");holder.replaceChildren();
 if(!url){const span=document.createElement("span");span.textContent="Add profile photo";holder.append(span);return;}
 const img=document.createElement("img");img.src=url;img.alt="Profile photo";holder.append(img);
}
function fillChoices(data){
 const p=data.profile||{};
 const services=el("serviceCategories");services.replaceChildren();
 for(const name of data.categories||[])option(services,name,name,(p.service_categories||[]).includes(name));
 const langs=el("languages");langs.replaceChildren();
 for(const item of data.languages||[])option(langs,item.code,item.label,(p.languages||[]).includes(item.code));
 const types=el("opportunityTypes");types.replaceChildren();
 for(const item of data.opportunity_types||[])option(types,item.code,item.label,(p.opportunity_types||[]).includes(item.code));
}
async function refreshProfile(){
 const data=await api("profile");
 fillChoices(data);
 const p=data.profile||null,form=el("profile");
 if(p){
  for(const name of ["display_name","contact_phone","base_zip","service_radius_miles","bio"]){
   const field=form.elements.namedItem(name);if(field)field.value=p[name]??"";
  }
  form.elements.namedItem("email_notifications").checked=p.email_notifications!==false;
  form.elements.namedItem("sms_opt_in").checked=p.sms_opt_in===true;
  profileImagePath=p.profile_image_path||"";
  imagePreview(data.profile_image_url||"");
  el("profileStatus").textContent=p.status==="active"?"Profile active":"Profile incomplete";
  el("saveHint").textContent=p.status==="active"?"Your profile is ready for matching opportunities.":"Complete all required fields to activate your profile.";
 }else{
  if(data.signup_defaults?.contact_phone)form.elements.namedItem("contact_phone").value=data.signup_defaults.contact_phone;
  form.elements.namedItem("sms_opt_in").checked=data.signup_defaults?.sms_opt_in===true;
  profileImagePath="";imagePreview("");
  el("profileStatus").textContent="Profile incomplete";
 }
 el("legalConsent").hidden=data.legal_consent_recorded===true;
 if(data.capabilities?.profile_editing_enabled===false){
  for(const control of form.elements)control.disabled=true;
  el("uploadPhoto").disabled=true;
  say("Work profile editing is not open in this environment.");
 }
 return data;
}
el("login").addEventListener("submit",async event=>{
 event.preventDefault();say("Signing in...");
 try{
  const f=new FormData(event.currentTarget);
  const data=await api("login","POST",{email:f.get("email"),password:f.get("password")});
  token=data.access_token;event.currentTarget.elements.password.value="";
  showSignedIn(true);await refreshProfile();
  document.querySelector('[data-panel="profilePanel"]').click();
  say("Signed in.");
 }catch(e){say(e.message);}
});
el("signup").addEventListener("submit",async event=>{
 event.preventDefault();say("Creating account...");
 try{
  const f=new FormData(event.currentTarget);
  const data=await api("signup","POST",{
   email:f.get("email"),phone:f.get("phone"),password:f.get("password"),
   privacyConsent:f.get("privacyConsent")==="on",
   termsConsent:f.get("termsConsent")==="on",
   smsOptIn:f.get("smsOptIn")==="on"
  });
  say(data.message||"Check your email to confirm your account.");
 }catch(e){say(e.message);}
});
el("uploadPhoto").addEventListener("click",async()=>{
 const file=el("profilePhoto").files?.[0];
 if(!file){say("Choose a profile photo first.");return;}
 if(!el("photoPermission").checked){say("Confirm that you have permission to publish this image.");return;}
 if(file.size>3000000){say("Profile photo must be 3 MB or smaller.");return;}
 say("Uploading profile photo...");
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("Could not read the photo."));reader.onload=()=>resolve(String(reader.result||""));reader.readAsDataURL(file);});
  const comma=dataUrl.indexOf(",");if(comma<0)throw Error("Invalid photo.");
  const result=await api("profile-image","POST",{rightsConsent:true,data:dataUrl.slice(comma+1)});
  profileImagePath=result.image_path;imagePreview(result.public_url);say("Profile photo uploaded. Save your profile to continue.");
 }catch(e){say(e.message);}
});
el("profile").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,f=new FormData(form);
 const payload={
  display_name:f.get("display_name"),
  contact_phone:f.get("contact_phone"),
  base_zip:f.get("base_zip"),
  service_radius_miles:Number(f.get("service_radius_miles")),
  service_categories:values(el("serviceCategories")),
  languages:values(el("languages")),
  opportunity_types:values(el("opportunityTypes")),
  bio:f.get("bio"),
  profile_image_path:profileImagePath,
  email_notifications:f.get("email_notifications")==="on",
  sms_opt_in:f.get("sms_opt_in")==="on"
 };
 if(!el("legalConsent").hidden){
  payload.privacyConsent=f.get("privacyConsent")==="on";
  payload.termsConsent=f.get("termsConsent")==="on";
 }
 say("Saving work profile...");
 try{
  const result=await api("profile","POST",payload);
  say(result.status==="active"?"Work profile saved and active.":"Work profile saved.");
  await refreshProfile();
 }catch(e){say(e.message);}
});
for(const button of document.querySelectorAll(".nav button[data-panel]")){
 button.addEventListener("click",()=>{
  for(const other of document.querySelectorAll(".nav button[data-panel]"))other.classList.toggle("active",other===button);
  for(const panel of document.querySelectorAll(".panel"))panel.hidden=panel.id!==button.dataset.panel;
 });
}
el("logout").addEventListener("click",()=>{
 sessionGeneration++;token="";profileImagePath="";el("profile").reset();imagePreview("");showSignedIn(false);say("Signed out.");
});
showSignedIn(false);
})();