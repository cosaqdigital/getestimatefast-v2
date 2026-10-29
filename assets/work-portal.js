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
const languageNames={en:"English",pt:"Portuguese",es:"Spanish"};
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const payLabel=basis=>basis==="hour"?"/hour":basis==="fixed"?" fixed":"/day";
function empty(holder,title,text){
 holder.replaceChildren();
 const box=document.createElement("div");box.className="placeholder";
 const strong=document.createElement("strong");strong.textContent=title;
 const p=document.createElement("p");p.textContent=text;
 box.append(strong,p);holder.append(box);
}
function workMeta(item){
 const values=[
  "⌖ "+item.city+", FL "+item.zip_code,
  item.distance_miles+" mi away",
  item.work_date+(item.start_time?" · "+String(item.start_time).slice(0,5):""),
  money(item.pay_cents)+payLabel(item.pay_basis),
  item.workers_needed+" "+(item.workers_needed===1?"person":"people")+" needed",
  item.contacts_remaining+" candidate "+(item.contacts_remaining===1?"spot":"spots")+" left"
 ];
 return values;
}
function renderWorkFeed(data){
 const holder=el("workFeed"),items=data.opportunities||[];
 el("feedSummary").textContent=items.length?items.length+" matching "+(items.length===1?"opportunity":"opportunities")+" near your work area":"No matching opportunities right now.";
 holder.replaceChildren();
 if(!items.length){empty(holder,"No matching work right now","When a local professional posts something that matches your profile, it will appear here.");return;}
 for(const item of items){
  const card=document.createElement("article");card.className="work-card";
  const head=document.createElement("div");head.className="work-card-head";
  const title=document.createElement("h3");title.textContent=(item.opportunity_type==="helper"?"Helper":"Professional")+" · "+item.service_category;
  const badge=document.createElement("span");badge.className="work-badge";badge.textContent=item.task_label||"Work opportunity";
  head.append(title,badge);
  const meta=document.createElement("div");meta.className="work-meta";
  for(const value of workMeta(item)){const span=document.createElement("span");span.textContent=value;meta.append(span);}
  const description=document.createElement("p");description.className="work-description";description.textContent=item.description;
  const languages=document.createElement("p");languages.className="muted";languages.textContent="Languages: "+(item.languages||[]).map(v=>languageNames[v]||v).join(", ");
  const poster=document.createElement("div");poster.className="work-poster";
  const who=document.createElement("div");const strong=document.createElement("strong");strong.textContent=item.poster.display_name;const small=document.createElement("div");small.className="muted";small.textContent=item.poster.headline||"GetEstimateFast professional";who.append(strong,small);
  const profile=document.createElement("a");profile.href=item.poster.profile_path;profile.target="_blank";profile.rel="noopener";profile.textContent="View company profile";
  poster.append(who,profile);
  const actions=document.createElement("div");actions.className="work-actions";
  if(item.application){
   const applied=document.createElement("span");applied.className="work-applied";applied.textContent="✓ Applied · "+String(item.application.status||"interested").replaceAll("_"," ");actions.append(applied);
  }else{
   const apply=document.createElement("button");apply.type="button";apply.textContent="I'm Interested";
   apply.addEventListener("click",async()=>{
    apply.disabled=true;say("Submitting your interest...");
    try{
     const result=await api("applications","POST",{opportunity_id:item.id,operation_key:"work-apply-"+crypto.randomUUID()});
     say(result.already_applied?"You already applied to this opportunity.":"Your interest was sent. The professional can now review your work profile.");
     await Promise.all([loadWorkFeed(),loadApplications()]);
    }catch(e){apply.disabled=false;say(e.message);}
   });
   actions.append(apply);
  }
  card.append(head,meta,description,languages,poster,actions);holder.append(card);
 }
}
async function loadWorkFeed(){
 try{const data=await api("opportunities");renderWorkFeed(data);return data;}
 catch(e){
  if(e.message.includes("Complete your Find Work profile"))empty(el("workFeed"),"Complete your profile first","Add your photo, services, ZIP, work radius and languages before viewing matching work.");
  el("feedSummary").textContent="Work feed unavailable.";throw e;
 }
}
function renderApplications(data){
 const holder=el("applicationList"),items=data.applications||[];holder.replaceChildren();
 if(!items.length){empty(holder,"No applications yet","When you click “I'm Interested,” your applications will appear here.");return;}
 for(const item of items){
  const op=item.opportunity;
  const card=document.createElement("article");card.className="application-card";
  const title=document.createElement("h3");title.textContent=op?(op.service_category+" · "+(op.city||op.zip_code)):"Opportunity";
  const state=document.createElement("div");state.className="application-status";
  if(item.status==="selected"){
   state.textContent="✓ Selected";
   state.style.color="#287408";
  }else if(item.status==="declined"){
   state.textContent="Opportunity filled";
   state.style.color="#8a5b0d";
  }else{
   state.textContent=String(item.status||"interested").replaceAll("_"," ");
  }
  card.append(title,state);
  if(op){
   const p=document.createElement("p");p.textContent=(op.work_date||"")+" · "+money(op.pay_cents)+payLabel(op.pay_basis);card.append(p);
   if(op.poster){
    const who=document.createElement("p");who.className="muted";who.textContent="Posted by "+op.poster.display_name;card.append(who);
    const profile=document.createElement("a");profile.href=op.poster.profile_path;profile.target="_blank";profile.rel="noopener";profile.textContent="View company profile";card.append(profile);
   }
   if(item.status==="selected"){
    const selected=document.createElement("p");selected.className="work-applied";selected.textContent="The professional selected you for this opportunity and can contact you using your work profile phone.";card.append(selected);
   }else if(item.status==="declined"){
    const closed=document.createElement("p");closed.className="muted";closed.textContent="This opportunity has been filled and is no longer accepting candidates.";card.append(closed);
   }
  }
  holder.append(card);
 }
}
async function loadApplications(){const data=await api("applications");renderApplications(data);return data;}

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
async function enterGoogleSession(){
 say("Completing Google sign-in...");
 const session=await api("google-session");
 if(!session?.access_token)throw Error("Google sign-in could not be completed.");
 token=session.access_token;
 showSignedIn(true);
 const profileState=await refreshProfile();
 const active=profileState?.profile?.status==="active";
 document.querySelector('[data-panel="'+(active?"findPanel":"profilePanel")+'"]').click();
 if(active)await Promise.all([loadWorkFeed(),loadApplications()]);
 say(active?"Signed in with Google. Matching opportunities are ready.":"Signed in with Google. Complete your Find Work profile to continue.");
}
async function startGoogle(){
 say("Opening Google sign-in...");
 try{
  const result=await api("google-start","POST",{});
  if(!result?.redirect)throw Error("Google sign-in could not be started.");
  location.assign(result.redirect);
 }catch(e){say(e.message||"Google sign-in could not be started.");}
}
async function resumeGoogle(){
 const state=new URLSearchParams(location.search).get("google");
 if(!state)return;
 try{history.replaceState(null,"",location.pathname+location.hash);}catch{}
 if(state!=="success"){
  say("Google sign-in was canceled or could not be completed.");
  return;
 }
 try{await enterGoogleSession();}catch(e){say(e.message||"Google sign-in could not be completed.");}
}

el("login").addEventListener("submit",async event=>{
 event.preventDefault();say("Signing in...");
 try{
  const f=new FormData(event.currentTarget);
  const data=await api("login","POST",{email:f.get("email"),password:f.get("password")});
  token=data.access_token;event.currentTarget.elements.password.value="";
  showSignedIn(true);const profileState=await refreshProfile();
  const active=profileState?.profile?.status==="active";
  document.querySelector('[data-panel="'+(active?"findPanel":"profilePanel")+'"]').click();
  if(active)await Promise.all([loadWorkFeed(),loadApplications()]);
  say(active?"Signed in. Matching opportunities are ready.":"Signed in. Complete your Find Work profile to continue.");
 }catch(e){say(e.message);}
});
el("googleLogin")?.addEventListener("click",startGoogle);
el("googleSignup")?.addEventListener("click",startGoogle);

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
  if(result.status==="active"){
   document.querySelector('[data-panel="findPanel"]').click();
   await Promise.all([loadWorkFeed(),loadApplications()]);
  }
 }catch(e){say(e.message);}
});
for(const button of document.querySelectorAll(".nav button[data-panel]")){
 button.addEventListener("click",()=>{
  for(const other of document.querySelectorAll(".nav button[data-panel]"))other.classList.toggle("active",other===button);
  for(const panel of document.querySelectorAll(".panel"))panel.hidden=panel.id!==button.dataset.panel;
  if(button.dataset.panel==="findPanel")loadWorkFeed().catch(e=>say(e.message));
  if(button.dataset.panel==="applicationsPanel")loadApplications().catch(e=>say(e.message));
 });
}
el("refreshWorkFeed").addEventListener("click",()=>loadWorkFeed().catch(e=>say(e.message)));
el("logout").addEventListener("click",()=>{
 fetch("/api/work/google-logout",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"}).catch(()=>{});
 sessionGeneration++;token="";profileImagePath="";el("profile").reset();imagePreview("");showSignedIn(false);say("Signed out.");
});
showSignedIn(false);
resumeGoogle();
})();