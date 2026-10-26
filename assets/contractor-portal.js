(()=>{"use strict";const el=id=>document.getElementById(id);let token="",sessionGeneration=0,capabilities={payments_enabled:false};const say=s=>el("message").textContent=s;
async function api(path,method="GET",body){const generation=sessionGeneration;let r=await fetch("/api/contractor/"+path,{method,cache:"no-store",credentials:"same-origin",headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});let d=await r.json();if(generation!==sessionGeneration)throw Error("Session changed. Please sign in again.");if(!r.ok){if([401,403].includes(r.status)&&token){sessionGeneration++;token="";el("profile").reset();el("opportunityCards").replaceChildren();loggedIn(false);}throw Error(d.error||"Request failed");}return d;}
const loggedIn=b=>{el("auth").hidden=b;el("register").hidden=b||new URLSearchParams(window.location.search).get("signup")!=="1";el("workspace").hidden=!b;window.dispatchEvent(new CustomEvent(b?"gef-signed-in":"gef-signed-out"));};
el("login").addEventListener("submit",async e=>{e.preventDefault();say("Signing in...");try{const f=new FormData(e.currentTarget);const d=await api("login","POST",{email:f.get("email"),password:f.get("password")});token=d.access_token;el("login").elements.password.value="";loggedIn(true);await refresh();try{await loadOpportunities();if(!new URLSearchParams(window.location.search).get("opportunity")){say("Signed in.");setTimeout(()=>{if(el("message").textContent==="Signed in.")say("");},3500);}}catch(error){say(error.message);}}catch(ex){say(ex.message)}});
async function refresh(){const d=await api("profile");capabilities=d.capabilities||{payments_enabled:false};const launchFlag=el("launchFlag"),opportunityIntro=el("opportunityIntro");if(launchFlag)launchFlag.textContent=capabilities.payments_enabled===true?"Your professional account is active. Browse eligible opportunities and securely unlock customer contacts through GetEstimateFast.":"Your professional account is active. Complete your business details now so you are ready for local opportunities.";if(opportunityIntro)opportunityIntro.textContent=capabilities.payments_enabled===true?"Browse published service requests and project photos. Customer name, phone and email remain private until you securely unlock a contact.":"Browse published service requests. Customer phone, email and personal details remain private while contact purchases are unavailable.";el("categories").replaceChildren();for(const c of d.categories){const o=document.createElement("option");o.value=c;o.textContent=c;el("categories").appendChild(o);}const p=d.profile;el("smsOptIn").checked=p?.sms_opt_in===true;window.dispatchEvent(new CustomEvent("gef-profile",{detail:d}));if(!p){el("accountStatus").textContent="No completed profile yet.";return;}el("accountStatus").textContent="Account status: "+p.account_status;for(const [k,v] of Object.entries(p)){const field=el("profile").elements.namedItem(k);if(!field||field.type==="checkbox")continue;if(k==="service_categories"){for(const o of field.options)o.selected=v.includes(o.value);}else field.value=v??"";}}
el("profile").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const obj=Object.fromEntries(f.entries());obj.service_categories=f.getAll("service_categories");obj.service_radius_miles=Number(obj.service_radius_miles);obj.privacyConsent=f.get("privacyConsent")==="on";obj.termsConsent=f.get("termsConsent")==="on";try{const d=await api("profile","POST",obj);say("Profile saved. Account status: "+d.account_status);await refresh();}catch(ex){say(ex.message);}});
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
async function loadOpportunities(append=false){
 const page=append?opportunityPage+1:0;
 const city=el("opportunityCity").value.trim();
 const params=new URLSearchParams({page:String(page),city});\n const directOpportunity=new URLSearchParams(window.location.search).get("opportunity")||"";\n if(directOpportunity)params.set("opportunity_id",directOpportunity);
 for(const [id,key] of [["opportunityCategory","category"],["opportunityZip","zip"],["opportunityRadius","radius"],["opportunityAvailability","availability"]])if(el(id)?.value)params.set(key,el(id).value);
 const d=await api("opportunities?"+params);
 window.dispatchEvent(new CustomEvent("gef-opportunities",{detail:d}));
 if(!append)el("opportunityCards").replaceChildren();
 for(const item of d.opportunities){
  const card=document.createElement("div");
  card.style.cssText="border:1px solid #dce4eb;border-radius:10px;padding:15px;background:#f7fafd";
  const title=document.createElement("h3");
  title.textContent=item.service_category+" - "+item.city+", "+item.zip_code;
  const summary=document.createElement("p");
  summary.textContent=item.public_summary;
  const date=document.createElement("small");
  date.textContent="Published: "+new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:"America/New_York"}).format(new Date(item.published_at));
  const price=document.createElement("p");
  price.textContent=item.origin_free?"Free contact - from your public profile":item.commercial?.amount_cents!=null?"Contact price: "+new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(item.commercial.amount_cents/100):item.commercial?.reason==="expired"?"Expired opportunity":"Contact price not configured";
  const purchase=document.createElement("button");purchase.type="button";
  if(item.origin_free){
    purchase.disabled=true;
    purchase.textContent="Your profile lead";
  }else if(capabilities.payments_enabled===true&&item.commercial?.available===true){
    purchase.disabled=false;
    purchase.textContent="Buy Contact";
    purchase.addEventListener("click",async()=>{
      purchase.disabled=true;
      try{
        say("Preparing secure checkout...");
        const quote=await api("live-checkout","POST",{action:"quote",opportunity_id:item.opportunity_id});
        const checkout=await api("live-checkout","POST",{
          action:"checkout",
          opportunity_id:item.opportunity_id,
          quote_id:quote.quote_id,
          operation_key:"buy_"+crypto.randomUUID()
        });
        sessionStorage.setItem("gef_pending_order_id",checkout.order_id);
        window.location.assign(checkout.checkout_url);
      }catch(ex){
        purchase.disabled=false;
        say(ex.message);
      }
    });
  }else{
    purchase.disabled=true;
    purchase.textContent="Contact purchases are not enabled";
  }
  card.append(title,summary,date);renderProjectPhotos(card,item);card.append(price,purchase);
  el("opportunityCards").appendChild(card);
 }
 opportunityPage=page;
 el("moreOpportunities").hidden=d.opportunities.length<25;
 if(!d.opportunities.length&&!append)el("opportunityCards").textContent=directOpportunity?"This opportunity is unavailable or does not match your professional profile.":"No matching opportunities have been published yet.";\n if(directOpportunity&&!append&&d.opportunities.some(item=>item.opportunity_id===directOpportunity)){\n  const target=el("opportunityCards").querySelector("[data-opportunity-id=\\""+CSS.escape(directOpportunity)+"\\"]");\n  target?.scrollIntoView({block:"center",behavior:"smooth"});\n  say("Opportunity opened from your GetEstimateFast alert.");\n }
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
