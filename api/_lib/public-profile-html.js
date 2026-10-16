"use strict";
const crypto=require("node:crypto");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function profileHtml(data,origin,storageOrigin,referral={}){
 const p=data.profile,url=origin+"/professionals/"+encodeURIComponent(p.slug),title=p.display_name+" | GetEstimateFast";
 const image=p.portfolio?.[0]?storageOrigin+"/storage/v1/object/public/gef-portfolio/"+p.portfolio[0].image_path:origin+"/assets/images/hero-home-improvement.jpg";
 const demo=referral.synthetic===true;
 const serviceOptions=(p.categories||[]).map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
 const requestButton=referral.token?'<a class="button" href="#requestEstimate">Request a Free Estimate</a>':"";
 const demoMessage=demo?'<p class="notice" role="note"><strong>Development test only.</strong> Use the prefilled synthetic details below. Do not enter a real customer name, phone or email.</p>':"";
 const quoteForm=referral.token?[
  '<section class="panel" id="requestEstimate" aria-labelledby="requestEstimateTitle">',
  '<p class="eyebrow">ESTIMATE REQUEST</p><h2 id="requestEstimateTitle">Request a Free Estimate from '+esc(p.display_name)+'</h2>',
  '<p>Tell us what you need. GetEstimateFast reviews the request first. This professional will receive your contact without charge after approval and publication. Other local professionals may also purchase access to your contact so they can offer an estimate. You are not obligated to hire anyone.</p>',
  demoMessage,
  '<form action="/api/profile-request" method="post" class="profile-quote-form" accept-charset="utf-8">',
  '<input type="hidden" name="profile_slug" value="'+esc(p.slug)+'">',
  '<input type="hidden" name="profile_token" value="'+esc(referral.token)+'">',
  '<input type="hidden" name="submission_token" value="'+esc(crypto.randomUUID())+'">',
  '<label class="request-honeypot" aria-hidden="true">Leave empty<input tabindex="-1" autocomplete="off" name="website"></label>',
  '<div class="profile-request-grid">',
  '<label>Service needed<select name="service" required>'+serviceOptions+'</select></label>',
  '<label>City<input name="city" required maxlength="80" autocomplete="address-level2" value="'+esc(p.city)+'"></label>',
  '<label>ZIP Code<input name="zip" pattern="[0-9]{5}" inputmode="numeric" maxlength="5" required value="'+esc(p.zip_code)+'"></label>',
  '<label>Your full name<input name="full_name" required minlength="2" maxlength="120" autocomplete="name" value="'+(demo?'TEST ONLY Customer':'')+'"></label>',
  '<label>Email<input type="email" name="email" maxlength="254" required autocomplete="email" value="'+(demo?'synthetic@example.invalid':'')+'"></label>',
  '<label>US phone number<input type="tel" name="phone" required autocomplete="tel" value="'+(demo?'8135550100':'')+'"></label>',
  '</div>',
  '<label class="profile-request-desc">Describe your project<textarea name="description" rows="4" required minlength="20" maxlength="2400" placeholder="What do you need done?">'+(demo?'TEST ONLY: Interior painting for one room in a synthetic QA scenario.':'')+'</textarea></label>',
  '<label class="profile-consent"><input type="checkbox" name="contact_consent" value="yes" required><span>I understand my contact details will be shared at no charge with this professional after approval and publication, and may also be shared with other local professionals who purchase access to this request.</span></label>',
  '<button type="submit">Send My Free Estimate Request</button>',
  '<p class="profile-privacy">No fee for customers. No guaranteed quote or job. We do not request marketing-text consent with this form.</p>',
  '</form></section>'
 ].join(""):"";
 const reviews=data.reviews||[];
 const s=data.review_summary;
 const reputation=s?`<p id="reviewSummary">${s.approved_count>0&&Number.isFinite(Number(s.average_rating))?esc(Number(s.average_rating).toFixed(1))+"/5 from "+esc(s.approved_count)+" approved "+(s.approved_count===1?"review":"reviews"):"No reviews yet"}</p>`:"";
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><meta name="description" content="${esc(p.headline||p.about.slice(0,160))}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="profile"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(p.headline||p.about.slice(0,160))}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><link rel="stylesheet" href="/assets/marketplace.css"><link rel="stylesheet" href="/assets/profile-request.css"></head><body><header class="topbar"><a href="/">GetEstimateFast</a><span>We Connect. You Decide.</span></header><main class="shell"><section class="panel"><p class="eyebrow">Independent local professional</p><h1>${esc(p.display_name)}</h1><p class="lead">${esc(p.headline)}</p><p>${esc(p.city)}, ${esc(p.state_code)} ${esc(p.zip_code)} · ${esc(p.radius_miles)} mile service radius</p><p>${esc(p.about)}</p><h2>Services</h2><p>${(p.categories||[]).map(esc).join(" · ")}</p><p>Languages: ${(p.languages||[]).map(esc).join(", ")||"Not specified"}</p><div class="actions">${requestButton}</div><div class="share-tools" data-share-url="${esc(url)}" data-share-title="${esc(p.display_name)}"></div></section>${quoteForm}<section class="panel"><h2>Recent work</h2><div class="card-grid">${(p.portfolio||[]).map(item=>`<article class="card"><img class="portfolio-image" loading="lazy" src="${esc(storageOrigin+"/storage/v1/object/public/gef-portfolio/"+item.image_path)}" alt="${esc(item.title)}"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p></article>`).join("")||"<p>No work photos published yet.</p>"}</div></section><section class="panel"><h2>Customer reviews</h2>${reputation}${reviews.map(r=>`<article class="card"><strong>${esc(r.display_name)} · ${esc(r.rating)}/5</strong><p>${esc(r.comment)}</p><small>${r.source==="external"?"External customer review":"Review from a platform contact; service completion is not verified"}</small><button type="button" class="secondary report-review" data-review-id="${esc(r.id)}">Report review</button></article>`).join("")||"<p>No approved reviews yet.</p>"}</section><p class="notice">GetEstimateFast connects customers with independent professionals. We do not certify licenses, endorse providers or guarantee services. Review credentials and agree on scope, payment and terms directly with your provider.</p><p id="publicMessage" role="status" aria-live="polite"></p></main><script src="/assets/profile-sharing.js" defer></script></body></html>`;
}
module.exports={esc,profileHtml};
