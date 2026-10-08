(function () {
"use strict";
const $ = id => document.getElementById(id);
let token = "", page = 0, leadCount = 0;
const status = text => { $("status").textContent = text; };
const loggedIn = yes => { $("login").hidden = yes; $("dashboard").hidden = !yes; $("logout").hidden = !yes; };
async function api(path, method = "GET", body) {
  const response = await fetch("/api/admin/" + path, { method, credentials:"same-origin", cache:"no-store",
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type":"application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) { if ([401,403].includes(response.status) && token) { token = ""; loggedIn(false); }
    throw new Error(data.error || "Request failed"); }
  return data;
}
async function load() {
  const params = new URLSearchParams({page:String(page)});
  if ($("filter").value) params.set("status",$("filter").value);
  const data = await api("leads?" + params);
  const body = $("rows"); body.replaceChildren(); leadCount = data.leads.length;
  for (const lead of data.leads) {
    const tr = document.createElement("tr");
    const cell = text => { const td = document.createElement("td"); td.textContent = text; tr.appendChild(td); return td; };
    cell(new Date(lead.created_at).toLocaleString());
    cell(lead.service_type + " · " + lead.city + ", " + lead.zip_code + (lead.details?.["Project Description"] ? "\n" + lead.details["Project Description"] : ""));
    cell(lead.full_name + "\n" + lead.email + "\n" + lead.phone);
    cell(lead.status);
    const action = document.createElement("td");
    const select = document.createElement("select");
    for (const s of ["new","qualified","published","closed","rejected"]) {
      const opt=document.createElement("option"); opt.value=s; opt.textContent=s; opt.selected=s===lead.status;select.appendChild(opt);
    }
    const note=document.createElement("textarea");note.rows=2; note.maxLength=1000; note.placeholder="Internal note (optional)";
    const save=document.createElement("button");save.textContent="Save";
    save.addEventListener("click",async()=>{
      save.disabled=true;
      try{await api("status","POST",{id:lead.id,status:select.value,note:note.value});status("Updated.");await load();}
      catch(e){status(e.message);}finally{save.disabled=false;}
    });
    action.append(select,note,save);tr.appendChild(action);body.appendChild(tr);
  }
  $("previous").disabled=page===0;$("next").disabled=leadCount<25;
  if(!leadCount) status("No requests on this page.");
}
$("loginForm").addEventListener("submit",async event=>{
  event.preventDefault(); status("Signing in...");
  try{
    const d=await api("login","POST",{email:$("email").value,password:$("password").value});
    token=d.access_token; $("password").value="";loggedIn(true);page=0;status("");await load();
  }catch(e){status(e.message);}
});
$("logout").addEventListener("click",()=>{token="";loggedIn(false);status("Signed out. Note: existing token expires automatically.");});
$("refresh").addEventListener("click",()=>load().catch(e=>status(e.message)));
$("filter").addEventListener("change",()=>{page=0;load().catch(e=>status(e.message));});
$("previous").addEventListener("click",()=>{if(page){page--;load().catch(e=>status(e.message));}});
$("next").addEventListener("click",()=>{if(leadCount===25){page++;load().catch(e=>status(e.message));}});
loggedIn(false);
})();
