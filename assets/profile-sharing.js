(()=>{"use strict";
function render(box){
 if(box.dataset.rendered)return;box.dataset.rendered="true";
 const url=box.dataset.shareUrl,title=box.dataset.shareTitle||"GetEstimateFast";
 const button=document.createElement("button");
 button.type="button";button.className="secondary gef-share-profile-button";button.textContent="Share profile";
 button.onclick=async()=>{
  try{
   if(navigator.share){await navigator.share({title,url,text:title});return;}
   await navigator.clipboard.writeText(url);
   const previous=button.textContent;button.textContent="Profile link copied";
   window.setTimeout(()=>{button.textContent=previous;},1800);
  }catch(error){
   if(error?.name==="AbortError")return;
   try{
    const input=document.createElement("textarea");input.value=url;input.setAttribute("readonly","");input.style.position="fixed";input.style.opacity="0";document.body.append(input);input.select();document.execCommand("copy");input.remove();button.textContent="Profile link copied";window.setTimeout(()=>{button.textContent="Share profile";},1800);
   }catch{button.textContent="Copy profile link";button.onclick=()=>window.prompt("Copy this profile link:",url);}
  }
 };
 box.append(button);
}
window.GetEstimateFastSharing={render};document.querySelectorAll(".share-tools").forEach(render);
for(const button of document.querySelectorAll(".report-review"))button.onclick=()=>{
 const dialog=document.createElement("dialog"),form=document.createElement("form"),heading=document.createElement("h2");dialog.className="review-report-dialog";heading.textContent="Report this review";heading.id="reviewReportHeading";dialog.setAttribute("aria-labelledby",heading.id);
 dialog.addEventListener("close",()=>{dialog.remove();button.focus();},{once:true});
 const emailLabel=document.createElement("label");emailLabel.textContent="Your email (kept private)";const email=document.createElement("input");email.type="email";email.required=true;emailLabel.append(email);
 const reasonLabel=document.createElement("label");reasonLabel.textContent="Reason";const reason=document.createElement("textarea");reason.required=true;reason.minLength=10;reason.maxLength=1000;reasonLabel.append(reason);
 const send=document.createElement("button");send.textContent="Submit report";const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.className="secondary";cancel.onclick=()=>dialog.close();
 const status=document.createElement("p");status.setAttribute("role","status");status.setAttribute("aria-live","polite");form.append(heading,emailLabel,reasonLabel,send,cancel,status);dialog.append(form);document.body.append(dialog);dialog.showModal();email.focus();
 form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{const response=await fetch("/api/public-profile?action=report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review_id:button.dataset.reviewId,email:email.value,reason:reason.value})});const result=await response.json();if(!response.ok)throw Error(result.error||"Report could not be submitted");status.textContent="Report received for administrative review.";email.value="";}catch(e){status.textContent=e.message;}finally{send.disabled=false;}};
};
})();
