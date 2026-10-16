(()=>{
"use strict";
const portal=window.GetEstimateFastPortal,home=document.getElementById("contractorDashboard");
if(!portal||!home)return;
const make=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
const section=make("section",undefined,"pro-my-origin-leads");
section.id="myProfileRequests";
section.append(make("h2","Requests from my public profile"),make("p","Share your public page to invite requests. Validated contacts from your own page are always free for you. The same opportunity may also be offered to other professionals.","muted"));
const content=make("div");content.id="myProfileRequestList";
const refresh=make("button","Refresh my profile requests","secondary");refresh.type="button";
section.append(refresh,content);home.append(section);
let generation=0,active=false;
function clear(){content.replaceChildren();}
async function load(){
 const g=generation;
 content.replaceChildren(make("p","Loading profile requests..."));
 try{
  const data=await portal.api("profile-origin-leads?action=list");
  if(!active||g!==generation)return;
  clear();
  if(!Array.isArray(data.requests)||data.requests.length===0){
   content.append(make("p","No requests from your profile yet. Copy and share your public profile link to get started.","muted"));return;
  }
  for(const request of data.requests){
   const card=make("article",undefined,"card");
   const title=make("h3",(request.service_type||"Service")+" · "+(request.city||"Florida"));
   const status=make("p","Status: "+request.status+" · Your cost: $0.00","muted");
   card.append(title,status);
   if(request.contact_available===true){
    const button=make("button","View my free contact","secondary");
    button.type="button";
    const detail=make("div");detail.setAttribute("aria-live","polite");
    button.onclick=async()=>{
     const clickGeneration=generation;
     button.disabled=true;detail.textContent="Checking verified contact...";
     try{
      const reply=await portal.api("profile-origin-leads?action=contact&id="+encodeURIComponent(request.lead_id));
      if(!active||clickGeneration!==generation)return;
      const c=reply.contact;if(!c||c.amount_cents!==0)throw Error("Contact unavailable.");
      detail.replaceChildren();
      for(const [label,value] of [["Customer",c.full_name],["Phone",c.phone],["Email",c.email],["Preferred contact",c.contact_method]]){
       const p=make("p",label+": "+(value||"Not provided"));detail.append(p);
      }
      detail.append(make("small","Free contact from your own public page. Only use these details for the customer's specific service request."));
     }catch(error){if(active&&clickGeneration===generation)detail.textContent=error.message;}
     finally{button.disabled=false;}
    };
    card.append(button,detail);
   }else{
    card.append(make("p","Your contact will be available here after the administrator validates the request.","muted"));
   }
   content.append(card);
  }
 }catch(error){if(active&&g===generation)content.replaceChildren(make("p","Profile requests are not available yet in this Development preview.","muted"));}
}
refresh.onclick=()=>{if(active)load();};
window.addEventListener("gef-signed-in",()=>{active=true;generation++;clear();});
window.addEventListener("gef-profile",()=>{if(active)load();});
window.addEventListener("gef-signed-out",()=>{active=false;generation++;clear();});
})();
