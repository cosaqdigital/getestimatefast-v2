(()=>{"use strict";const el=id=>document.getElementById(id);let token="",sessionGeneration=0;const say=s=>el("message").textContent=s;
async function api(path,method="GET",body){const generation=sessionGeneration;let r=await fetch("/api/contractor/"+path,{method,cache:"no-store",credentials:"same-origin",headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});let d=await r.json();if(generation!==sessionGeneration)throw Error("Session changed. Please sign in again.");if(!r.ok)throw Error(d.error||"Request failed");return d;}
const loggedIn=b=>{el("auth").hidden=b;el("workspace").hidden=!b;window.dispatchEvent(new CustomEvent(b?"gef-signed-in":"gef-signed-out"));};
el("login").addEventListener("submit",async e=>{e.preventDefault();say("Signing in...");try{const f=new FormData(e.currentTarget);const d=await api("login","POST",{email:f.get("email"),password:f.get("password")});token=d.access_token;el("login").elements.password.value="";loggedIn(true);await refresh();try{await loadOpportunities();say("Signed in.");}catch(error){say(error.message);}}catch(ex){say(ex.message)}});
async function refresh(){const d=await api("profile");el("categories").replaceChildren();for(const c of d.categories){const o=document.createElement("option");o.value=c;o.textContent=c;el("categories").appendChild(o);}const p=d.profile;el("smsOptIn").checked=p?.sms_opt_in===true;window.dispatchEvent(new CustomEvent("gef-profile",{detail:d}));if(!p){el("accountStatus").textContent="No completed profile yet.";return;}el("accountStatus").textContent="Account status: "+p.account_status;for(const [k,v] of Object.entries(p)){const field=el("profile").elements.namedItem(k);if(!field||field.type==="checkbox")continue;if(k==="service_categories"){for(const o of field.options)o.selected=v.includes(o.value);}else field.value=v??"";}}
el("profile").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const obj=Object.fromEntries(f.entries());obj.service_categories=f.getAll("service_categories");obj.service_radius_miles=Number(obj.service_radius_miles);obj.privacyConsent=f.get("privacyConsent")==="on";obj.termsConsent=f.get("termsConsent")==="on";try{const d=await api("profile","POST",obj);say("Profile saved. Account status: "+d.account_status);await refresh();}catch(ex){say(ex.message);}});
el("saveSmsPreference").addEventListener("click",async()=>{try{const d=await api("sms-preference","POST",{smsOptIn:el("smsOptIn").checked});say("SMS preference saved. Live SMS is disabled.");el("smsOptIn").checked=d.sms_opt_in;}catch(e){say(e.message);}});
let opportunityPage=0;
async function loadOpportunities(append=false){
 const page=append?opportunityPage+1:0;
 const city=el("opportunityCity").value.trim();
 const params=new URLSearchParams({page:String(page),city});
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
  price.textContent=item.commercial?.amount_cents!=null?"Contact price: "+new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(item.commercial.amount_cents/100):item.commercial?.reason==="expired"?"Expired opportunity":"Contact price not configured";
  const purchase=document.createElement("button");purchase.type="button";purchase.disabled=true;purchase.textContent="Contact purchases are not enabled";
  card.append(title,summary,date,price,purchase);
  el("opportunityCards").appendChild(card);
 }
 opportunityPage=page;
 el("moreOpportunities").hidden=d.opportunities.length<25;
 if(!d.opportunities.length&&!append)el("opportunityCards").textContent="No matching opportunities have been published yet.";
}
el("loadOpportunities").addEventListener("click",()=>loadOpportunities().catch(e=>say(e.message)));
el("moreOpportunities").addEventListener("click",()=>loadOpportunities(true).catch(e=>say(e.message)));
el("logout").addEventListener("click",()=>{sessionGeneration++;token="";el("profile").reset();el("opportunityCards").replaceChildren();loggedIn(false);say("Signed out.");});
window.GetEstimateFastPortal={api,say,loadOpportunities};
})();
