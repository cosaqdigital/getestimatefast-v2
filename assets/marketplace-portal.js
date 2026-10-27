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
<section id="publicProfilePanel" class="pro-profile-editor">
  <div class="pro-profile-editor-head">
    <div><p class="eyebrow">YOUR PUBLIC PROFILE</p><h2>Build your professional presence</h2><p>Complete your profile so homeowners can understand your business, services, service area, work and reputation before requesting an estimate.</p></div>
    <div class="pro-profile-strength"><span>Profile strength</span><strong id="profileStrengthValue">0%</strong><div><i id="profileStrengthBar"></i></div><small id="profileStrengthHint">Add your business details to get started.</small></div>
  </div>

  <form id="publicProfileForm">
    <section class="pro-editor-section">
      <div class="pro-section-head"><div><span class="pro-step">01</span><h3>Visual identity</h3><p>Add the images customers will see first on your public profile.</p></div></div>
      <div class="pro-identity-grid">
        <div class="pro-media-editor">
          <div class="pro-media-preview pro-logo-preview" id="profileImagePreview"><span>Logo or profile image</span></div>
          <div><strong>Logo / profile image</strong><p>Use your business logo or a clear professional image. JPG, PNG or WebP, up to 3 MB.</p>
          <label class="pro-file-label">Choose image<input id="profileImageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label class="check"><input id="profileImagePermission" type="checkbox">I have permission to publish this image.</label>
          <button id="uploadProfileImage" type="button" class="secondary">Upload profile image</button></div>
        </div>
        <div class="pro-media-editor pro-cover-editor">
          <div class="pro-media-preview pro-cover-preview" id="coverImagePreview"><span>Cover image</span></div>
          <div><strong>Profile cover</strong><p>Choose a wide image that represents your company or quality of work.</p>
          <label class="pro-file-label">Choose cover<input id="coverImageFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <label class="check"><input id="coverImagePermission" type="checkbox">I have permission to publish this image.</label>
          <button id="uploadCoverImage" type="button" class="secondary">Upload cover image</button></div>
        </div>
      </div>
    </section>

    <section class="pro-editor-section">
      <div class="pro-section-head"><div><span class="pro-step">02</span><h3>Business identity</h3><p>Tell customers who you are and what makes your company worth considering.</p></div></div>
      <div class="form-grid">
        <label>Professional or business name<input name="display_name" maxlength="150" required></label>
        <label>Public profile link<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" minlength="3" maxlength="80" placeholder="your-business-name" required></label>
        <label class="wide">Professional headline<input name="headline" maxlength="180" placeholder="Painting, remodeling and home improvement services"></label>
        <label>Years of experience<input name="years_experience" type="number" min="0" max="80" placeholder="e.g. 8"></label>
        <label class="wide">About your business<textarea name="about" maxlength="2000" rows="6" placeholder="Describe your experience, the work you specialize in and what customers can expect when working with you."></textarea></label>
      </div>
    </section>

    <section class="pro-editor-section">
      <div class="pro-section-head"><div><span class="pro-step">03</span><h3>Services & service area</h3><p>Choose the work you perform and where you want customers to find you.</p></div></div>
      <div class="form-grid">
        <label>City<input name="city" required></label>
        <label>State<input name="state_code" value="FL" readonly></label>
        <label>ZIP Code<input name="zip_code" pattern="[0-9]{5}" maxlength="5" required></label>
        <label>Service radius in miles<input name="radius_miles" type="number" min="1" max="100" value="25" required></label>
        <label class="wide">Service categories<select name="categories" id="publicCategories" multiple required></select></label>
        <label class="wide">Languages (one per line)<textarea name="languages" rows="3" placeholder="English&#10;Spanish"></textarea></label>
      </div>
    </section>

    <section class="pro-editor-section">
      <div class="pro-section-head"><div><span class="pro-step">04</span><h3>Recent work & portfolio</h3><p>Show real examples of your work. Six strong projects are enough to create a complete portfolio presentation.</p></div><span id="portfolioCount" class="pro-count-pill">0 projects</span></div>
      <div id="portfolioItems" class="pro-portfolio-editor-grid"></div>
      <div class="pro-portfolio-add">
        <div class="form-grid">
          <label>Project title<input id="portfolioTitle" maxlength="120" placeholder="Kitchen cabinet installation"></label>
          <label>Project description<input id="portfolioDescription" maxlength="600" placeholder="Briefly explain the work completed"></label>
          <label class="wide">Work photo (JPG, PNG or WebP, up to 3 MB)<input id="portfolioFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
        </div>
        <label class="check"><input id="portfolioPermission" type="checkbox">I have permission to publish this photo and it does not expose private customer information.</label>
        <button id="addPortfolio" type="button" class="secondary">Add project to portfolio</button>
      </div>
    </section>

    <section class="pro-editor-section pro-publish-section">
      <div class="pro-section-head"><div><span class="pro-step">05</span><h3>Preview & publish</h3><p>Save your work at any time. Publish only when you are ready for customers to view the profile.</p></div></div>
      <label class="check pro-publish-check"><input name="published" type="checkbox">Publish my professional profile on GetEstimateFast.</label>
      <div class="pro-publish-actions"><button type="submit">Save public profile</button><a id="viewPublicProfile" class="button secondary" href="#" target="_blank" rel="noopener" hidden>View public profile</a></div>
      <div id="profileShare"></div>
    </section>
  </form>

  <section class="pro-editor-section pro-reviews-editor">
    <div class="pro-section-head"><div><span class="pro-step">06</span><h3>Customer reviews</h3><p>Invite legitimate customers to review your work. Reviews are verified and moderated before publication.</p></div></div>
    <label>Review source<select id="reviewPurchase"><option value="">External customer</option></select></label>
    <button id="createReviewInvite" type="button" class="secondary">Create review invitation</button>
    <div id="reviewInviteShare"></div>
  </section>

  <aside class="pro-profile-help-card">
    <div><span class="pro-assist-kicker">NEED HELP?</span><h3>Not sure what to write — or want our team to build it for you?</h3><p>Your self-service profile is always free. If you prefer, our team can prepare the complete presentation, organize your portfolio and create a basic logo if needed.</p></div>
    <a id="profileAssistOpen" class="button secondary" href="/professional-profile-setup.html" target="_blank" rel="noopener">See Professional Profile Setup</a>
  </aside>
</section>`;
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
 for(const id of ["createReviewInvite","profileAssistOpen","profileServiceCheckout"]){const control=el(id);if(control)control.disabled=capabilities?.marketplace_enabled===false;}
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
const assistDetails=el("profileAssistDetails"),assistOpen=el("profileAssistOpen"),assistClose=el("profileAssistClose"),assistCheckout=el("profileServiceCheckout"),assistState=el("profileServiceState"),assistIntake=el("profileServiceIntake"),assistCategories=el("profileServiceCategories");
let profileServiceOrder=null;

function fillAssistCategories(){
 if(!assistCategories)return;
 const source=el("publicCategories");
 const selected=new Set([...assistCategories.selectedOptions].map(o=>o.value));
 assistCategories.replaceChildren();
 for(const option of source?.options||[]){
  const o=node("option",option.textContent);o.value=option.value;o.selected=selected.has(option.value)||option.selected;assistCategories.append(o);
 }
}
function assistStatusLabel(status){
 return ({awaiting_payment:"Awaiting payment",paid:"Payment received",intake_pending:"Payment received — information needed",submitted:"Information submitted",in_progress:"Our team is building your profile",review_ready:"Profile ready for your review",completed:"Profile setup completed",failed:"Payment failed",expired:"Checkout expired",canceled:"Canceled",refund_required:"Refund review required",refunded:"Refunded"})[status]||String(status||"");
}
async function loadProfileService(){
 if(!signedIn)return;
 try{
  const r=await portal.api("profile-service-checkout");
  profileServiceOrder=r.existing_order||null;
  if(r.price?.amount_cents)assistCheckout.textContent="Build My Profile for "+money(r.price.amount_cents);
  if(profileServiceOrder){
   assistState.textContent=assistStatusLabel(profileServiceOrder.status);
   const paidStates=new Set(["paid","intake_pending","submitted","in_progress","review_ready","completed"]);
   assistCheckout.hidden=paidStates.has(profileServiceOrder.status);
   assistIntake.hidden=!["paid","intake_pending"].includes(profileServiceOrder.status);
   if(profileServiceOrder.status==="submitted")assistState.textContent="Information submitted. Our team can now begin preparing your profile.";
   if(profileServiceOrder.status==="in_progress")assistState.textContent="Our team is currently preparing your professional profile.";
   if(profileServiceOrder.status==="review_ready")assistState.textContent="Your profile is ready for review.";
   if(profileServiceOrder.status==="completed")assistState.textContent="Your assisted profile setup is complete.";
  }else{
   assistCheckout.hidden=false;assistIntake.hidden=true;assistState.textContent="";
  }
  const state=new URLSearchParams(location.search).get("profile_service");
  const pending=sessionStorage.getItem("gef_profile_service_intent_id");
  if(state==="pending"&&pending){
   const check=await portal.api("profile-service-checkout?intent_id="+encodeURIComponent(pending));
   if(check.status==="confirmed"){
    sessionStorage.removeItem("gef_profile_service_intent_id");
    assistDetails.hidden=false;profileServiceOrder={...(profileServiceOrder||{}),order_id:check.order_id,status:check.order_status||"intake_pending"};
    assistCheckout.hidden=true;assistIntake.hidden=false;assistState.textContent="Payment received. Complete the information below so our team can begin.";
   }else assistState.textContent="Payment is still being confirmed by Stripe.";
  }else if(state==="canceled"){
   sessionStorage.removeItem("gef_profile_service_intent_id");assistState.textContent="Checkout was canceled. No profile service was purchased.";
  }
 }catch(e){assistState.textContent=e.message||"Profile setup service is temporarily unavailable.";}
}
assistOpen.addEventListener("click",()=>{assistDetails.hidden=false;fillAssistCategories();loadProfileService();assistDetails.scrollIntoView({behavior:"smooth",block:"start"});});
assistClose.addEventListener("click",()=>{assistDetails.hidden=true;assistOpen.focus();});
assistCheckout.addEventListener("click",async()=>{
 assistCheckout.disabled=true;
 try{
  const r=await portal.api("profile-service-checkout","POST",{action:"checkout",operation_key:"profile_"+crypto.randomUUID()});
  if(r.service_ready){assistDetails.hidden=false;assistCheckout.hidden=true;assistIntake.hidden=false;assistState.textContent="Payment already confirmed. Complete your business information below.";return;}
  sessionStorage.setItem("gef_profile_service_intent_id",r.intent_id);
  window.location.assign(r.checkout_url);
 }catch(e){assistCheckout.disabled=false;portal.say(e.message);}
});
assistIntake.addEventListener("submit",async e=>{
 e.preventDefault();
 if(!profileServiceOrder?.order_id){portal.say("Your paid profile setup order could not be found. Reload the page.");return;}
 const submit=e.submitter;submit.disabled=true;
 const f=new FormData(e.currentTarget);
 try{
  const body={action:"intake",order_id:profileServiceOrder.order_id,business_name:f.get("business_name"),logo_plan:f.get("logo_plan"),years_experience:f.get("years_experience"),city:f.get("city"),zip_code:f.get("zip_code"),radius_miles:Number(f.get("radius_miles")),services:f.getAll("services"),languages:String(f.get("languages")||"").split("\n").map(x=>x.trim()).filter(Boolean),company_story:f.get("company_story"),portfolio_notes:f.get("portfolio_notes"),notes:f.get("notes")};
  await portal.api("profile-service-checkout","POST",body);
  assistIntake.hidden=true;assistState.textContent="Information submitted. Our team can now begin preparing your profile.";profileServiceOrder.status="submitted";
  portal.say("Your Professional Profile Setup information was submitted.");
 }catch(err){portal.say(err.message);}finally{submit.disabled=false;}
});
window.addEventListener("gef-signed-in",()=>queueMicrotask(()=>{fillAssistCategories();loadProfileService();}));
})();
