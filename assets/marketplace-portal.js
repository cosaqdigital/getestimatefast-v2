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
el("signup").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const r=await portal.api("signup","POST",{email:f.get("email"),phone:f.get("phone"),password:f.get("password"),privacyConsent:f.get("privacyConsent")==="on",termsConsent:f.get("termsConsent")==="on",smsOptIn:f.get("smsOptIn")==="on"});e.target.reset();portal.say(r.message);}catch(ex){portal.say(ex.message);}};
panels.innerHTML=`<nav class="portal-nav" aria-label="Contractor navigation"><a href="#contractorDashboard">Dashboard</a><a href="#opportunityPanel">Opportunities</a><a href="#walletPanel">Wallet</a><a href="#purchasePanel">Purchase history</a><a href="#publicProfilePanel">Public profile</a><a href="#profile">Account settings</a></nav>
<section id="contractorDashboard"><p class="eyebrow">Your professional workspace</p><h1>Welcome to GetEstimateFast</h1><p>We Connect. You Decide.</p><div class="metric-grid"><div class="metric">Matching opportunities<strong id="opportunityCount">—</strong><small id="opportunityCountNote">Load opportunities to see your matches</small></div><div class="metric">Acquired opportunities<strong id="purchaseCount">—</strong><small>See your purchase history below</small></div><div class="metric">Available credits<strong id="walletBalance">—</strong><small>USD · wallet and card payments</small></div><div class="metric">Profile status<strong id="dashboardProfileStatus">—</strong><small>Manage your services and service area</small></div></div><div class="actions"><a class="button" href="#opportunityPanel">Explore opportunities</a><a class="button secondary" href="#publicProfilePanel">Create your free public profile</a></div><p id="dashboardNotice" class="muted"></p></section>
<section id="walletPanel"><h2>Your wallet</h2><p>Paid credits, promotional credits and refund credits are tracked separately. Pending payments are not available credits.</p><div class="metric-grid"><div class="metric">Paid credits<strong id="paidBalance">—</strong></div><div class="metric">Promotional credits<strong id="promoBalance">—</strong></div><div class="metric">Refund credits<strong id="refundBalance">—</strong></div></div><p class="notice">Add credits securely with Stripe. Bonus credits are promotional and cannot be withdrawn or transferred.</p><h3>Add Credits</h3><div id="creditPackages" class="pro-coming-grid"></div><div class="form-grid"><label>Custom amount (USD)<input id="customTopupAmount" inputmode="decimal" placeholder="25.00" pattern="\\d{1,6}(\\.\\d{1,2})?"></label><div style="align-self:end"><button id="customTopupButton" type="button" class="secondary">Add custom amount</button></div></div><p class="muted">Promotional packages are optional. You can also add only the amount you choose.</p><h3>Statement</h3><div id="walletStatement" class="table-wrap"><p>Your statement will appear when marketplace access is enabled.</p></div><h3>Payment history</h3><div id="paymentHistory" class="table-wrap"></div></section>
<section id="purchasePanel"><h2>Purchased opportunities</h2><p>View your purchased opportunities and access unlocked customer contact details.</p><div id="purchaseHistory" class="table-wrap"><p>No history loaded.</p></div></section>
<section id="publicProfilePanel"><h2>Your free public profile</h2><p>Create a shareable showcase for your services, work and customer reviews. Preparing your own profile is free.</p>
<div class="pro-profile-assist-teaser" id="profileAssistTeaser">
  <div><span class="pro-assist-kicker">OPTIONAL PROFESSIONAL SERVICE</span><h3>Want our team to build your profile for you?</h3><p>We can turn your business information, services and project photos into a complete, polished GetEstimateFast profile — while you keep the option to build it yourself for free.</p></div>
  <button id="profileAssistOpen" type="button" class="secondary">See what our team can build</button>
</div>
<section class="pro-profile-assist" id="profileAssistDetails" hidden>
  <div class="pro-assist-head"><span class="pro-assist-kicker">PROFESSIONAL PROFILE SETUP</span><h3>We build the profile. You focus on the work.</h3><p>Our team organizes your business information into a professional profile designed to clearly present your services, work and reputation inside GetEstimateFast.</p></div>
  <div class="pro-assist-grid">
    <article><span>01</span><strong>Business positioning</strong><p>We refine your headline, company description and service presentation so homeowners quickly understand what you do.</p></article>
    <article><span>02</span><strong>Logo support</strong><p>If you already have a logo, we prepare it for the profile. If you do not, a basic business logo can be created as part of the setup.</p></article>
    <article><span>03</span><strong>Services & service area</strong><p>We organize your active services, location, ZIP Code and service radius using the categories available on GetEstimateFast.</p></article>
    <article><span>04</span><strong>Portfolio presentation</strong><p>We organize up to 6 initial work photos with clear project titles and descriptions. You must have permission to publish every image.</p></article>
    <article><span>05</span><strong>Profile copy & search readiness</strong><p>We write clear customer-facing profile copy and structure the content so the profile is ready for future search visibility features when indexing is enabled.</p></article>
    <article><span>06</span><strong>Review setup</strong><p>We help you prepare the profile to request legitimate customer reviews through the GetEstimateFast review flow.</p></article>
  </div>
  <div class="pro-assist-example">
    <div><span>BEFORE</span><strong>Basic information</strong><p>Business name, a few services and little context.</p></div>
    <div class="pro-assist-arrow">→</div>
    <div><span>AFTER</span><strong>Complete professional presentation</strong><p>Logo, clear positioning, services, service area, portfolio, profile copy and review-ready presentation.</p></div>
  </div>
  <div class="pro-assist-rules">
    <h4>What this service does — and does not do</h4>
    <ul><li>Your GetEstimateFast account and self-service profile remain free.</li><li>The $100 service pays for our team's preparation work; it does not buy leads or wallet credits.</li><li>It does not guarantee jobs, customer contacts, reviews, search rankings or placement above other professionals.</li><li>Any “Profile Complete” status is based on profile completeness, not on payment.</li><li>You remain responsible for the accuracy of business information, rights to photos and any license or credential claims you provide.</li></ul>
  </div>
  <div class="pro-assist-offer">
    <div><span class="pro-assist-kicker">LAUNCH OFFER</span><p class="pro-assist-price"><s>$180</s> <strong>$100</strong> <small>one-time</small></p><p>Launch pricing for the assisted Professional Profile Setup. Planned standard price after the promotion: $180.</p></div>
    <div><button id="profileServiceCheckout" type="button">Build My Profile for $100</button><p class="pro-assist-safe">Secure payment through Stripe. Opportunity credits are not used.</p></div>
  </div>
  <div id="profileServiceState" class="pro-assist-state"></div>
  <form id="profileServiceIntake" class="pro-assist-intake" hidden>
    <div class="pro-section-head"><div><span class="pro-assist-kicker">AFTER PAYMENT</span><h3>Tell our team about your business</h3><p>Submit the information we should use to prepare your profile.</p></div></div>
    <div class="form-grid">
      <label>Business name<input name="business_name" maxlength="150" required></label>
      <label>Logo<select name="logo_plan" required><option value="">Choose one</option><option value="have_logo">I already have a logo</option><option value="need_logo">I need a basic logo created</option></select></label>
      <label>Years of experience<input name="years_experience" maxlength="60" placeholder="e.g. 8 years"></label>
      <label>City<input name="city" maxlength="80" required></label>
      <label>ZIP Code<input name="zip_code" pattern="[0-9]{5}" maxlength="5" required></label>
      <label>Service radius in miles<input name="radius_miles" type="number" min="1" max="100" value="25" required></label>
      <label class="wide">Services<select name="services" id="profileServiceCategories" multiple required></select></label>
      <label class="wide">Languages (one per line)<textarea name="languages" rows="3" placeholder="English&#10;Spanish"></textarea></label>
      <label class="wide">About your company<textarea name="company_story" rows="5" maxlength="3000" placeholder="Tell us what makes your business different, your experience and the type of work you prefer."></textarea></label>
      <label class="wide">Portfolio notes<textarea name="portfolio_notes" rows="4" maxlength="3000" placeholder="Tell us about the projects or photos you want highlighted."></textarea></label>
      <label class="wide">Anything else our team should know?<textarea name="notes" rows="3" maxlength="3000"></textarea></label>
    </div>
    <button type="submit">Submit Information to Our Team</button>
  </form>
  <button id="profileAssistClose" type="button" class="secondary pro-assist-close">Close details</button>
</section><form id="publicProfileForm"><div class="form-grid"><label>Public link name<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="80" placeholder="your-business-name" required></label><label>Professional or business name<input name="display_name" maxlength="150" required></label><label class="wide">Headline<input name="headline" maxlength="180"></label><label class="wide">About your services<textarea name="about" maxlength="2000" rows="4"></textarea></label><label>City<input name="city" required></label><label>State<input name="state_code" value="FL" readonly></label><label>ZIP Code<input name="zip_code" pattern="[0-9]{5}" maxlength="5" required></label><label>Service radius in miles<input name="radius_miles" type="number" min="1" max="100" value="25" required></label><label>Service categories<select name="categories" id="publicCategories" multiple required></select></label><label>Languages (one per line)<textarea name="languages" rows="4" placeholder="English&#10;Spanish"></textarea></label><label class="wide">Social media links (one HTTPS link per line)<textarea name="social_links" rows="3"></textarea></label><label>Public email<input name="public_email" type="email"></label><label>Public US phone<input name="public_phone" type="tel"></label></div><label class="check"><input name="publish_email" type="checkbox">I consent to publishing the email entered above.</label><label class="check"><input name="publish_phone" type="checkbox">I consent to publishing the phone entered above.</label><label class="check"><input name="published" type="checkbox">Publish my profile and the information entered here.</label><h3>Work photos</h3><p>Publish only photos you have permission to share. Avoid customer faces, addresses and private information.</p><div id="portfolioItems"></div><label>Work title<input id="portfolioTitle" maxlength="120"></label><label>Work description<input id="portfolioDescription" maxlength="600"></label><label>Photo (JPG, PNG or WebP, up to 3 MB)<input id="portfolioFile" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="check"><input id="portfolioPermission" type="checkbox">I have permission to publish this photo.</label><button id="addPortfolio" type="button" class="secondary">Add work photo</button><p><button>Save public profile</button></p></form><div id="profileShare"></div><h3>Request a customer review</h3><p>Invite a customer you have served, including customers from outside GetEstimateFast. Google verification is the fastest option; email verification remains available as an alternative. GetEstimateFast moderates reviews before publication. External reviews are labeled as external.</p><label>Review source<select id="reviewPurchase"><option value="">External customer</option></select></label><button id="createReviewInvite" type="button" class="secondary">Create review invitation</button><div id="reviewInviteShare"></div></section>`;
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
function topupCents(value){
 const text=String(value||"").trim();
 if(!/^\\d{1,6}(\\.\\d{1,2})?$/.test(text))throw Error("Enter a valid USD amount, for example 25.00.");
 const [d,f=""]=text.split(".");
 const cents=Number(d)*100+Number(f.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<100)throw Error("Minimum wallet top-up is $1.00.");
 return cents;
}
async function startTopup(payload){
 const result=await portal.api("wallet-topup","POST",{...payload,operation_key:"topup_"+crypto.randomUUID()});
 if(result.credited){portal.say("Wallet credits are already available.");window.dispatchEvent(new CustomEvent("gef-wallet-updated"));return;}
 sessionStorage.setItem("gef_pending_topup_intent_id",result.intent_id);
 window.location.assign(result.checkout_url);
}
function renderTopupPromotions(promotions){
 const holder=el("creditPackages");holder.replaceChildren();
 if(!promotions?.length){holder.append(node("p","No bonus packages are active right now. You can still add a custom amount."));return;}
 for(const p of promotions){
  const card=node("article",undefined,"pro-coming-card");
  const amount=money(p.amount_cents),total=money(p.total_cents),bonus=money(p.bonus_cents);
  card.append(node("strong","Add "+amount+" → Get "+total),node("p","Includes "+bonus+" promotional bonus."));
  const button=node("button","Add "+amount,"secondary");button.type="button";
  button.onclick=async()=>{button.disabled=true;try{await startTopup({promotion_id:p.id});}catch(e){button.disabled=false;portal.say(e.message);}};
  card.append(button);holder.append(card);
 }
}
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
  const d=await api("dashboard");if(current!==generation||!signedIn)return;el("dashboardNotice").textContent=d.payments_enabled===true?"Wallet credits and secure card purchases are enabled. Customer details unlock only after a completed purchase.":"Contact payments are currently unavailable.";
  if(d.payments_enabled===true){const topups=await portal.api("wallet-topup");if(current!==generation||!signedIn)return;renderTopupPromotions(topups.promotions||[]);}else renderTopupPromotions([]);
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
  const walletState=new URLSearchParams(location.search).get("wallet");
  const pendingTopup=sessionStorage.getItem("gef_pending_topup_intent_id");
  if(walletState==="pending"&&pendingTopup&&d.payments_enabled===true){
   try{
    const topup=await portal.api("wallet-topup?intent_id="+encodeURIComponent(pendingTopup));
    if(topup.status==="confirmed"){
     sessionStorage.removeItem("gef_pending_topup_intent_id");
     el("dashboardNotice").textContent="Wallet top-up confirmed. Your credits are available.";
    }else el("dashboardNotice").textContent="Wallet top-up is still being confirmed by Stripe.";
   }catch(e){el("dashboardNotice").textContent=e.message;}
  }else if(walletState==="canceled"){
   sessionStorage.removeItem("gef_pending_topup_intent_id");
   el("dashboardNotice").textContent="Wallet top-up was canceled. No credits were added.";
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
 if(p&&!profileSeeded){const f=el("publicProfileForm");for(const [k,v] of Object.entries({display_name:p.business_name||p.display_name,city:p.city,zip_code:p.base_zip,radius_miles:p.service_radius_miles,about:p.bio||""}))f.elements.namedItem(k).value=v;for(const o of el("publicCategories").options)o.selected=p.service_categories.includes(o.value);}if(signedIn&&p)loadMarketplace();
});
window.addEventListener("gef-opportunities",e=>{el("opportunityCount").textContent=e.detail.matching_total;el("opportunityCountNote").textContent="Matches for your current search filters";});
window.addEventListener("gef-signed-out",()=>{signedIn=false;generation++;for(const id of ["walletBalance","paidBalance","promoBalance","refundBalance","purchaseCount","opportunityCount","dashboardProfileStatus"])el(id).textContent="—";for(const id of ["walletStatement","purchaseHistory","paymentHistory","profileShare","reviewInviteShare"])el(id).replaceChildren();el("publicProfileForm").reset();portfolio=[];renderPortfolio();profileSeeded=false;});
el("publicProfileForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),obj=Object.fromEntries(f);obj.categories=f.getAll("categories");obj.languages=String(obj.languages).split("\n").map(s=>s.trim()).filter(Boolean);obj.social_links=String(obj.social_links).split("\n").map(s=>s.trim()).filter(Boolean);obj.radius_miles=Number(obj.radius_miles);for(const k of ["published","publish_email","publish_phone"])obj[k]=f.get(k)==="on";obj.portfolio=portfolio;try{const r=await api("public-profile","POST",obj);portal.say("Public profile saved.");addShares("profileShare",obj.published?r.profile_path:null,obj.display_name);window.dispatchEvent(new CustomEvent("gef-public-profile",{detail:{profile:obj}}));}catch(ex){portal.say(ex.message);}};
el("addPortfolio").onclick=async()=>{const file=el("portfolioFile").files[0];if(!file||file.size>3000000||!el("portfolioPermission").checked||el("portfolioTitle").value.trim().length<2){portal.say("Choose a photo up to 3 MB, enter a title and confirm permission.");return;}const button=el("addPortfolio");button.disabled=true;try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});const r=await api("portfolio-upload","POST",{data,rightsConsent:true});portfolio.push({image_path:r.image_path,title:el("portfolioTitle").value.trim(),description:el("portfolioDescription").value.trim()});renderPortfolio();portal.say("Photo uploaded. Save your profile to publish it.");el("portfolioFile").value="";el("portfolioPermission").checked=false;}catch(e){portal.say(e.message);}finally{button.disabled=false;}};
el("createReviewInvite").onclick=async()=>{const b=el("createReviewInvite");b.disabled=true;try{const r=await api("review-invitation","POST",{purchase_id:el("reviewPurchase").value||null});addShares("reviewInviteShare",r.review_path,"Please review my work on GetEstimateFast");portal.say("Invitation created. Share it manually with one customer. It expires in 30 days.");}catch(e){portal.say(e.message);}finally{b.disabled=false;}};
el("customTopupButton").onclick=async()=>{const b=el("customTopupButton");b.disabled=true;try{await startTopup({amount_cents:topupCents(el("customTopupAmount").value)});}catch(e){b.disabled=false;portal.say(e.message);}};
window.addEventListener("gef-wallet-updated",()=>{if(signedIn)loadMarketplace();});
el("profileServicePreview").onclick=async()=>{try{const r=await api("profile-service-preview","POST",{});el("profileServiceDetails").textContent=r.price_label+". "+r.note;}catch(e){portal.say(e.message);}};
})();
