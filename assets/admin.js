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
function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = String(text);
  return n;
}
function reviewField(label, value) {
  const wrapper = node("div", "review-details");
  wrapper.append(node("strong", "", label + ": "), document.createTextNode(String(value == null ? "" : value)));
  return wrapper;
}
function checkboxReview(label) {
  const wrapper = node("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  wrapper.append(input, document.createTextNode(label));
  return { wrapper, input };
}
function renderLead(lead) {
  const card = node("article", "review-card");
  const top = node("div", "review-top");
  const head = node("div");
  head.append(node("h2", "", lead.service_type + " · " + lead.city + ", " + lead.zip_code),
    node("div", "review-muted", "Received: " + new Date(lead.created_at).toLocaleString()));
  top.append(head, node("span", "review-status", lead.status));
  card.append(top);

  const details = lead.details || {};
  const description = details["Project Description"] || details["Description"] || "No project description supplied.";
  const desc = node("p", "review-description", description);
  card.append(desc);
  const original = details._platform_review?.original_service || details["Service Type"] || lead.service_type;
  if (original !== lead.service_type) card.append(reviewField("Original category", original));
  for (const key of ["Project Type", "Project Intent", "Timeline", "Cleaning Type", "Cleaning Frequency", "Job Size"]) {
    if (details[key]) card.append(reviewField(key, details[key]));
  }
  card.append(node("p", "review-contact", lead.full_name + " · " + lead.phone + " · " + lead.email));
  if (lead.status !== "new") {
    card.append(node("div", "review-muted", "Reviewed. Status: " + lead.status + (lead.admin_note ? " · Note: " + lead.admin_note : "")));
    if (lead.status === "qualified") {
      const editor = node("div", "publish-editor");
      const title = node("label", "", "Public opportunity summary (20-1400 characters)");
      const summary = document.createElement("textarea");
      summary.rows = 3;
      summary.maxLength = 1400;
      summary.placeholder = "Describe the work without client name, phone, email, links or street address.";
      const confirmation = checkboxReview("I checked that this summary contains no personal contact details or exact address.");
      const publish = node("button", "approve", "Publish opportunity");
      publish.type = "button"; publish.disabled = true;
      const update = () => {publish.disabled = summary.value.trim().length < 20 || !confirmation.input.checked;};
      summary.addEventListener("input", update);confirmation.input.addEventListener("change", update);
      publish.addEventListener("click", async () => {
        publish.disabled = true;
        try {await api("publish-opportunity","POST",{id:lead.id,summary:summary.value,confirmReviewed:confirmation.input.checked});status("Opportunity published without customer contact details.");await load();}
        catch(e){status(e.message);update();}
      });
      editor.append(title,summary,confirmation.wrapper,publish);
      card.append(editor);
    } else if (lead.status === "published") {
      const withdraw = node("button", "secondary", "Withdraw opportunity");
      withdraw.type="button";
      withdraw.addEventListener("click",async()=>{
        if(!window.confirm("Hide this opportunity from contractors?"))return;
        withdraw.disabled=true;
        try{await api("withdraw-opportunity","POST",{id:lead.id,note:"Withdrawn by administrator"});status("Opportunity withdrawn.");await load();}
        catch(e){status(e.message);withdraw.disabled=false;}
      });
      card.append(withdraw);
    }
    return card;
  }

  const categoryLabel = node("label", "", "Service category (adjust if needed)");
  const category = document.createElement("select");
  category.setAttribute("aria-label", "Service category");
  const names = window.GetEstimateFastLaunch?.names || [];
  const all = names.includes(lead.service_type) ? names : [lead.service_type, ...names];
  for (const name of all) {
    const op = document.createElement("option");
    op.value = name;
    op.textContent = name === lead.service_type && !names.includes(name) ? name + " (original request)" : name;
    category.appendChild(op);
  }
  category.value = lead.service_type;
  const categoryWrap = node("div", "edit-row");
  categoryWrap.append(categoryLabel, category);
  card.append(categoryWrap);

  const checks = node("div", "review-checks");
  const contact = checkboxReview("Contact details reviewed");
  const scope = checkboxReview("Service description and category reviewed");
  checks.append(contact.wrapper, scope.wrapper);
  card.append(checks);

  const noteLabel = node("label", "", "Internal note (optional)");
  const note = document.createElement("textarea");
  note.rows = 2;
  note.maxLength = 1000;
  note.placeholder = "Only add a note when clarification is needed.";
  card.append(noteLabel, note);

  const footer = node("div", "review-footer");
  const approve = node("button", "approve", "Approve request");
  approve.type = "button";
  approve.disabled = true;
  const reject = node("button", "secondary", "Reject request");
  reject.type = "button";
  const hint = node("span", "review-muted", "Approval does not publish or send the contact.");
  const sync = () => { approve.disabled = !(contact.input.checked && scope.input.checked && category.value.trim()); };
  contact.input.addEventListener("change", sync);
  scope.input.addEventListener("change", sync);
  category.addEventListener("change", sync);
  approve.addEventListener("click", async () => {
    approve.disabled = true;
    reject.disabled = true;
    try {
      await api("approve-lead", "POST", {
        id: lead.id, category: category.value,
        contactReviewed: contact.input.checked,
        serviceReviewed: scope.input.checked,
        note: note.value
      });
      status("Request approved and marked qualified; it has not been published.");
      await load();
    } catch (error) {
      status(error.message);
      reject.disabled = false;
      sync();
    }
  });
  reject.addEventListener("click", async () => {
    if (!window.confirm("Reject this request? It will remain in the admin history.")) return;
    approve.disabled = true; reject.disabled = true;
    try {
      await api("status", "POST", {id:lead.id,status:"rejected",note:note.value});
      status("Request rejected and retained in the admin record.");
      await load();
    } catch (error) { status(error.message); reject.disabled = false; sync(); }
  });
  footer.append(approve, reject, hint);
  card.append(footer);
  return card;
}
async function load() {
  const params = new URLSearchParams({page:String(page)});
  if ($("filter").value) params.set("status", $("filter").value);
  const data = await api("leads?" + params);
  const body = $("rows"); body.replaceChildren();
  leadCount = data.leads.length;
  for (const lead of data.leads) body.appendChild(renderLead(lead));
  $("previous").disabled = page === 0;
  $("next").disabled = leadCount < 25;
  if (!leadCount) body.append(node("p", "review-muted", "No requests in this filter."));
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
