(()=>{"use strict";
const $=id=>document.getElementById(id);
const portal=()=>window.GetEstimateFastPortal;
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const typeLabel=value=>value==="helper"?"Helper":"Professional";
const basisLabel=value=>value==="hour"?"/ hour":value==="fixed"?" fixed":"/ day";
let loading=null,lastData=null;

function eligibilityMessage(summary){
 const code=summary?.eligibility_code;
 if(code==="eligible")return "Your professional profile is ready to post work opportunities.";
 if(code==="public_profile_required")return "Publish your professional public profile before posting. Candidates need to be able to review who is offering the opportunity.";
 if(code==="professional_profile_incomplete")return "Complete your professional account details before posting work opportunities.";
 if(code==="account_inactive")return "An active professional account is required before you can post work opportunities.";
 return "Complete your professional profile before posting.";
}
function renderPackages(packages){
 const holder=$("workPostPackages");if(!holder)return;
 holder.replaceChildren();
 for(const pkg of packages||[]){
  const card=document.createElement("article");card.className="work-post-package";
  const title=document.createElement("strong");title.textContent="+"+pkg.posts+" extra posts";
  const price=document.createElement("span");price.textContent=money(pkg.amount_cents)+" · credits do not expire";
  const button=document.createElement("button");button.type="button";button.className="secondary";button.disabled=true;button.textContent="Purchase connection coming next";
  card.append(title,price,button);holder.append(card);
 }
}
function renderQuota(summary){
 $("workFreePosts").textContent=(summary?.free_remaining??0)+" of "+(summary?.free_limit??4);
 $("workFreeUsed").textContent=String(summary?.free_used??0);
 $("workExtraPosts").textContent=String(summary?.purchased_remaining??0);
 const box=$("workPostEligibility");box.dataset.ok=summary?.eligible===true?"true":"false";box.textContent=eligibilityMessage(summary);
 const form=$("workPostForm");
 for(const control of form.elements)control.disabled=summary?.eligible!==true;
 $("workPostSubmit").disabled=summary?.eligible!==true;
 const action=$("workPostEligibilityAction");
 action.replaceChildren();
 if(summary?.eligibility_code==="public_profile_required"){
  const a=document.createElement("a");a.href="#publicProfilePanel";a.className="button secondary";a.textContent="Complete / publish public profile";action.append(a);
 }else if(summary?.eligibility_code==="professional_profile_incomplete"){
  const a=document.createElement("a");a.href="#accountSettingsPanel";a.className="button secondary";a.textContent="Complete professional profile";action.append(a);
 }
 renderPackages(summary?.packages||[]);
}
function renderCategories(categories){
 const select=$("workServiceCategory"),current=select.value;
 select.replaceChildren();
 const first=document.createElement("option");first.value="";first.textContent="Choose a service";select.append(first);
 for(const name of categories||[]){const option=document.createElement("option");option.value=name;option.textContent=name;select.append(option);}
 if(categories?.includes(current))select.value=current;
}
function renderPosts(items){
 const holder=$("workMyPosts");holder.replaceChildren();
 if(!items?.length){const empty=document.createElement("div");empty.className="work-post-empty";empty.textContent="No work opportunities posted yet.";holder.append(empty);return;}
 for(const item of items){
  const card=document.createElement("article");card.className="work-post-card";
  const main=document.createElement("div");
  const h=document.createElement("h4");h.textContent=typeLabel(item.opportunity_type)+" · "+item.service_category;
  const line=document.createElement("p");line.textContent=item.zip_code+" · "+item.work_date+(item.start_time?" · "+String(item.start_time).slice(0,5):"")+" · "+money(item.pay_cents)+" "+basisLabel(item.pay_basis);
  const counts=document.createElement("p");counts.textContent=item.positions_filled+" / "+item.workers_needed+" positions filled · "+item.contacts_used+" / "+item.max_contacts+" candidates";
  const source=document.createElement("span");source.className="work-post-source";source.textContent=item.posting_source==="monthly_free"?"Monthly free post":"Extra post credit";
  main.append(h,line,counts,source);
  const state=document.createElement("div");state.className="work-post-status";state.textContent=String(item.status||"").replaceAll("_"," ");
  card.append(main,state);holder.append(card);
 }
}
function defaultDate(){
 const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
async function load(force=false){
 if(loading&&!force)return loading;
 loading=(async()=>{
  const data=await portal().api("work-opportunities");
  lastData=data;
  renderQuota(data.summary||{});
  renderCategories(data.categories||[]);
  renderPosts(data.opportunities||[]);
  const zip=$("workZip");if(!zip.value)zip.value=data.defaults?.zip_code||"";
  const date=$("workDate");date.min=defaultDate();if(!date.value)date.value=defaultDate();
  return data;
 })();
 try{return await loading;}finally{loading=null;}
}
function selectedLanguages(){
 return [...document.querySelectorAll('input[name="work_languages"]:checked')].map(x=>x.value);
}
$("workWorkersNeeded")?.addEventListener("input",()=>{
 const workers=Number($("workWorkersNeeded").value||1),contacts=$("workMaxContacts");
 contacts.min=String(Math.max(1,workers));
 if(Number(contacts.value)<workers)contacts.value=String(workers);
});
$("workPostForm")?.addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,fd=new FormData(form);
 const workers=Number(fd.get("workers_needed")),maxContacts=Number(fd.get("max_contacts"));
 if(maxContacts<workers){portal().say("Maximum candidates must be at least the number of workers needed.");return;}
 const languages=selectedLanguages();
 if(!languages.length){portal().say("Choose at least one accepted language.");return;}
 const payload={
  operation_key:"work-post-"+crypto.randomUUID(),
  opportunity_type:fd.get("opportunity_type"),
  service_category:fd.get("service_category"),
  task_label:fd.get("task_label"),
  zip_code:fd.get("zip_code"),
  description:fd.get("description"),
  pay_amount:fd.get("pay_amount"),
  pay_basis:fd.get("pay_basis"),
  work_date:fd.get("work_date"),
  start_time:fd.get("start_time"),
  workers_needed:workers,
  max_contacts:maxContacts,
  languages
 };
 $("workPostSubmit").disabled=true;portal().say("Publishing work opportunity...");
 try{
  const result=await portal().api("work-opportunities","POST",payload);
  portal().say(result.posting_source==="monthly_free"?"Opportunity published using your monthly free allowance.":"Opportunity published using 1 extra post credit.");
  const keepZip=payload.zip_code;
  form.reset();$("workZip").value=keepZip;$("workWorkersNeeded").value="1";$("workMaxContacts").value="3";$("workDate").value=defaultDate();
  await load(true);
 }catch(error){
  portal().say(error.message||"Could not publish this opportunity.");
  try{await load(true);}catch{}
 }finally{$("workPostSubmit").disabled=lastData?.summary?.eligible!==true;}
});
window.addEventListener("gef-profile",()=>{load(true).catch(()=>{});});
window.addEventListener("gef-signed-out",()=>{lastData=null;$("workMyPosts")?.replaceChildren();});
window.GetEstimateFastWorkPoster={load};
})();