(()=>{"use strict";const el=id=>document.getElementById(id);let token="",sessionGeneration=0,capabilities={payments_enabled:false};const say=s=>el("message").textContent=s;
async function api(path,method="GET",body){const generation=sessionGeneration;let r=await fetch("/api/contractor/"+path,{method,cache:"no-store",credentials:"same-origin",headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});let d=await r.json();if(generation!==sessionGeneration)throw Error("Session changed. Please sign in again.");if(!r.ok){if(r.status===401&&token){sessionGeneration++;token="";el("profile").reset();el("opportunityCards").replaceChildren();loggedIn(false);}throw Error(d.error||"Request failed");}return d;}
const loggedIn=b=>{el("auth").hidden=b;el("register").hidden=b||new URLSearchParams(window.location.search).get("signup")!=="1";el("workspace").hidden=!b;window.dispatchEvent(new CustomEvent(b?"gef-signed-in":"gef-signed-out"));};
el("login").addEventListener("submit",async e=>{e.preventDefault();say("Signing in...");try{const f=new FormData(e.currentTarget);const d=await api("login","POST",{email:f.get("email"),password:f.get("password")});token=d.access_token;el("login").elements.password.value="";loggedIn(true);const profileState=await refresh();const p=profileState?.profile;const ready=Boolean(p?.account_status==="active"&&p?.base_zip&&p?.contact_phone&&p?.service_categories?.length);if(ready){try{await loadOpportunities();if(!new URLSearchParams(window.location.search).get("opportunity")){say("Signed in.");setTimeout(()=>{if(el("message").textContent==="Signed in.")say("");},3500);}}catch(error){say(error.message);}}else{say("Signed in. Complete your business profile to continue.");}}catch(ex){say(ex.message)}});
async function refresh(){const d=await api("profile");capabilities=d.capabilities||{payments_enabled:false};const launchFlag=el("launchFlag"),opportunityIntro=el("opportunityIntro");if(launchFlag)launchFlag.textContent=capabilities.payments_enabled===true?"Your professional account is active. Browse eligible opportunities and securely unlock customer contacts through GetEstimateFast.":"Your professional account is active. Complete your business details now so you are ready for local opportunities.";if(opportunityIntro)opportunityIntro.textContent=capabilities.payments_enabled===true?"Browse published service requests and project photos. Customer name, phone and email remain private until you securely unlock a contact.":"Browse published service requests. Customer phone, email and personal details remain private while contact purchases are unavailable.";el("categories").replaceChildren();for(const c of d.categories){const o=document.createElement("option");o.value=c;o.textContent=c;el("categories").appendChild(o);}const p=d.profile,signup=d.signup_defaults||null;el("smsOptIn").checked=p?.sms_opt_in===true||(!p&&signup?.sms_opt_in===true);const legacy=el("legacyProfileConsent");if(legacy)legacy.hidden=Boolean(p||signup?.legal_consent_recorded);if(!p&&signup?.contact_phone){const phoneField=el("profile").elements.namedItem("contact_phone");if(phoneField&&!phoneField.value)phoneField.value=signup.contact_phone;}window.dispatchEvent(new CustomEvent("gef-profile",{detail:d}));if(!p){el("accountStatus").textContent="No completed profile yet.";return d;}el("accountStatus").textContent="Account status: "+p.account_status;for(const [k,v] of Object.entries(p)){const field=el("profile").elements.namedItem(k);if(!field||field.type==="checkbox")continue;if(k==="service_categories"){for(const o of field.options)o.selected=v.includes(o.value);}else field.value=v??"";}return d;}
el("profile").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const obj=Object.fromEntries(f.entries());obj.service_categories=f.getAll("service_categories");obj.service_radius_miles=Number(obj.service_radius_miles);const legacy=el("legacyProfileConsent");if(legacy&&!legacy.hidden){obj.privacyConsent=f.get("privacyConsent")==="on";obj.termsConsent=f.get("termsConsent")==="on";}try{const d=await api("profile","POST",obj);say("Profile saved. Account status: "+d.account_status);await refresh();}catch(ex){say(ex.message);}});
el("saveSmsPreference").addEventListener("click",async()=>{try{const d=await api("sms-preference","POST",{smsOptIn:el("smsOptIn").checked});say("SMS preference saved. Live SMS is disabled.");el("smsOptIn").checked=d.sms_opt_in;}catch(e){say(e.message);}});
function renderProjectPhotos(card,item){
 const photos=Array.isArray(item.photos)?item.photos.filter(photo=>photo&&photo.url):[];
 if(!photos.length)return;
 const section=document.createElement("section");section.className="pro-opportunity-photo-section";
 const heading=document.createElement("div");heading.className="pro-opportunity-photo-heading";
 const strong=document.createElement("strong");strong.textContent=photos.length===1?"1 project photo":photos.length+" project photos";
 const note=document.createElement("span");note.textContent="Photos are visible before purchase to help you evaluate the project.";
 heading.append(strong,note);
 const gallery=document.createElement("div");gallery.className="pro-opportunity-photo-gallery";
 photos.forEach((photo,index)=>{
  const link=document.createElement("a");link.href=photo.url;link.target="_blank";link.rel="noopener noreferrer";link.className="pro-opportunity-photo-link";
  const img=document.createElement("img");img.src=photo.url;img.alt="Project photo "+(index+1);img.loading="lazy";img.decoding="async";
  link.append(img);gallery.append(link);
 });
 section.append(heading,gallery);card.append(section);
}
let opportunityPage=0;
const OPPORTUNITY_PAGE_SIZE=10;
function relativePublished(value){
 const ms=Date.now()-new Date(value).getTime(),hours=Math.max(0,Math.floor(ms/3600000));
 if(hours<1)return "Just now";
 if(hours<24)return hours+"h ago";
 const days=Math.floor(hours/24);return days===1?"1 day ago":days+" days ago";
}
async function loadOpportunities(append=false,requestedPage=null){
 const page=Number.isInteger(requestedPage)?requestedPage:(append?opportunityPage+1:0);
 const city=el("opportunityCity").value.trim();
 const params=new URLSearchParams({page:String(page),city});
 const directOpportunity=new URLSearchParams(window.location.search).get("opportunity")||"";
 if(directOpportunity)params.set("opportunity_id",directOpportunity);
 for(const [id,key] of [["opportunityCategory","category"],["opportunityZip","zip"],["opportunityRadius","radius"],["opportunityAvailability","availability"]])if(el(id)?.value)params.set(key,el(id).value);
 const d=await api("opportunities?"+params);
 window.dispatchEvent(new CustomEvent("gef-opportunities",{detail:d}));
 const holder=el("opportunityCards");holder.replaceChildren();holder.classList.add("pro-opportunity-list");
 const meta=document.createElement("div");meta.className="pro-opportunity-list-meta";
 const startIndex=d.matching_total?d.page*OPPORTUNITY_PAGE_SIZE+1:0;
 const endIndex=Math.min(d.matching_total,(d.page+1)*OPPORTUNITY_PAGE_SIZE);
 meta.textContent=d.matching_total?"Showing "+startIndex+"–"+endIndex+" of "+d.matching_total+" opportunities":"No matching opportunities";
 holder.append(meta);
 for(const item of d.opportunities){
  const card=document.createElement("article");card.className="pro-opportunity-row";card.dataset.opportunityId=item.opportunity_id;
  const photos=Array.isArray(item.photos)?item.photos.filter(photo=>photo&&photo.url):[];
  const thumb=document.createElement("div");thumb.className="pro-opportunity-thumb";
  if(photos[0]?.url){const img=document.createElement("img");img.src=photos[0].url;img.alt="Project preview";img.loading="lazy";thumb.append(img);}
  else thumb.textContent="▧";
  const main=document.createElement("div");main.className="pro-opportunity-main";
  const titleLine=document.createElement("div");titleLine.className="pro-opportunity-title-line";
  const title=document.createElement("h3");title.textContent=item.service_category;titleLine.append(title);
  if(item.origin_free){const badge=document.createElement("span");badge.className="pro-opportunity-badge direct";badge.textContent="Direct Lead";titleLine.append(badge);}
  else if(item.commercial?.reason==="expired"){const badge=document.createElement("span");badge.className="pro-opportunity-badge expired";badge.textContent="Expired";titleLine.append(badge);}
  else{const badge=document.createElement("span");badge.className="pro-opportunity-badge available";badge.textContent="Available";titleLine.append(badge);}
  const metaRow=document.createElement("div");metaRow.className="pro-opportunity-meta";
  const location=document.createElement("span");location.textContent="⌖ "+item.city+", FL · "+item.zip_code;
  const published=document.createElement("span");published.textContent="◷ "+relativePublished(item.published_at);
  const photoInfo=document.createElement("span");photoInfo.textContent="▧ "+(photos.length?photos.length+(photos.length===1?" photo":" photos"):"No photos");
  metaRow.append(location,published,photoInfo);main.append(titleLine,metaRow);
  const view=document.createElement("button");view.type="button";view.className="secondary pro-opportunity-view";view.textContent="View Details →";
  const details=document.createElement("div");details.hidden=true;details.className="pro-opportunity-details pro-opportunity-expanded";
  const summary=document.createElement("p");summary.className="pro-opportunity-summary";summary.textContent=item.public_summary;
  details.append(summary);
  const detailEntries=Object.entries(item.project_details||{}).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=="");
  if(detailEntries.length){
    const project=document.createElement("div");project.className="pro-project-details";
    const heading=document.createElement("h3");heading.textContent="Project details";project.append(heading);
    const grid=document.createElement("div");grid.className="pro-project-grid";
    for(const [key,value] of detailEntries){
      const entry=document.createElement("div");entry.className="pro-project-item";
      const label=document.createElement("span");label.textContent=key;
      const text=document.createElement("p");text.textContent=Array.isArray(value)?value.join(", "):String(value);
      entry.append(label,text);grid.append(entry);
    }
    project.append(grid);details.append(project);
  }
  const access=document.createElement("div");access.className="pro-opportunity-access";
  const accessCopy=document.createElement("div");
  const accessLabel=document.createElement("span");accessLabel.textContent=item.origin_free?"Direct lead from your public profile":"Contact access";
  const accessValue=document.createElement("strong");
  if(item.origin_free)accessValue.textContent="No purchase required";
  else if(item.commercial?.amount_cents!=null)accessValue.textContent=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(item.commercial.amount_cents/100);
  else accessValue.textContent=item.commercial?.reason==="expired"?"Opportunity expired":"Unavailable";
  accessCopy.append(accessLabel,accessValue);access.append(accessCopy);
  const privacy=document.createElement("p");privacy.className="pro-opportunity-privacy";privacy.textContent=item.origin_free?"Your customer contact is available in Direct Leads after approval and publication.":"Customer contact details remain private until you choose to unlock this contact.";
  const purchaseActions=document.createElement("div");purchaseActions.className="pro-contact-actions";
  if(item.origin_free){
    const free=document.createElement("button");free.type="button";free.disabled=true;free.textContent="Free contact from your profile";purchaseActions.append(free);
  }else if(capabilities.payments_enabled===true&&item.commercial?.amount_cents!=null&&item.commercial?.available!==false){
    const amountLabel=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(item.commercial.amount_cents/100);
    const walletPurchase=document.createElement("button");walletPurchase.type="button";walletPurchase.className="secondary";walletPurchase.textContent="Unlock with Credits — "+amountLabel;
    const cardPurchase=document.createElement("button");cardPurchase.type="button";cardPurchase.textContent="Pay with Card — "+amountLabel;
    walletPurchase.addEventListener("click",async()=>{walletPurchase.disabled=true;cardPurchase.disabled=true;try{say("Checking your wallet credits...");const quote=await api("live-checkout","POST",{action:"quote",opportunity_id:item.opportunity_id});const result=await api("wallet-purchase","POST",{quote_id:quote.quote_id,operation_key:"wallet_buy_"+crypto.randomUUID()});if(result.contact_release_enabled){say("Contact unlocked with wallet credits.");await loadOpportunities();window.dispatchEvent(new CustomEvent("gef-wallet-updated"));}else throw Error("Contact could not be unlocked.");}catch(ex){walletPurchase.disabled=false;cardPurchase.disabled=false;say(ex.message);}});
    cardPurchase.addEventListener("click",async()=>{walletPurchase.disabled=true;cardPurchase.disabled=true;try{say("Preparing secure Stripe checkout...");const quote=await api("live-checkout","POST",{action:"quote",opportunity_id:item.opportunity_id});const checkout=await api("live-checkout","POST",{action:"checkout",opportunity_id:item.opportunity_id,quote_id:quote.quote_id,operation_key:"buy_"+crypto.randomUUID()});sessionStorage.setItem("gef_pending_order_id",checkout.order_id);window.location.assign(checkout.checkout_url);}catch(ex){walletPurchase.disabled=false;cardPurchase.disabled=false;say(ex.message);}});
    purchaseActions.append(walletPurchase,cardPurchase);
  }else{
    const unavailable=document.createElement("button");unavailable.type="button";unavailable.disabled=true;unavailable.textContent="Contact purchase unavailable";purchaseActions.append(unavailable);
  }
  renderProjectPhotos(details,item);details.append(access,privacy,purchaseActions);
  view.addEventListener("click",()=>{details.hidden=!details.hidden;view.textContent=details.hidden?"View Details →":"Hide Details ↑";});
  card.append(thumb,main,view,details);holder.append(card);
 }
 opportunityPage=page;
 const pager=document.createElement("div");pager.className="pro-opportunity-pager";
 const prev=document.createElement("button");prev.type="button";prev.className="secondary";prev.textContent="← Previous";prev.disabled=page===0;
 const pageLabel=document.createElement("span");pageLabel.textContent="Page "+(page+1)+" of "+Math.max(1,Math.ceil((d.matching_total||0)/OPPORTUNITY_PAGE_SIZE));
 const next=document.createElement("button");next.type="button";next.className="secondary";next.textContent="Next →";next.disabled=endIndex>=d.matching_total;
 prev.addEventListener("click",()=>loadOpportunities(false,Math.max(0,page-1)).catch(e=>say(e.message)));
 next.addEventListener("click",()=>loadOpportunities(false,page+1).catch(e=>say(e.message)));
 pager.append(prev,pageLabel,next);holder.append(pager);
 el("moreOpportunities").hidden=true;
 if(!d.opportunities.length)holder.append(document.createTextNode(directOpportunity?"This opportunity is unavailable or does not match your professional profile.":"No matching opportunities have been published yet."));
 if(directOpportunity&&d.opportunities.some(item=>item.opportunity_id===directOpportunity)){
  const target=holder.querySelector('[data-opportunity-id="'+CSS.escape(directOpportunity)+'"]');
  target?.scrollIntoView({block:"center",behavior:"smooth"});
  const viewButton=target?.querySelector(".pro-opportunity-view");
  if(viewButton&&viewButton.textContent.startsWith("View Details"))viewButton.click();
  say("Opportunity opened from your GetEstimateFast alert.");
 }
}
el("loadOpportunities").addEventListener("click",()=>loadOpportunities().catch(e=>say(e.message)));
el("moreOpportunities").addEventListener("click",()=>loadOpportunities(true).catch(e=>say(e.message)));
el("logout").addEventListener("click",()=>{sessionGeneration++;token="";el("profile").reset();el("opportunityCards").replaceChildren();loggedIn(false);say("Signed out.");});
const paymentState=new URLSearchParams(window.location.search).get("payment");
if(paymentState==="pending"){
  say("Payment is being confirmed. Contact details unlock only after Stripe confirmation.");
}else if(paymentState==="canceled"){
  say("Checkout was canceled. No contact was released.");
}
window.GetEstimateFastPortal={api,say,loadOpportunities};
})();
