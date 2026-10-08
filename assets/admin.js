(function () {
"use strict";
const $ = id => document.getElementById(id);
let token = "", page = 0, leadCount = 0, contractorPage = 0, contractorHasMore = false;
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

function contractorCell(tr, value) {
  const td = document.createElement("td");
  td.textContent = String(value == null ? "" : value);
  tr.appendChild(td);
  return td;
}
async function loadContractors() {
  const params = new URLSearchParams({page: String(contractorPage)});
  if ($("contractorFilter").value) params.set("status", $("contractorFilter").value);
  const data = await api("contractors?" + params);
  const tbody = $("contractorRows");
  tbody.replaceChildren();
  contractorHasMore = Boolean(data.has_more);
  for (const p of data.contractors) {
    const tr = document.createElement("tr");
    contractorCell(tr, (p.business_name || p.display_name) + "\n" + p.display_name + "\n" + p.contact_email + "\n" + p.contact_phone);
    contractorCell(tr, p.city + ", " + p.state_code + " " + p.base_zip + "\n" + p.service_radius_miles + " miles\n" + (p.service_categories || []).join(", "));
    contractorCell(tr, "Status: " + p.account_status + "\nEmail verified: " + (p.email_verified_at ? "Yes" : "No") + "\nRegistered: " + new Date(p.created_at).toLocaleString());

    const review = document.createElement("td");
    const sel = document.createElement("select");
    for (const next of ["pending_review", "active", "suspended", "rejected"]) {
      const op = document.createElement("option"); op.value = next; op.textContent = next;
      op.selected = next === p.account_status; sel.appendChild(op);
    }
    if (p.account_status === "pending_review") sel.disabled = true;
    const note = document.createElement("textarea");
    note.rows = 2; note.maxLength = 1000; note.placeholder = "Required review reason (5+ characters)";
    const save = document.createElement("button"); save.textContent = "Save decision"; save.type = "button";
    save.disabled = p.account_status === "pending_review";
    save.addEventListener("click", async () => {
      if (note.value.trim().length < 5) { status("Enter a review reason (at least 5 characters)."); return; }
      if (sel.value === "active" && !["suspended", "rejected"].includes(p.account_status)) { status("New accounts are enabled automatically; no manual approval required."); return; }
      if (sel.value === "active" && !window.confirm("Reactivate this previously restricted account? This does not verify a trade license.")) return;
      save.disabled = true;
      try {
        await api("contractor-review", "POST", {user_id:p.user_id,status:sel.value,note:note.value});
        status("Contractor review saved."); await loadContractors();
      } catch(e) { status(e.message); } finally { save.disabled = false; }
    });
    const historyButton = document.createElement("button");
    historyButton.type = "button"; historyButton.className = "secondary"; historyButton.textContent = "History";
    const eventsDisplay = document.createElement("div"); eventsDisplay.hidden = true;
    historyButton.addEventListener("click", async () => {
      if (!eventsDisplay.hidden) { eventsDisplay.hidden=true; return; }
      try {
        const result = await api("contractor-history?user_id=" + encodeURIComponent(p.user_id));
        eventsDisplay.replaceChildren();
        if (!result.events.length) eventsDisplay.textContent = "No review history yet.";
        for (const e of result.events) {
          const line=document.createElement("p");
          line.textContent = new Date(e.created_at).toLocaleString() + ": " + (e.prior_status || "none") + " -> " + e.next_status + (e.note ? " (" + e.note + ")" : "");
          eventsDisplay.appendChild(line);
        }
        eventsDisplay.hidden=false;
      } catch(e) { status(e.message); }
    });
    review.append(sel, note, save, historyButton, eventsDisplay);
    tr.appendChild(review); tbody.appendChild(tr);
  }
  $("contractorPrevious").disabled = contractorPage===0;
  $("contractorNext").disabled = !contractorHasMore;
  if (!data.contractors.length) status("No contractors with this status.");
}
function showArea(area) {
  $("leadView").hidden = area !== "leads";
  $("contractorView").hidden = area !== "contractors";
  status("");
  if (area === "contractors") loadContractors().catch(e => status(e.message));
  else load().catch(e => status(e.message));
}
$("showLeads").addEventListener("click", () => showArea("leads"));
$("showContractors").addEventListener("click", () => showArea("contractors"));
$("contractorRefresh").addEventListener("click", () => loadContractors().catch(e => status(e.message)));
$("contractorFilter").addEventListener("change", () => {contractorPage=0;loadContractors().catch(e=>status(e.message));});
$("contractorPrevious").addEventListener("click", () => {if(contractorPage>0){contractorPage--;loadContractors().catch(e=>status(e.message));}});
$("contractorNext").addEventListener("click", () => {if(contractorHasMore){contractorPage++;loadContractors().catch(e=>status(e.message));}});

loggedIn(false);
})();
