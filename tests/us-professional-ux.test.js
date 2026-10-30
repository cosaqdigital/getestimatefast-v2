"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
test("Independent professional UX loads after existing code",()=>{
 const h=read("contractor-portal.html");
 assert(h.indexOf("marketplace-portal.js")<h.indexOf("contractor-ux.js"));
 assert(h.includes("contractor-ux.css"));
});
test("Signed-in users never see account creation",()=>{
 assert.match(read("assets/contractor-portal.js"),/el\("register"\)\.hidden=b\|\|/);
});
test("Guided profile is two steps and preserves public profile privacy",()=>{
 const src=read("assets/contractor-ux.js");
 for(const s of ["Step 1 of 2","Step 2 of 2","Select the services","publicProfileForm","Private contacts are not published automatically."])assert(src.includes(s)||s==="Select the services"&&src.includes("Choose the services"));
 assert.match(src,/step2\.disabled=step!==2/);
 assert.match(src,/opt\.selected=input\.checked/);
});
test("One section at a time, all modules available",()=>{
 const src=read("assets/contractor-ux.js");
 for(const name of ["contractorDashboard","opportunityPanel","publicProfilePanel","accountSettingsPanel","walletPanel","purchasePanel"])assert(src.includes(name));
 assert.match(src,/section\.hidden=key!==dest/);
});
test("Preview blocks public signup and financial transactions",()=>{
 assert.match(read("api/contractor/signup.js"),/GETESTIMATEFAST_ISOLATED_BACKEND/);
 assert.match(read("api/_lib/marketplace-access.js"),/blockPayments/);
 assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled["feat/us-admin-overview-20261015"],false);
});


test("Opportunity browsing remains available when commercial actions are closed",()=>{
 const src=read("assets/contractor-ux.js");
 const set=src.match(/const commercialScreens=new Set\(\[(.*?)\]\);/)?.[1]||"";
 assert(!set.includes("opportunityPanel"));
 for(const locked of ["walletPanel","purchasePanel"])assert(set.includes(locked));
 const portal=read("assets/contractor-portal.js");
 assert(portal.includes('get("opportunity")'));
 assert(portal.includes('details.hidden=Boolean(!directOpportunity)'));
 assert(portal.includes("This opportunity is unavailable or does not match your professional profile."));
});


test("SMS deep links use a focused mobile opportunity detail view",()=>{
 const portal=read("assets/contractor-portal.js");
 const ux=read("assets/contractor-ux.js");
 const css=read("assets/contractor-ux.css");
 const html=read("contractor-portal.html");
 for(const required of [
  "pro-opportunity-direct",
  "pro-opportunity-direct-card",
  "pro-opportunity-direct-head",
  "← Back to Opportunities",
  'url.searchParams.delete("opportunity")',
  "gef-opportunity-direct-exit",
  'details.hidden=Boolean(!directOpportunity)'
 ])assert(portal.includes(required),required);
 assert(ux.includes("const isDirectOpportunity="));
 assert(ux.includes('const destination=direct?"opportunityPanel"'));
 assert(ux.includes('nav.hidden=hasProfile!==true||direct'));
 for(const required of [
  "#opportunityPanel>.columns",
  "#opportunityPanel>.form-grid",
  ".pro-opportunity-direct-card",
  ".pro-contact-unavailable:disabled"
 ])assert(css.includes(required),required);
 assert(html.includes("/assets/contractor-portal.js?v=20261030-011"));
 assert(html.includes("/assets/contractor-ux.js?v=20261030-011"));
 assert(html.includes("/assets/contractor-ux.css?v=20261030-011"));
});
