(function () {
"use strict";
const endpoint="/api/admin/production-password-reset";
const $=id=>document.getElementById(id);
let accessToken="",state="loading",cleared=false;

(function consume(){
 const fragment=window.location.hash;
 const hadQuery=Boolean(window.location.search);
 try{
  window.history.replaceState(null,"",window.location.pathname);
  cleared=!window.location.hash&&!window.location.search;
  if(!cleared||hadQuery||!fragment){state="expired";return;}
  const fields=new URLSearchParams(fragment.slice(1));
  const tokens=fields.getAll("access_token");
  const types=fields.getAll("type");
  const tokenTypes=fields.getAll("token_type");
  if(fields.has("error")||fields.has("error_code")||tokens.length!==1||types.length!==1||types[0]!=="recovery"||
     tokenTypes.length>1||(tokenTypes.length&&tokenTypes[0].toLowerCase()!=="bearer")){state="expired";return;}
  if(tokens[0].length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tokens[0])){state="expired";return;}
  accessToken=tokens[0];state="verify";
 }catch(_){accessToken="";state="expired";}
})();

function clearSecrets(){accessToken="";$("newPassword").value="";$("confirmPassword").value="";}
function show(next,message=""){
 state=next;$("resetApp").dataset.state=next;$("resetApp").setAttribute("aria-busy",String(["loading","saving"].includes(next)));
 $("status").textContent=message;
 $("unavailableView").hidden=next!=="unavailable";
 $("passwordForm").hidden=!["ready","saving"].includes(next);
 $("expiredView").hidden=next!=="expired";
 $("successView").hidden=next!=="success";
 $("passwordFields").disabled=next!=="ready"||!accessToken;
}
async function api(method,body){
 const response=await fetch(endpoint,{
  method,mode:"cors",credentials:"same-origin",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",
  headers:{Accept:"application/json",Authorization:"Bearer "+accessToken,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 let data={};try{data=await response.json();}catch(_){}
 if(!response.ok)throw {code:typeof data.code==="string"?data.code:"service_unavailable"};
 return data;
}
async function bootstrap(){
 if(!cleared||state==="expired"||!accessToken){clearSecrets();show("expired");return;}
 show("loading","Verifying your recovery link…");
 try{
  const data=await api("GET");
  if(data?.enabled!==true||data?.sessionValidated!==true||data?.recipient!=="admin@getestimatefast.com"){clearSecrets();show("expired");return;}
  show("ready");
 }catch(error){
  clearSecrets();
  if(["recovery_disabled","origin_not_allowed","access_denied"].includes(error?.code)){
   $("unavailableMessage").textContent="Administrator password reset is not available for this request.";show("unavailable");return;
  }
  show("expired");
 }
}
$("passwordForm").addEventListener("submit",async event=>{
 event.preventDefault();
 if(state!=="ready"||!accessToken)return;
 const password=$("newPassword").value,confirm=$("confirmPassword").value;
 $("passwordError").textContent="";
 if(password.length<8||password.length>256){$("passwordError").textContent="Use a password with 8–256 characters.";$("newPassword").focus();return;}
 if(password!==confirm){$("passwordError").textContent="The passwords do not match.";$("confirmPassword").focus();return;}
 show("saving","Updating your password…");
 const pending=api("POST",{password});
 $("newPassword").value="";$("confirmPassword").value="";
 try{
  const result=await pending;
  if(result?.ok!==true||result?.redirectPath!=="/admin.html")throw {code:"result_uncertain"};
  clearSecrets();show("success");
 }catch(error){
  clearSecrets();
  if(error?.code==="invalid_password"){
   $("passwordError").textContent="This password was not accepted. Request a new recovery link and choose another password.";
  }
  show("expired");
 }
});
window.addEventListener("pagehide",()=>{clearSecrets();});
void bootstrap();
})();