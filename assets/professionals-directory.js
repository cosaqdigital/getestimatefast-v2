(()=>{"use strict";
const form=document.getElementById("professionalSearch"),category=document.getElementById("professionalCategory"),city=document.getElementById("professionalCity"),zip=document.getElementById("professionalZip"),results=document.getElementById("professionalResults"),meta=document.getElementById("professionalResultsMeta"),empty=document.getElementById("professionalEmpty");
for(const item of window.GetEstimateFastLaunch.categories){const o=document.createElement("option");o.value=item.name;o.textContent=item.name;category.append(o);}
const stars=v=>"★★★★★".slice(0,Math.round(Number(v)||0))+"☆☆☆☆☆".slice(0,5-Math.round(Number(v)||0));
const badgeLabels={top_rated:"Top Rated",highly_rated:"Highly Rated",profile_complete:"Profile Complete",new_professional:"New Professional"};
function card(p){
 const a=document.createElement("article");a.className="pro-dir-card";
 const badges=Object.entries(p.badges||{}).filter(([,v])=>v===true).map(([k])=>'<span>'+badgeLabels[k]+'</span>').join("");
 const rating=p.average_rating==null?'<strong>New professional</strong>':'<strong>'+Number(p.average_rating).toFixed(1)+'</strong><span class="pro-dir-stars">'+stars(p.average_rating)+'</span><small>'+p.review_count+' '+(p.review_count===1?"review":"reviews")+'</small>';
 a.innerHTML='<div class="pro-dir-card-top"><div class="pro-dir-rank">#'+p.rank+'</div><div class="pro-dir-avatar">'+(p.display_name||"P").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()+'</div><div class="pro-dir-name"><h2></h2><p></p></div></div><div class="pro-dir-badges">'+badges+'</div><div class="pro-dir-rating">'+rating+'</div><div class="pro-dir-facts"><span>📍 '+p.city+', '+p.state_code+'</span><span>Serving up to '+p.radius_miles+' miles</span><span>'+p.portfolio_count+' portfolio '+(p.portfolio_count===1?"item":"items")+'</span></div><div class="pro-dir-actions"><a class="btn btn-secondary" href="/professionals/'+encodeURIComponent(p.slug)+'">View Profile</a><a class="btn btn-primary" href="/professionals/'+encodeURIComponent(p.slug)+'#requestEstimate">Request Estimate</a></div>';
 a.querySelector("h2").textContent=p.display_name;a.querySelector(".pro-dir-name p").textContent=p.headline||"Local service professional";return a;
}
async function search(){
 const qs=new URLSearchParams({category:category.value,limit:"20"});if(city.value.trim())qs.set("city",city.value.trim());if(zip.value.trim())qs.set("zip",zip.value.trim());
 meta.textContent="Searching local professionals…";results.replaceChildren();empty.hidden=true;
 const r=await fetch("/api/professionals?"+qs.toString(),{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Unable to load professionals.");
 const list=d.professionals||[];meta.textContent=list.length?list.length+" matching "+(list.length===1?"professional":"professionals")+" found. Results are ordered by GetEstimateFast ranking rules.":"";
 if(!list.length){empty.hidden=false;return;}for(const p of list)results.append(card(p));
}
form.addEventListener("submit",e=>{e.preventDefault();search().catch(err=>{meta.textContent=err.message;empty.hidden=true;});});
const q=new URLSearchParams(location.search),cat=q.get("category"),qcity=q.get("city"),qzip=q.get("zip");if(cat&&window.GetEstimateFastLaunch.names.includes(cat)){category.value=cat;if(qcity)city.value=qcity;if(qzip)zip.value=qzip;search().catch(err=>meta.textContent=err.message);}
})();