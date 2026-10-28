"use strict";
const crypto=require("node:crypto");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const stars=value=>{
 const rating=Math.max(0,Math.min(5,Number(value)||0));
 return "★".repeat(Math.round(rating))+"☆".repeat(5-Math.round(rating));
};
const initials=value=>String(value||"Professional").split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();
function profileHtml(data,origin,storageOrigin,referral={}){
 const p=data.profile,url=origin+"/professionals/"+encodeURIComponent(p.slug),title=p.display_name+" | GetEstimateFast";
 const image=p.profile_image_path?storageOrigin+"/storage/v1/object/public/gef-portfolio/"+p.profile_image_path:(p.portfolio?.[0]?storageOrigin+"/storage/v1/object/public/gef-portfolio/"+p.portfolio[0].image_path:origin+"/assets/images/hero-home-improvement.jpg");
 const demo=referral.synthetic===true;
 const categories=Array.isArray(p.categories)?p.categories:[];
 const languages=Array.isArray(p.languages)?p.languages:[];
 const portfolio=Array.isArray(p.portfolio)?p.portfolio:[];
 const reviews=Array.isArray(data.reviews)?data.reviews:[];
 const summary=data.review_summary||{};
 const ranking=data.ranking_summary||{};
 const badges=ranking.badges||{};
 const badgeItems=[
  badges.top_rated&&["Top Rated","top"],
  badges.highly_rated&&["Highly Rated","high"],
  badges.profile_complete&&["Profile Complete","complete"],
  badges.new_professional&&["New Professional","new"]
 ].filter(Boolean);
 const reviewCount=Number(summary.approved_count)||0;
 const average=reviewCount>0&&Number.isFinite(Number(summary.average_rating))?Number(summary.average_rating):null;
 const serviceOptions=categories.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
 const requestButton=referral.token?'<a class="gef-profile-primary-button" href="#requestEstimate">Request a Free Estimate</a>':"";
 const demoMessage=demo?'<p class="notice" role="note"><strong>Development test only.</strong> Use the prefilled synthetic details below. Do not enter a real customer name, phone or email.</p>':"";
 const avatar=p.profile_image_path
  ?'<img class="gef-profile-avatar-image" src="'+esc(storageOrigin+"/storage/v1/object/public/gef-portfolio/"+p.profile_image_path)+'" alt="'+esc(p.display_name)+' profile image">'
  :'<span class="gef-profile-avatar-fallback" aria-hidden="true">'+esc(initials(p.display_name))+'</span>';
 const heroStyle=p.cover_image_path?' style="background-image:linear-gradient(90deg,rgba(3,33,78,.88),rgba(9,71,145,.66)),url(\''+esc(storageOrigin+"/storage/v1/object/public/gef-portfolio/"+p.cover_image_path)+'\')"':"";
 const serviceChips=categories.map((service,index)=>'<span class="gef-profile-service-chip"><span aria-hidden="true">'+(["⌂","▤","✦","⌁","▣","◇"][index%6])+'</span>'+esc(service)+'</span>').join("");
 const portfolioCards=portfolio.slice(0,10).map(item=>'<article class="gef-profile-work-card"><button type="button" class="gef-profile-work-image-button" aria-label="View '+esc(item.title)+'"><img loading="lazy" src="'+esc(storageOrigin+"/storage/v1/object/public/gef-portfolio/"+item.image_path)+'" alt="'+esc(item.title)+'"></button><div><h3>'+esc(item.title)+'</h3><p>'+esc(item.description)+'</p></div></article>').join("");
 const reviewCards=reviews.slice(0,6).map(r=>'<article class="gef-profile-review-card"><div class="gef-profile-review-top"><div><strong>'+esc(r.display_name)+'</strong><span class="gef-profile-review-stars" aria-label="'+esc(r.rating)+' out of 5 stars">'+esc(stars(r.rating))+'</span></div><span class="gef-profile-review-source">'+(r.source==="external"?"External customer review":"GetEstimateFast contact")+'</span></div><p>'+esc(r.comment)+'</p><small>'+(r.source==="external"?"External customer review":"Review from a platform contact; service completion is not verified")+'</small><button type="button" class="secondary report-review" data-review-id="'+esc(r.id)+'">Report review</button></article>').join("");
 const quoteForm=referral.token?[
  '<aside class="gef-profile-estimate-card" id="requestEstimate" aria-labelledby="requestEstimateTitle">',
  '<div class="gef-profile-estimate-heading"><p class="eyebrow">FREE ESTIMATE REQUEST</p><h2 id="requestEstimateTitle">Request a Free Estimate</h2><p>No cost. No obligation. Your request stays inside GetEstimateFast.</p></div>',
  demoMessage,
  '<form action="/api/profile-request" method="post" class="profile-quote-form" accept-charset="utf-8">',
  '<input type="hidden" name="profile_slug" value="'+esc(p.slug)+'">',
  '<input type="hidden" name="profile_token" value="'+esc(referral.token)+'">',
  '<input type="hidden" name="submission_token" value="'+esc(crypto.randomUUID())+'">',
  '<label class="request-honeypot" aria-hidden="true">Leave empty<input tabindex="-1" autocomplete="off" name="website"></label>',
  '<label>Service needed<select name="service" required><option value="">Select a service</option>'+serviceOptions+'</select></label>',
  '<div class="profile-request-grid">',
  '<label>City<input name="city" required maxlength="80" autocomplete="address-level2" value="'+esc(p.city)+'"></label>',
  '<label>ZIP Code<input name="zip" pattern="[0-9]{5}" inputmode="numeric" maxlength="5" required value="'+esc(p.zip_code)+'"></label>',
  '</div>',
  '<label class="profile-request-desc">Tell us about your project<textarea name="description" rows="4" required minlength="20" maxlength="2400" placeholder="Describe the work, timing and any useful details.">'+(demo?'TEST ONLY: Interior painting for one room in a synthetic QA scenario.':'')+'</textarea></label>',
  '<div class="gef-profile-contact-fields"><h3>Your contact details</h3><p>These are not displayed publicly. They are used only for this estimate request under platform rules.</p><div class="profile-request-grid">',
  '<label>Your full name<input name="full_name" required minlength="2" maxlength="120" autocomplete="name" value="'+(demo?'TEST ONLY Customer':'')+'"></label>',
  '<label>Email<input type="email" name="email" maxlength="254" required autocomplete="email" value="'+(demo?'synthetic@example.invalid':'')+'"></label>',
  '<label>US phone number<input type="tel" name="phone" required autocomplete="tel" value="'+(demo?'8135550100':'')+'"></label>',
  '</div></div>',
  '<label class="profile-consent"><input type="checkbox" name="contact_consent" value="yes" required><span>I understand my contact details will be shared at no charge with this professional after approval and publication. Other local professionals may also purchase access to this request so they can offer an estimate.</span></label>',
  '<button type="submit" class="gef-profile-submit">Get Free Estimate →</button>',
  '<ul class="gef-profile-estimate-points"><li>Your request is free and without obligation.</li><li>This professional receives your request under GetEstimateFast rules.</li><li>Other eligible local professionals may also be matched.</li></ul>',
  '<p class="profile-privacy">No fee for customers. No guaranteed quote or job. We do not request marketing-text consent with this form.</p>',
  '</form>',
  '<div class="share-tools gef-profile-share" data-share-url="'+esc(url)+'" data-share-title="'+esc(p.display_name)+'"></div>',
  '</aside>'
 ].join(""):"";
 const reputation=average!==null
  ?'<div class="gef-profile-rating-block"><span class="gef-profile-rating-stars" aria-hidden="true">'+esc(stars(average))+'</span><strong>'+esc(average.toFixed(1))+'</strong><a href="#reviews">('+esc(reviewCount)+' '+(reviewCount===1?"review":"reviews")+')</a></div>'
  :'<div class="gef-profile-rating-block"><strong>New professional</strong><span>No approved reviews yet</span></div>';
 const badgeHtml=badgeItems.length?'<div class="gef-profile-ranking-badges">'+badgeItems.map(([label,type])=>'<span class="gef-profile-ranking-badge '+esc(type)+'">'+esc(label)+'</span>').join("")+'</div>':"";
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="same-origin"><title>${esc(title)}</title><meta name="description" content="${esc(p.headline||p.about.slice(0,160))}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="profile"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(p.headline||p.about.slice(0,160))}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><link rel="stylesheet" href="/assets/marketplace.css"><link rel="stylesheet" href="/assets/profile-request.css?v=20261028-003"></head><body class="gef-public-profile"><header class="gef-profile-topbar"><a class="gef-profile-brand" href="/">GetEstimate<span>Fast</span></a><span class="gef-profile-brand-divider"></span><strong>Find Local Professionals</strong><nav><a href="/services.html">Back to Search</a><a href="/">Home</a></nav></header><main class="gef-profile-page">
<section class="gef-profile-hero"${heroStyle}>
  <div class="gef-profile-hero-overlay"></div>
  <div class="gef-profile-avatar">${avatar}</div>
  <div class="gef-profile-identity">
    <span class="gef-profile-active">✓ Active GetEstimateFast Professional</span>
    <h1>${esc(p.display_name)}</h1>
    <p class="gef-profile-headline">${esc(p.headline||"Local service professional")}</p>
    ${reputation}
    ${badgeHtml}
    <div class="gef-profile-service-chips">${serviceChips||'<span class="gef-profile-service-chip">Services available on request</span>'}</div>
    <p class="gef-profile-location">⌖ ${esc(p.city)}, ${esc(p.state_code)} · Serving customers within ${esc(p.radius_miles)} miles</p>
    <div class="gef-profile-hero-actions">${requestButton}</div>
  </div>
</section>

<div class="gef-profile-layout">
  <div class="gef-profile-content">
    <nav class="gef-profile-section-nav" aria-label="Profile sections"><a href="#overview">Overview</a><a href="#recentWork">Recent Work</a><a href="#reviews">Reviews</a><a href="#about">About</a></nav>
    <section class="gef-profile-section" id="overview">
      <div class="gef-profile-section-heading"><p class="eyebrow">SERVICES</p><h2>Services Offered</h2></div>
      <div class="gef-profile-service-grid">${categories.map((service,index)=>'<div class="gef-profile-service-card"><span>'+(["⌂","▤","✦","⌁","▣","◇"][index%6])+'</span><strong>'+esc(service)+'</strong></div>').join("")||"<p>No services published yet.</p>"}</div>
    </section>

    <section class="gef-profile-section" id="about">
      <div class="gef-profile-section-heading"><p class="eyebrow">ABOUT</p><h2>About ${esc(p.display_name)}</h2></div>
      <p class="gef-profile-about">${esc(p.about||"This professional has not added an introduction yet.")}</p>
      <div class="gef-profile-facts">
        <div><span aria-hidden="true">⌖</span><p><strong>Service area</strong><small>${esc(p.city)}, ${esc(p.state_code)} · ${esc(p.radius_miles)} mile radius</small></p></div>
        <div><span aria-hidden="true">◉</span><p><strong>Languages</strong><small>${esc(languages.join(", ")||"Not specified")}</small></p></div>
        <div><span aria-hidden="true">✓</span><p><strong>Experience</strong><small>${p.years_experience!==null&&p.years_experience!==undefined?esc(p.years_experience)+" years":"Not specified"}</small></p></div>
      </div>
    </section>

    <section class="gef-profile-section" id="recentWork">
      <div class="gef-profile-section-heading gef-profile-section-row"><div><p class="eyebrow">PORTFOLIO</p><h2>Recent Work</h2></div><span>${portfolio.length} ${portfolio.length===1?"project":"projects"}</span></div>
      <div class="gef-profile-work-grid">${portfolioCards||'<div class="gef-profile-empty"><strong>No work photos published yet.</strong><p>This professional can add project photos from the Professional Portal.</p></div>'}</div>
    </section>

    <section class="gef-profile-section" id="reviews">
      <div class="gef-profile-section-heading"><p class="eyebrow">REPUTATION</p><h2>Customer Reviews</h2></div>
      <div class="gef-profile-reviews-summary">${average!==null?'<div><strong>'+esc(average.toFixed(1))+'</strong><span class="gef-profile-review-stars">'+esc(stars(average))+'</span><small>'+esc(reviewCount)+' approved '+(reviewCount===1?"review":"reviews")+'</small></div>':'<div><strong>New</strong><small>No approved reviews yet.</small></div>'}</div>
      <div class="gef-profile-review-grid">${reviewCards||'<div class="gef-profile-empty"><strong>No approved reviews yet.</strong><p>Reviews will appear here after approval.</p></div>'}</div>
    </section>
    <p class="notice gef-profile-legal">GetEstimateFast connects customers with independent professionals. We do not certify licenses, endorse providers or guarantee services. Review credentials and agree on scope, payment and terms directly with your provider.</p>
  </div>
  ${quoteForm}
</div>
<p id="publicMessage" role="status" aria-live="polite"></p>
</main><div class="gef-profile-lightbox" id="profileLightbox" hidden><button type="button" aria-label="Close image">×</button><img alt=""></div><script src="/assets/profile-sharing.js?v=20261028-003" defer></script><script src="/assets/public-profile-ui.js" defer></script></body></html>`;
}
module.exports={esc,profileHtml};