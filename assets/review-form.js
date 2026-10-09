(()=>{"use strict";const token=location.hash.slice(1),form=document.getElementById("reviewForm"),status=document.getElementById("reviewStatus"),button=document.getElementById("submitReview");
if(!/^[A-Za-z0-9_-]{43}$/.test(token)){form.hidden=true;status.textContent="Open the exclusive review invitation shared by your professional.";return;}
// Keep the invitation in memory; remove it from the visible address and history entry.
history.replaceState(null,"",location.pathname);
form.onsubmit=async e=>{e.preventDefault();button.disabled=true;const f=new FormData(form);try{const response=await fetch("/api/public-profile?action=review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,display_name:f.get("display_name"),email:f.get("email"),rating:Number(f.get("rating")),comment:f.get("comment"),website:f.get("website"),consent:f.get("consent")==="on"})});const data=await response.json();if(!response.ok)throw Error(data.error||"Review submission failed");form.reset();form.hidden=true;status.textContent="Thank you. Your review is pending administrative moderation.";}catch(e){status.textContent=e.message;button.disabled=false;}};
})();
