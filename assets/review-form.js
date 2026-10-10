(()=>{"use strict";
const form=document.getElementById("reviewForm"),status=document.getElementById("reviewStatus"),submit=document.getElementById("submitReview"),login=document.getElementById("googleReviewLogin"),logout=document.getElementById("reviewLogout"),profile=document.getElementById("reviewProfessional");
let token=location.hash.slice(1),csrf="";
if(token&&!/^[A-Za-z0-9_-]{43}$/.test(token))token="";
if(location.hash)history.replaceState(null,"",location.pathname+location.search);
const say=(message,focus=false)=>{status.textContent=message;if(focus)status.focus();};
async function api(path,body){const r=await fetch("/api/reviews/"+path,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify({...body,csrf}):undefined,cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Review service temporarily unavailable.");return d;}
async function refresh(){const s=await api("session");csrf=s.csrf;profile.textContent=s.profile&&!token?"Review "+s.profile.display_name:"";const ready=s.authenticated&&s.profile&&!token;form.hidden=!ready;login.hidden=Boolean(ready);logout.hidden=!s.authenticated;login.disabled=!token&&!s.profile;if(!token&&!s.profile)say("Open the exclusive review invitation shared by your professional.");else if(new URLSearchParams(location.search).get("auth")==="cancelled")say("Google sign-in was not completed. You can try again.");else say(ready?"Your email stays private. Choose the name you want to publish.":"Continue with Google to leave your review. No password or additional signup is required.");}
login.onclick=async()=>{login.disabled=true;try{const s=await api("auth-start",token?{token}:{});location.assign(s.redirect);}catch(e){say(e.message,true);login.disabled=false;}};
logout.onclick=async()=>{logout.disabled=true;try{await api("logout",{});await refresh();say("Signed out. Continue with Google to choose an account.");}catch(e){say(e.message,true);}finally{logout.disabled=false;}};
form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;const f=new FormData(form);try{await api("submit",{display_name:f.get("display_name"),rating:Number(f.get("rating")),comment:f.get("comment"),website:f.get("website"),consent:f.get("consent")==="on"});form.reset();form.hidden=true;login.hidden=true;say("Thank you. Your review is pending administrative moderation.",true);}catch(e){say(e.message,true);submit.disabled=false;}};
refresh().catch(e=>{form.hidden=true;login.disabled=true;say(e.message);});
})();
