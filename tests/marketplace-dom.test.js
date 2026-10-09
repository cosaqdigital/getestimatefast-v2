"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{setTimeout:delay}=require("node:timers/promises");
const {createSandbox}=require("../scripts/local-marketplace-sandbox");
async function until(predicate){for(let i=0;i<80;i++){if(predicate())return;await delay(100);}throw Error("DOM condition timed out");}
test("local DOM: contractor dashboard, categories, public profile, invitations, logout and admin",async()=>{
 const {JSDOM,VirtualConsole,requestInterceptor}=await import("jsdom");const s=await createSandbox();let dom,admin;const errors=[];
 // Every resource in these fixture pages is same-origin and served by the local sandbox.
 const options={resources:{interceptors:[requestInterceptor(req=>{if(!req.url.startsWith(s.origin+"/"))return new Response("External resources blocked in local test",{status:403});})]},runScripts:"dangerously",virtualConsole:new VirtualConsole().on("jsdomError",e=>errors.push(e.message)),beforeParse(w){w.fetch=(input,init)=>s.fetch(new URL(input,s.origin),init);}};
 try{
  dom=await JSDOM.fromURL(s.origin+"/contractor-portal.html",options);const w=dom.window,d=w.document;
  await until(()=>d.getElementById("publicProfileForm"));
  const login=d.getElementById("login");login.elements.email.value="contractor@example.invalid";login.elements.password.value="SyntheticTestOnly!";login.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await until(()=>d.getElementById("paidBalance").textContent==="$0.00"&&d.getElementById("opportunityCount").textContent==="1");
  assert.equal(d.getElementById("dashboardProfileStatus").textContent,"active");assert.equal(d.getElementById("categories").multiple,true);assert(d.getElementById("opportunityCards").textContent.includes("SYNTHETIC SANDBOX REQUEST"));
  const f=d.getElementById("publicProfileForm");f.elements.slug.value="synthetic-dom-profile";f.elements.published.checked=true;f.elements.languages.value="English";f.dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
  await until(()=>d.getElementById("profileShare").querySelector('a[href^="sms:"]'));
  const publicData=await (await s.fetch(s.origin+"/api/public-profile?slug=synthetic-dom-profile")).json();assert.equal(publicData.profile.display_name,"Synthetic Painting Business");
  d.getElementById("createReviewInvite").click();await until(()=>d.getElementById("reviewInviteShare").querySelector("input"));assert(d.getElementById("reviewInviteShare").querySelector("input").value.includes("/review.html#"));
  assert(d.getElementById("walletPanel").querySelector("button").disabled);d.getElementById("logout").click();assert(d.getElementById("workspace").hidden);assert.equal(d.getElementById("profileShare").textContent,"");assert.equal(d.getElementById("paidBalance").textContent,"—");
  admin=await JSDOM.fromURL(s.origin+"/marketplace-admin.html",options);const aw=admin.window,ad=aw.document;await until(()=>ad.getElementById("adminCategories").options.length>0);
  const form=ad.getElementById("adminLogin");form.elements.email.value="admin@example.invalid";form.elements.password.value="SyntheticTestOnly!";form.dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));await until(()=>!ad.getElementById("adminWorkspace").hidden);assert(ad.getElementById("adminMetrics").textContent.includes("public profiles"));
  assert.deepEqual(errors,[]);
 }finally{dom?.window.close();admin?.window.close();await s.close();}
});
