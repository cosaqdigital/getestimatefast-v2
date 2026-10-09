(()=>{"use strict";
function render(box){
 if(box.dataset.rendered)return;box.dataset.rendered="true";
 const url=box.dataset.shareUrl,title=box.dataset.shareTitle||"GetEstimateFast",message=title+": "+url;
 const input=document.createElement("input");input.value=url;input.readOnly=true;input.setAttribute("aria-label","Shareable link");box.append(input);
 const copy=document.createElement("button");copy.type="button";copy.className="secondary";copy.textContent="Copy link";copy.onclick=async()=>{try{await navigator.clipboard.writeText(url);copy.textContent="Link copied";}catch{input.select();copy.textContent="Select and copy the link";}};box.append(copy);
 for(const [label,href] of [["WhatsApp","https://wa.me/?text="+encodeURIComponent(message)],["Facebook","https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url)],["SMS","sms:?body="+encodeURIComponent(message)],["Email","mailto:?subject="+encodeURIComponent(title)+"&body="+encodeURIComponent(message)]]){
  const a=document.createElement("a");a.textContent=label;a.href=href;a.className="button secondary";if(href.startsWith("https:")){a.target="_blank";a.rel="noopener noreferrer";}box.append(a);
 }
 if(navigator.share){const button=document.createElement("button");button.type="button";button.textContent="Share";button.onclick=async()=>{try{await navigator.share({title,url,text:title});}catch{/* User cancellation leaves the link available. */}};box.append(button);}
}
window.GetEstimateFastSharing={render};document.querySelectorAll(".share-tools").forEach(render);
for(const button of document.querySelectorAll(".report-review"))button.onclick=()=>{
 const dialog=document.createElement("dialog"),form=document.createElement("form"),heading=document.createElement("h2");heading.textContent="Report this review";
 const emailLabel=document.createElement("label");emailLabel.textContent="Your email (kept private)";const email=document.createElement("input");email.type="email";email.required=true;emailLabel.append(email);
 const reasonLabel=document.createElement("label");reasonLabel.textContent="Reason";const reason=document.createElement("textarea");reason.required=true;reason.minLength=10;reason.maxLength=1000;reasonLabel.append(reason);
 const send=document.createElement("button");send.textContent="Submit report";const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.className="secondary";cancel.onclick=()=>{dialog.close();dialog.remove();};
 const status=document.createElement("p");status.setAttribute("role","status");form.append(heading,emailLabel,reasonLabel,send,cancel,status);dialog.append(form);document.body.append(dialog);dialog.showModal();
 form.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{const response=await fetch("/api/public-profile?action=report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review_id:button.dataset.reviewId,email:email.value,reason:reason.value})});const result=await response.json();if(!response.ok)throw Error(result.error||"Report could not be submitted");status.textContent="Report received for administrative review.";email.value="";}catch(e){status.textContent=e.message;}finally{send.disabled=false;}};
};
})();
