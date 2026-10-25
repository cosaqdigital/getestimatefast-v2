(()=>{"use strict";
const form=document.getElementById("reviewForm"),status=document.getElementById("reviewStatus"),submit=document.getElementById("submitReview"),profile=document.getElementById("reviewProfessional");
let token=location.hash.slice(1);
if(token&&!/^[A-Za-z0-9_-]{43}$/.test(token))token="";
if(location.hash)history.replaceState(null,"",location.pathname+location.search);
const say=(message,focus=false)=>{status.textContent=message;if(focus)status.focus();};
async function json(url,options){const r=await fetch(url,{...options,cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Review service temporarily unavailable.");return d;}
async function load(){
 if(!token){say("Open the exclusive review invitation shared by your professional.",true);return;}
 try{
  const data=await json("/api/reviews/session?token="+encodeURIComponent(token));
  profile.textContent="Review "+data.profile.display_name;
  form.hidden=false;
  say("Your email stays private. After submitting, check your inbox to confirm the review.");
 }catch(e){form.hidden=true;say(e.message,true);}
}
form.onsubmit=async e=>{
 e.preventDefault();submit.disabled=true;
 const f=new FormData(form);
 try{
  const data=await json("/api/reviews/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   token,
   display_name:f.get("display_name"),
   email:f.get("email"),
   rating:Number(f.get("rating")),
   comment:f.get("comment"),
   website:f.get("website"),
   consent:f.get("consent")==="on"
  })});
  form.reset();form.hidden=true;token="";
  say(data.message||"Check your email to confirm your review.",true);
 }catch(e){say(e.message,true);submit.disabled=false;}
};
load();
})();