(()=>{"use strict";
const params=new URLSearchParams(location.search),result=params.get("result"),slug=params.get("profile"),title=document.getElementById("reviewConfirmTitle"),message=document.getElementById("reviewConfirmMessage"),link=document.getElementById("reviewProfileLink");
if(result==="success"){title.textContent="Email confirmed";message.textContent="Thank you. Your review has been verified and is now pending GetEstimateFast moderation before it can appear publicly.";}
else if(result==="expired"){title.textContent="Confirmation link expired";message.textContent="This confirmation link has expired. Ask the professional for a new review invitation and submit the review again.";}
else if(result==="invalid"){title.textContent="Invalid confirmation link";message.textContent="This confirmation link is invalid or unavailable.";}
else{title.textContent="We couldn't confirm the review";message.textContent="Please try the confirmation link again or request a new review invitation.";}
if(slug&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){link.href="/professionals/"+encodeURIComponent(slug);link.hidden=false;}
})();