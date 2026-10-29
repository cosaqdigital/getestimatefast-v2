(()=>{"use strict";
const $=id=>document.getElementById(id);
const portal=()=>window.GetEstimateFastPortal;
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const typeLabel=value=>value==="helper"?"Helper":"Professional";
const basisLabel=value=>value==="hour"?"/ hour":value==="fixed"?" fixed":"/ day";
const languageNames={en:"English",pt:"Portuguese",es:"Spanish"};
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
function renderNotifications(data){
 const holder=$("workNotifications");if(!holder)return;
 holder.replaceChildren();
 const items=data?.notifications||[];
 if(!items.length){const empty=document.createElement("div");empty.className="work-post-empty";empty.textContent="No candidate notifications yet.";holder.append(empty);return;}
 for(const item of items){
  const row=document.createElement("article");row.className="work-notification";row.dataset.unread=item.read_at?"false":"true";
  const copy=document.createElement("div");
  const strong=document.createElement("strong");strong.textContent=item.actor_name+" is interested in your opportunity";
  const small=document.createElement("span");small.textContent=new Date(item.created_at).toLocaleString();
  copy.append(strong,small);
  const button=document.createElement("button");button.type="button";button.className="secondary";button.textContent="View applicant";
  button.addEventListener("click",async()=>{
   try{if(!item.read_at)await portal().api("work-notifications","POST",{notification_id:item.id});}catch{}
   const card=document.querySelector('[data-work-opportunity-id="'+CSS.escape(item.opportunity_id)+'"]');
   const target=card?.querySelector(".work-applicants");
   const toggle=card?.querySelector(".work-candidate-button");
   if(target&&toggle)await loadApplicants(item.opportunity_id,target,toggle);
   card?.scrollIntoView({behavior:"smooth",block:"center"});
   row.dataset.unread="false";
  });
  row.append(copy,button);holder.append(row);
 }
}
function applicantCard(item){
 const p=item.profile;
 const card=document.createElement("article");card.className="work-applicant-card";
 if(p.profile_image_url){
  const img=document.createElement("img");img.className="work-applicant-photo";img.src=p.profile_image_url;img.alt=p.display_name;img.loading="lazy";card.append(img);
 }else{
  const img=document.createElement("div");img.className="work-applicant-photo";card.append(img);
 }
 const main=document.createElement("div");
 const name=document.createElement("div");name.className="work-applicant-name";name.textContent=p.display_name;
 const meta=document.createElement("div");meta.className="work-applicant-meta";meta.textContent="ZIP "+p.base_zip+" · "+p.service_radius_miles+" mi radius · "+(p.languages||[]).map(v=>languageNames[v]||v).join(", ");
 const services=document.createElement("div");services.className="work-applicant-meta";services.textContent=(p.service_categories||[]).join(" · ");
 const bio=document.createElement("p");bio.className="work-applicant-bio";bio.textContent=p.bio;
 main.append(name,meta,services,bio);
 const contact=document.createElement("div");contact.className="work-applicant-contact";
 const phone=document.createElement("a");phone.href="tel:"+String(p.contact_phone).replace(/[^0-9+]/g,"");phone.textContent=p.contact_phone;
 const status=document.createElement("span");status.textContent="Application: "+String(item.status||"interested").replaceAll("_"," ");
 contact.append(phone,status);
 if(item.status==="interested"){
  const select=document.createElement("button");select.type="button";select.textContent="Select Worker";
  select.addEventListener("click",async()=>{
   if(!window.confirm("Select "+p.display_name+" for this opportunity?"))return;
   select.disabled=true;select.textContent="Selecting...";
   try{
    const result=await portal().api("work-selection","POST",{application_id:item.id});
    portal().say(result.filled?"Worker selected. All positions are now filled and the opportunity is closed.":"Worker selected. The opportunity still has an open position.");
    await load(true);
   }catch(e){select.disabled=false;select.textContent="Select Worker";portal().say(e.message||"Could not select this worker.");}
  });
  contact.append(select);
 }else if(item.status==="selected"){
  const badge=document.createElement("strong");badge.textContent="✓ Selected";badge.className="work-selected-badge";contact.append(badge);
 }else if(item.status==="declined"){
  const closed=document.createElement("strong");closed.textContent="Opportunity filled";closed.className="work-closed-badge";contact.append(closed);
 }
 card.append(main,contact);return card;
}
async function loadApplicants(opportunityId,holder,button){
 button.disabled=true;button.textContent="Loading candidates...";
 try{
  const data=await portal().api("work-applicants?opportunity_id="+encodeURIComponent(opportunityId));
  holder.hidden=false;holder.replaceChildren();
  const title=document.createElement("strong");title.textContent=(data.applicants?.length||0)+" "+((data.applicants?.length||0)===1?"candidate":"candidates");holder.append(title);
  const list=document.createElement("div");list.className="work-applicant-list";
  if(!data.applicants?.length){const empty=document.createElement("div");empty.className="work-post-empty";empty.textContent="No active candidate profiles available.";list.append(empty);}
  else for(const item of data.applicants)list.append(applicantCard(item));
  holder.append(list);
  button.textContent="Hide candidates";
  button.disabled=false;
  button.onclick=()=>{holder.hidden=true;button.textContent="View candidates ("+(data.applicants?.length||0)+")";button.onclick=()=>loadApplicants(opportunityId,holder,button);};
 }catch(e){button.disabled=false;button.textContent="View candidates";portal().say(e.message);}
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
  const side=document.createElement("div");
  const state=document.createElement("div");state.className="work-post-status";state.textContent=String(item.status||"").replaceAll("_"," ");
  side.append(state);
  const button=document.createElement("button");button.type="button";button.className="secondary work-candidate-button";button.textContent="View candidates ("+item.contacts_used+")";
  const applicants=document.createElement("div");applicants.className="work-applicants";applicants.hidden=true;
  button.onclick=()=>loadApplicants(item.id,applicants,button);
  side.append(button);
  card.dataset.workOpportunityId=item.id;
  card.append(main,side,applicants);holder.append(card);
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
  try{renderNotifications(await portal().api("work-notifications"));}catch{renderNotifications({notifications:[]});}
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
window.addEventListener("gef-signed-out",()=>{lastData=null;$("workMyPosts")?.replaceChildren();$("workNotifications")?.replaceChildren();});
window.GetEstimateFastWorkPoster={load};
})();