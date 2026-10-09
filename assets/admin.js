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
    const reviewed = details._platform_review;
    const completeReview = reviewed?.review_status === "approved" && reviewed?.contact_reviewed === true && reviewed?.scope_reviewed === true && reviewed?.approved_category === lead.service_type;
    if (lead.status === "qualified" && !completeReview) {
      const panel=node("div","review-card");
      panel.append(node("strong","","Legacy request: reconfirm before publishing"));
      panel.append(node("p","review-muted","This request was previously qualified but is missing the current review checks. Confirm both items here without changing the original description."));
      const label=node("label","","Service category (change only if needed)");
      const category=document.createElement("select");
      const names=window.GetEstimateFastLaunch?.names||[];
      for(const name of (names.includes(lead.service_type)?names:[lead.service_type,...names])){
        const opt=document.createElement("option");opt.value=name;opt.textContent=name;category.append(opt);
      }
      category.value=lead.service_type;
      const c1=checkboxReview("Customer contact reviewed");
      const c2=checkboxReview("Service description and category reviewed");
      const noteLabel=node("label","","Internal note (optional)");
      const note=document.createElement("textarea");note.rows=2;note.maxLength=1000;
      note.placeholder="Add a note only if necessary";
      const submit=node("button","approve","Reconfirm review");
      submit.type="button";submit.disabled=true;
      const update=()=>{submit.disabled=!(c1.input.checked&&c2.input.checked&&category.value.trim());};
      c1.input.addEventListener("change",update);c2.input.addEventListener("change",update);category.addEventListener("change",update);
      submit.addEventListener("click",async()=>{
        submit.disabled=true;
        try {
          await api("reconfirm-legacy-lead","POST",{id:lead.id,category:category.value,contactReviewed:c1.input.checked,serviceReviewed:c2.input.checked,note:note.value});
          status("Legacy review confirmed. The request has not been published.");await load();
        }catch(error){status(error.message);update();}
      });
      panel.append(label,category,c1.wrapper,c2.wrapper,noteLabel,note,submit);
      card.append(panel);
      return card;
    }
    if (lead.status === "qualified" || lead.status === "published") {
      const matches = node("div", "review-details", "Find matching professionals by ZIP radius and service");
      const show = node("button", "secondary", "Check professionals in range");
      show.type="button";
      const output=node("div","review-details");
      show.addEventListener("click",async()=>{
        show.disabled=true;output.textContent="Checking service area...";
        try {
          const d=await api("matching-candidates?id="+encodeURIComponent(lead.id));
          output.replaceChildren();
          output.append(node("strong","",d.candidates.length+" matching professionals"));
          if(lead.status==="published")output.append(node("p","review-muted","Rounds used: "+d.round_count+" / 5 · each round may select up to five new professionals."));
          const selections=[];
          const save=node("button","approve","Record selected professionals");
          save.type="button"; save.disabled=true;
          const update=()=>{save.disabled=selections.filter(i=>i.input.checked).length<1||d.remaining_rounds===0;};
          for(const p of d.candidates){
            const item=checkboxReview(p.display_name+" · "+p.city+" · "+p.base_zip+" · "+p.distance_miles+" mi (radius "+p.service_radius_miles+" mi)"+(p.already_selected?" · Previously selected":""));
            item.input.disabled=p.already_selected||lead.status!=="published"||d.remaining_rounds===0;
            item.input.addEventListener("change",()=>{
              if(selections.filter(i=>i.input.checked).length>5){item.input.checked=false;status("Select no more than five professionals per round.");}
              update();
            });
            selections.push({...item,id:p.user_id});output.append(item.wrapper);
          }
          if(lead.status==="published"){
            save.addEventListener("click",async()=>{
              const selected=selections.filter(i=>i.input.checked).map(i=>i.id);
              if(!selected.length||selected.length>5)return;
              save.disabled=true;
              try{
                const recorded=await api("record-matching-round","POST",{leadId:lead.id,contractorIds:selected});
                status("Round "+recorded.result.round_number+" saved ("+recorded.result.selected_count+" professionals). No notifications sent.");
                show.click();
              }catch(err){status(err.message);update();}
            });
            output.append(save,node("p","review-muted","This only records a selection. It does not send SMS, email or customer contacts."));
          }
          if(d.unresolved_zip)output.append(node("p","review-muted","ZIP not recognized: review location manually."));
        }catch(error){output.textContent=error.message;}finally{show.disabled=false;}
      });
      card.append(matches,show,output);
    }
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
      const simulate=node("button","secondary","Simulate SMS notifications (no sending)");
      simulate.type="button";
      simulate.addEventListener("click",async()=>{
        simulate.disabled=true;
        try{const result=await api("simulate-sms","POST",{leadId:lead.id});status("SMS simulation: "+result.selected+" selected, "+result.recorded+" new records, 0 messages sent.");}
        catch(e){status(e.message);}finally{simulate.disabled=false;}
      });
      card.append(simulate);
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
