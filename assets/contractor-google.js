(()=>{"use strict";
const el=id=>document.getElementById(id);
const portal=()=>window.GetEstimateFastPortal;
const say=message=>portal()?.say?.(message);
async function start(mode,data={}){
 const p=portal();if(!p)return;
 say("Opening Google sign-in...");
 try{
  const result=await p.api("google-start","POST",{mode,...data});
  if(!result?.redirect)throw Error("Google sign-in could not be started.");
  location.assign(result.redirect);
 }catch(e){say(e.message||"Google sign-in could not be started.");}
}
function installLogin(){
 const auth=el("auth"),form=el("login");if(!auth||!form||el("googleLogin"))return;
 const button=document.createElement("button");button.type="button";button.id="googleLogin";button.className="secondary";button.textContent="Continue with Google";
 button.addEventListener("click",()=>start("login"));
 const divider=document.createElement("p");divider.textContent="or sign in with email and password";divider.style.textAlign="center";
 auth.insertBefore(button,form);auth.insertBefore(divider,form);
}
function check(label,input,text){
 const wrap=document.createElement("label");wrap.className="check";wrap.htmlFor=input.id;
 wrap.append(input,document.createTextNode(text));return wrap;
}
function installSignup(){
 const register=el("register");if(!register||el("googleSignupPanel"))return;
 const panel=document.createElement("div");panel.id="googleSignupPanel";panel.className="flag";
 const title=document.createElement("strong");title.textContent="Create your professional account with Google";
 const intro=document.createElement("p");intro.textContent="Enter your mobile number, choose your SMS preference, accept the required policies, then continue with Google.";
 const phoneLabel=document.createElement("label");phoneLabel.textContent="Mobile phone";
 const phone=document.createElement("input");phone.id="googleSignupPhone";phone.type="tel";phone.autocomplete="tel";phone.placeholder="e.g. (813) 555-0123";phone.required=true;phoneLabel.append(phone);
 const privacy=document.createElement("input");privacy.id="googleSignupPrivacy";privacy.type="checkbox";
 const terms=document.createElement("input");terms.id="googleSignupTerms";terms.type="checkbox";
 const sms=document.createElement("input");sms.id="googleSignupSms";sms.type="checkbox";
 const privacyRow=check("privacy",privacy,"I agree to the GetEstimateFast Privacy Policy.");
 const termsRow=check("terms",terms,"I accept the GetEstimateFast Terms of Use.");
 const smsRow=check("sms",sms,"I agree to receive optional SMS about matching opportunities and account-related support. Message and data rates may apply. Reply STOP to opt out.");
 const button=document.createElement("button");button.type="button";button.id="googleSignup";button.className="secondary";button.textContent="Create account with Google";
 button.addEventListener("click",()=>{
  if(!phone.reportValidity())return;
  if(!privacy.checked||!terms.checked){say("Accept the Privacy Policy and Terms of Use to continue.");return;}
  start("signup",{phone:phone.value,privacyConsent:true,termsConsent:true,smsOptIn:sms.checked});
 });
 const divider=document.createElement("p");divider.textContent="or create an account with email and password";divider.style.textAlign="center";
 panel.append(title,intro,phoneLabel,privacyRow,termsRow,smsRow,button);
 register.insertBefore(panel,register.firstChild?.nextSibling||register.firstChild);register.insertBefore(divider,register.querySelector("form"));
}
function hydrate(data){
 const workspace=el("workspace"),auth=el("auth"),register=el("register");
 if(auth)auth.hidden=true;if(register)register.hidden=true;if(workspace)workspace.hidden=false;
 window.dispatchEvent(new CustomEvent("gef-signed-in"));
 const categories=el("categories");if(categories&&Array.isArray(data.categories)){
  categories.replaceChildren();for(const name of data.categories){const o=document.createElement("option");o.value=name;o.textContent=name;categories.append(o);}
 }
 const profile=data.profile;
 const sms=el("smsOptIn");if(sms)sms.checked=profile?.sms_opt_in===true||(!profile&&data.signup_defaults?.sms_opt_in===true);
 const form=el("profile");
 if(form&&profile){
  for(const [key,value] of Object.entries(profile)){
   const field=form.elements.namedItem(key);if(!field||field.type==="checkbox")continue;
   if(key==="service_categories"){for(const option of field.options)option.selected=Array.isArray(value)&&value.includes(option.value);}
   else field.value=value??"";
  }
 }else if(form&&data.signup_defaults?.contact_phone){
  const phone=form.elements.namedItem("contact_phone");if(phone&&!phone.value)phone.value=data.signup_defaults.contact_phone;
 }
 window.dispatchEvent(new CustomEvent("gef-profile",{detail:data}));
}
async function resume(){
 const state=new URLSearchParams(location.search).get("google");if(!state)return;
 try{history.replaceState(null,"",location.pathname+location.hash);}catch{}
 if(state==="needs_signup"){installSignup();if(el("register"))el("register").hidden=false;say("This Google account is not linked to a professional account yet. Create your professional account with Google.");return;}
 if(state!=="success"){say("Google sign-in was canceled or could not be completed.");return;}
 try{
  const data=await portal().api("profile");
  hydrate(data);
  const p=data.profile,ready=Boolean(p?.account_status==="active"&&p.base_zip&&p.contact_phone&&p.service_categories?.length);
  if(ready){await portal().loadOpportunities();say("Signed in with Google.");}
  else say("Signed in with Google. Complete your business profile to continue.");
 }catch(e){say(e.message||"Google sign-in could not be completed.");}
}
document.addEventListener("DOMContentLoaded",()=>{installLogin();installSignup();resume();});
const logout=el("logout");
if(logout)logout.addEventListener("click",()=>fetch("/api/contractor/google-logout",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"}).catch(()=>{}),true);
})();