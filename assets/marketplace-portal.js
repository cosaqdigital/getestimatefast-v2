(()=>{"use strict";
const el=id=>document.getElementById(id),portal=window.GetEstimateFastPortal,workspace=el("workspace");
if(!portal||!workspace)return;
const api=(action,method="GET",body)=>portal.api("marketplace?action="+encodeURIComponent(action),method,body);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
const date=s=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/New_York"}).format(new Date(s));
const formatPhone=value=>{const digits=String(value||"").replace(/\D/g,"");const local=digits.length===11&&digits.startsWith("1")?digits.slice(1):digits;return local.length===10?"("+local.slice(0,3)+") "+local.slice(3,6)+"-"+local.slice(6):String(value||"");};
const statusLabel=value=>value==="acquired"?"Contact unlocked":value==="reserved"?"Pending":value==="expired"?"Expired":String(value||"").replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());
const detailValue=value=>Array.isArray(value)?value.join(", "):value&&typeof value==="object"?JSON.stringify(value):String(value??"");
function node(tag,value,cls){const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;}
function projectPhotoGallery(photos){
 const valid=Array.isArray(photos)?photos.filter(photo=>photo&&photo.url):[];
 if(!valid.length)return null;
 const wrap=node("div",undefined,"pro-project-photo-block");
 wrap.append(node("h3","Project photos"));
 const gallery=node("div",undefined,"pro-opportunity-photo-gallery");
 valid.forEach((photo,index)=>{
  const a=node("a",undefined,"pro-opportunity-photo-link");a.href=photo.url;a.target="_blank";a.rel="noopener noreferrer";
  const img=node("img");img.src=photo.url;img.alt="Project photo "+(index+1);img.loading="lazy";img.decoding="async";a.append(img);gallery.append(a);
 });
 wrap.append(gallery);return wrap;
}
const panels=document.createElement("div");
const registrationToggle=document.createElement("button");registrationToggle.type="button";registrationToggle.className="secondary";registrationToggle.textContent="Create a free account";registrationToggle.setAttribute("aria-controls","register");registrationToggle.setAttribute("aria-expanded","false");
registrationToggle.onclick=()=>{const open=el("register").hidden;el("register").hidden=!open;registrationToggle.setAttribute("aria-expanded",String(open));if(open)el("register").scrollIntoView({block:"start",behavior:"smooth"});};
el("auth").append(registrationToggle);
if(new URLSearchParams(window.location.search).get("signup")==="1"){el("register").hidden=false;registrationToggle.setAttribute("aria-expanded","true");}
el("signup").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const r=await portal.api("signup","POST",{email:f.get("email"),password:f.get("password"),privacyConsent:f.get("privacyConsent")==="on",termsConsent:f.get("termsConsent")==="on"});e.target.reset();portal.say(r.message);}catch(ex){portal.say(ex.message);}};
panels.innerHTML=`<nav class="portal-nav" aria-label="Contractor navigation"><a href="#contractorDashboard">Dashboard</a><a href="#opportunityPanel">Opportunities</a><a href="#walletPanel">Wallet</a><a href="#purchasePanel">Purchase history</a><a href="#publicProfilePanel">Public profile</a><a href="#profile">Account settings</a></nav>
<section id="contractorDashboard"><p class="eyebrow">Your professional workspace</p><h1>Welcome to GetEstimateFast</h1><p>We Connect. You Decide.</p><div class="metric-grid"><div class="metric">Matching opportunities<strong id="opportunityCount">—</strong><small id="opportunityCountNote">Load opportunities to see your matches</small></div><div class="metric">Acquired opportunities<strong id="purchaseCount">—</strong><small>See your purchase history below</small></div><div class="metric">Available credits<strong id="walletBalance">—</strong><small>USD · payments disabled</small></div><div class="metric">Profile status<strong id="dashboardProfileStatus">—</strong><small>Manage your services and service area</small></div></div><div class="actions"><a class="button" href="#opportunityPanel">Explore opportunities</a><a class="button secondary" href="#publicProfilePanel">Create your free public profile</a></div><p id="dashboardNotice" class="muted"></p></section>
<section id="walletPanel"><h2>Your wallet</h2><p>Paid credits, promotional credits and refund credits are tracked separately. Pending payments are not available credits.</p><div class="metric-grid"><div class="metric">Paid credits<strong id="paidBalance">—</strong></div><div class="metric">Promotional credits<strong id="promoBalance">—</strong></div><div class="metric">Refund credits<strong id="refundBalance">—</strong></div></div><p class="notice">Payments and financial movements are disabled. When checkout is available, you can add only the amount needed for one contact. Promotional packages will always be optional.</p><button disabled type="button">Add credits — not enabled</button><h3>Statement</h3><div id="walletStatement" class="table-wrap"><p>Your statement will appear when marketplace access is enabled.</p></div><h3>Payment history</h3><div id="paymentHistory" class="table-wrap"></div></section>
<section id="purchasePanel"><h2>Purchased opportunities</h2><p>View your purchased opportunities and access unlocked customer contact details.</p><div id="purchaseHistory" class="table-wrap"><p>No history loaded.</p></div></section>
<section id="publicProfilePanel"><h2>Your free public profile</h2><p>Create a shareable showcase for your services, work and customer reviews. Preparing your own profile is free.</p><form id="publicProfileForm"><div class="form-grid"><label>Public link name<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="80" placeholder="your-business-name" required></label><label>Professional or business name<input name="display_name" maxlength="150" required></label><label class="wide">Headline<input name="headline" maxlength="180"></label><label class="wide">About your services<textarea name="about" maxlength="2000" rows="4"></textarea></label><label>City<input name="city" required></label><label>State<input name="state_code" value="FL" readonly></label><label>ZIP Code<input name="zip_code" pattern="[0-9]{5}" maxlength="5" required></label><label>Service radius in miles<input name="radius_miles" type="number" min="1" max="100" value="25" required></label><label>Service categories<select name="categories" id="publicCategories" multiple required></select></label><label>Languages (one per line)<textarea name="languages" rows="4" placeholder="English&#10;Spanish"></textarea></label><label class="wide">Social media links (one HTTPS link per line)<textarea name="social_links" rows="3"></textarea></label><label>Public email<input name="public_email" type="email"></label><label>Public US phone<input name="public_phone" type="tel"></label></div><label class="check"><input name="publish_email" type="checkbox">I consent to publishing the email entered above.</label><label class="check"><input name="publish_phone" type="checkbox">I consent to publishing the phone entered above.</label><label class="check"><input name="published" type="checkbox">Publish my profile and the information entered here.</label><h3>Work photos</h3><p>Publish only photos you have permission to share. Avoid customer faces, addresses and private information.</p><div id="portfolioItems"></div><label>Work title<input id="portfolioTitle" maxlength="120"></label><label>Work description<input id="portfolioDescription" maxlength="600"></label><label>Photo (JPG, PNG or WebP, up to 3 MB)<input id="portfolioFile" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="check"><input id="portfolioPermission" type="checkbox">I have permission to publish this photo.</label><button id="addPortfolio" type="button" class="secondary">Add work photo</button><p><button>Save public profile</button></p></form><div id="profileShare"></div><h3>Request a customer review</h3><p>Invite a customer you have served, including customers from outside GetEstimateFast. Google verification is the fastest option; email verification remains available as an alternative. GetEstimateFast moderates reviews before publication. External reviews are labeled as external.</p><label>Review source<select id="reviewPurchase"><option value="">External customer</option></select></label><button id="createReviewInvite" type="button" class="secondary">Create review invitation</button><div id="reviewInviteShare"></div><h3>Optional profile preparation</h3><p>Prefer help preparing your profile? This optional service has a separate price and does not use opportunity wallet credits.</p><button id="profileServicePreview" type="button" class="secondary">View service details</button><p id="profileServiceDetails"></p><button disabled type="button">Profile service checkout — not enabled</button></section>`;
workspace.insertBefore(panels,workspace.querySelector("h1"));
el("categories").multiple=true;el("categories").size=5;
const filters=document.createElement("div");filters.className="form-grid";
filters.innerHTML=`<label>Category<select id="opportunityCategory"><option value="">All my categories</option></select></label><label>ZIP Code near your search<input id="opportunityZip" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 33569"></label><label>Search radius in miles<input id="opportunityRadius" type="number" min="1" max="100" placeholder="Your profile radius"></label><label>Availability<select id="opportunityAvailability"><option value="available">Available</option><option value="expired">Expired</option><option value="all">All published</option></select></label>`;
el("opportunityPanel").insertBefore(filters,el("opportunityCards"));
let portfolio=[],profileSeeded=false,generation=0,signedIn=false,capabilities=null;
const availability=node("p",undefined,"notice");availability.id="profileAvailability";
el("publicProfileForm").before(availability);
function renderPortfolio(){el("portfolioItems").replaceChildren();portfolio.forEach((p,index)=>{const row=node("div",undefined,"card");row.append(node("strong",p.title),node("p",p.description));const remove=node("button","Remove photo","secondary");remove.type="button";remove.onclick=()=>{portfolio.splice(index,1);renderPortfolio();};row.append(remove);el("portfolioItems").append(row);});}
function table(container,head,rows){const holder=el(container);holder.replaceChildren();if(!rows.length){holder.append(node("p","No records yet."));return;}const t=node("table"),thead=node("thead"),tr=node("tr");for(const h of head)tr.append(node("th",h));thead.append(tr);t.append(thead);const body=node("tbody");for(const row of rows){const r=node("tr");for(const v of row)r.append(node("td",v));body.append(r);}t.append(body);holder.append(t);}
function renderPurchases(purchases,contactRelease){
 const holder=el("purchaseHistory");holder.replaceChildren();
 if(!purchases.length){holder.append(node("p","No purchases yet."));return;}
 for(const p of purchases){
  const card=node("article",undefined,"card pro-purchase-card");
  card.append(
   node("strong",p.service_category+" — "+p.city,"pro-purchase-title"),
   node("p","Purchased "+date(p.created_at)+" · Purchase price: "+money(p.amount_cents)+" · Status: "+statusLabel(p.status),"pro-purchase-meta")
  );
  if(contactRelease&&p.status==="acquired"){
   const button=node("button","View contact","secondary");button.type="button";
   const details=node("div",undefined,"pro-contact-details");details.hidden=true;
   let loaded=false;
   button.onclick=async()=>{
    if(loaded){details.hidden=!details.hidden;button.textContent=details.hidden?"View contact":"Hide contact";return;}
    button.disabled=true;
    try{
     const r=await portal.api("contact-access?opportunity_id="+encodeURIComponent(p.opportunity_id));
     const x=r.contact||{};
     const contactHead=node("div",undefined,"pro-contact-head");
     contactHead.append(node("h3","Customer contact"));
     const contactGrid=node("div",undefined,"pro-contact-grid");
     const name=node("div",undefined,"pro-contact-item");name.append(node("span","Customer"),node("strong",x.full_name||"Not provided"));
     const phone=node("div",undefined,"pro-contact-item");phone.append(node("span","Phone"));
     if(x.phone){const a=node("a",formatPhone(x.phone));a.href="tel:"+String(x.phone).replace(/[^0-9+]/g,"");phone.append(a);}else phone.append(node("strong","Not provided"));
     const email=node("div",undefined,"pro-contact-item");email.append(node("span","Email"));
     if(x.email){const a=node("a",x.email);a.href="mailto:"+x.email;email.append(a);}else email.append(node("strong","Not provided"));
     const preferred=node("div",undefined,"pro-contact-item");preferred.append(node("span","Preferred contact"),node("strong",x.contact_method||"Not specified"));
     const locationBox=node("div",undefined,"pro-contact-item");locationBox.append(node("span","Location"),node("strong",[x.city,x.zip_code].filter(Boolean).join(", ")||"Not provided"));
     contactGrid.append(name,phone,email,preferred,locationBox);
     contactHead.append(contactGrid);
     const actions=node("div",undefined,"pro-contact-actions");
     if(x.phone){const call=node("a","Call customer","button secondary");call.href="tel:"+String(x.phone).replace(/[^0-9+]/g,"");actions.append(call);}
     if(x.email){const mail=node("a","Email customer","button secondary");mail.href="mailto:"+x.email;actions.append(mail);}
     const project=node("div",undefined,"pro-project-details");
     project.append(node("h3","Project details"));
     const excluded=new Set(["Submission Token","Full Name","Phone Number","Email Address","Preferred contact method","City","ZIP Code","Service Type","Project Photo Paths","Project Photo Count"]);
     const entries=Object.entries(x.project_details||{}).filter(([key,value])=>!excluded.has(key)&&value!==null&&value!==undefined&&detailValue(value).trim()!=="");
     if(entries.length){
      const grid=node("div",undefined,"pro-project-grid");
      for(const [key,value] of entries){const item=node("div",undefined,"pro-project-item");item.append(node("span",key),node("p",detailValue(value)));grid.append(item);}
      project.append(grid);
     }else project.append(node("p","No additional project details were provided."));
     const photos=projectPhotoGallery(x.project_photos);if(photos)details.append(contactHead,actions,photos,project);else details.append(contactHead,actions,project);
     details.hidden=false;loaded=true;button.textContent="Hide contact";
    }catch(e){portal.say(e.message);}
    finally{button.disabled=false;}
   };
   card.append(button,details);
  }
  holder.append(card);
 }
}
function addShares(id,path,title){const holder=el(id);holder.replaceChildren();if(!path)return;const box=node("div",undefined,"share-tools");box.dataset.shareUrl=new URL(path,location.origin).href;box.dataset.shareTitle=title;holder.append(box);window.GetEstimateFastSharing?.render(box);}
async function loadMarketplace(){
 const current=generation;
 if(capabilities?.marketplace_enabled===false){
  for(const id of ["walletBalance","paidBalance","promoBalance","refundBalance","purchaseCount"])el(id).textContent="—";
  for(const id of ["profileShare","reviewInviteShare"])el(id).replaceChildren();
  el("dashboardNotice").textContent="Your account is available. Marketplace, wallet access, profile publishing and payments are not open yet.";
  for(const id of ["walletStatement","purchaseHistory","paymentHistory"])el(id).textContent="Not available while marketplace access is disabled.";
  return;
 }
 try{
  const d=await api("dashboard");if(current!==generation||!signedIn)return;el("dashboardNotice").textContent=d.payments_enabled===true?"Secure contact purchases are enabled. Customer details unlock only after Stripe payment confirmation.":"Contact payments are currently unavailable.";
  for(const [id,key] of [["walletBalance","available_cents"],["paidBalance","paid_cents"],["promoBalance","promotional_cents"],["refundBalance","refund_cents"]])el(id).textContent=money(d.wallet[key]);
  el("purchaseCount").textContent=d.purchase_count??d.purchases.length;
  table("walletStatement",["Date (Eastern Time)","Activity","Credit origin","Amount"],d.transactions.map(t=>[date(t.created_at),t.kind,t.bucket,(t.amount_cents<0?"−":"+")+money(Math.abs(t.amount_cents))]));
  renderPurchases(d.purchases,d.contact_release_enabled===true);
  table("paymentHistory",["Date","Purpose","Amount","Status"],d.pending_payments.map(p=>[date(p.created_at),p.purpose==="profile_service"?"Profile preparation":"Wallet top-up",money(p.amount_cents),p.status]));
  el("reviewPurchase").replaceChildren(node("option","External customer"));el("reviewPurchase").firstChild.value="";
  for(const p of d.purchases.filter(p=>p.status==="acquired")){const o=node("option",p.service_category+" — "+p.city);o.value=p.id;el("reviewPurchase").append(o);}
  const paymentState=new URLSearchParams(location.search).get("payment");
  const pendingOrder=sessionStorage.getItem("gef_pending_order_id");
  if(paymentState==="pending"&&pendingOrder&&d.payments_enabled===true){
   try{
    const order=await portal.api("live-checkout?order_id="+encodeURIComponent(pendingOrder));
    if(order.status==="paid"&&order.contact_release_enabled){
     sessionStorage.removeItem("gef_pending_order_id");
     el("dashboardNotice").textContent="Payment confirmed. Your customer contact is available under Purchased opportunities.";
    }else if(order.status==="refund_required"){
     sessionStorage.removeItem("gef_pending_order_id");
     el("dashboardNotice").textContent="Payment was received but contact access could not be completed. Support review is required.";
    }else{
     el("dashboardNotice").textContent="Payment is still being confirmed. Contact details remain locked until confirmation.";
    }
   }catch(e){el("dashboardNotice").textContent=e.message;}
  }
  const saved=(await api("public-profile")).profile;if(current!==generation||!signedIn)return;if(saved){
   const form=el("publicProfileForm");for(const [k,v] of Object.entries(saved)){const field=form.elements.namedItem(k);if(!field)continue;if(field.type==="checkbox")field.checked=v===true;else if(k==="categories")for(const o of field.options)o.selected=v.includes(o.value);else field.value=Array.isArray(v)?v.join("\n"):v??"";}
   portfolio=saved.portfolio||[];renderPortfolio();profileSeeded=true;
   addShares("profileShare",saved.published?"/professionals/"+saved.slug:null,saved.display_name);
   window.dispatchEvent(new CustomEvent("gef-public-profile",{detail:{profile:saved}}));
  }
 }catch(e){if(current===generation&&signedIn)el("dashboardNotice").textContent=e.message;}
}
window.addEventListener("gef-signed-in",()=>{signedIn=true;generation++;});
window.addEventListener("gef-profile",e=>{const {profile:p,categories}=e.detail;capabilities=e.detail.capabilities||null;
 availability.textContent=capabilities?.marketplace_enabled===false?"Public profile publishing is not open yet.":capabilities?.profile_editing_enabled===false?"Profile editing is not open yet.":"";
 for(const field of el("publicProfileForm").elements)field.disabled=capabilities?.marketplace_enabled===false||capabilities?.profile_editing_enabled===false;
 for(const id of ["createReviewInvite","profileServicePreview"])el(id).disabled=capabilities?.marketplace_enabled===false;
 for(const field of el("profile").elements)field.disabled=capabilities?.profile_editing_enabled===false;
 el("dashboardProfileStatus").textContent=p?.account_status||"Incomplete";for(const id of ["publicCategories","opportunityCategory"]){const select=el(id);if(id==="publicCategories")select.replaceChildren();else while(select.options.length>1)select.remove(1);for(const c of categories){const o=node("option",c);o.value=c;select.append(o);}}
 if(p&&!profileSeeded){const f=el("publicProfileForm");for(const [k,v] of Object.entries({display_name:p.business_name||p.display_name,city:p.city,zip_code:p.base_zip,radius_miles:p.service_radius_miles,about:p.bio||""}))f.elements.namedItem(k).value=v;for(const o of el("publicCategories").options)o.selected=p.service_categories.includes(o.value);}if(signedIn)loadMarketplace();
});
window.addEventListener("gef-opportunities",e=>{el("opportunityCount").textContent=e.detail.matching_total;el("opportunityCountNote").textContent="Matches for your current search filters";});
window.addEventListener("gef-signed-out",()=>{signedIn=false;generation++;for(const id of ["walletBalance","paidBalance","promoBalance","refundBalance","purchaseCount","opportunityCount","dashboardProfileStatus"])el(id).textContent="—";for(const id of ["walletStatement","purchaseHistory","paymentHistory","profileShare","reviewInviteShare"])el(id).replaceChildren();el("publicProfileForm").reset();portfolio=[];renderPortfolio();profileSeeded=false;});
el("publicProfileForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),obj=Object.fromEntries(f);obj.categories=f.getAll("categories");obj.languages=String(obj.languages).split("\n").map(s=>s.trim()).filter(Boolean);obj.social_links=String(obj.social_links).split("\n").map(s=>s.trim()).filter(Boolean);obj.radius_miles=Number(obj.radius_miles);for(const k of ["published","publish_email","publish_phone"])obj[k]=f.get(k)==="on";obj.portfolio=portfolio;try{const r=await api("public-profile","POST",obj);portal.say("Public profile saved.");addShares("profileShare",obj.published?r.profile_path:null,obj.display_name);window.dispatchEvent(new CustomEvent("gef-public-profile",{detail:{profile:obj}}));}catch(ex){portal.say(ex.message);}};
el("addPortfolio").onclick=async()=>{const file=el("portfolioFile").files[0];if(!file||file.size>3000000||!el("portfolioPermission").checked||el("portfolioTitle").value.trim().length<2){portal.say("Choose a photo up to 3 MB, enter a title and confirm permission.");return;}const button=el("addPortfolio");button.disabled=true;try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});const r=await api("portfolio-upload","POST",{data,rightsConsent:true});portfolio.push({image_path:r.image_path,title:el("portfolioTitle").value.trim(),description:el("portfolioDescription").value.trim()});renderPortfolio();portal.say("Photo uploaded. Save your profile to publish it.");el("portfolioFile").value="";el("portfolioPermission").checked=false;}catch(e){portal.say(e.message);}finally{button.disabled=false;}};
el("createReviewInvite").onclick=async()=>{const b=el("createReviewInvite");b.disabled=true;try{const r=await api("review-invitation","POST",{purchase_id:el("reviewPurchase").value||null});addShares("reviewInviteShare",r.review_path,"Please review my work on GetEstimateFast");portal.say("Invitation created. Share it manually with one customer. It expires in 30 days.");}catch(e){portal.say(e.message);}finally{b.disabled=false;}};
el("profileServicePreview").onclick=async()=>{try{const r=await api("profile-service-preview","POST",{});el("profileServiceDetails").textContent=r.price_label+". "+r.note;}catch(e){portal.say(e.message);}};
})();
