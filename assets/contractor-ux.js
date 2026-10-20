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
const sms=$("smsPreferences");if(sms){const extra=make("details",undefined,"pro-optional");extra.append(make("summary","Optional SMS alerts"),sms);settings.append(extra);}
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
referrals.append(make("h2","Requests from my public profile"),
 make("p","When you share your profile, customers can request an estimate. After administrative review and publication, you see the customer's contact here at no charge. No wallet credits are used."));
const referralReload=make("button","Refresh my requests","secondary");referralReload.type="button";
const referralList=make("div",undefined,"pro-referral-cards");
referrals.append(referralReload,referralList);workspace.append(referrals);
async function showReferrals(){
 if(capabilities?.marketplace_enabled===false){referralList.replaceChildren(make("p","Profile requests and customer contacts are not open yet."));return;}
 referralList.replaceChildren(make("p","Loading your profile requests..."));
 try{
  const result=await window.GetEstimateFastPortal.api("origin-leads");
  referralList.replaceChildren();
  if(!result.leads?.length){referralList.append(make("p","No requests from your profile yet. Share your public profile to invite estimate requests."));return;}
  for(const lead of result.leads){
   const card=make("article",undefined,"pro-referral-card");
   card.append(make("h3",lead.service_type+" · "+lead.city+", "+lead.zip_code));
   card.append(make("p","Status: "+(lead.contact_available?"Approved · Free contact ready":lead.status==="new"?"Waiting for GetEstimateFast review":lead.status==="qualified"?"Approved · Awaiting publication":"Not currently available")));
   if(lead.contact_available && lead.customer){
    card.append(make("p","Free access — $0.00. No credits deducted."));
    const details=make("div",undefined,"pro-referral-contact");
    details.append(make("p","Customer: "+lead.customer.name),make("p","Phone: "+lead.customer.phone),make("p","Email: "+lead.customer.email));
    card.append(details);
   }else card.append(make("p","Customer contact is private until the request has been approved and published."));
   referralList.append(card);
  }
 }catch(e){referralList.replaceChildren(make("p",e?.message||"Could not load your profile requests."));}
}
referralReload.addEventListener("click",()=>showReferrals());

// Reuse every existing module, showing one section at a time.
const views={contractorDashboard:$("contractorDashboard"),opportunityPanel:$("opportunityPanel"),myReferralsPanel:referrals,publicProfilePanel:$("publicProfilePanel"),accountSettingsPanel:settings,walletPanel:$("walletPanel"),purchasePanel:$("purchasePanel")};
nav.replaceChildren();
for(const [id,label] of [["contractorDashboard","Home"],["opportunityPanel","Opportunities"],["myReferralsPanel","My free requests"],["publicProfilePanel","Public profile"],["accountSettingsPanel","My details"],["walletPanel","Wallet"],["purchasePanel","Purchase history"]]){
 const link=make("a",label);link.href="#"+id;link.dataset.screen=id;nav.append(link);
}
nav.classList.add("pro-navigation");
const welcome=make("div",undefined,"pro-welcome");welcome.append(make("strong","My GetEstimateFast"),make("p","Manage your business, one step at a time."));
workspace.prepend(welcome);
for(const id of ["walletBalance","purchaseCount"]){const card=$(id)?.closest(".metric");if(card)card.hidden=true;}
const dash=views.contractorDashboard;
const callout=make("div",undefined,"pro-callout");callout.append(make("h2","Find local work that fits your business"),make("p","Explore requests near your ZIP Code. Purchases and payments are currently disabled."));
for(const [id,label] of [["opportunityPanel","See opportunities"],["myReferralsPanel","My free profile requests"],["publicProfilePanel","Create my public profile"]]){const link=make("a",label,"pro-link");link.href="#"+id;callout.append(link);}
dash.prepend(callout);
const oldButtons=dash.querySelector(":scope > .actions");if(oldButtons)oldButtons.hidden=true;
const oldHeadline=dash.querySelector(":scope > h1");if(oldHeadline)oldHeadline.hidden=true;
// Collapse nonessential profile fields without resetting consent or changing publication status.
const pub=views.publicProfilePanel,pubGrid=publicForm.querySelector(".form-grid");
if(pubGrid){
 const optional=make("details",undefined,"pro-optional");optional.append(make("summary","Optional profile details (not public contact information)"));
 const extra=make("div",undefined,"form-grid");optional.append(extra);
 for(const n of ["languages","social_links","public_email","public_phone"]){const label=pubGrid.querySelector('[name="'+n+'"]')?.closest("label");if(label)extra.append(label);}
 for(const n of ["publish_email","publish_phone"]){const label=publicForm.querySelector('[name="'+n+'"]')?.closest("label");if(label)extra.append(label);}
 const publish=publicForm.querySelector('input[name="published"]')?.closest("label");
 if(publish){publicForm.insertBefore(optional,publish);publicForm.insertBefore(make("p","Your phone and email are not shown on public profiles during this launch phase. Visitors request estimates through GetEstimateFast.","pro-privacy"),publish);}
}
const workTitle=[...publicForm.children].find(x=>x.tagName==="H3"&&x.textContent.trim()==="Work photos");
const addWork=$("addPortfolio");
if(workTitle&&addWork){
 const opt=make("details",undefined,"pro-optional");opt.append(make("summary","Optional work photos"));
 let current=workTitle;
 while(current){const following=current.nextElementSibling;opt.append(current);if(current===addWork)break;current=following;}
 publicForm.append(opt);
}
const reviewTitle=[...pub.children].find(x=>x.tagName==="H3"&&x.textContent.trim()==="Request a customer review");
if(reviewTitle){
 const opt=make("details",undefined,"pro-optional");opt.append(make("summary","Optional reviews and assistance"));
 let x=reviewTitle;while(x){const after=x.nextElementSibling;opt.append(x);x=after;}pub.append(opt);
}
let signedIn=false,hasProfile=null,current="",capabilities=null;
function go(id){
 if(!signedIn)return;
 const dest=hasProfile===false?"accountSettingsPanel":views[id]?id:"contractorDashboard";
 for(const [key,section] of Object.entries(views))section.hidden=key!==dest;
 nav.hidden=hasProfile!==true;
 for(const link of nav.querySelectorAll("a"))link.dataset.active=link.dataset.screen===dest?"true":"false";
 if(dest==="accountSettingsPanel"){drawServices();if(current!==dest)selectStep(1);}
 if(dest==="publicProfilePanel")drawPublic();
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
 referralReload.disabled=capabilities?.marketplace_enabled===false;
 if(capabilities?.marketplace_enabled===false)referralList.replaceChildren(make("p","Profile requests and customer contacts are not open yet."));
 const p=e.detail?.profile,wasReady=hasProfile===true;
 hasProfile=Boolean(p?.account_status==="active"&&p.base_zip&&p.contact_phone&&p.service_categories?.length);
 queueMicrotask(drawServices);
 if(hasProfile)go(wasReady?current:(views[location.hash.slice(1)]?location.hash.slice(1):"contractorDashboard"));
 else go("accountSettingsPanel");
});
window.addEventListener("gef-signed-out",()=>{signedIn=false;hasProfile=null;capabilities=null;referralList.replaceChildren();nav.hidden=true;for(const x of Object.values(views))x.hidden=true;selectStep(1);});
})();
