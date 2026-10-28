(()=>{
"use strict";
const $=id=>document.getElementById(id), workspace=$("workspace"), nav=workspace?.querySelector(".portal-nav"), form=$("profile"), publicForm=$("publicProfileForm");
if(!workspace||!nav||!form||!publicForm)return;
document.body.classList.add("pro-simple");
const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n;};
// Split existing validated form without changing any API fields.
const settings=make("section",undefined,"pro-settings");settings.id="accountSettingsPanel";
settings.append(make("h2","My business details"),make("p","Just your business, services and work area. Private contacts are not published automatically.","pro-explain"));
const status=$("accountStatus");if(status)settings.append(status);
const basic=form.querySelector(":scope > .columns"),cells=basic?[...basic.children]:[];
if(cells.length!==8)return;
const step1=make("fieldset",undefined,"pro-step"),step2=make("fieldset",undefined,"pro-step");
step1.append(make("legend","Step 1 of 2 — About your business"));step2.append(make("legend","Step 2 of 2 — Services and area"));
const a=make("div",undefined,"pro-grid"),b=make("div",undefined,"pro-grid");
cells.slice(0,3).forEach(x=>a.append(x));cells.slice(3).forEach(x=>b.append(x));
const bio=form.querySelector('textarea[name="bio"]')?.closest("label");if(bio)a.append(bio);
step1.append(a);step2.append(b);
[...form.children].filter(x=>x.tagName==="LABEL"&&x.classList.contains("check")).forEach(x=>step2.append(x));
basic.remove();
const save=$("saveProfile");save.textContent="Save business profile";save.parentElement?.removeChild(save);
const controls=make("div",undefined,"pro-controls");
const back=make("button","Back","secondary"),next=make("button","Continue to services →"),count=make("small","Step 1 of 2");
back.type="button";next.type="button";controls.append(count,back,next,save);
form.append(step1,step2,controls);settings.append(form);
const sms=$("smsPreferences");if(sms){const extra=make("details",undefined,"pro-optional");extra.append(make("summary","Optional SMS alerts"),sms);step2.append(extra);}
workspace.append(settings);
let step=1;
function selectStep(number){
 step=number===2?2:1;step1.hidden=step!==1;step2.hidden=step!==2;step2.disabled=step!==2;
 back.hidden=step===1;next.hidden=step===2;save.hidden=step!==2;count.textContent="Step "+step+" of 2";
}
selectStep(1);
next.onclick=()=>{for(const field of step1.querySelectorAll("input[required],textarea[required]"))if(!field.reportValidity())return;selectStep(2);};
back.onclick=()=>selectStep(1);
form.addEventListener("submit",e=>{if(step===1){e.preventDefault();e.stopImmediatePropagation();next.click();}},true);
// Progressive enhancement: accessible checkbox categories, retaining original native select for FormData.
function categoryPicker(id,fieldId){
 const select=$(id),label=select?.closest("label");if(!select||!label)return ()=>{};
 const box=make("fieldset",undefined,"pro-category-box");box.id=fieldId;box.append(make("legend","Choose the services you offer"));
 label.insertAdjacentElement("afterend",box);label.classList.add("pro-visually-hidden");
 select.classList.add("pro-visually-hidden");
 const draw=()=>{
  box.querySelectorAll(".pro-category").forEach(x=>x.remove());
  for(const opt of [...select.options]){
   if(!opt.value)continue;
   const choice=make("label",undefined,"pro-category"),input=document.createElement("input");
   input.type="checkbox";input.checked=opt.selected;
   input.onchange=()=>{opt.selected=input.checked;if([...select.selectedOptions].length>12){opt.selected=false;input.checked=false;}choice.classList.toggle("selected",input.checked);};
   choice.classList.toggle("selected",input.checked);
   choice.append(input,make("span",opt.textContent));box.append(choice);
  }
 };
 return draw;
}
const drawServices=categoryPicker("categories","proServiceChoices"),drawPublic=categoryPicker("publicCategories","proPublicChoices");
const referrals=make("section",undefined,"pro-referrals");referrals.id="myReferralsPanel";
referrals.append(make("h2","Direct Leads"),
 make("p","Customers who contact you directly through your public GetEstimateFast profile appear here. These leads do not require a contact purchase or wallet credits."));
const referralReload=make("button","Refresh direct leads","secondary");referralReload.type="button";
const referralList=make("div",undefined,"pro-referral-cards");
referrals.append(referralReload,referralList);workspace.append(referrals);
async function showReferrals(){
 if(capabilities?.marketplace_enabled===false){referralList.replaceChildren(make("p","Direct Leads are not available yet."));return;}
 referralList.replaceChildren(make("p","Loading direct leads..."));
 try{
  const result=await window.GetEstimateFastPortal.api("origin-leads");
  referralList.replaceChildren();
  if($("proQuickDirect"))$("proQuickDirect").textContent=String(result.leads?.length||0);
  if(!result.leads?.length){referralList.append(make("p","No direct leads yet. Share your public profile to invite customers to contact you directly."));return;}
  for(const lead of result.leads){
   const card=make("article",undefined,"pro-referral-card");
   card.append(make("h3",lead.service_type+" · "+lead.city+", "+lead.zip_code));
   card.append(make("p","Status: "+(lead.contact_available?"Approved · Contact ready":lead.status==="new"?"Waiting for GetEstimateFast review":lead.status==="qualified"?"Approved · Awaiting publication":"Not currently available")));
   if(lead.contact_available && lead.customer){
    card.append(make("p","Direct lead — no contact purchase required. $0.00 charged."));
    const details=make("div",undefined,"pro-referral-contact");
    details.append(make("p","Customer: "+lead.customer.name),make("p","Phone: "+lead.customer.phone),make("p","Email: "+lead.customer.email));
    card.append(details);
   }else card.append(make("p","Customer contact is private until the request has been approved and published."));
   referralList.append(card);
  }
 }catch(e){referralList.replaceChildren(make("p",e?.message||"Could not load your direct leads."));}
}
referralReload.addEventListener("click",()=>showReferrals());

// Reuse every existing module, showing one section at a time.
const views={contractorDashboard:$("contractorDashboard"),opportunityPanel:$("opportunityPanel"),myReferralsPanel:referrals,publicProfilePanel:$("publicProfilePanel"),profilePreviewPanel:$("profilePreviewPanel"),accountSettingsPanel:settings,walletPanel:$("walletPanel"),purchasePanel:$("purchasePanel")};
nav.replaceChildren();
for(const [id,label] of [["contractorDashboard","Home"],["opportunityPanel","Opportunities"],["myReferralsPanel","Direct Leads"],["publicProfilePanel","Public profile"],["profilePreviewPanel","Profile preview"],["accountSettingsPanel","My details"],["walletPanel","Wallet"],["purchasePanel","Purchase history"]]){
 const link=make("a",label);link.href="#"+id;link.dataset.screen=id;nav.append(link);
}
nav.classList.add("pro-navigation");
const commercialScreens=new Set(["opportunityPanel","myReferralsPanel","publicProfilePanel","profilePreviewPanel","walletPanel","purchasePanel"]);
function syncNavigationAvailability(){
 const closed=capabilities?.marketplace_enabled===false;
 for(const link of nav.querySelectorAll("a[data-screen]")){
  const locked=closed&&commercialScreens.has(link.dataset.screen);
  link.dataset.coming=locked?"true":"false";
  link.setAttribute("aria-disabled",locked?"true":"false");
  let badge=link.querySelector(".pro-nav-badge");
  if(locked){
   link.title="Coming soon";
   if(!badge){badge=make("span","Coming soon","pro-nav-badge");link.append(badge);}
  }else{
   link.removeAttribute("title");
   badge?.remove();
  }
 }
}
const welcome=make("section",undefined,"pro-account-overview");
const welcomeCopy=make("div",undefined,"pro-account-copy");
const welcomeTitle=make("strong","My GetEstimateFast");welcomeTitle.id="proBusinessWelcome";
const welcomeMeta=make("p","Professional account · Get ready for local service opportunities.");welcomeMeta.id="proBusinessMeta";
const accountBadge=make("span","Account Active","pro-account-badge");accountBadge.id="proAccountBadge";
welcomeCopy.append(welcomeTitle,welcomeMeta,accountBadge);
const quickStats=make("div",undefined,"pro-quick-stats");
const quickStat=(label,value,id,href)=>{const a=make("a",undefined,"pro-quick-stat");a.href=href;const strong=make("strong",value);strong.id=id;a.append(strong,make("span",label));return a;};
quickStats.append(
 quickStat("Opportunities","0","proQuickOpportunities","#opportunityPanel"),
 quickStat("Direct Leads","0","proQuickDirect","#myReferralsPanel"),
 quickStat("Wallet","$0.00","proQuickWallet","#walletPanel")
);
welcome.append(welcomeCopy,quickStats);
workspace.prepend(welcome);
// Remove legacy shell copy from the signed-in workspace; the redesigned dashboard and My details panel replace it.
for(const legacy of [...workspace.children].filter(x=>x.matches("h1,p")&&!x.id))legacy.hidden=true;
for(const id of ["walletBalance","purchaseCount"]){const card=$(id)?.closest(".metric");if(card)card.hidden=true;}
const dash=views.contractorDashboard;
const oldButtons=dash.querySelector(":scope > .actions");if(oldButtons)oldButtons.hidden=true;
const oldHeadline=dash.querySelector(":scope > h1");if(oldHeadline)oldHeadline.hidden=true;
const oldEyebrow=dash.querySelector(":scope > .eyebrow");if(oldEyebrow)oldEyebrow.hidden=true;
for(const legacy of [...dash.children].filter(x=>x.tagName==="P"&&!x.id))legacy.hidden=true;
const oldMetrics=dash.querySelector(":scope > .metric-grid");if(oldMetrics)oldMetrics.hidden=true;

const linkTo=(id,label,cls="pro-action secondary")=>{const a=make("a",label,cls);a.href="#"+id;return a;};
const hero=make("section",undefined,"pro-hero");
const heroCopy=make("div",undefined,"pro-hero-copy");
heroCopy.append(make("p","WELCOME TO GETESTIMATEFAST","pro-eyebrow"),make("h1","Get More Local Service Leads"),make("p","Build your professional profile, set your service area and access relevant local home-service opportunities — all from one place.","pro-hero-text"));
const heroActions=make("div",undefined,"pro-hero-actions");
heroActions.append(linkTo("accountSettingsPanel","Complete My Business Profile","pro-action primary"),linkTo("accountSettingsPanel","Set My Service Area"),linkTo("accountSettingsPanel","Review My Details"));
heroCopy.append(heroActions);
const heroAside=make("aside",undefined,"pro-hero-aside");
heroAside.append(make("strong","Be ready for local work"),make("p","✓ Showcase your services"),make("p","✓ Set your ZIP Code and service radius"),make("p","✓ Securely unlock customer contacts when you choose an opportunity"));
hero.append(heroCopy,heroAside);

const summary=make("div",undefined,"pro-summary-grid");
const summaryCard=(label,value,id,help)=>{const card=make("article",undefined,"pro-summary-card");card.append(make("span",label,"pro-summary-label"));const strong=make("strong",value);strong.id=id;card.append(strong,make("small",help));return card;};
summary.append(
 summaryCard("Profile completion","—","proCompletionValue","Complete your information to get ready for local opportunities."),
 summaryCard("Service area","—","proServiceAreaValue","Set your ZIP Code and service radius."),
 summaryCard("Account status","—","proAccountValue","Your professional account status."),
 summaryCard("Local opportunities","0","proOpportunityValue","Marketplace opportunities appear based on your services, location and availability."),
 summaryCard("Public profile","Not published","proPublicValue","Manage your public profile and sharing settings.")
);

const readiness=make("div",undefined,"pro-readiness-layout");
const checklist=make("section",undefined,"pro-checklist-card");
const checklistHead=make("div",undefined,"pro-section-head");checklistHead.append(make("div",undefined,"pro-section-title"),make("span","0% complete","pro-progress-label"));
checklistHead.firstChild.append(make("h2","Complete Your Contractor Profile"),make("p","A complete contractor profile helps homeowners understand your services and helps GetEstimateFast match you with relevant local projects."));
const progress=make("div",undefined,"pro-progress");progress.append(make("span"));checklist.append(checklistHead,progress);
const list=make("div",undefined,"pro-checklist");
const checklistItems=[
 ["business","Business name","Add your professional or business name"],
 ["services","Services","Choose the services you provide"],
 ["area","Service area","Add your ZIP Code and service radius"],
 ["phone","Phone number","Add a contact phone number"],
 ["about","About your business","Tell customers about your experience"],
 ["photos","Service photos","Add work photos when profile publishing opens"]
];
for(const [key,title,help] of checklistItems){const row=linkTo("accountSettingsPanel","", "pro-check-row");row.dataset.check=key;const mark=make("span","○","pro-check-mark");const text=make("span");text.append(make("strong",title),make("small",help));row.append(mark,text,make("span","›","pro-check-arrow"));list.append(row);}
checklist.append(list);

const why=make("aside",undefined,"pro-why");
why.append(make("h2","Why this matters"),make("p","Accurate business information helps GetEstimateFast match you with relevant local opportunities."));
const benefit=(title,text,cls)=>{const card=make("article",undefined,"pro-benefit "+cls);card.append(make("strong",title),make("p",text));return card;};
why.append(
 benefit("Appear ready for local service leads","Keep your profile complete so your business can match with relevant projects in your area.","warm"),
 benefit("Build trust with homeowners","Clear service details and accurate information help customers understand your business.","blue"),
 benefit("Get discovered in your service area","Your services, ZIP Code and radius help determine where your business can match.","green")
);
readiness.append(checklist,why);

const coming=make("section",undefined,"pro-coming");
coming.append(make("h2","More tools coming to your account"),make("p","Your core marketplace, wallet, customer contact and purchase history are available. We are continuing to expand optional business tools."));
const comingGrid=make("div",undefined,"pro-coming-grid");
for(const [title,text] of [["Referral rewards","Earn promotional credits from eligible professional referrals when this program launches."],["Saved payment preferences","Make repeat checkout faster while keeping payment details with the payment processor."],["Opportunity alerts","Expand notification options as messaging channels are approved."],["Business insights","Review more marketplace activity and performance trends over time."]]){const card=make("article",undefined,"pro-coming-card");card.append(make("strong",title),make("p",text),make("span","Planned","pro-pill"));comingGrid.append(card);}
coming.append(comingGrid);

dash.prepend(hero,summary,readiness,coming);
const dashboardNotice=$("dashboardNotice");
function syncDashboardNotice(){
 if(!dashboardNotice)return;
 const redundant=/^Your account is available\. Marketplace, wallet access, profile publishing and payments are not open yet\.$/.test(dashboardNotice.textContent.trim());
 dashboardNotice.hidden=redundant;
}
if(dashboardNotice){
 const noticeObserver=new MutationObserver(syncDashboardNotice);
 noticeObserver.observe(dashboardNotice,{childList:true,characterData:true,subtree:true});
 syncDashboardNotice();
}

function updateLaunchDashboard(p,publicProfilePublished){
 coming.hidden=capabilities?.marketplace_enabled!==false;
 const complete={
  business:Boolean((p?.business_name||p?.display_name||"").trim()),
  services:Boolean(p?.service_categories?.length),
  area:Boolean(p?.base_zip&&p?.service_radius_miles),
  phone:Boolean((p?.contact_phone||"").trim()),
  about:Boolean((p?.bio||"").trim().length>=20),
  photos:false
 };
 const done=Object.values(complete).filter(Boolean).length,percent=Math.round(done/Object.keys(complete).length*100);
 $("proCompletionValue").textContent=percent+"%";
 $("proServiceAreaValue").textContent=p?.base_zip?(p.base_zip+" · "+(p.service_radius_miles||"—")+" mi"):"Not set";
 $("proAccountValue").textContent=p?.account_status||"Incomplete";
 $("proPublicValue").textContent=publicProfilePublished===true?"Published":(capabilities?.marketplace_enabled===false||capabilities?.profile_editing_enabled===false?"Not available":"Not published");
 checklist.querySelector(".pro-progress-label").textContent=percent+"% complete";
 progress.firstChild.style.width=percent+"%";
 for(const row of checklist.querySelectorAll("[data-check]")){const doneNow=complete[row.dataset.check]===true;row.classList.toggle("done",doneNow);row.querySelector(".pro-check-mark").textContent=doneNow?"✓":"○";}
}
// Public profile editing is rendered by marketplace-portal.js. Keep this UX layer from
// re-arranging legacy public contact fields or wrapping the new editor sections.
const pub=views.publicProfilePanel;
let signedIn=false,hasProfile=null,current="",capabilities=null;
function go(id){
 if(!signedIn)return;
 if(capabilities?.marketplace_enabled===false&&commercialScreens.has(id)){
  window.GetEstimateFastPortal?.say?.("This feature is coming soon. Complete your business details now so your account is ready.");
  return;
 }
 const dest=hasProfile===false?"accountSettingsPanel":views[id]?id:"contractorDashboard";
 for(const [key,section] of Object.entries(views))section.hidden=key!==dest;
 nav.hidden=hasProfile!==true;
 for(const link of nav.querySelectorAll("a"))link.dataset.active=link.dataset.screen===dest?"true":"false";
 if(dest==="accountSettingsPanel"){drawServices();if(current!==dest)selectStep(1);}
 if(dest==="publicProfilePanel")drawPublic();
 if(dest==="profilePreviewPanel")window.dispatchEvent(new CustomEvent("gef-profile-preview-request"));
 if(dest==="myReferralsPanel")showReferrals();
 current=dest;
}
document.addEventListener("click",e=>{
 const link=e.target?.closest?.('a[href^="#"]'),id=link?.getAttribute("href").slice(1);
 if(!id||!views[id]||!signedIn)return;
 e.preventDefault();go(id);
 try{history.replaceState(null,"","#"+(hasProfile===false?"accountSettingsPanel":id));}catch{}
 views[current]?.scrollIntoView?.({behavior:"smooth",block:"start"});
});
window.addEventListener("gef-signed-in",()=>{signedIn=true;hasProfile=null;current="";$("register").hidden=true;nav.hidden=true;for(const section of Object.values(views))section.hidden=true;});
window.addEventListener("gef-profile",e=>{
 capabilities=e.detail?.capabilities||null;
 syncNavigationAvailability();
 referralReload.disabled=capabilities?.marketplace_enabled===false;
 if(capabilities?.marketplace_enabled===false)referralList.replaceChildren(make("p","Profile requests and customer contacts are not open yet."));
 const p=e.detail?.profile,wasReady=hasProfile===true;
 updateLaunchDashboard(p,e.detail?.public_profile_published===true);
 const businessName=(p?.business_name||p?.display_name||"").trim();
 if($("proBusinessWelcome"))$("proBusinessWelcome").textContent=businessName||"My GetEstimateFast";
 if($("proBusinessMeta"))$("proBusinessMeta").textContent=p?.city&&p?.state_code?(p.city+", "+p.state_code+" · "+(p.service_radius_miles||"—")+"-mile service area"):"Professional account · Get ready for local service opportunities.";
 if($("proAccountBadge")){$("proAccountBadge").textContent=p?.account_status==="active"?"Account Active":"Account "+(p?.account_status||"Incomplete");$("proAccountBadge").dataset.active=p?.account_status==="active"?"true":"false";}
 hasProfile=Boolean(p?.account_status==="active"&&p.base_zip&&p.contact_phone&&p.service_categories?.length);
 queueMicrotask(drawServices);
 if(hasProfile){
  const justCompleted=!wasReady;
  const destination=justCompleted?"opportunityPanel":(views[location.hash.slice(1)]?location.hash.slice(1):(current||"contractorDashboard"));
  go(destination);
  if(justCompleted){
   try{history.replaceState(null,"","#opportunityPanel");}catch{}
   queueMicrotask(()=>$("loadOpportunities")?.click());
   const confirmation="Business profile saved. Your matching opportunities are ready below.";
   window.GetEstimateFastPortal?.say?.(confirmation);
   window.setTimeout(()=>{
    const message=document.getElementById("message");
    if(message?.textContent===confirmation)window.GetEstimateFastPortal?.say?.("");
   },4200);
  }
 }else go("accountSettingsPanel");
});
window.addEventListener("gef-public-profile",e=>{const p=e.detail?.profile;if($("proPublicValue"))$("proPublicValue").textContent=p?.published===true?"Published":"Not published";});
window.addEventListener("gef-opportunities",e=>{const total=String(e.detail?.matching_total??0);if($("proOpportunityValue"))$("proOpportunityValue").textContent=total;if($("proQuickOpportunities"))$("proQuickOpportunities").textContent=total;});
const walletSource=$("walletBalance");
if(walletSource){
 const syncQuickWallet=()=>{if($("proQuickWallet"))$("proQuickWallet").textContent=walletSource.textContent||"$0.00";};
 new MutationObserver(syncQuickWallet).observe(walletSource,{childList:true,characterData:true,subtree:true});syncQuickWallet();
}
window.addEventListener("gef-signed-out",()=>{signedIn=false;hasProfile=null;capabilities=null;referralList.replaceChildren();nav.hidden=true;for(const x of Object.values(views))x.hidden=true;selectStep(1);if($("proOpportunityValue"))$("proOpportunityValue").textContent="0";if($("proQuickOpportunities"))$("proQuickOpportunities").textContent="0";if($("proQuickDirect"))$("proQuickDirect").textContent="0";});
})();
